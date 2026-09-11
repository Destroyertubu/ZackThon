"""Acquire only five selected CC0 assets from Poly Haven's public API.
Original files are retained, verified against API MD5 and recorded with SHA-256.
No credentials, paid services, telemetry or user data are read.
"""
import concurrent.futures, datetime, hashlib, json, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets-source/polyhaven'
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Wanderwise-local-asset-preparation/1.0'})
    with urllib.request.urlopen(req,timeout=60) as r:return r.read()
def acquire(asset,model=True):
    folder=DEST/asset;folder.mkdir(parents=True,exist_ok=True)
    files=json.loads(get('https://api.polyhaven.com/files/'+asset))
    info=json.loads(get('https://api.polyhaven.com/info/'+asset))
    (folder/'api-files.json').write_text(json.dumps(files,indent=2))
    (folder/'api-info.json').write_text(json.dumps(info,indent=2))
    resolution='2k' if asset=='ArmChair_01' else '1k'
    entry=files['gltf'][resolution]['gltf'];items=dict(entry['include'])
    if model:items[asset+'_'+resolution+'.gltf']=entry
    else:items={k:v for k,v in items.items() if k.startswith('textures/')}
    records=[]
    for name,item in items.items():
        path=folder/name;path.parent.mkdir(parents=True,exist_ok=True)
        data=path.read_bytes() if path.exists() else get(item['url'])
        assert hashlib.md5(data).hexdigest()==item['md5'],name
        path.write_bytes(data)
        records.append({'file':str(path.relative_to(ROOT)),'url':item['url'],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    print('Acquired',asset,len(records),'files',flush=True)
    return {'id':asset,'author':info.get('authors'),'officialSource':'https://polyhaven.com/a/'+asset,'version':info.get('date_published'),'resolution':resolution,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'license':'CC0-1.0','licenseURL':'https://creativecommons.org/publicdomain/zero/1.0/','files':records,'modifications':'Sources unchanged. Derived Blender scene normalizes transforms and packs PBR maps; see build script.','distribution':'CC0 source files plus embedded images in runtime GLB'}
if __name__=='__main__':
    DEST.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        records=list(pool.map(lambda a:acquire(*a),[('ArmChair_01',True),('GothicCabinet_01',True),('Shelf_01',True),('wood_floor',False),('plastered_wall_02',False)]))
    (DEST/'manifest.json').write_text(json.dumps(records,indent=2))
    (DEST/'CC0-1.0.txt').write_bytes(get('https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt'))
