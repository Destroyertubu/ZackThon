"""Real browser checks for the four roaming changes. Isolated visitor, real local API.
Only explicit error cases intercept graphics creation; normal business requests are real.
"""
import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/roaming-update/evidence';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];details={}
def check(s):checks.append(s);print('PASS',s,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--disable-backgrounding-occluded-windows'])
 def ready(page,kind='home'):
  page.wait_for_function('(kind)=>wanderwiseDiagnostics?.().sceneState==="ready"&&wanderwiseDiagnostics().sceneKind===kind',arg=kind,timeout=30000)
 def new(viewport={'width':1920,'height':1080},touch=False):
  ctx=b.new_context(viewport=viewport,has_touch=touch,device_scale_factor=1);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));return ctx,page
 def close(page):page.locator('#overlay-root [data-action="close"]').first.click();page.wait_for_timeout(100)
 result={}
 try:
  ctx,page=new({'width':800,'height':900},True);ctx.add_init_script("localStorage.setItem('ww-settings',JSON.stringify({mode2d:true,quality:'low'}))");page.goto('http://127.0.0.1:18091/home?mode=2d');page.bring_to_front();ready(page);assert page.locator('canvas').count()==1;assert page.locator('#crosshair,.two-d').count()==0
  page.locator('[data-action="settings"]').first.click();assert page.locator('#setting-2d').count()==0;assert not page.evaluate("'mode2d' in JSON.parse(localStorage.getItem('ww-settings'))");check('Touch/narrow viewport/old preference/old URL all start real 3D; no simplified mode or crosshair');ctx.close()
  ctx,page=new();ctx.add_init_script('''window.workerAudit={created:0,active:0};const NativeWorker=Worker;window.Worker=class extends NativeWorker{constructor(...a){super(...a);workerAudit.created++;workerAudit.active++}terminate(){if(!this.ended){this.ended=true;workerAudit.active--}return super.terminate()}};''')
  page.goto('http://127.0.0.1:18091/home?qa=1');page.bring_to_front();ready(page);page.locator('.bottom-dock [data-action="seed"]').click();page.locator('[data-action="preset"]').first.click();ready(page,'world');page.wait_for_url('**/journeys/**')
  journey=page.request.get('http://127.0.0.1:18091/api/v1/journeys/'+page.url.split('/journeys/')[1].split('?')[0]).json()['data'];wid=journey['worldId'];world=page.request.get('http://127.0.0.1:18091/api/v1/worlds/'+wid).json()['data'];n=world['nodes'][0]
  page.wait_for_timeout(600);page.screenshot(path=str(OUT/'world-distant-labels.png'))
  page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':n['position']['x']-1.8,'y':0,'z':n['position']['z']+3.3},'yaw':0,'pitch':0,'distance':4});page.locator('[data-action="roam"]').click();page.wait_for_timeout(400);page.screenshot(path=str(OUT/'nearby-quote.png'));page.keyboard.press('Escape');close(page)
  # Look away from the text: the nearest quote remains actionable without aiming.
  page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':n['position']['x']-1.8,'y':0,'z':n['position']['z']+3.3},'yaw':3.14159265,'pitch':0,'distance':3});page.locator('[data-action="roam"]').click();page.wait_for_timeout(200)
  target=page.evaluate('wanderwiseDiagnostics().target');assert target and '@' in target;page.mouse.click(960,540);page.wait_for_function('()=>wanderwiseDiagnostics().modal==="reader"');check('Left click near quote opens actual reader while camera faces away');page.screenshot(path=str(OUT/'actual-reader.png'));close(page)
  page.locator('[data-action="roam"]').click();page.wait_for_timeout(200);page.keyboard.press('e');page.wait_for_timeout(500);page.keyboard.press('b');page.locator('[data-bag]').first.wait_for();check('E still collects and B still opens the original bag');close(page)
  page.locator('[data-action="roam"]').click();page.wait_for_timeout(200);page.keyboard.press('f');ready(page,'field');page.wait_for_timeout(300);page.screenshot(path=str(OUT/'article-field-labels.png'));check('F still enters the actual article field');page.locator('.bottom-dock [data-action="return-world"]').click();ready(page,'world')
  world=page.request.get('http://127.0.0.1:18091/api/v1/worlds/'+wid).json()['data'];n=next(x for x in world['nodes'][1:] if x['expansionState']=='unexpanded');version=world['version']
  page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':n['position']['x'],'y':0,'z':n['position']['z']+5},'yaw':.2,'pitch':.17,'distance':4});page.wait_for_timeout(2100);page.bring_to_front();page.locator('[data-action="roam"]').click();page.wait_for_function('()=>!!document.pointerLockElement')
  page.evaluate('''()=>{window.expansionAudit={unlocks:0,replacements:0};document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement)expansionAudit.unlocks++});new MutationObserver(()=>expansionAudit.replacements++).observe(document.querySelector('#app'),{childList:true});}''')
  before=page.evaluate('wanderwiseDiagnostics()');page.keyboard.down('a');page.wait_for_timeout(350);page.keyboard.up('a');moved=page.evaluate('wanderwiseDiagnostics().position')
  page.wait_for_function('(v)=>wanderwiseDiagnostics().worldVersion>v',arg=version,timeout=30000);page.wait_for_timeout(600);after=page.evaluate('wanderwiseDiagnostics()');audit=page.evaluate('({...expansionAudit,...workerAudit,locked:!!document.pointerLockElement})')
  details['expansion']={'before':before,'after':after,'audit':audit,'toasts':page.locator('#toasts').inner_text()};print('EXPANSION',json.dumps(details['expansion'],ensure_ascii=False),flush=True);assert after['active'] and audit['locked'];assert audit['unlocks']==0 and audit['replacements']==0,audit;assert after['camera']==before['camera'];assert abs(after['position']['x']-moved['x'])<.05;assert audit['created']>=1 and audit['active']==0,audit;check('Automatic expansion uses worker, keeps pointer lock/camera/movement, and never replaces app DOM');details['expansion']=audit;page.screenshot(path=str(OUT/'expanded-without-interruption.png'))
  page.keyboard.press('v');page.wait_for_timeout(200);assert page.locator('#nav-label:not(.hidden)').count()==1;page.keyboard.press('r');page.locator('#anchor-text').wait_for();close(page);page.locator('[data-action="roam"]').click();page.keyboard.press('t');page.wait_for_function('()=>wanderwiseDiagnostics().modal==="anchors"');close(page);check('V navigation, R thought editor, and T anchor list retain their original meanings')
  page.locator('.bottom-dock [data-action="pause"]').click();page.locator('[data-action="pause-home"]').click();ready(page);page.reload();ready(page);page.locator('.bottom-dock [data-action="bag"]').click();page.locator('[data-bag]').first.wait_for();close(page);check('Save home and refresh preserve the collected excerpt')
  # Actual WebGL context loss must give retry, never silently select another mode.
  page.evaluate("document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");page.locator('#scene-load [data-action="retry-scene"]').wait_for();assert page.locator('.two-d,#setting-2d,[data-action="fallback-2d"]').count()==0;page.locator('[data-action="retry-scene"]').click();ready(page);assert page.locator('canvas').count()==1;check('Real context loss recovers through retry with one fresh canvas, no 2D fallback');ctx.close()
  ctx,page=new();ctx.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(k,...a){if(k==='webgl2'&&!window.allowGraphics)return null;return original.call(this,k,...a)}")
  page.goto('http://127.0.0.1:18091/home');page.bring_to_front();page.locator('#scene-load [data-action="retry-low-quality"]').wait_for();assert page.locator('.two-d').count()==0;page.evaluate('window.allowGraphics=true');page.locator('[data-action="retry-low-quality"]').click();ready(page);check('Unsupported WebGL reports an explicit error; low-quality retry starts actual 3D');ctx.close()
  assert not errors,errors;result={'status':'passed','checks':checks,'errors':errors,'details':details,'browser':b.version,'conditions':'macOS Apple M5, headed Chrome; 1920x1080 DPR1 plus 800x900 touch context; local real HTTP and isolated visitor'}
 except Exception as e:
  import traceback;traceback.print_exc();result={'status':'failed','checks':checks,'error':str(e),'errors':errors,'details':details};print('FAIL',str(e),flush=True)
  if not page.is_closed():page.screenshot(path=str(OUT/'failure.png'))
 finally:
  (OUT/'browser-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False),flush=True);b.close()
