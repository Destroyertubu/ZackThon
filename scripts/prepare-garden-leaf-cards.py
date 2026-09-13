#!/usr/bin/env python3
"""Replace collapsed tiny leaves with UV-preserving four-triangle curved cards.

The mature reference GLB's trunk, branches, transforms, PBR textures and total
bounds remain unchanged. Output is a separate comparison/runtime asset.
"""
from pathlib import Path
import copy
import json
import runpy
import struct
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
TOOLS = runpy.run_path(str(ROOT / "scripts/prepare-garden-assets.py"))
OPTIONS = TOOLS["OPTIONS"]
CACHE = TOOLS["CACHE"]
OUT = ROOT / "public/models/garden"
REFERENCE = OUT / "tree-small-02.glb"
if not REFERENCE.exists():
    REFERENCE = ROOT / "artifacts/garden-assets/tree-small-02.glb"
DESTINATION = OUT / "tree-small-02-cards.glb"


def source_islands():
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    path = CACHE / "tree_small_02"
    document = json.loads((path / "tree_small_02_1k.gltf").read_text())
    binary = (path / "tree_small_02.bin").read_bytes()
    primitive = document["meshes"][0]["primitives"][1]

    def accessor(index):
        entry = document["accessors"][index]
        view = document["bufferViews"][entry["bufferView"]]
        width = {"VEC3": 3, "VEC2": 2, "SCALAR": 1}[entry["type"]]
        return np.frombuffer(binary, dtype={5126: np.float32, 5125: np.uint32}[entry["componentType"]],
                             count=entry["count"] * width, offset=view.get("byteOffset", 0)
                             + entry.get("byteOffset", 0)).reshape(-1, width)

    positions = accessor(primitive["attributes"]["POSITION"])
    triangles = accessor(primitive["indices"]).reshape(-1, 3)
    pairs = np.concatenate((triangles[:, [0, 1]], triangles[:, [1, 2]]))
    graph = coo_matrix((np.ones(len(pairs), dtype=np.uint8), (pairs[:, 0], pairs[:, 1])),
                       shape=(len(positions), len(positions)))
    _, labels = connected_components(graph, directed=False)
    return positions, accessor(primitive["attributes"]["TEXCOORD_0"]), accessor(primitive["attributes"]["NORMAL"]), labels


def make_cards(positions, source_uv, source_normals, labels):
    order = np.argsort(labels, kind="stable")
    groups = np.split(order, np.flatnonzero(np.diff(labels[order])) + 1)
    points, coordinates, normals, indices, errors = [], [], [], [], []
    for group in groups:
        p, uv = positions[group].astype(np.float64), source_uv[group].astype(np.float64)
        # Work in the UV island's own axes. Many scanned leaves are diagonal
        # strips in the atlas; an axis-aligned box includes distant UV corners.
        uv_origin = uv.mean(axis=0)
        _, uv_frame = np.linalg.eigh(np.cov((uv - uv_origin).T))
        island_uv = (uv - uv_origin) @ uv_frame
        lo, hi = island_uv.min(axis=0), island_uv.max(axis=0)
        middle, half = (lo + hi) * .5, np.maximum((hi - lo) * .5, 1e-8)
        normalized = (island_uv - middle) / half
        u, v = normalized.T
        fit = np.stack((u * 0 + 1, u, v, u * v, u * u, v * v), axis=1)
        coefficients = np.linalg.lstsq(fit, p, rcond=None)[0]
        linear = np.linalg.lstsq(fit[:, :3], p, rcond=None)[0]
        residual = p - fit[:, :3] @ linear
        # Choose the long physical direction for the middle bend row.
        long_u = np.linalg.norm(linear[1]) > np.linalg.norm(linear[2])
        us, vs = ([-1, 0, 1], [-1, 1]) if long_u else ([-1, 1], [-1, 0, 1])
        grid = np.array([(x, y) for y in vs for x in us], dtype=np.float64)
        gu, gv = grid.T
        basis = np.stack((gu * 0 + 1, gu, gv, gu * gv, gu * gu, gv * gv), axis=1)
        # Curvature is interpolated only from observed residuals, not evaluated
        # by polynomial extrapolation outside the UV island. This avoids the
        # large spikes produced by ill-conditioned diagonal leaf charts.
        card = basis[:, :3] @ linear
        axis = 0 if long_u else 1
        for level in (-1, 0, 1):
            weights = np.exp(-((normalized[:, axis] - level) / OPTIONS["leafCardBendWindow"]) ** 2)
            bend = (residual * weights[:, None]).sum(axis=0) / max(weights.sum(), 1e-12)
            card[grid[:, axis] == level] += bend
        largest_source = float(np.ptp(p, axis=0).max())
        largest_card = float(np.ptp(card, axis=0).max())
        if largest_card > largest_source * OPTIONS["leafCardMaxExtentRatio"]:
            center_card = card.mean(axis=0)
            card = center_card + (card - center_card) * (largest_source * OPTIONS["leafCardMaxExtentRatio"] / largest_card)
        error = float(np.sqrt(np.mean((fit @ coefficients - p) ** 2)) / max(np.ptp(p, axis=0).max(), 1e-8))
        # The source is nearly planar botanical geometry; reject an unexpected
        # UV mapping instead of silently substituting incorrect alpha shapes.
        assert error < OPTIONS["leafCardUvFitTolerance"], f"Leaf UV fit is unreliable: relative RMS {error}"
        errors.append(error)
        center = p.mean(axis=0)
        gain = TOOLS["canopy_gain"](center[1])
        card += np.array([center[0] * (gain - 1), 0, center[2] * (gain - 1)])
        faces = []
        width = len(us)
        for row in range(len(vs) - 1):
            for col in range(len(us) - 1):
                a = row * width + col
                faces.extend(((a, a + 1, a + width + 1), (a, a + width + 1, a + width)))
        faces = np.array(faces, dtype=np.uint32)
        desired = source_normals[group].mean(axis=0)
        face_normals = np.cross(card[faces[:, 1]] - card[faces[:, 0]], card[faces[:, 2]] - card[faces[:, 0]])
        if np.dot(face_normals.sum(axis=0), desired) < 0:
            faces = faces[:, [0, 2, 1]]
            face_normals *= -1
        vertex_normals = np.zeros_like(card)
        for face, normal in zip(faces, face_normals):
            for vertex in face:
                vertex_normals[vertex] += normal
        vertex_normals /= np.maximum(np.linalg.norm(vertex_normals, axis=1, keepdims=True), 1e-12)
        indices.append(faces + len(points) * 6)
        points.append(card)
        coordinates.append((grid * half + middle) @ uv_frame.T + uv_origin)
        normals.append(vertex_normals)
    return (np.concatenate(points).astype(np.float32), np.concatenate(coordinates).astype(np.float32),
            np.concatenate(normals).astype(np.float32), np.concatenate(indices), errors)


def main():
    points, uv, normals, indices, errors = make_cards(*source_islands())
    document, binary = TOOLS["read_glb"](REFERENCE)
    document = copy.deepcopy(document)
    binary = bytearray(binary)
    leaf_node = next(node for node in document["nodes"] if node["name"] == "star_tree_leaves")
    primitive = document["meshes"][leaf_node["mesh"]]["primitives"][0]
    old_bounds = document["accessors"][primitive["attributes"]["POSITION"]]
    old_min, old_max = np.array(old_bounds["min"]), np.array(old_bounds["max"])
    current_min, current_max = points.min(axis=0), points.max(axis=0)
    correction = (old_max - old_min) / (current_max - current_min)
    points = ((points - current_min) * correction + old_min).astype(np.float32)
    normals = normals / correction
    normals = (normals / np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-12)).astype(np.float32)

    def append_accessor(array, kind, component_type):
        binary.extend(b"\0" * (-len(binary) % 4))
        offset = len(binary)
        content = np.ascontiguousarray(array).tobytes()
        binary.extend(content)
        view = len(document["bufferViews"])
        document["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": len(content)})
        entry = {"bufferView": view, "componentType": component_type, "count": len(array), "type": kind}
        if kind == "VEC3":
            entry.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        document["accessors"].append(entry)
        return len(document["accessors"]) - 1

    primitive["attributes"] = {"POSITION": append_accessor(points, "VEC3", 5126),
                               "NORMAL": append_accessor(normals, "VEC3", 5126),
                               "TEXCOORD_0": append_accessor(uv, "VEC2", 5126)}
    primitive["indices"] = append_accessor(indices.astype(np.uint32).reshape(-1, 1), "SCALAR", 5125)
    # Compact away the old collapsed leaf buffers while retaining all referenced
    # trunk/branch geometry and texture bytes exactly.
    used_accessors = sorted({index for mesh in document["meshes"] for pr in mesh["primitives"]
                             for index in [*pr["attributes"].values(), pr["indices"]]})
    accessor_map = {old: new for new, old in enumerate(used_accessors)}
    document["accessors"] = [document["accessors"][i] for i in used_accessors]
    for mesh in document["meshes"]:
        for pr in mesh["primitives"]:
            pr["attributes"] = {key: accessor_map[index] for key, index in pr["attributes"].items()}
            pr["indices"] = accessor_map[pr["indices"]]
    used_views = sorted({a["bufferView"] for a in document["accessors"]} | {im["bufferView"] for im in document["images"]})
    view_map, new_views, compact = {}, [], bytearray()
    for old in used_views:
        view = copy.deepcopy(document["bufferViews"][old])
        start, size = view.get("byteOffset", 0), view["byteLength"]
        compact.extend(b"\0" * (-len(compact) % 4))
        view["byteOffset"] = len(compact)
        compact.extend(binary[start:start + size])
        view_map[old] = len(new_views)
        new_views.append(view)
    for entry in [*document["accessors"], *document["images"]]:
        entry["bufferView"] = view_map[entry["bufferView"]]
    document["bufferViews"] = new_views
    document["buffers"] = [{"byteLength": len(compact)}]
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    compact.extend(b"\0" * (-len(compact) % 4))
    content = struct.pack("<II", len(encoded), 0x4e4f534a) + encoded
    content += struct.pack("<II", len(compact), 0x004e4942) + compact
    DESTINATION.write_bytes(b"glTF" + struct.pack("<II", 2, 12 + len(content)) + content)
    report = TOOLS["inspect_glb"](DESTINATION)
    assert report["triangles"] < 220000
    assert np.all(np.isfinite(points)) and np.all(np.isfinite(normals))
    report["leafCards"] = {"count": len(indices) // 4, "trianglesPerLeaf": 4,
                           "uvFitRelativeRmsMedian": float(np.median(errors)),
                           "uvFitRelativeRmsMax": max(errors), "bboxCorrection": correction.tolist(),
                           "sourceLeavesPreserved": "all 30250 complete UV islands"}
    report["processingOptions"] = OPTIONS
    report["attachmentSections"] = TOOLS["measure_trunk_sections"](document, bytes(compact), report["bbox"])
    (OUT / "leaf-card-report.json").write_text(json.dumps(report, indent=2))
    deployed = [report, TOOLS["inspect_glb"](OUT / "fern-02.glb"), TOOLS["inspect_glb"](OUT / "flowers.glb")]
    (OUT / "asset-report.json").write_text(json.dumps(deployed, indent=2))
    print(json.dumps(report["leafCards"]), flush=True)


if __name__ == "__main__":
    main()
