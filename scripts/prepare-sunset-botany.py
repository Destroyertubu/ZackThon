#!/usr/bin/env python3
"""Reproducible, rooted Poly Haven plant variants; never modifies scene source.

python3 scripts/prepare-sunset-botany.py
python3 scripts/prepare-sunset-botany.py --only-fern  # bounded incremental build
Requires Pillow and Blender (BLENDER_BIN may override the macOS installation).
Tree: preserve all 190,999 triangles and relative branch/leaf placement.
Shrub: select one COMPLETE original rooted plant, no decimation.
Fern: preserve all 2,248 triangles of the existing complete fern_02_c plant.
"""
from pathlib import Path
import copy
import hashlib
import io
import json
import os
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/sunset-botany'
OUTPUT = ROOT / 'public/models/sunset-boulevard/botany'
AUDIT = ROOT / 'artifacts/star-tide-upgrade/botany'
TREE = ROOT / 'public/models/garden/tree-small-02-cards.glb'
FERN = ROOT / 'public/models/garden/fern-02.glb'
SHRUB = SOURCE / 'shrub-01/shrub_01_1k.gltf'
for directory in [SOURCE, OUTPUT, AUDIT]:
    directory.mkdir(parents=True, exist_ok=True)


def hashes(path):
    data = path.read_bytes()
    return {'file': str(path.relative_to(ROOT)), 'bytes': len(data),
            'md5': hashlib.md5(data).hexdigest(), 'sha256': hashlib.sha256(data).hexdigest()}


def read_glb(path):
    data = path.read_bytes()
    count = struct.unpack_from('<I', data, 12)[0]
    return json.loads(data[20:20 + count]), data[28 + count:]


def tree_clearance(audit):
    """Measure original world-space vertices after the same one root shift."""
    document, binary = read_glb(TREE)
    anchor = audit['rootAnchorInSourceWorldYUp']
    wood = []
    for node in document['nodes']:
        if 'leaves' in node['name']:
            continue
        for primitive in document['meshes'][node['mesh']]['primitives']:
            accessor = document['accessors'][primitive['attributes']['POSITION']]
            view = document['bufferViews'][accessor['bufferView']]
            offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            stride = view.get('byteStride', 12)
            scale = node.get('scale', [1, 1, 1])
            translation = node.get('translation', [0, 0, 0])
            assert not node.get('rotation') and not node.get('matrix')
            for index in range(accessor['count']):
                point = struct.unpack_from('<fff', binary, offset + index * stride)
                wood.append([point[axis] * scale[axis] + translation[axis] - anchor[axis] for axis in range(3)])
    leaf = next(p['boundsYUp'] for p in audit['parts'] if 'leaves' in p['name'])
    height = audit['boundsYUp']['size'][1]
    def radius(cutoff, scale=1):
        points = [point for point in wood if point[1] * scale < cutoff]
        return max((point[0] ** 2 + point[2] ** 2) ** 0.5 * scale for point in points)
    return {'leafMinimumY': leaf['min'][1],
        'crownBoundsCenterXZOffsetFromRoot': [(leaf['min'][axis] + leaf['max'][axis]) / 2 for axis in [0, 2]],
        'woodRadiusBelowLocalY': {str(y): radius(y) for y in [1.5, 1.9]},
        'placementByTargetHeight': [{'targetHeight': target, 'uniformScale': target / height,
             'leafMinimumY': leaf['min'][1] * target / height,
             'woodRadiusBelowWorldY': {str(y): radius(y, target / height) for y in [1.5, 1.9]}}
             for target in [6.6, 6.9, 7.2]],
        'method': 'All original trunk+branch vertices transformed to world space then the single shared root anchor subtracted; no canopy-centre proxy.'}


def fetch_shrub():
    metadata = SOURCE / 'shrub-01-files.json'
    if not metadata.exists():
        subprocess.run(['curl', '-fL', '--retry', '2', 'https://api.polyhaven.com/files/shrub_01', '-o', str(metadata)], check=True)
    api = json.loads(metadata.read_text())
    model = api['gltf']['1k']['gltf']
    sources = {'shrub_01_1k.gltf': model, **model['include'],
               'textures/shrub_01_alpha_1k.png': api['Alpha']['1k']['png']}
    report = []
    for relative, entry in sources.items():
        path = SHRUB.parent / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest() != entry['md5']:
            subprocess.run(['curl', '-fL', '--retry', '2', '--max-time', '120', entry['url'], '-o', str(path)], check=True)
        actual = hashes(path)
        assert actual['md5'] == entry['md5'], f'Official source checksum mismatch: {relative}'
        report.append({**actual, 'url': entry['url'], 'officialMd5': entry['md5']})
    return report


def prepare_alpha():
    from PIL import Image
    document = json.loads(SHRUB.read_text())
    color = Image.open(SHRUB.parent / 'textures/shrub_01_diff_1k.jpg').convert('RGBA')
    alpha = Image.open(SHRUB.parent / 'textures/shrub_01_alpha_1k.png').convert('L')
    assert color.size == alpha.size == (1024, 1024)
    color.putalpha(alpha)
    target = SHRUB.parent / 'textures/shrub_01_diff_rgba_1k.png'
    color.save(target)
    document['images'][1]['uri'] = 'textures/' + target.name
    document['images'][1]['mimeType'] = 'image/png'
    document['images'][1]['name'] = 'shrub_01_diff_rgba_1k'
    document['materials'][0]['alphaMode'] = 'MASK'
    document['materials'][0]['alphaCutoff'] = 0.5
    prepared = SHRUB.with_name('shrub_01_alpha_prepared.gltf')
    prepared.write_text(json.dumps(document, indent=2) + '\n')


def blender_export():
    import bpy
    import bmesh
    from mathutils import Matrix, Vector

    def triangles(objects):
        return sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in objects)

    def bounds(objects):
        points = [vertex.co for obj in objects for vertex in obj.data.vertices]
        low = [min(point[axis] for point in points) for axis in range(3)]
        high = [max(point[axis] for point in points) for axis in range(3)]
        # Blender Z-up -> glTF Y-up. glTF Z = -Blender Y.
        return {'min': [low[0], low[2], -high[1]], 'max': [high[0], high[2], -low[1]],
                'size': [high[0] - low[0], high[2] - low[2], high[1] - low[1]]}

    models = [('fern', FERN)] if '--only-fern' in sys.argv else [
        ('street-tree', TREE), ('rooted-shrub', SHRUB.with_name('shrub_01_alpha_prepared.gltf')), ('fern', FERN)]
    for name, source in models:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(source))
        objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
        all_triangles = triangles(objects)
        if name == 'rooted-shrub':
            assert len(objects) == 1
            obj = objects[0]
            # Source has nine separate plants laid out along X. This split lies
            # inside an empty 17.5 cm gap, never through any branch or leaf.
            split_x = -2.190749764442444
            mesh = bmesh.new()
            mesh.from_mesh(obj.data)
            assert not any(min(v.co.x for v in face.verts) < split_x < max(v.co.x for v in face.verts) for face in mesh.faces)
            bmesh.ops.delete(mesh, geom=[v for v in mesh.verts if v.co.x > split_x], context='VERTS')
            mesh.to_mesh(obj.data)
            mesh.free()
            obj.name = 'shrub_01_complete_rooted_a'
            assert triangles(objects) == 36199
        else:
            assert all_triangles == (2248 if name == 'fern' else 190999)

        for obj in objects:
            obj.animation_data_clear()
            if obj.data.shape_keys:
                obj.shape_key_clear()
            # Bake each original transform; all parts retain their world relation.
            obj.data.transform(obj.matrix_world)
            obj.parent = None
            obj.matrix_world = Matrix.Identity(4)
            obj.data.update()
        before_anchor = bounds(objects)
        root_mesh = next((obj for obj in objects if 'trunk' in obj.name), objects[0])
        base = min(v.co.z for v in root_mesh.data.vertices)
        height = max(v.co.z for v in root_mesh.data.vertices) - base
        # Root anchor from actual low trunk vertices, not canopy/bounds center.
        root_band = min(0.05, height * 0.01)
        root_vertices = [v.co.copy() for v in root_mesh.data.vertices if v.co.z <= base + root_band]
        anchor = Vector((sum(v.x for v in root_vertices) / len(root_vertices),
                         sum(v.y for v in root_vertices) / len(root_vertices), base))
        translation = Matrix.Translation(-anchor)
        for obj in objects:
            obj.data.transform(translation)
            obj.data.update()
        for action in list(bpy.data.actions):
            bpy.data.actions.remove(action)
        bpy.ops.file.pack_all()
        # Editable source remains texture-packed, with uncompressed full meshes.
        editable = SOURCE / f'{name}.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(editable), compress=True)
        target = AUDIT / f'{name}-draco.glb'
        bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', export_apply=False,
            export_texcoords=True, export_normals=True, export_materials='EXPORT',
            export_cameras=False, export_lights=False, export_animations=False, export_image_format='AUTO',
            export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
            export_draco_position_quantization=16, export_draco_normal_quantization=12,
            export_draco_texcoord_quantization=14)
        document, _ = read_glb(target)
        after = sum(document['accessors'][p['indices']]['count'] // 3 for m in document['meshes'] for p in m['primitives'])
        assert after == triangles(objects)
        assert not document.get('animations')
        audit = {'name': name, 'source': str(source.relative_to(ROOT)), 'sourceAllTriangles': all_triangles,
                 'selectedTriangles': after, 'decimated': False, 'animationCount': 0,
                 'relativeBranchLeafPlacementPreserved': True,
                 'sourceBoundsYUp': before_anchor, 'boundsYUp': bounds(objects),
                 'rootAnchorInSourceWorldYUp': [anchor.x, anchor.z, -anchor.y],
                 'rootAnchorLocalYUp': [0, 0, 0], 'rootBandMeters': root_band, 'rootSampleCount': len(root_vertices),
                 'parts': [{'name': obj.name, 'triangles': triangles([obj]), 'boundsYUp': bounds([obj])} for obj in objects],
                 'positionQuantizationBits': 16, 'normalQuantizationBits': 12, 'uvQuantizationBits': 14,
                 'editableSource': str(editable.relative_to(ROOT))}
        if name == 'rooted-shrub':
            audit['selection'] = {'sourceLocalXLessThan': split_x, 'sourcePlantCount': 9, 'selectedWholePlantCount': 1,
                                  'selectionCutsFaces': False, 'description': 'Leftmost complete high-detail rooted plant; other eight whole plants removed.'}
        (AUDIT / f'{name}-geometry.json').write_text(json.dumps(audit, indent=2) + '\n')
        print(json.dumps(audit), flush=True)


def repack(name):
    from PIL import Image
    source = AUDIT / f'{name}-draco.glb'
    document, binary = read_glb(source)
    before_document = copy.deepcopy(document)
    packed = bytearray()
    images = {image['bufferView']: image for image in document['images']}
    image_report, geometry_report = [], []
    for index, view in enumerate(document['bufferViews']):
        raw = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        if index in images:
            item = images[index]
            decoded = Image.open(io.BytesIO(raw))
            pixels = decoded.convert('RGBA' if 'A' in decoded.getbands() else 'RGB')
            assert pixels.size == (1024, 1024), (item.get('name'), pixels.size)
            kind = 'normal' if 'nor' in item.get('name', '') else 'roughness' if 'arm' in item.get('name', '') else 'color'
            quality = ({'normal': 88, 'roughness': 82, 'color': 84} if name == 'street-tree'
                       else {'normal': 92, 'roughness': 86, 'color': 88})[kind]
            stream = io.BytesIO()
            # Native 1K. WebP RGB is high-quality lossy; WebP alpha stays exact.
            pixels.save(stream, 'WEBP', quality=quality, method=6, exact=True, alpha_quality=100)
            encoded = stream.getvalue()
            check = Image.open(io.BytesIO(encoded)).convert(pixels.mode)
            if pixels.mode == 'RGBA':
                assert pixels.getchannel('A').tobytes() == check.getchannel('A').tobytes(), 'Alpha coverage must not change'
            image_report.append({'name': item.get('name'), 'dimensions': list(pixels.size), 'kind': kind,
                'beforeBytes': len(raw), 'bytes': len(encoded), 'codec': 'WebP', 'rgbQuality': quality,
                'rgbLossless': False, 'alphaPixelExact': pixels.mode == 'RGBA',
                'alphaExtrema': list(pixels.getchannel('A').getextrema()) if pixels.mode == 'RGBA' else None})
            raw = encoded
            item['mimeType'] = 'image/webp'
        else:
            geometry_report.append({'bufferView': index, 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)})
        packed.extend(b'\0' * (-len(packed) % 4))
        view['byteOffset'], view['byteLength'] = len(packed), len(raw)
        packed.extend(raw)
    packed.extend(b'\0' * (-len(packed) % 4))
    for texture in document['textures']:
        texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': texture.pop('source')}
    for key in ['extensionsUsed', 'extensionsRequired']:
        if 'EXT_texture_webp' not in document.setdefault(key, []):
            document[key].append('EXT_texture_webp')
    document['buffers'][0]['byteLength'] = len(packed)
    for key in ['nodes', 'meshes', 'materials', 'accessors', 'scenes', 'scene']:
        assert document.get(key) == before_document.get(key), key
    for row in geometry_report:
        view = document['bufferViews'][row['bufferView']]
        assert hashlib.sha256(packed[view['byteOffset']:view['byteOffset'] + view['byteLength']]).hexdigest() == row['sha256']
    encoded_json = json.dumps(document, separators=(',', ':')).encode()
    encoded_json += b' ' * (-len(encoded_json) % 4)
    glb = (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded_json) + len(packed))
        + struct.pack('<II', len(encoded_json), 0x4E4F534A) + encoded_json
        + struct.pack('<II', len(packed), 0x004E4942) + packed)
    target = OUTPUT / f'{name}.glb'
    target.write_bytes(glb)
    audit = json.loads((AUDIT / f'{name}-geometry.json').read_text())
    if name == 'street-tree':
        audit['clearance'] = tree_clearance(audit)
    if name == 'fern':
        audit['placement'] = {'targetHeight': 0.28, 'uniformScale': 0.28 / audit['boundsYUp']['size'][1],
                              'widthAtTargetHeight': audit['boundsYUp']['size'][0] * 0.28 / audit['boundsYUp']['size'][1],
                              'depthAtTargetHeight': audit['boundsYUp']['size'][2] * 0.28 / audit['boundsYUp']['size'][1]}
        audit['authors'] = ['Rico Cilliers', 'Rob Tuytel']
        audit['sourcePage'] = 'https://polyhaven.com/a/fern_02'
        audit['license'] = 'CC0-1.0'
    report = {**audit, **hashes(target), 'images': image_report, 'geometryStreamsByteIdenticalToDracoIntermediate': True,
              'editable': hashes(SOURCE / f'{name}.blend'), 'extensionsRequired': document['extensionsRequired']}
    print(f'{name}: {len(glb):,} bytes; {audit["selectedTriangles"]:,} triangles; no animation', flush=True)
    return report


if '--blender-export' in sys.argv:
    blender_export()
else:
    fern_only = '--only-fern' in sys.argv
    prior = json.loads((OUTPUT / 'manifest.json').read_text()) if fern_only else None
    if fern_only:
        sources = prior['officialShrubDownloads']
    else:
        sources = fetch_shrub()
        prepare_alpha()
    if '--repack-only' not in sys.argv:
        subprocess.run([os.getenv('BLENDER_BIN', '/Applications/Blender.app/Contents/MacOS/Blender'),
            '--background', '--threads', '2', '--python', __file__, '--', '--blender-export']
            + (['--only-fern'] if fern_only else []), check=True)
    assets = ([asset for asset in prior['assets'] if asset['name'] != 'fern'] + [repack('fern')]
              if fern_only else [repack('street-tree'), repack('rooted-shrub'), repack('fern')])
    report = {'license': 'CC0-1.0', 'authors': ['Rico Cilliers', 'Rob Tuytel'], 'publisher': 'Poly Haven',
        'sourcePages': ['https://polyhaven.com/a/tree_small_02', 'https://polyhaven.com/a/shrub_01', 'https://polyhaven.com/a/fern_02'],
        'generatedBy': 'scripts/prepare-sunset-botany.py', 'coordinateSystem': 'glTF Y-up, metres; true low root at local [0,0,0]',
        'originalTree': hashes(TREE), 'originalFern': hashes(FERN), 'officialShrubDownloads': sources, 'assets': assets,
        'modifications': ['Tree: original three meshes and 190,999 triangles retained; bake original transforms; one shared root translation.',
            'Shrub: retain one complete 36,199-triangle original plant; remove eight whole neighbouring variants; restore official alpha.',
            'Fern: complete existing fern_02_c plant retained, 2,248 triangles; bake original transform and align its lowest root to local origin.',
            'No decimation, no scattered/recentered leaves; static transforms and no animations.',
            'Draco geometry compression, native 1024px WebP images with high-quality lossy RGB and exact leaf alpha.']}
    (OUTPUT / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    (OUTPUT / 'PROVENANCE.md').write_text('''# Sunset boulevard botany

Originals: [Tree Small 02](https://polyhaven.com/a/tree_small_02) and [Shrub 01](https://polyhaven.com/a/shrub_01), by **Rico Cilliers / Poly Haven**; [Fern 02](https://polyhaven.com/a/fern_02), by **Rico Cilliers and Rob Tuytel / Poly Haven**. All **CC0-1.0**.

`street-tree.glb` preserves all 190,999 source triangles and the original placement of its trunk, branches and leaves. All parts share one root translation. `rooted-shrub.glb` is one complete high-detail original plant (36,199 triangles); eight neighbouring plants were removed through empty spatial gaps. `fern.glb` preserves the existing complete `fern_02_c` plant and all 2,248 triangles; its native alpha cutoff of 0.38 remains. None of these plants was decimated. The official shrub alpha PNG was combined with its diffuse map before export.

All models use Draco geometry and native 1024×1024 WebP textures. RGB compression is lossy (quality 82–92); leaf alpha is pixel-exact. No animations, lights or cameras are exported. Coordinates are glTF Y-up, metres; the true low root lies at local `[0, 0, 0]`. Use the measured bounds and trunk clearance in `manifest.json`, not the canopy centre, for scene placement.

Editable, texture-packed Blender files and original shrub downloads are under `assets/source/sunset-botany/`. Rebuild with `python3 scripts/prepare-sunset-botany.py`; use `--only-fern` to rebuild just the fern while preserving existing tree/shrub files and manifest entries. Source downloads are checked against official MD5; `manifest.json` records all SHA-256/MD5 hashes, byte sizes, bounds, root measurements, mesh counts and processing choices. Fern's original local derivative provenance remains in `public/models/garden/README.md`.
''')
    assert assets[0]['bytes'] <= 3_000_000, 'Tree exceeds 3 MB target'
    assert assets[1]['bytes'] <= 1_100_000, 'Shrub exceeds approx 1 MB target'
    assert assets[2]['bytes'] < 1_000_000, 'Fern exceeds 1 MB target'
