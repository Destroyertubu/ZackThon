"""Fetch verified Poly Haven CC0 originals and encode 2K web textures without resizing.
Uses the same Pillow/libwebp pipeline as prepare-journey-assets.py. No API key.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, subprocess

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source/sunset-boulevard';OUT=ROOT/'public/textures/sunset-boulevard'
SOURCE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
metadata=SOURCE/'polyhaven-files.json'
if not metadata.exists():
    subprocess.run(['curl','-fsSL','--retry','2','https://api.polyhaven.com/files/patterned_cobblestone','-o',str(metadata)],check=True)
files=json.loads(metadata.read_text());manifest=[]
for role,key,quality in [('diffuse','Diffuse',72),('normal','nor_gl',80),('roughness','Rough',70)]:
    info=files[key]['2k']['jpg'];original=SOURCE/info['url'].rsplit('/',1)[1]
    if not original.exists():subprocess.run(['curl','-fsSL','--retry','2',info['url'],'-o',str(original)],check=True)
    assert hashlib.md5(original.read_bytes()).hexdigest()==info['md5'],'Upstream original checksum mismatch'
    image=Image.open(original).convert('RGB');assert image.size==(2048,2048)
    output=OUT/(original.stem+'.webp');image.save(output,format='WEBP',quality=quality,method=6)
    manifest.append({'role':role,'file':output.name,'upstream':info['url'],'license':'CC0-1.0','author':'Rob Tuytel / Poly Haven','resolution':[2048,2048],'metersPerTile':2.5,'processing':f'WebP from verified upstream at unchanged 2048x2048, quality {quality}, method 6','sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size})
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'textures':manifest,'totalRuntimeBytes':sum(row['bytes'] for row in manifest)},indent=2))
