#!/usr/bin/env python3
"""Bounded observatory-only variants. Originals and all cabin URLs remain intact."""
from pathlib import Path
import copy
import hashlib
import io
import json
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/garden/optimized'
REPORT = ROOT / 'artifacts/star-tide-upgrade'
OUT.mkdir(parents=True, exist_ok=True)
REPORT.mkdir(parents=True, exist_ok=True)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read_glb(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    return data, json.loads(data[20:20 + size]), data[28 + size:]


def source_asset_bytes(path):
    dependencies = {path}
    if path.suffix == '.gltf':
        document = json.loads(path.read_text())
        for item in document.get('buffers', []) + document.get('images', []):
            uri = item.get('uri', '')
            if uri and not uri.startswith('data:'):
                dependencies.add(path.parent / uri)
    return sum(file.stat().st_size for file in dependencies)


def blender_export():
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = ROOT / 'public/models/potted_plant_01/potted_plant_01_1k.gltf'
    bpy.ops.import_scene.gltf(filepath=str(source))
    before = sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in bpy.context.scene.objects if obj.type == 'MESH')
    # No decimation, transforms, material edits, or texture resizing.
    destination = REPORT / 'potted-plant-01-draco.glb'
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format='GLB', export_apply=False,
        export_texcoords=True, export_normals=True, export_materials='EXPORT',
        export_cameras=False, export_lights=False, export_animations=False, export_image_format='AUTO',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16, export_draco_normal_quantization=12, export_draco_texcoord_quantization=14)
    _, exported, _ = read_glb(destination)
    after = sum(exported['accessors'][primitive['indices']]['count'] // 3 for mesh in exported['meshes'] for primitive in mesh['primitives'])
    assert before == after, (before, after)
    (REPORT / 'potted-plant-draco-audit.json').write_text(json.dumps({'source': str(source.relative_to(ROOT)),
        'trianglesBefore': before, 'trianglesAfter': after, 'decimated': False,
        'quantization': {'position': 16, 'normal': 12, 'uv': 14}, 'intermediateBytes': destination.stat().st_size}, indent=2) + '\n')


def repack(source, filename, original_source=None):
    from PIL import Image
    original, document, binary = read_glb(source)
    before_document = copy.deepcopy(document)
    views = document['bufferViews']
    images = {image['bufferView']: image for image in document.get('images', [])}
    packed = bytearray()
    image_report, geometry = [], []
    webp_sources = set()
    for index, view in enumerate(views):
        raw = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        if index in images:
            image = images[index]
            decoded = Image.open(io.BytesIO(raw)); decoded.load()
            stream = io.BytesIO()
            # Lossless for color, transparency, normals and roughness. Keep original if it is smaller.
            pixels = decoded.convert('RGBA' if 'A' in decoded.getbands() else 'RGB')
            pixels.save(stream, 'WEBP', lossless=True, quality=100, method=4, exact=True)
            encoded = stream.getvalue()
            selected = len(encoded) < len(raw)
            if selected:
                check = Image.open(io.BytesIO(encoded)).convert(pixels.mode)
                assert check.tobytes() == pixels.tobytes(), image.get('name')
                previous = len(raw); raw = encoded; image['mimeType'] = 'image/webp'
                webp_sources.add(document['images'].index(image))
            else:
                previous = len(raw)
            image_report.append({'name': image.get('name', str(index)), 'size': list(decoded.size),
                'beforeBytes': previous, 'afterBytes': len(raw), 'codecChanged': selected,
                'decodedPixelsIdentical': True, 'alphaPreserved': True})
        else:
            geometry.append({'bufferView': index, 'bytes': len(raw), 'sha256': sha(raw)})
        packed.extend(b'\0' * (-len(packed) % 4))
        view['byteOffset'], view['byteLength'] = len(packed), len(raw)
        packed.extend(raw)
    packed.extend(b'\0' * (-len(packed) % 4))
    for texture in document.get('textures', []):
        source_index = texture.get('source')
        if source_index in webp_sources:
            texture.pop('source')
            texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': source_index}
    if webp_sources:
        for key in ['extensionsUsed', 'extensionsRequired']:
            if 'EXT_texture_webp' not in document.setdefault(key, []):
                document[key].append('EXT_texture_webp')
    document['buffers'][0]['byteLength'] = len(packed)
    encoded_json = json.dumps(document, separators=(',', ':')).encode()
    encoded_json += b' ' * (-len(encoded_json) % 4)
    result = (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded_json) + len(packed))
        + struct.pack('<II', len(encoded_json), 0x4E4F534A) + encoded_json
        + struct.pack('<II', len(packed), 0x004E4942) + packed)
    (OUT / filename).write_bytes(result)
    for key in ['meshes', 'nodes', 'materials', 'accessors', 'scenes', 'scene']:
        assert document.get(key) == before_document.get(key), key
    for item in geometry:
        view = document['bufferViews'][item['bufferView']]
        assert sha(packed[view['byteOffset']:view['byteOffset'] + view['byteLength']]) == item['sha256']
    assert source.read_bytes() == original
    report = {'file': filename, 'source': str((original_source or source).relative_to(ROOT)),
        'comparisonInput': str(source.relative_to(ROOT)),
        'comparisonScope': 'Draco export intermediate to final (not original glTF binary)' if original_source else 'Original GLB to final',
        'comparisonInputBytes': len(original), 'originalSourceAssetBytes': source_asset_bytes(original_source or source),
        'bytes': len(result), 'sha256': sha(result),
        'geometryByteIdenticalToInput': True, 'imagePixelsIdentical': True,
        'resolutionChanged': False, 'materialsAndNodeNamesUnchanged': True,
        'images': image_report, 'geometry': geometry,
        'license': 'CC0-1.0 / Poly Haven; upstream provenance retained in original asset records'}
    print(f'{filename}: {len(original):,} -> {len(result):,}; pixels and geometry streams preserved', flush=True)
    return report


if '--blender-export' in sys.argv:
    blender_export()
else:
    blender = '/Applications/Blender.app/Contents/MacOS/Blender'
    subprocess.run([blender, '--background', '--threads', '2', '--python', __file__, '--', '--blender-export'], check=True)
    reports = [
        repack(REPORT / 'potted-plant-01-draco.glb', 'potted-plant-01.glb', ROOT / 'public/models/potted_plant_01/potted_plant_01_1k.gltf'),
        repack(ROOT / 'public/models/garden/details/brass-lantern.glb', 'brass-lantern.glb'),
        repack(ROOT / 'public/models/garden/flowers.glb', 'flowers.glb'),
    ]
    (OUT / 'manifest.json').write_text(json.dumps({'assets': reports, 'route': 'observatory only',
        'generatedBy': 'scripts/prepare-observatory-runtime.py',
        'notes': 'Potted plant geometry uses Draco without decimation; all images retain exact decoded pixels and native resolution. Original inputs remain untouched.'}, indent=2) + '\n')
