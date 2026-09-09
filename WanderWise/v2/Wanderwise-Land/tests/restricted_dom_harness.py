"""Restricted-environment DOM integration harness.
about:blank + in-memory JS bundle; actual FastAPI TestClient handles API calls.
History/localStorage/IndexedDB are test shims. Does NOT validate origin cookies,
network/CSP enforcement, WebGL, pointer lock, or real IndexedDB persistence.
"""
from pathlib import Path
import sys,os,re,json,base64
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
OUT=ROOT/'reports'/'restricted-dom';OUT.mkdir(parents=True,exist_ok=True)
import tempfile
TEMP=tempfile.TemporaryDirectory(prefix='wanderwise-dom-')
os.environ['WANDERWISE_DB']=str(Path(TEMP.name)/'test.sqlite3');os.environ['WW_HOURLY_TASK_LIMIT']='1000'
from fastapi.testclient import TestClient
from backend.app.main import app
from playwright.sync_api import sync_playwright
FILES=['engine/math.js','engine/geometry.js','engine/renderer.js','engine/scenes.js','engine/engine.js','storage.js']
parts=[]
for f in FILES:
 text=(ROOT/'frontend'/f).read_text();text=re.sub(r'^import .*?;\n','',text,flags=re.M);text=re.sub(r'^export \{[^}]+\};?\s*$','',text,flags=re.M);text=re.sub(r'\bexport (?=(const|let|class|function))','',text);parts.append(text)
shim="""
const _stores={outbox:new Map(),cache:new Map(),drafts:new Map()};
Object.assign(local,{get:async(s,k)=>_stores[s].get(k),put:async(s,k,v)=>_stores[s].set(k,{id:k,value:structuredClone(v)}),del:async(s,k)=>_stores[s].delete(k),all:async(s)=>[..._stores[s].values()],clear:async(s)=>_stores[s].clear()});
"""
appjs=(ROOT/'frontend/app.js').read_text();appjs=re.sub(r'^import .*?;\n','',appjs,flags=re.M)
parts.extend([shim,appjs])
bundle='\n'.join(parts)
logo='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'frontend/assets/mark.svg').read_bytes()).decode()
bundle=bundle.replace('/static/assets/mark.svg',logo)
css=(ROOT/'frontend/style.css').read_text()
with TestClient(app) as client, sync_playwright() as p:
 client.headers['Origin']='http://testserver'
 def bridge(payload):
  headers={k:v for k,v in payload.get('headers',{}).items() if k.lower() not in ('origin','host')};headers['Origin']='http://testserver'
  r=client.request(payload['method'],payload['path'],content=payload.get('body'),headers=headers)
  return {'ok':r.is_success,'status':r.status_code,'body':r.text}
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.emulate_media(reduced_motion='reduce')
 page.expose_function('backendBridge',bridge)
 page.set_content('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>'+css+'</style></head><body><canvas id="world"></canvas><div class="atmosphere"></div><div id="app"></div><div id="overlay-root"></div><div id="toasts" role="status"></div></body></html>')
 page.evaluate('''() => {crypto.randomUUID=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');const m=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}});history.pushState=()=>{};history.replaceState=()=>{};window.fetch=async(path,options={})=>{const r=await window.backendBridge({path,method:options.method||'GET',body:options.body||null,headers:options.headers||{}});return {ok:r.ok,status:r.status,json:async()=>JSON.parse(r.body)}};}''')
 page.add_script_tag(content=bundle)
 page.wait_for_selector('[data-action="enter-home"]',timeout=10000)
 page.screenshot(path=str(OUT/'dom-landing.png'))
 page.locator('[data-action="enter-home"]').click();page.wait_for_selector('.two-d-home');page.screenshot(path=str(OUT/'dom-home.png'))
 page.locator('.bottom-dock [data-action="seed"]').click();page.wait_for_selector('[data-action="preset"]');page.screenshot(path=str(OUT/'dom-seeds.png'))
 page.locator('[data-action="preset"]').first.click();page.wait_for_selector('.topics [data-action="topic"]',timeout=15000)
 print('WORLD',page.evaluate('wanderwiseDiagnostics()'))
 page.locator('.topics [data-action="topic"]').first.click();page.wait_for_timeout(2200)
 page.locator('[data-action="read-content"]').click();page.wait_for_selector('.article-paragraph');page.screenshot(path=str(OUT/'dom-reader.png'))
 page.locator('[data-action="collect-excerpt"]').nth(0).click();page.wait_for_timeout(350)
 page.locator('[data-action="collect-excerpt"]').nth(1).click();page.wait_for_timeout(350)
 page.locator('[data-action="enter-field"]').click();page.wait_for_function('wanderwiseDiagnostics().page==="field"',timeout=10000)
 print('FIELD',page.evaluate('wanderwiseDiagnostics()'));page.screenshot(path=str(OUT/'dom-field.png'))
 page.locator('.bottom-dock [data-action="return-world"]').click();page.wait_for_function('wanderwiseDiagnostics().page==="world"')
 page.locator('.topics [data-action="topic"]').first.click();page.locator('#overlay-root [data-action="anchor"]').click();page.locator('#anchor-text').fill('测试：保留来源，再建立自己的联系。');page.locator('#anchor-form button[type="submit"]').click();page.wait_for_timeout(500)
 page.locator('.bottom-dock [data-action="bag"]').click();page.wait_for_selector('[data-bag]');assert page.locator('[data-bag]').count()==2
 page.locator('[data-bag]').nth(0).check();page.locator('[data-bag]').nth(1).check();page.screenshot(path=str(OUT/'dom-bag.png'))
 page.locator('[data-action="selected-synthesis"]').click();page.wait_for_selector('#synthesis-form');page.locator('#synthesis-question').fill('如何保留真实来源？');page.locator('#synthesis-form button[type="submit"]').click();page.wait_for_selector('#insight-form',timeout=10000)
 page.locator('#insight-title').fill('先保存出处，再连接观点');page.locator('#insight-core').fill('两份材料让我注意到，整理观点前需要保存来源和语境。这是测试中手工写下的联系，而非模型生成结论。');page.locator('#insight-connection').fill('保留出处让未来复查与修订变得可能。');page.locator('#insight-form button[type="submit"]').click();page.wait_for_function('wanderwiseDiagnostics().modal==="insight-view"',timeout=10000);page.screenshot(path=str(OUT/'dom-insight.png'))
 page.locator('#overlay-root [data-action="close"]').click();page.locator('.bottom-dock [data-action="pause"]').click();page.locator('[data-action="pause-home"]').click();page.wait_for_function('wanderwiseDiagnostics().page==="home"',timeout=10000)
 page.locator('.bottom-dock [data-action="journal"]').click();page.wait_for_selector('.journal-card');page.screenshot(path=str(OUT/'dom-journal.png'));page.locator('[data-action="journey-map"]').click();page.wait_for_selector('.map-wrap');page.screenshot(path=str(OUT/'dom-map.png'))
 print('ERRORS',errors)
 assert not errors,errors
 result={'status':'passed','browser':browser.version,'mode':'2D DOM + in-process FastAPI transport; storage/history shims','assertions':['guest home','preset world','source reader','two distinct collections','enter/return field','private anchor','bag selection','manual synthesis save','pause home','journal','semantic map'],'pageErrors':errors}
 (OUT/'dom-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 browser.close()
