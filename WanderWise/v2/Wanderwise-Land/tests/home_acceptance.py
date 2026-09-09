# Historical v1.1.0-home.1 browser script; expects the retired 2D interface.
# Current regression: tests/roaming_browser.py and tests/roaming_worker_browser.py.
"""Real browser/HTTP home regression and sustained run. Uses an isolated visitor.
No production data, credentials, Zhihu or model APIs are used. Camera-only QA poses
are opt-in localhost tools; business steps are performed through the actual DOM.
"""
import argparse,json,time,math,statistics,gzip,hashlib,platform,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
P=argparse.ArgumentParser();P.add_argument('--base-url',default='http://127.0.0.1:18091');P.add_argument('--soak-seconds',type=int,default=1200);P.add_argument('--headless',action='store_true');P.add_argument('--output-dir',type=Path);A=P.parse_args()
OUT=A.output_dir or ROOT/'docs/home-upgrade/evidence';OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];samples=[];rounds=[];viewpoints={};last_stamp=0

def check(s):checks.append(s);print('PASS',s,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=A.headless,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--disable-backgrounding-occluded-windows','--window-size=1920,1080'])
 ctx=b.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1);page=ctx.new_page();cdp=ctx.new_cdp_session(page)
 page.on('pageerror',lambda e:errors.append(str(e)))
 def ready(kind=None):
  page.wait_for_function('(k)=>window.wanderwiseDiagnostics?.().sceneState==="ready" && (!k || (wanderwiseDiagnostics().page===k && wanderwiseDiagnostics().sceneKind===k))',arg=kind,timeout=30000)
 def close():
  if page.locator('#overlay-root [data-action="close"]').count():page.locator('#overlay-root [data-action="close"]').click()
 def mode2d(enabled):
  page.locator('[data-action="settings"]').first.click();page.locator('#setting-2d').set_checked(enabled);page.locator('[data-action="apply-settings"]').click();page.wait_for_function('(v)=>wanderwiseDiagnostics().mode2d===v',arg=enabled)
  if not enabled:page.wait_for_function('()=>wanderwiseDiagnostics().sceneState==="ready" && wanderwiseDiagnostics().sceneKind===wanderwiseDiagnostics().page',timeout=30000)
 def view(name,position,yaw=0,pitch=.15,distance=3.8):
  v={'position':position,'yaw':yaw,'pitch':pitch,'distance':distance};page.evaluate('(v)=>wanderwiseRenderQA.setView(v)',v);page.wait_for_timeout(450);viewpoints[name]=v
 def snap(name):page.screenshot(path=str(OUT/(name+'.png')))
 def facility(id,approach):
  t=next(t for t in page.evaluate('wanderwiseDiagnostics().facilities') if t['id']==id)['position'];dx=t['x']-approach['x'];dz=t['z']-approach['z'];yaw=math.atan2(-dx,-dz)
  view('facility-'+id,approach,yaw,0,3.3);page.locator('[data-action="roam"]').click();page.wait_for_function('()=>wanderwiseDiagnostics().active');page.wait_for_function('(id)=>wanderwiseDiagnostics().target===id',arg=id,timeout=4000);snap('facility-'+id)
  for typ in ['mousePressed','mouseReleased']:cdp.send('Input.dispatchMouseEvent',{'type':typ,'x':960,'y':540,'button':'left','clickCount':1})
  expected={'door':'seed','cabinet':'bag','synthesis':'synthesis','journal':'journal','phone':'phone'}[id]
  page.wait_for_function('(m)=>wanderwiseDiagnostics().modal===m',arg=expected);check('spatial left-click '+id+' -> '+expected)
 def frames():
  global last_stamp
  info=page.evaluate('wanderwiseRenderQA.inspect()')
  if info:
   for stamp,ms,hidden in info.get('frameTrace',[]):
    if stamp>last_stamp:samples.append([stamp,ms,hidden])
   if info.get('frameTrace'):last_stamp=info['frameTrace'][-1][0]
  return info
 result={};started=time.monotonic()
 try:
  page.goto(A.base_url+'/home?qa=1');page.bring_to_front();ready('home');cold=time.monotonic()-started;page.wait_for_timeout(800)
  gpu=page.evaluate('()=>{const g=document.querySelector("canvas").getContext("webgl2"),e=g.getExtension("WEBGL_debug_renderer_info");return g.getParameter(e.UNMASKED_RENDERER_WEBGL)}')
  transport=page.evaluate('()=>performance.getEntriesByType("resource").map(r=>({name:new URL(r.name).pathname,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize}))')
  snap('final-spawn');check('cold home ready and one canvas');assert page.locator('canvas').count()==1
  facility('cabinet',{'x':-.76,'y':0,'z':-1.5});close()
  facility('synthesis',{'x':-2.35,'y':0,'z':.95});close()
  facility('journal',{'x':1.05,'y':0,'z':-1.55});close()
  facility('phone',{'x':3.2,'y':0,'z':1.1});assert '未开放' in page.locator('#overlay-root').inner_text();close();check('phone remains honestly unavailable')
  facility('door',{'x':-3.2,'y':0,'z':-2.5})
  pos=page.evaluate('wanderwiseDiagnostics().position');page.locator('#seed-input').fill('窗边的思考 WASD 中文输入');page.locator('#seed-input').press('w');assert page.evaluate('wanderwiseDiagnostics().position')==pos;check('Chinese input isolated from movement')
  page.locator('[data-action="preset"]').first.click();ready('world');page.wait_for_timeout(700);snap('final-world');check('door enters real preset world')
  # Same established reader and storage workflow; 2D is a real supported UI, no HTTP bridge.
  mode2d(True);page.locator('.topics [data-action="topic"]').first.click();page.wait_for_timeout(2200);page.locator('[data-action="read-content"]').click();page.locator('.article-paragraph').first.wait_for()
  for i in [0,1,0]:page.locator('[data-action="collect-excerpt"]').nth(i).click();page.wait_for_timeout(300)
  page.locator('[data-action="enter-field"]').click();page.wait_for_function('()=>wanderwiseDiagnostics().page==="field"');mode2d(False);ready('field');snap('final-field');check('reader collection and true article field')
  page.locator('.bottom-dock [data-action="return-world"]').click();ready('world');mode2d(True)
  page.locator('.topics [data-action="topic"]').first.click();page.locator('#overlay-root [data-action="anchor"]').click();page.locator('#anchor-text').fill('书屋验收：记录出处，再连接观点。');page.locator('#anchor-form button[type="submit"]').click();page.wait_for_timeout(350)
  page.locator('.bottom-dock [data-action="bag"]').click();page.locator('[data-bag]').first.wait_for();assert page.locator('[data-bag]').count()==2;check('same bag, deduplication and private anchor')
  page.locator('[data-bag]').nth(0).check();page.locator('[data-bag]').nth(1).check();page.locator('[data-action="selected-synthesis"]').click();page.locator('#synthesis-question').fill('两份材料如何互相补充？');page.locator('#synthesis-form button[type="submit"]').click();page.locator('#insight-form').wait_for()
  page.locator('#insight-title').fill('窗边的联系');page.locator('#insight-core').fill('这是本次验收输入的手工理解，保留两份材料的出处。');page.locator('#insight-connection').fill('两份材料共同支持可复查的记录。');page.locator('#insight-form button[type="submit"]').click();page.wait_for_function('()=>wanderwiseDiagnostics().modal==="insight-view"');check('existing manual synthesis and insight save');close()
  page.locator('.bottom-dock [data-action="pause"]').click();page.locator('[data-action="pause-home"]').click();page.wait_for_function('()=>wanderwiseDiagnostics().page==="home"');mode2d(False);ready('home')
  page.reload();ready('home');page.locator('.bottom-dock [data-action="bag"]').click();page.locator('[data-bag]').first.wait_for();assert page.locator('[data-bag]').count()>=2;close();page.locator('.bottom-dock [data-action="journal"]').click();page.locator('.journal-card').first.wait_for();close();check('saved home, refresh, collection and journal')
  # Refresh removed QA from the path when navigation changed it; opt it back in locally.
  page.goto(A.base_url+'/home?qa=1');ready('home')
  # A wall/opaque booth rear must block interaction even inside 3m.
  view('behind-phone',{'x':4.8,'y':0,'z':4.40},0,0,2);page.locator('[data-action="roam"]').click();page.wait_for_timeout(300);assert page.evaluate('wanderwiseDiagnostics().target')!='phone';page.keyboard.press('Escape');check('opaque wall blocks facility targeting')
  # Near-wall camera rotations may shorten the boom, never cross the wall.
  for i in range(8):
   view('near-wall-'+str(i),{'x':-5.4,'y':0,'z':-2.45},i*math.pi/4,0,4);e=page.evaluate('wanderwiseDiagnostics().eye');assert -5.85<e[0]<5.85 and -4.9<e[2]<4.9,e
  check('eight near-wall camera angles remain inside room')
  view('final-diagonal',{'x':0,'y':0,'z':0},-.85,.33,6);snap('final-diagonal')
  view('final-window-detail',{'x':1.1,'y':0,'z':-1.1},-.38,.12,3.8);snap('final-window-detail')
  view('final-hearth-detail',{'x':3,'y':0,'z':1.4},-1.2,.20,4);snap('final-hearth-detail')
  page.locator('[data-action="settings"]').first.click();page.locator('#setting-quality').select_option('low');page.locator('#setting-auto').uncheck();page.locator('[data-action="apply-settings"]').click();ready('home');page.wait_for_timeout(5000);low=page.evaluate('wanderwiseDiagnostics().metrics');snap('final-low-quality');check('low quality remains usable')
  page.locator('[data-action="settings"]').first.click();page.locator('#setting-quality').select_option('medium');page.locator('[data-action="apply-settings"]').click();ready('home');page.wait_for_timeout(1200)
  # Genuine visibility/focus loss, then return without stuck movement keys.
  page.locator('[data-action="roam"]').click();other=ctx.new_page();other.goto('about:blank');other.bring_to_front();page.wait_for_timeout(300);assert not page.evaluate('wanderwiseDiagnostics().active');other.close();page.bring_to_front();check('focus loss pauses movement')
  soak_start=time.monotonic();baseline=None;raw_start=page.evaluate('performance.now()');last_stamp=raw_start
  for n in range(10):
   page.locator('.bottom-dock [data-action="journal"]').click();page.locator('[data-action="resume-journey"]').first.click();ready('world');page.wait_for_timeout(500)
   page.locator('.bottom-dock [data-action="pause"]').click();page.locator('[data-action="pause-home"]').click();ready('home');page.wait_for_timeout(500)
   d=page.evaluate('wanderwiseDiagnostics()');rounds.append({'round':n+1,'metrics':d['metrics'],'status':d['sceneState']});frames();print('ROUND',n+1,d['metrics'],flush=True)
  check('10 real home/world round trips')
  # Warm same label set at each checkpoint so resource comparisons are meaningful.
  view('soak',{'x':0,'y':0,'z':.65},0,.22,3.8);page.wait_for_timeout(1200);baseline=page.evaluate('wanderwiseDiagnostics().metrics')
  tick=0
  while time.monotonic()-soak_start<A.soak_seconds:
   page.wait_for_timeout(5000);frames();tick+=1
   if tick%12==0:
    d=page.evaluate('wanderwiseDiagnostics()');assert d['sceneState']=='ready';assert page.locator('canvas').count()==1;assert not errors,errors;print('SOAK',round(time.monotonic()-soak_start),d['metrics'],flush=True)
   if tick%4==0:
    # Real key input in a clear central path, alternating direction without leaving the room.
    page.locator('[data-action="roam"]').click();key='a' if tick%8==0 else 'd';page.keyboard.down(key);page.wait_for_timeout(180);page.keyboard.up(key);page.keyboard.press('Escape')
  duration=time.monotonic()-soak_start;final=page.evaluate('wanderwiseDiagnostics().metrics');frames();assert not errors,errors
  if A.soak_seconds>=1200:check('at least 20 minutes continuous browser operation')
  visible=[ms for stamp,ms,hidden in samples if not hidden and stamp>=raw_start];ordered=sorted(visible)
  perf={'sampleCount':len(visible),'medianFps':1000/statistics.median(visible),'p95ms':ordered[int(len(ordered)*.95)],'includesSceneChanges':True,'rawFrameTimes':True}
  result={'status':'passed','checks':checks,'browser':b.version,'device':{'platform':platform.platform(),'gpu':gpu,'dpr':1,'viewport':[1920,1080],'headed':not A.headless},'network':'localhost HTTP; fresh browser context, no disk browser cache; OS filesystem cache not cleared','coldSecondsToReadyAndFirstRender':cold,'startupTransfers':transport,'lowQuality':low,'soakSeconds':duration,'roundTrips':rounds,'resourceBaseline':baseline,'resourceFinal':final,'performance':perf,'errors':errors,'sourceModelSha256':hashlib.sha256((ROOT/'frontend/assets/home/home-full.glb').read_bytes()).hexdigest()}
  with gzip.open(OUT/'raw-frames.json.gz','wt') as f:json.dump(samples,f)
 except Exception as e:
  result={'status':'failed','checks':checks,'error':str(e),'errors':errors,'roundTrips':rounds};snap('acceptance-failure');print('FAIL',str(e),flush=True)
 finally:
  (OUT/'home-acceptance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));(OUT/'acceptance-viewpoints.json').write_text(json.dumps(viewpoints,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ['startupTransfers','roundTrips']},ensure_ascii=False),flush=True);b.close()
