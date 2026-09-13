#!/usr/bin/env python3
"""Prepare CC0 Poly Haven garden assets; run with system Python (NumPy/SciPy).

Downloads are cached outside public/. Blender performs material-aware mesh
decimation and glTF export, so the deployed GLBs need no compression decoder.
"""
from pathlib import Path
import concurrent.futures
import copy
import hashlib
import json
import os
import shutil
import struct
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("GARDEN_SOURCE_CACHE", "/tmp/wanderwise-garden-source"))
OUTPUT = ROOT / "public/models/garden"
ASSETS = ("tree_small_02", "fern_02", "flower_heliophila")
OPTIONS = json.loads((ROOT / "scripts/garden-asset-options.json").read_text())


def canopy_gain(height):
    """Gradually spread bough locations while leaving the root in place."""
    start, end = OPTIONS["canopySpreadStartHeight"], OPTIONS["canopySpreadFullHeight"]
    t = max(0.0, min(1.0, (height - start) / (end - start)))
    return 1 + (OPTIONS["canopySpread"] - 1) * t * t * (3 - 2 * t)


def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "WanderwiseAssetPreparation/1.0"})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def download(path, metadata):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest() != metadata["md5"]:
        with urllib.request.urlopen(metadata["url"]) as response:
            path.write_bytes(response.read())
    assert hashlib.md5(path.read_bytes()).hexdigest() == metadata["md5"], path


def prepare_sources():
    jobs = []
    for name in ASSETS:
        files = fetch_json(f"https://api.polyhaven.com/files/{name}")
        source = files["gltf"]["1k"]["gltf"]
        directory = CACHE / name
        directory.mkdir(parents=True, exist_ok=True)
        alpha_key = next(key for key in files if "alpha" in key.lower())
        alpha = files[alpha_key]["1k"]["png"]
        manifest = {"source": source, "alpha": alpha,
                    "info": fetch_json(f"https://api.polyhaven.com/info/{name}")}
        (directory / "manifest.json").write_text(json.dumps(manifest, indent=2))
        jobs.append((directory / f"{name}_1k.gltf", source))
        jobs.extend((directory / path, meta) for path, meta in source["include"].items())
        jobs.append((directory / "alpha.png", alpha))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(lambda task: download(*task), jobs))


def thin_tree_canopy():
    """Keep distributed complete leaf islands before decimation, never random faces."""
    import numpy as np
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components

    source_dir = CACHE / "tree_small_02"
    document = json.loads((source_dir / "tree_small_02_1k.gltf").read_text())
    binary = (source_dir / document["buffers"][0]["uri"]).read_bytes()
    dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
    size = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

    def read_accessor(index):
        accessor = document["accessors"][index]
        view = document["bufferViews"][accessor["bufferView"]]
        offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        return np.frombuffer(binary, dtype=dtype[accessor["componentType"]],
                             count=accessor["count"] * size[accessor["type"]],
                             offset=offset).reshape(-1, size[accessor["type"]])

    output = copy.deepcopy(document)
    output.update(accessors=[], bufferViews=[], meshes=[], nodes=[], scenes=[{"nodes": []}])
    chunks = bytearray()

    def write_accessor(array, component_type, kind):
        while len(chunks) % 4:
            chunks.append(0)
        offset = len(chunks)
        data = np.ascontiguousarray(array).tobytes()
        chunks.extend(data)
        view = len(output["bufferViews"])
        output["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(data)})
        result = {"bufferView": view, "componentType": component_type, "count": len(array), "type": kind}
        if kind == "VEC3":
            result.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        output["accessors"].append(result)
        return len(output["accessors"]) - 1

    names = ("star_tree_branches", "star_tree_leaves", "star_tree_trunk")
    for part, primitive in enumerate(document["meshes"][0]["primitives"]):
        triangles = read_accessor(primitive["indices"]).reshape(-1, 3)
        if part == 1:
            count = document["accessors"][primitive["attributes"]["POSITION"]]["count"]
            pairs = np.concatenate((triangles[:, [0, 1]], triangles[:, [1, 2]]))
            adjacency = coo_matrix((np.ones(len(pairs), dtype=np.uint8), (pairs[:, 0], pairs[:, 1])),
                                   shape=(count, count))
            component_count, components = connected_components(adjacency, directed=False)
            ids = components[triangles[:, 0]].astype(np.uint64)
            # A stable integer hash distributes retained leaves through the crown.
            keep = ((ids * 2654435761 + 12013) % 4294967296) / 4294967296 < OPTIONS["leafIslandRetention"]
            triangles = triangles[keep]
            positions = read_accessor(primitive["attributes"]["POSITION"])
            sizes = np.bincount(components, minlength=component_count)
            centers = np.stack([np.bincount(components, weights=positions[:, axis], minlength=component_count)
                                / np.maximum(sizes, 1) for axis in range(3)], axis=1)
            gains = np.array([canopy_gain(point[1]) for point in centers])
            offsets = centers.copy()
            offsets[:, 0] *= gains - 1
            offsets[:, 1] = 0
            offsets[:, 2] *= gains - 1
        used, remapped = np.unique(triangles, return_inverse=True)
        attributes = {}
        for semantic, accessor_index in primitive["attributes"].items():
            accessor = document["accessors"][accessor_index]
            values = read_accessor(accessor_index)[used]
            if part == 1 and semantic == "POSITION":
                # Translate each leaf island as a rigid shape; its blade size,
                # UVs and original normals do not change with the crown spread.
                values = (values + offsets[components[used]]).astype(np.float32)
            attributes[semantic] = write_accessor(values, accessor["componentType"], accessor["type"])
        indices = write_accessor(remapped.astype(np.uint32).reshape(-1, 1), 5125, "SCALAR")
        output["meshes"].append({"name": names[part], "primitives": [{"attributes": attributes,
                                  "indices": indices, "material": primitive["material"]}]})
        output["nodes"].append({"mesh": part, "name": names[part]})
        output["scenes"][0]["nodes"].append(part)
    output["buffers"] = [{"uri": "sparse-tree.bin", "byteLength": len(chunks)}]
    (source_dir / "sparse-tree.bin").write_bytes(chunks)
    (source_dir / "sparse-tree.gltf").write_text(json.dumps(output))


def blender_export():
    import bpy
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree

    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for source, filename, chosen in (("tree_small_02", "tree-small-02.glb", None),
                                     ("fern_02", "fern-02.glb", "fern_02_c"),
                                     ("flower_heliophila", "flowers.glb", "flower_heliophila_small")):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        directory = CACHE / source
        path = directory / ("sparse-tree.gltf" if chosen is None else f"{source}_1k.gltf")
        bpy.ops.import_scene.gltf(filepath=str(path))
        if chosen:
            for obj in list(bpy.data.objects):
                if obj.type == "MESH" and obj.name != chosen:
                    bpy.data.objects.remove(obj, do_unlink=True)
        meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
        if not chosen:
            budgets = OPTIONS["triangleBudgets"]
            for obj in meshes:
                bpy.context.view_layer.objects.active = obj
                if obj.name != "star_tree_leaves":
                    # Estimate local cylinder diameter by casting inward through
                    # each surface. Expand around its own bough centerline, not
                    # around the tree origin (which would stretch the whole tree).
                    tree = BVHTree.FromObject(obj, bpy.context.evaluated_depsgraph_get())
                    vertices = [(vertex.co.copy(), vertex.normal.copy()) for vertex in obj.data.vertices]
                    trunk = obj.name == "star_tree_trunk"
                    for vertex, (point, normal) in zip(obj.data.vertices, vertices):
                        normal.normalize()
                        epsilon = 0.0025 if trunk else 0.0004
                        hit, _, _, distance = tree.ray_cast(point - normal * epsilon, -normal, 0.55 if trunk else 0.15)
                        radius = ((distance + epsilon) * .5) if hit is not None else (0.065 if trunk else 0.012)
                        radius = max(0.009 if trunk else 0.002, min(radius, 0.16 if trunk else 0.045))
                        expanded = point + normal * radius * (OPTIONS["trunkThicknessFactor"] - 1)
                        if trunk:
                            # Keep the scanned root cut seated on its original
                            # floor, instead of inflating its cap downward.
                            root_blend = max(0.0, min(1.0, (point.z - .2) / .3))
                            expanded.z = point.z + (expanded.z - point.z) * root_blend
                        # Blender uses Z-up after importing glTF Y-up.
                        gain = canopy_gain(expanded.z)
                        expanded.x *= gain
                        expanded.y *= gain
                        vertex.co = expanded
                    obj.data.update()
                modifier = obj.modifiers.new("Web silhouette budget", "DECIMATE")
                modifier.ratio = min(1.0, budgets[obj.name] / len(obj.data.polygons))
                modifier.use_collapse_triangulate = True
                bpy.ops.object.modifier_apply(modifier=modifier.name)
                print(obj.name, len(obj.data.polygons), "triangles", flush=True)

        # The supplied JPG glTF omits cutout alpha. Connect the separate official
        # alpha map so the exporter combines diffuse RGB + alpha into a PNG.
        alpha_image = bpy.data.images.load(str(directory / "alpha.png"))
        alpha_image.colorspace_settings.name = "Non-Color"
        for material in bpy.data.materials:
            if source == "tree_small_02" and "leaves" not in material.name:
                continue
            material.use_backface_culling = False
            nodes = material.node_tree.nodes
            shader = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
            texture = nodes.new("ShaderNodeTexImage")
            texture.image = alpha_image
            material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Alpha"])

        bpy.context.view_layer.update()
        corners = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
        minimum = Vector(tuple(min(point[axis] for point in corners) for axis in range(3)))
        maximum = Vector(tuple(max(point[axis] for point in corners) for axis in range(3)))
        offset = Vector(((minimum.x + maximum.x) / 2, (minimum.y + maximum.y) / 2, minimum.z))
        target_height = OPTIONS["treeHeight"] if chosen is None else maximum.z - minimum.z
        vertical_scale = target_height / (maximum.z - minimum.z)
        for obj in meshes:
            obj.location -= offset
            obj.location.z *= vertical_scale
            obj.scale.z *= vertical_scale
        bpy.context.view_layer.update()
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT / filename), export_format="GLB",
                                  export_apply=True, export_image_format="AUTO",
                                  export_cameras=False, export_lights=False, export_animations=False)
        # Force deterministic cutout rendering in all consumers, irrespective of
        # Blender's preview material mode. glTF Y-up matches the runtime.
        patch_glb_materials(OUTPUT / filename, source)
        records.append(inspect_glb(OUTPUT / filename))
    (OUTPUT / "asset-report.json").write_text(json.dumps(records, indent=2))


def read_glb(path):
    raw = path.read_bytes()
    assert raw[:4] == b"glTF" and struct.unpack_from("<I", raw, 4)[0] == 2
    json_size = struct.unpack_from("<I", raw, 12)[0]
    document = json.loads(raw[20:20 + json_size])
    binary_start = 20 + json_size
    binary = raw[binary_start + 8:] if binary_start < len(raw) else b""
    return document, binary


def patch_glb_materials(path, source):
    document, binary = read_glb(path)
    if source == "tree_small_02":
        bounds = []
        for node in document["nodes"]:
            shift, scale = node.get("translation", [0, 0, 0]), node.get("scale", [1, 1, 1])
            for primitive in document["meshes"][node["mesh"]]["primitives"]:
                positions = document["accessors"][primitive["attributes"]["POSITION"]]
                bounds.append(([positions["min"][i] * scale[i] + shift[i] for i in range(3)],
                               [positions["max"][i] * scale[i] + shift[i] for i in range(3)]))
        lo = [min(value[0][i] for value in bounds) for i in range(3)]
        hi = [max(value[1][i] for value in bounds) for i in range(3)]
        center = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]
        for node in document["nodes"]:
            node["translation"] = [node.get("translation", [0, 0, 0])[i] - center[i] for i in range(3)]
    for material in document.get("materials", []):
        if source != "tree_small_02" or "leaves" in material.get("name", ""):
            material.update(alphaMode="MASK", alphaCutoff=OPTIONS["leafAlphaCutoff"] if source == "tree_small_02" else 0.38, doubleSided=True)
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    binary += b"\0" * (-len(binary) % 4)
    content = struct.pack("<II", len(encoded), 0x4e4f534a) + encoded
    content += struct.pack("<II", len(binary), 0x004e4942) + binary
    path.write_bytes(b"glTF" + struct.pack("<II", 2, 12 + len(content)) + content)


def inspect_glb(path):
    document, binary = read_glb(path)
    count = sum(document["accessors"][primitive["indices"]]["count"] // 3
                for mesh in document["meshes"] for primitive in mesh["primitives"])
    bounds = []
    for node in document["nodes"]:
        if "mesh" not in node:
            continue
        assert "rotation" not in node and "matrix" not in node, "Expected baked glTF Y-up geometry"
        shift = node.get("translation", [0, 0, 0])
        scale = node.get("scale", [1, 1, 1])
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            positions = document["accessors"][primitive["attributes"]["POSITION"]]
            bounds.append(([positions["min"][i] * scale[i] + shift[i] for i in range(3)],
                           [positions["max"][i] * scale[i] + shift[i] for i in range(3)]))
    minimum = [min(pair[0][i] for pair in bounds) for i in range(3)]
    maximum = [max(pair[1][i] for pair in bounds) for i in range(3)]
    record = {"file": path.name, "bytes": path.stat().st_size, "triangles": count,
              "bbox": {"min": minimum, "max": maximum,
                       "size": [maximum[i] - minimum[i] for i in range(3)]},
              "nodes": document["nodes"], "materials": document.get("materials", []),
              "positionAccessors": [document["accessors"][primitive["attributes"]["POSITION"]]
                                    for mesh in document["meshes"] for primitive in mesh["primitives"]]}
    assert all(view.get("byteOffset", 0) + view["byteLength"] <= len(binary) for view in document["bufferViews"])
    assert not any("uri" in image for image in document.get("images", [])), "GLB must embed all textures"
    if path.name == "tree-small-02.glb":
        assert count <= OPTIONS["treeTriangleLimit"], f"Tree budget exceeded: {count}"
        record["processingOptions"] = OPTIONS
        record["attachmentSections"] = measure_trunk_sections(document, binary, record["bbox"])
        (OUTPUT / "tree-attachments.json").write_text(json.dumps(record["attachmentSections"], indent=2))
    print(json.dumps({key: record[key] for key in ("file", "bytes", "triangles")}), flush=True)
    return record


def measure_trunk_sections(document, binary, bounds):
    """Measure actual horizontal trunk intersections, including separate forks."""
    import math
    import numpy as np

    def accessor(index):
        value = document["accessors"][index]
        view = document["bufferViews"][value["bufferView"]]
        dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[value["componentType"]]
        width = {"SCALAR": 1, "VEC3": 3}[value["type"]]
        start = view.get("byteOffset", 0) + value.get("byteOffset", 0)
        return np.frombuffer(binary, dtype=dtype, count=value["count"] * width, offset=start).reshape(-1, width)

    node = next(node for node in document["nodes"] if node.get("name") == "star_tree_trunk")
    primitive = document["meshes"][node["mesh"]]["primitives"][0]
    positions = accessor(primitive["attributes"]["POSITION"]).astype(np.float64)
    positions *= np.array(node.get("scale", [1, 1, 1]))
    positions += np.array(node.get("translation", [0, 0, 0]))
    triangles = positions[accessor(primitive["indices"]).reshape(-1, 3)]
    reference = OPTIONS["runtimeReference"]
    scale = reference["height"] / bounds["size"][1]
    center = np.array([(bounds["min"][0] + bounds["max"][0]) / 2, 0,
                       (bounds["min"][2] + bounds["max"][2]) / 2])
    angle = reference["rotationY"]

    def world(point):
        p = (point - center) * scale
        return [math.cos(angle) * p[0] + math.sin(angle) * p[2] + reference["position"][0],
                p[1] + reference["position"][1],
                -math.sin(angle) * p[0] + math.cos(angle) * p[2] + reference["position"][2]]

    def section(height, tag):
        # A cross-section above the uneven scan cut gives the trunk's root
        # center, rather than measuring a tiny low point at the cut's edge.
        sample = max(0.12, height)
        selected = triangles[(triangles[:, :, 1].min(axis=1) <= sample)
                             & (triangles[:, :, 1].max(axis=1) >= sample)]
        edges, points, lookup, parents = [], [], {}, []

        def point_id(p):
            # Smooth thickening can move duplicated UV-seam vertices by tiny
            # different amounts. Join seam endpoints by distance, rather than
            # exact decimal rounding whose clusters change after recentering.
            tolerance = .003
            key = tuple(np.floor(p[[0, 2]] / tolerance).astype(int))
            for dx in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for index in lookup.get((key[0] + dx, key[1] + dz), []):
                        if np.linalg.norm(points[index][[0, 2]] - p[[0, 2]]) <= tolerance:
                            return index
            index = len(points)
            lookup.setdefault(key, []).append(index)
            points.append(p)
            parents.append(len(parents))
            return index

        def root(i):
            while parents[i] != i:
                parents[i] = parents[parents[i]]
                i = parents[i]
            return i

        for triangle in selected:
            hits = []
            for a, b in ((0, 1), (1, 2), (2, 0)):
                p, q = triangle[a], triangle[b]
                if (p[1] - sample) * (q[1] - sample) < 0:
                    hits.append(p + (q - p) * ((sample - p[1]) / (q[1] - p[1])))
            if len(hits) == 2:
                a, b = point_id(hits[0]), point_id(hits[1])
                parents[root(b)] = root(a)
                edges.append((a, b))
        groups = {}
        for a, b in edges:
            groups.setdefault(root(a), []).append((points[a], points[b]))
        loops = []
        for segments in groups.values():
            lengths = np.array([np.linalg.norm(a - b) for a, b in segments])
            perimeter = float(lengths.sum())
            if perimeter < .035:
                continue
            midpoints = np.array([(a + b) / 2 for a, b in segments])
            midpoint = (midpoints * lengths[:, None]).sum(axis=0) / perimeter
            midpoint[1] = height
            loops.append({"localCenter": midpoint.tolist(), "sceneCenter": world(midpoint),
                          "approxRadius": perimeter / (2 * math.pi), "perimeter": perimeter})
        loops.sort(key=lambda loop: loop["perimeter"], reverse=True)
        return {"tag": tag, "localHeight": height, "sampleHeight": sample, "loops": loops}

    result = {"coordinateSystem": "GLB Y-up, node transforms applied; scene coordinates include the runtime reference below",
              "runtimeReference": reference, "runtimeScale": scale,
              "modelHeightSections": [section(height, "model") for height in (0, 1.5, 2.5)],
              "sceneHeightSections": [section((height - reference["position"][1]) / scale, "scene")
                                      for height in (1.5, 2.5, 3.5, 4.5)]}
    return result


if __name__ == "__main__":
    if "--blender-export" in sys.argv:
        blender_export()
    else:
        prepare_sources()
        thin_tree_canopy()
        blender = os.environ.get("BLENDER_BINARY", "/Applications/Blender.app/Contents/MacOS/Blender")
        subprocess.run([blender, "--background", "--python", str(Path(__file__).resolve()),
                        "--", "--blender-export"], check=True)
        subprocess.run([sys.executable, str(ROOT / "scripts/prepare-garden-leaf-cards.py")], check=True)
        archive = ROOT / "artifacts/garden-assets"
        archive.mkdir(parents=True, exist_ok=True)
        shutil.move(str(OUTPUT / "tree-small-02.glb"), str(archive / "tree-small-02.glb"))
