"""Fetch only selected CC0 files from the author's official public repository.
No login, purchase, commercial source pack or model-generation service is used.
"""
from pathlib import Path
from urllib.request import urlopen
import json, hashlib, datetime, concurrent.futures

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '96d5930a8dbdb363409bbc2d3341718b00e17c9c'
BASE = f'https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/{COMMIT}/'
PREFIX = 'addons/kaykit_furniture_bits/Assets/gltf/'
SELECTED = ['table_medium_long', 'chair_B_wood', 'shelf_B_large', 'lamp_table',
            'armchair_pillows', 'book_set', 'book_single', 'cactus_medium_A']
DEST = ROOT / 'assets-source/kaykit-furniture'

def get(path):
    dest = DEST / Path(path).name
    if not dest.exists():
        with urlopen(BASE + path, timeout=30) as r:
            data = r.read(5_000_001)
        if len(data) > 5_000_000: raise ValueError('Asset exceeds acquisition bound')
        dest.write_bytes(data)
    return dest

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    get('LICENSE.txt')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        gltfs = list(pool.map(get, [PREFIX+n+'.gltf' for n in SELECTED]))
    refs = set()
    for p in gltfs:
        j=json.loads(p.read_text())
        for resource in j.get('buffers', [])+j.get('images', []):
            uri=resource.get('uri','')
            if '/' in uri or '\\' in uri or ':' in uri: raise ValueError('Unexpected external reference')
            if uri: refs.add(PREFIX+uri)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(get,sorted(refs)))
    report={'author':'Kay Lousberg','pack':'KayKit Furniture Bits 1.0','commit':COMMIT,
      'officialSource':'https://kaylousberg.itch.io/furniture-bits',
      'repository':'https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0',
      'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
      'license':'CC0-1.0; original text in LICENSE.txt','modifications':'None in assets-source. Blender conversion/placement documented separately.',
      'distribution':'Selected CC0 source files and derived runtime GLB; no paid EXTRA or SOURCE pack.',
      'files':[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(DEST.iterdir()) if p.name!='provenance.json']}
    (DEST/'provenance.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({'files':len(report['files']),'bytes':sum(x['bytes'] for x in report['files']),'commit':COMMIT}))

if __name__=='__main__':main()
