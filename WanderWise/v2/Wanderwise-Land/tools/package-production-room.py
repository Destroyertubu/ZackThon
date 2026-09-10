"""Whitelist release: source + prebuilt runtime, excluding credentials, data and dev runtimes."""
from pathlib import Path
import zipfile,json,hashlib
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'releases/Wanderwise-Room-1.3.0-local.zip';out.parent.mkdir(exist_ok=True)
files=set()
for name in ['start.py','start.bat','start.command','start.sh','requirements.txt','requirements-dev.txt','VERSION','LICENSE','ASSET_LICENSES.md','package.json','package-lock.json']:
 files.add(ROOT/name)
for folder in ['frontend','backend','demo-data','design/home','tests']:
 for p in (ROOT/folder).rglob('*'):
  if not p.is_file() or p.is_symlink() or '__pycache__' in p.parts or p.suffix=='.pyc':continue
  rel=p.relative_to(ROOT)
  if str(rel).startswith('frontend/assets/home/') and p.name not in ['full.glb','full.json','home-realistic-full.glb','scene.json','scene.previous.json']:continue
  files.add(p)
for pattern in ['tools/production-*.py','tools/build-production-room.py','tools/finalize-production-room.py','tools/optimize-production.mjs','tools/check_frontend.mjs','tools/package-production-room.py','tests/production_*.py','docs/PRODUCTION_ROOM.md','docs/PRODUCTION_ROOM_REPORT.md','assets-source/ASSET_LICENSES.md','assets-source/room-production/full.blend','assets-source/room-production/full-stats.json','assets-source/polyhaven/CC0-1.0.txt','assets-source/polyhaven/manifest.json','10_execution/status.json','10_execution/worktree.json','10_execution/WORK_LOG.md','reports/G*.md','reports/environment.lock.json']:
 files.update(p for p in ROOT.glob(pattern) if p.is_file() and not p.is_symlink())
for folder in ['production-assets','production-acceptance','production-collision','full-browser','full-gltf']:
 files.update(p for p in (ROOT/'reports'/folder).rglob('*') if p.is_file() and p.suffix in ['.md','.json','.png','.txt','.gz','.webm'])
for p in files:
 rel=p.relative_to(ROOT);assert not p.is_symlink();assert not any(part in {'.env','data','.venv','node_modules','.netlify','.git'} for part in rel.parts);assert p.suffix not in ['.secret','.sqlite3','.db','.pyc']
manifest={'version':'1.3.0-production-room','exclusions':'No environment files, keys, databases, visitor data, node_modules, Python venv, reference images or commercial original assets.','files':[{'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]}
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(files):z.write(p,'Wanderwise-Room/'+str(p.relative_to(ROOT)))
 z.writestr('Wanderwise-Room/RELEASE_MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
 z.writestr('Wanderwise-Room/README.md','# 漫知录 · 林间灯火\n\n运行 python3 start.py（Windows可双击start.bat）。无需Node或Blender。\n\n完整启动/回滚说明见 docs/PRODUCTION_ROOM.md，实际验证与缺口见 docs/PRODUCTION_ROOM_REPORT.md。本包不是全部87资产、28专项均通过的声明。\n')
print(out);print(len(files),'files,',out.stat().st_size,'bytes')
