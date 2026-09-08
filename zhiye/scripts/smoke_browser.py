from playwright.sync_api import sync_playwright
from pathlib import Path
import json, time, re, sys, tempfile, os
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.config import Config
from dataclasses import replace
ROOT=Path(__file__).resolve().parents[1]
tmp=tempfile.TemporaryDirectory()
client=TestClient(create_app(replace(Config(),mode='demo',secret='',provider='http',db_path=str(Path(tmp.name)/'test.sqlite3'))))
def handle_fetch(path, options):
    r=client.request(options.get('method','GET'),path,content=options.get('body'),headers={'Content-Type':'application/json'})
    return {'status':r.status_code,'body':r.text}
html=(ROOT/'web/index.html').read_text()
html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
html=html.replace('<link rel="stylesheet" href="/static/style.css">','<style>'+(ROOT/'web/style.css').read_text()+'</style>')
import base64
mark='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'web/assets/mark.svg').read_bytes()).decode()
html=html.replace('/static/assets/mark.svg',mark)
bridge='window.__ZHIYE_TEST__=true;window.fetch=async(path,o={})=>{const r=await window.__testFetch(String(path),{method:o.method||"GET",body:o.body||null});return new Response(r.body,{status:r.status,headers:{"Content-Type":"application/json"}});};'
storage_bridge=r"""
(()=>{const data=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}});
const backups=new Map();const db={createObjectStore(){},transaction(){const tx={objectStore(){return {put(v,k){backups.set(k,structuredClone(v));setTimeout(()=>tx.oncomplete?.(),0);},clear(){backups.clear();setTimeout(()=>tx.oncomplete?.(),0);},get(k){const r={result:backups.get(k)};setTimeout(()=>r.onsuccess?.(),0);return r;}}}};return tx;}};
Object.defineProperty(window,'indexedDB',{value:{open(){const r={result:db};setTimeout(()=>r.onsuccess?.(),0);return r;}}});
if(!crypto.randomUUID)crypto.randomUUID=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
})();
"""
bridge=storage_bridge+bridge
html=html.replace('</body>','<script>'+bridge+'</script><script>'+(ROOT/'previews/test-bundle.js').read_text()+'</script></body>')
(ROOT/'previews/test-harness.html').write_text(html)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.expose_function('__testFetch',handle_fetch)
    page.set_content(html,wait_until='load')
    page.wait_for_function('window.__zhiye !== undefined',timeout=20000)
    page.wait_for_timeout(1500)
    page.screenshot(path=str(ROOT/'previews/01-landing.png'),full_page=True,animations='disabled')
    print('LANDING',page.title(), 'ERRORS',errors)
    page.click('#start-btn')
    page.wait_for_selector('.near-card',timeout=20000)
    page.wait_for_timeout(1500)
    initial=page.evaluate('window.__zhiye.worldView.player.z')
    page.keyboard.down('w');page.wait_for_timeout(250);page.keyboard.up('w')
    assert page.evaluate('window.__zhiye.worldView.player.z')<initial
    page.screenshot(path=str(ROOT/'previews/02-exploration.png'),full_page=True,animations='disabled')
    print('EXPLORE',page.locator('#hud-title').inner_text(), 'cards',page.locator('.near-card').count())
    page.keyboard.press('e')
    page.wait_for_timeout(400)
    page.evaluate("async()=>{const x=window.__zhiye;const n=x.state.world.nodes[1];x.worldView.jump(n);await x.visitNode(n.id);}")
    page.wait_for_timeout(1000)
    page.keyboard.press('e')
    page.click('[data-panel="bag"]')
    page.wait_for_selector('.knowledge-card')
    page.locator('.selection-box').nth(0).check()
    page.locator('.selection-box').nth(1).check()
    page.fill('#synthesis-note','热爱不一定先于行动，我想在反复尝试中寻找自己的方向。')
    page.screenshot(path=str(ROOT/'previews/03-backpack.png'),full_page=True,animations='disabled')
    page.get_by_role('button',name='搭一座灵感桥').click()
    page.wait_for_timeout(300)
    print('BAG',page.locator('.knowledge-card').count())
    page.get_by_role('button',name='关闭面板').click()
    page.keyboard.press('r')
    page.fill('#anchor-text','我发现，问题的意义也会在走路的过程中改变。')
    page.get_by_role('button',name='把想法留在这里').click()
    page.wait_for_timeout(800)
    page.screenshot(path=str(ROOT/'previews/04-anchor.png'),full_page=True,animations='disabled')
    page.get_by_role('button',name='关闭面板').click()
    page.keyboard.press('m')
    page.wait_for_selector('.graph-frame')
    page.screenshot(path=str(ROOT/'previews/05-canvas.png'),full_page=True,animations='disabled')
    # Modal focus must prevent keyboard movement.
    before=page.evaluate('JSON.stringify(window.__zhiye.worldView.player)')
    page.keyboard.down('w');page.wait_for_timeout(250);page.keyboard.up('w')
    assert page.evaluate('JSON.stringify(window.__zhiye.worldView.player)')==before
    assert page.locator('.knowledge-bridge').count()==1
    page.get_by_role('button',name='关闭面板').click()
    page.evaluate('window.__zhiye.saveJourney(true)')
    assert len(client.get('/api/journeys').json())==1
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.expose_function('__testFetch',handle_fetch)
    mobile.set_content(html,wait_until='load')
    mobile.wait_for_function('window.__zhiye !== undefined',timeout=20000)
    # An existing server archive restores on boot; return to seed input for this view.
    mobile.click('#home-btn');mobile.wait_for_timeout(500)
    mobile.screenshot(path=str(ROOT/'previews/06-mobile.png'),full_page=True,animations='disabled')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    print('ERRORS',errors)
    assert not errors,errors
    (ROOT/'previews/browser-smoke.json').write_text(json.dumps({'errors':errors,'renderer':page.evaluate('window.__zhiye.worldView.renderer.name'),'bagCount':page.evaluate('window.__zhiye.state.journey.bag.length'),'thoughtCount':page.evaluate('window.__zhiye.state.journey.thoughts.length'),'knowledgeBridges':1,'modalMovementPaused':True,'wasdMovement':True,'serverArchiveSaved':True,'mobileViewport':'390x844','testTransport':'FastAPI TestClient / ASGI bridge','storage':'Mocked for opaque about:blank origin; native IndexedDB not tested'},ensure_ascii=False,indent=2))
    browser.close()
