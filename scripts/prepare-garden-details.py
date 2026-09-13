#!/usr/bin/env python3
"""Download verified CC0 sources and export the observatory's small garden details.

Run: python3 scripts/prepare-garden-details.py
Requires Blender; override BLENDER_BIN and GARDEN_DETAILS_CACHE if necessary.
Official source files remain outside public/, with their published MD5 checksums.
"""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import os
import struct
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(os.environ.get("GARDEN_DETAILS_CACHE", "/tmp/wanderwise-garden-details-source"))
OUTPUT = ROOT / "public/models/garden/details"
SOURCES = ("rock_moss_set_01", "periwinkle_plant", "brass_diya_lantern")
ROCK_TRIANGLE_TARGET = 2200
LANTERN_BODY_TRIANGLE_TARGET = 4100


def fetch_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "WanderwiseGardenDetails/1.0"})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def download(item):
    path, metadata = item
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest() != metadata["md5"]:
        with urllib.request.urlopen(metadata["url"]) as response:
            path.write_bytes(response.read())
    assert hashlib.md5(path.read_bytes()).hexdigest() == metadata["md5"], path


def sources():
    jobs = []
    for name in SOURCES:
        directory = CACHE / name
        directory.mkdir(parents=True, exist_ok=True)
        manifest_path = directory / "manifest.json"
        if manifest_path.exists():
            manifest = json.loads(manifest_path.read_text())
        else:
            files = fetch_json(f"https://api.polyhaven.com/files/{name}")
            manifest = {
                "source": files["gltf"]["1k"]["gltf"],
                "extras": {key: files[key]["1k"]["png"] for key in files
                           if any(term in key.lower() for term in ("alpha", "opacity"))},
            }
        if "info" not in manifest:
            manifest["info"] = fetch_json(f"https://api.polyhaven.com/info/{name}")
        manifest_path.write_text(json.dumps(manifest, indent=2))
        jobs.append((directory / f"{name}_1k.gltf", manifest["source"]))
        jobs.extend((directory / path, metadata) for path, metadata in manifest["source"]["include"].items())
        jobs.extend((directory / f"{key}.png", metadata) for key, metadata in manifest["extras"].items())
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        list(executor.map(download, jobs))


def export_with_blender():
    import bpy
    from mathutils import Vector

    OUTPUT.mkdir(parents=True, exist_ok=True)

    def load(name):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(CACHE / name / f"{name}_1k.gltf"))

    def keep(names):
        for obj in list(bpy.context.scene.objects):
            if obj.name not in names:
                bpy.data.objects.remove(obj, do_unlink=True)

    def normalize(objects, together=False):
        # Imported glTF is Blender Z-up. Bake world transform, then bottom-center.
        for obj in objects:
            obj.data.transform(obj.matrix_world)
            obj.matrix_world.identity()
        groups = [objects] if together else [[obj] for obj in objects]
        for group in groups:
            vertices = [vertex.co for obj in group for vertex in obj.data.vertices]
            low = Vector(tuple(min(point[axis] for point in vertices) for axis in range(3)))
            high = Vector(tuple(max(point[axis] for point in vertices) for axis in range(3)))
            offset = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
            for obj in group:
                for vertex in obj.data.vertices:
                    vertex.co -= offset
                obj.data.update()

    def simplify(obj, target):
        obj.data.calc_loop_triangles()
        count = len(obj.data.loop_triangles)
        if count <= target:
            return
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new("Web silhouette budget", "DECIMATE")
        modifier.ratio = target / count
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)

    def opacity(name, filter_name=lambda name: True):
        alpha = bpy.data.images.load(str(CACHE / name / "opacity.png"))
        alpha.colorspace_settings.name = "Non-Color"
        for material in bpy.data.materials:
            if not material.use_nodes or not filter_name(material.name):
                continue
            shader = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
            if shader is None:
                continue
            texture = material.node_tree.nodes.new("ShaderNodeTexImage")
            texture.image = alpha
            material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Alpha"])

    def export(filename):
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT / filename), export_format="GLB",
                                  export_yup=True, export_animations=False,
                                  export_cameras=False, export_lights=False,
                                  export_image_format="AUTO", export_texcoords=True,
                                  export_normals=True, export_materials="EXPORT")

    load("rock_moss_set_01")
    keep(["rock_moss_set_01_rock01", "rock_moss_set_01_rock03", "rock_moss_set_01_rock06"])
    rocks = sorted(bpy.context.scene.objects, key=lambda obj: obj.name)
    for index, obj in enumerate(rocks):
        obj.name = f"moss_rock_{index + 1}"
        simplify(obj, ROCK_TRIANGLE_TARGET)
    normalize(rocks)
    export("moss-rocks.glb")

    load("periwinkle_plant")
    keep(["periwinkle_plant_05_LOD0", "periwinkle_plant_06_LOD0"])
    plants = sorted(bpy.context.scene.objects, key=lambda obj: obj.name)
    plants[0].name = "periwinkle_flower_clump"
    plants[1].name = "periwinkle_trailing_sprig"
    # These are already low-poly, shaped leaves; do not decimate their alpha cards.
    normalize(plants)
    opacity("periwinkle_plant")
    export("periwinkle.glb")

    load("brass_diya_lantern")
    keep(["brass_diya_lantern", "brass_diya_lantern_connection"])
    lantern = list(bpy.context.scene.objects)
    for obj in lantern:
        if obj.name == "brass_diya_lantern":
            simplify(obj, LANTERN_BODY_TRIANGLE_TARGET)
    normalize(lantern, together=True)
    opacity("brass_diya_lantern", lambda name: "glass" in name or "flame" in name)
    export("brass-lantern.glb")


def finalize():
    reports = []
    for path in sorted(OUTPUT.glob("*.glb")):
        raw = path.read_bytes()
        length, kind = struct.unpack_from("<II", raw, 12)
        assert kind == 0x4E4F534A
        document = json.loads(raw[20:20 + length])
        remainder = raw[20 + length:]
        for material in document.get("materials", []):
            if "periwinkle" in material.get("name", ""):
                material.update(alphaMode="MASK", alphaCutoff=0.3, doubleSided=True)
                material["pbrMetallicRoughness"]["roughnessFactor"] = 1
        encoded = json.dumps(document, separators=(",", ":")).encode()
        encoded += b" " * ((-len(encoded)) % 4)
        output = (struct.pack("<III", 0x46546C67, 2, 20 + len(encoded) + len(remainder))
                  + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + remainder)
        path.write_bytes(output)
        nodes = []
        for node in document["nodes"]:
            if "mesh" not in node:
                continue
            mesh = document["meshes"][node["mesh"]]
            triangles = sum(document["accessors"][primitive["indices"]]["count"] // 3
                            for primitive in mesh["primitives"])
            bounds = [document["accessors"][primitive["attributes"]["POSITION"]]
                      for primitive in mesh["primitives"]]
            low = [min(bound["min"][axis] for bound in bounds) for axis in range(3)]
            high = [max(bound["max"][axis] for bound in bounds) for axis in range(3)]
            nodes.append({"name": node["name"], "triangles": triangles, "min": low, "max": high,
                          "dimensions": [high[i] - low[i] for i in range(3)]})
        reports.append({"file": path.name, "bytes": path.stat().st_size, "nodes": nodes,
                        "triangles": sum(node["triangles"] for node in nodes)})
    ivy = json.loads((OUTPUT / "ivy/asset-report.json").read_text())
    # Inspect the actual deterministic runtime geometry, instead of maintaining
    # a second copy of the foliage layout or estimating its instance count.
    javascript = """
import { buildSync } from 'esbuild';
const compile = path => buildSync({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false}).outputFiles[0].text;
const load = async path => import('data:text/javascript;base64,' + Buffer.from(compile(path)).toString('base64'));
const {makeGardenIvy} = await load('src/components/observatory/gardenIvyGeometry.ts');
const {GARDEN_DETAIL_OBSTACLES} = await load('src/components/observatory/gardenDetailLayout.ts');
const ivy = makeGardenIvy([7.3,0,-3.8]);
console.log(JSON.stringify({leafCount:ivy.leafCount,leafCardTriangles:4,
  branchTriangles:ivy.branchTriangles,renderedTriangles:ivy.triangles,
  obstacles:GARDEN_DETAIL_OBSTACLES}));
"""
    geometry = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", javascript], cwd=ROOT))
    ivy["runtimeGeometry"] = {key: value for key, value in geometry.items() if key != "obstacles"}
    (OUTPUT / "ivy/asset-report.json").write_text(json.dumps(ivy, indent=2))
    report = {"license": "CC0-1.0", "verifiedAt": "2026-09-13", "assets": reports,
              "additionalTextureAssets": [ivy],
              "totalDeployedBytes": sum(record["bytes"] for record in reports) + ivy["runtimeBytes"],
              "sources": [{"id": name, "url": f"https://polyhaven.com/a/{name}",
                           "manifest": json.loads((CACHE / name / "manifest.json").read_text())}
                          for name in SOURCES]}
    counts = {"moss_rock_1": 4, "moss_rock_2": 4, "moss_rock_3": 4,
              "periwinkle_flower_clump": 16}
    parts = [{"name": node["name"], "instances": counts[node["name"]],
              "trianglesPerInstance": node["triangles"],
              "renderedTriangles": counts[node["name"]] * node["triangles"]}
             for asset in reports for node in asset["nodes"] if node["name"] in counts]
    parts.extend([{"name": "existing_armchair", "instances": 1, "renderedTriangles": 5626},
                  {"name": "woven_rug", "instances": 1, "renderedTriangles": 7152},
                  {"name": "photographed_ivy", "instances": 1, "renderedTriangles": geometry["renderedTriangles"]}])
    base_triangles = sum(part["renderedTriangles"] for part in parts)
    report["sceneBudget"] = {"parts": parts, "baseGardenDetailsTriangles": base_triangles,
                            "optionalLanternTrianglesEach": 4688, "recommendedMaximumLanterns": 8,
                            "withEightLanternsTriangles": base_triangles + 4688 * 8, "limit": 200000}
    report["additionalObstacles"] = [{**obstacle, "reason": "reading armchair"} for obstacle in geometry["obstacles"]]
    assert report["totalDeployedBytes"] <= 12_000_000
    assert report["sceneBudget"]["withEightLanternsTriangles"] <= 200_000
    (OUTPUT / "asset-report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({"assets": reports, "totalDeployedBytes": report["totalDeployedBytes"]}, indent=2))


if __name__ == "__main__":
    if "--blender" in sys.argv:
        export_with_blender()
    elif "--report-only" in sys.argv:
        finalize()
    else:
        sources()
        blender = os.environ.get("BLENDER_BIN", "/Applications/Blender.app/Contents/MacOS/Blender")
        subprocess.run([blender, "--background", "--python", str(Path(__file__).resolve()), "--", "--blender"], check=True)
        subprocess.run([sys.executable, str(ROOT / "scripts/prepare-garden-ivy.py")], check=True)
        finalize()
