"""Create a local runnable source distribution from explicit public allowlists.
Never traverses user databases, .env files, dependency stores or platform state.
"""
import argparse,hashlib,json,zipfile,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
P=argparse.ArgumentParser();P.add_argument('--output',type=Path,default=ROOT.parent/'Wanderwise_Home_Upgrade_Local_20260910.zip');A=P.parse_args()
files={}
root_names=['.dockerignore','README.md','VERSION','LICENSE','ASSET_LICENSES.md','requirements.txt','requirements-dev.txt','start.py','start.bat','start.command','start.sh','package.json','package-lock.json','netlify.toml','.gitignore','.env.example']
for name in root_names:files[name]=ROOT/name
for folder in ['frontend','backend','cloud','netlify','demo-data','contracts','deploy','tools','tests','docs','assets-source','dist']:
 for p in (ROOT/folder).rglob('*'):
  rel=p.relative_to(ROOT)
  if not p.is_file() or p.is_symlink():continue
  if any(x in ['__pycache__','node_modules','.netlify','input','.pytest_cache'] for x in rel.parts):continue
  if p.suffix in ['.pyc','.blend1','.blend2','.log','.secret','.local'] or '.env' in p.name and not p.name.endswith('.example'):continue
  if p.name.endswith(('.sqlite3','.sqlite3-wal','.sqlite3-shm')):continue
  if 'evidence' in rel.parts and (p.name=='failure.png' or p.name.startswith(('corner-first','acceptance-failure')) or ('home-upgrade' in rel.parts and p.name.startswith('full-'))):continue
  files[rel.as_posix()]=p
backup=ROOT.parent/'rollback-before-home-upgrade/wanderwise-v2-before-home.tar.gz'
if backup.exists():
 digest=hashlib.sha256(backup.read_bytes()).hexdigest()
 if digest!='57ac398506de11aca3028f0374094189504351be6d9be6a4966f7be3e0ed3e86':raise SystemExit('Unexpected rollback archive hash')
 files['rollback/pre-home-source.tar.gz']=backup
roaming_backup=ROOT.parent/'rollback-before-roaming-update/frontend-before-roaming.tar.gz'
if roaming_backup.exists():
 expected=json.loads((ROOT/'docs/roaming-update/BASELINE.json').read_text())['sha256']
 if hashlib.sha256(roaming_backup.read_bytes()).hexdigest()!=expected:raise SystemExit('Unexpected roaming backup hash')
 files['rollback/frontend-before-roaming.tar.gz']=roaming_backup
realistic_backup=ROOT.parent/'rollback-before-realistic-home.tar'
if realistic_backup.exists():
 expected=json.loads((ROOT/'docs/realistic-home/BASELINE.json').read_text())['sha256']
 if hashlib.sha256(realistic_backup.read_bytes()).hexdigest()!=expected:raise SystemExit('Unexpected realistic backup hash')
 files['rollback/before-realistic-home.tar']=realistic_backup
manifest={'version':(ROOT/'VERSION').read_text().strip(),'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'purpose':'Local home upgrade, not deployed; no user data or credentials','files':[{'file':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for name,p in sorted(files.items())]}
(ROOT/'MANIFEST.home.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
files['MANIFEST.home.json']=ROOT/'MANIFEST.home.json';A.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(A.output,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for name,p in sorted(files.items()):z.write(p,'Wanderwise-Land/'+name)
print(json.dumps({'file':str(A.output),'files':len(files),'bytes':A.output.stat().st_size,'sha256':hashlib.sha256(A.output.read_bytes()).hexdigest()},ensure_ascii=False))
