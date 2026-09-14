#!/usr/bin/env python3
"""Build journey-only texture variants. Never mutate the observatory assets."""
from pathlib import Path
import hashlib
import io
import json
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/garden/journey-textures'
REPORT = ROOT / 'artifacts/journey-assets'
OUT.mkdir(parents=True, exist_ok=True)
REPORT.mkdir(parents=True, exist_ok=True)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def webp(image, maximum=1024, lossless=False):
    image = image.copy()
    image.thumbnail((maximum, maximum), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    # Method 4 keeps exact lossless leaf pixels without an unnecessarily slow search.
    image.save(output, 'WEBP', quality=100 if lossless else 85,
               lossless=lossless, method=4, exact=True)
    data = output.getvalue()
    decoded = Image.open(io.BytesIO(data)); decoded.load()
    if lossless:
        assert decoded.tobytes() == image.tobytes(), 'Leaf pixels must remain exact'
    return data, image.size

def read_glb(path):
    data = path.read_bytes()
    length = struct.unpack_from('<I', data, 12)[0]
    return data, json.loads(data[20:20+length]), data[28+length:]

source = ROOT / 'public/models/garden/jacaranda-mature.glb'
original, document, binary = read_glb(source)
old_views = document['bufferViews']
images = {image['bufferView']: image for image in document['images']}
packed = bytearray()
image_report = []
geometry_report = []
for index, view in enumerate(old_views):
    offset = view.get('byteOffset', 0)
    raw = binary[offset:offset + view['byteLength']]
    if index in images:
        image = images[index]
        decoded = Image.open(io.BytesIO(raw))
        name = image.get('name', str(index))
        maximum = 1024 if '_diff_' in name or '_rgba_' in name or 'trunk_nor' in name else 512
        encoded, size = webp(decoded, maximum, decoded.mode == 'RGBA')
        image_report.append({'name': name, 'beforeBytes': len(raw), 'afterBytes': len(encoded),
                             'beforeSize': decoded.size, 'afterSize': size,
                             'losslessPixels': decoded.mode == 'RGBA'})
        raw = encoded
        image['mimeType'] = 'image/webp'
    else:
        geometry_report.append({'bufferView': index, 'bytes': len(raw), 'sha256': sha(raw)})
    while len(packed) % 4:
        packed.append(0)
    view['byteOffset'] = len(packed)
    view['byteLength'] = len(raw)
    packed.extend(raw)
while len(packed) % 4:
    packed.append(0)
for texture in document['textures']:
    source_index = texture.pop('source')
    texture.setdefault('extensions', {})['EXT_texture_webp'] = {'source': source_index}
for key in ['extensionsUsed', 'extensionsRequired']:
    if 'EXT_texture_webp' not in document.setdefault(key, []):
        document[key].append('EXT_texture_webp')
document['buffers'][0]['byteLength'] = len(packed)
encoded_json = json.dumps(document, separators=(',', ':')).encode()
encoded_json += b' ' * (-len(encoded_json) % 4)
result = (struct.pack('<III', 0x46546C67, 2, 28+len(encoded_json)+len(packed))
          + struct.pack('<II', len(encoded_json), 0x4E4F534A) + encoded_json
          + struct.pack('<II', len(packed), 0x004E4942) + packed)
destination = ROOT / 'public/models/garden/jacaranda-journey.glb'
destination.write_bytes(result)
for entry in geometry_report:
    view = document['bufferViews'][entry['bufferView']]
    start = view['byteOffset']
    assert sha(packed[start:start+view['byteLength']]) == entry['sha256']
assert source.read_bytes() == original
print(f'Journey tree: {len(original):,} -> {len(result):,} bytes; geometry unchanged', flush=True)

urls = [
    '/textures/wood_floor_deck_diff_1k.jpg', '/textures/wood_floor_deck_nor_gl_1k.jpg',
    '/textures/wood_table_001_diff_1k.jpg', '/textures/wood_table_001_nor_gl_1k.jpg',
    '/textures/rock_face_diff_1k.jpg', '/textures/rock_face_nor_gl_1k.jpg',
    '/textures/rock_face_rough_1k.jpg', '/textures/plastered_wall_04_diff_1k.jpg',
    '/models/garden/details/ivy/ivy-color.jpg', '/models/garden/details/ivy/ivy-opacity.jpg',
    '/scenery/star-garden/milkyway-nasa-4k.jpg',
]
inputs = [(url, ROOT / ('public' + url)) for url in urls]
inputs += [(f'./assets/{name}', ROOT / 'src/features/journeys/scene/assets' / name)
           for name in ['jacaranda-bark.jpg', 'jacaranda-bark-normal.jpg', 'jacaranda-leaves.png']]
mapping = []
for url, path in inputs:
    image = Image.open(path)
    lossless = image.mode == 'RGBA' or 'opacity' in path.name
    maximum = 2048 if 'milkyway' in path.name else 1024
    # Keep the opacity map at exact native values, too; all leaf silhouettes are unchanged.
    if lossless and image.mode not in ['RGB', 'RGBA']:
        image = image.convert('RGB')
    encoded, size = webp(image, maximum, lossless)
    target = OUT / (path.stem + '.webp')
    target.write_bytes(encoded)
    mapping.append({'sourceUrl': url, 'url': '/models/garden/journey-textures/' + target.name,
                    'beforeBytes': path.stat().st_size, 'afterBytes': len(encoded),
                    'size': size, 'losslessPixels': lossless})
    print(f'{target.name}: {path.stat().st_size:,} -> {len(encoded):,}', flush=True)

tree_report = {'url': '/models/garden/jacaranda-journey.glb', 'source': str(source.relative_to(ROOT)),
               'beforeBytes': len(original), 'afterBytes': len(result), 'sha256': sha(result),
               'triangles': sum(document['accessors'][p['indices']]['count'] // 3
                                for mesh in document['meshes'] for p in mesh['primitives']),
               'geometryByteIdentical': True, 'geometry': geometry_report, 'images': image_report}
report = {'tree': tree_report, 'textures': mapping}
(REPORT / 'asset-report.json').write_text(json.dumps(report, indent=2) + '\n')
(OUT / 'url-mapping.json').write_text(json.dumps(mapping, indent=2) + '\n')
