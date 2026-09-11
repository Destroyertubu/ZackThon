"""Small Python runtime package; development sources/evidence remain in the project.
Uses public directory allowlists; never visits environment files or visitor data.
"""
import json,hashlib,zipfile,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'Wanderwise_Realistic_Home_Runtime_20260910.zip';files={}
for name in ['VERSION','LICENSE','requirements.txt','start.py','start.bat','start.command','start.sh']:
 files[name]=ROOT/name
for directory in ['frontend','backend','demo-data','contracts']:
 for p in (ROOT/directory).rglob('*'):
  if not p.is_file() or p.is_symlink() or '__pycache__' in p.parts or p.suffix in ['.pyc','.sqlite3','.secret']:continue
  rel=p.relative_to(ROOT).as_posix()
  if rel.startswith('frontend/assets/home/') and p.name not in ['scene.json','home-realistic-full.glb','home-realistic-full.build.json']:continue
  files[rel]=p
for name in ['manifest.json','CC0-1.0.txt']:files['licenses/polyhaven/'+name]=ROOT/'assets-source/polyhaven'/name
files['licenses/ASSETS.md']=ROOT/'docs/realistic-home/ASSETS.md'
readme='''# 漫知录 · 写实知识书房 1.2.0

安装 Python 3.11+ 后在本目录执行 `python3 start.py`，或使用 start.bat / start.command。
浏览器访问 http://127.0.0.1:8000 。首次 Python 依赖安装需要联网。
不需要 Node.js、Blender 或前端 CDN。不要直接双击 frontend/index.html。

本包包含 Python 后端、可直接运行的前端源码、完整写实 GLB、Rapier 与 Three.js。
Blender 可编辑源文件、制作脚本、旧版备份和完整测试截图位于配套的 Wanderwise-Land 工程。
本轮未部署到公网。原有收藏、旅程、日志和手工合成保持；电话亭仍为未开放。
升级前关闭旧 Python 服务并保留原数据目录和配置。运行包不含用户数据库或凭证。
详细资产作者和许可见 licenses，库许可证在 frontend/vendor 下。
'''
manifest={'version':(ROOT/'VERSION').read_text().strip(),'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'kind':'Python runtime; development source assets and evidence are delivered in companion project','files':[{'file':n,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for n,p in sorted(files.items())]}
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for n,p in sorted(files.items()):z.write(p,'Wanderwise-Land/'+n)
 z.writestr('Wanderwise-Land/README.md',readme);z.writestr('Wanderwise-Land/MANIFEST.json',json.dumps(manifest,indent=2))
report={'file':str(OUT),'files':len(files)+2,'bytes':OUT.stat().st_size,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()};(ROOT/'docs/realistic-home/evidence/runtime-package.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
