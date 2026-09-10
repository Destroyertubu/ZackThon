"""Local, whitelist-only receipt/report generator. Never traverses env or user storage."""
from pathlib import Path
import json,hashlib,re,datetime
ROOT=Path(__file__).resolve().parents[1];src=ROOT/'assets-source/room-production';out=ROOT/'reports/production-assets';out.mkdir(parents=True,exist_ok=True)
catalog=json.loads((ROOT/'design/home/asset_catalog.json').read_text());stats=json.loads((src/'full-stats.json').read_text());records=[]
scriptfiles=sorted((ROOT/'tools').glob('production-*.py'))+[ROOT/'tools/build-production-room.py',ROOT/'tools/optimize-production.mjs',ROOT/'tools/finalize-production-room.py']
for a in catalog:
 id=a['id'];parts=[s for s in stats if re.match('VIS_'+id+r'(?:[._]|$)',s['name'])];component_names=[p['name'] for p in parts]
 scripts=[p for p in scriptfiles if id in p.read_text()]
 records.append({'id':id,'name':a.get('name'),'state':'implemented_geometry_review_pending' if parts else 'deferred_or_existing_system','authorship':'Project-authored procedural Blender assets; no new third-party model acquired','official_model_source':None,'recipe_source':'User-supplied Wanderwise Room Production Kit 2026-09-10','source_files':[str(p.relative_to(ROOT)) for p in scripts],'editable_source':'assets-source/room-production/full.blend' if parts else None,'runtime_file':'frontend/assets/home/production/full.glb' if parts else None,'visible_source_triangles':sum(p['triangles'] for p in parts),'actual_components':component_names,'license':'Project LICENSE; new original assets are not separately dedicated to CC0. User-supplied reference pixels are not redistributed.','distribution':'source scripts/editable scene and optimized runtime GLB; no restricted third-party raw assets','review':'Geometry names establish existence, not aesthetic/component acceptance. See 28-case and fixed-camera review.'})
files=[src/'full.blend',ROOT/'frontend/assets/home/production/full.glb',ROOT/'frontend/vendor/meshoptimizer/meshopt_decoder.mjs',ROOT/'frontend/vendor/meshoptimizer/LICENSE.md',*scriptfiles,*sorted((ROOT/'design/home').glob('*.json'))]
manifest={'version':'1.3.0-production-room','generatedAt':datetime.datetime.now().astimezone().isoformat(),'files':[{'path':str(f.relative_to(ROOT)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files if f.exists()],'assets':records,'external_runtime':[{'name':'meshoptimizer','version':'1.2.0','author':'Arseny Kapoulkine','source':'https://github.com/zeux/meshoptimizer','licenseFile':'frontend/vendor/meshoptimizer/LICENSE.md','license':'MIT','obtained':'existing pinned local npm dependency; vendored on 2026-09-10','modified':False}]}
(out/'asset-receipts.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
rows=['# 逐资产存在性与缺口','', '这张表从可编辑Blender几何统计生成；存在部件不等于所有该资产部件已验收。业务、声音、角色等非模型项继续使用旧实现或列作未制作。','', '| ID | 几何三角面 | 当前状态 |','|---|---:|---|']
for r in records:rows.append(f"| {r['id']} | {r['visible_source_triangles']} | {'已有几何，逐项审美/LOD待验' if r['actual_components'] else '本轮未新建；未勾通过'} |")
(out/'coverage.md').write_text('\n'.join(rows)+'\n');print('Wrote receipts for',len(records),'catalog entries')
