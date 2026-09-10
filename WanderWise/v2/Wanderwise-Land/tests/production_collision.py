"""Keyboard/camera regressions on the final production GLB. QA sets starts only."""
import json,math,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/production-collision';OUT.mkdir(parents=True,exist_ok=True);checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:18095/home?qa=1');page.wait_for_function('()=>wanderwiseDiagnostics().sceneState==="ready"',timeout=45000)
 def state():return page.evaluate('()=>wanderwiseDiagnostics()')
 def start(x,z,yaw=0):
  page.keyboard.press('Escape')
  if page.locator('#overlay-root [data-action="close"]').count():page.locator('#overlay-root [data-action="close"]').first.click()
  page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':x,'y':0,'z':z},'yaw':yaw,'pitch':.15,'distance':3.2});page.locator('[data-action="roam"]').click()
 def hold(keys,ms):
  for k in keys:page.keyboard.down(k)
  page.wait_for_timeout(ms)
  for k in keys:page.keyboard.up(k)
  return state()['position']
 def record(id,detail):checks.append({'id':id,'status':'passed','detail':detail});print(id,'PASS',flush=True)
 try:
  start(0,3.65);page.wait_for_timeout(30000);v=state()['position'];assert -.01<=v['y']<.03,v;record('K01',{'standSeconds':30,'position':v})
  stops=[]
  for x,z,yaw,axis,limit,less in [(-4.7,3,math.pi/2,'x',-5.8,False),(5,2, -math.pi/2,'x',5.8,True),(1.8,-4,0,'z',-7,False),(2,4,math.pi,'z',4.82,True)]:
   start(x,z,yaw);v=hold(['w'],3000);assert (v[axis]<limit if less else v[axis]>limit),v;stops.append(v)
  record('K02',{'actualForwardSecondsPerWall':3,'stops':stops})
  distances=[]
  for keys in [['w'],['w','d']]:
   start(2.5,2.7,0);v=hold(keys,200);distances.append(math.hypot(v['x']-2.5,v['z']-2.7))
  assert abs(distances[0]-distances[1])<.15,distances;record('K04',{'travelMetres':distances,'durationMs':200})
  start(2.5,2.7);page.keyboard.down('Space');page.wait_for_timeout(180);apex=state()['position']['y'];page.wait_for_timeout(1400);v=state()['position'];page.keyboard.up('Space');assert apex>.15 and v['y']<.04,(apex,v);record('K07',{'jumpY':apex,'heldSpaceLanding':v})
  route=[(2.5,2.7),(2.5,-2.7),(-2.5,-2.7),(-2.5,2.7),(2.5,2.7)];start(*route[0]);travel=[]
  for target in route[1:]:
   v=state()['position'];yaw=math.atan2(-(target[0]-v['x']),-(target[1]-v['z']))
   page.keyboard.press('Escape');page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'yaw':yaw,'distance':3.2});page.locator('[data-action="roam"]').click();page.keyboard.down('w');beg=time.monotonic()
   while True:
    page.wait_for_timeout(40);v=state()['position'];err=math.hypot(target[0]-v['x'],target[1]-v['z'])
    if err<.20:break
    if time.monotonic()-beg>5:raise AssertionError({'waypoint':target,'stopped':v,'error':err})
   page.keyboard.up('w');travel.append(v)
  record('K10',{'actualKeyboardLoop':travel})
  start(0,-5.5);v=hold(['w'],2000);page.keyboard.press('Space');v=hold(['w'],1000);assert v['z']>-6.95,v;record('K11',{'northRailJumpStop':v})
  inspection=page.evaluate('()=>wanderwiseRenderQA.inspect()');eyes=[]
  for pitch in [-.65,0,1.0]:
   for i in range(12):
    page.keyboard.press('Escape');page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':-5.35,'y':0,'z':3},'yaw':i*math.pi/6,'pitch':pitch,'distance':4.8});page.wait_for_timeout(110);eye=state()['eye'];eyes.append(eye)
    assert not any(c.get('camera',True) and all(c['min'][j]+.025<eye[j]<c['max'][j]-.025 for j in range(3)) for c in inspection['colliders']),eye
  record('K13',{'cameraOrientations':36,'eyes':eyes});record('K16','included upward/downward 36-orientation camera test')
  start(5.72,3.45);page.wait_for_timeout(300);assert state()['target']!='phone';record('K19','phone rear blocks targeting')
  start(2.9,3.45);page.wait_for_timeout(300);d=state();# Additional far test away from all semantic markers.
  start(0,-5.8);page.wait_for_timeout(250);assert state()['target'] is None;record('K20','player outside 3m cannot activate indoor facility')
  start(4.0,-1.45);page.wait_for_timeout(350);targets=[]
  for i in range(10):targets.append(state()['target']);page.wait_for_timeout(100)
  assert set(targets)=={'cabinet'},targets;record('K21',{'stableTargetSamples':targets})
  page.screenshot(path=str(OUT/'last.png'));assert not errors,errors
 except Exception as e:
  errors.append(str(e));page.screenshot(path=str(OUT/'failure.png'));print('FAIL',e,flush=True)
 finally:
  (OUT/'results.json').write_text(json.dumps({'checks':checks,'errors':errors,'browser':b.version,'viewport':[1280,720],'deviceScaleFactor':1,'input':'real Playwright keyboard, local QA only sets initial positions/cameras'},ensure_ascii=False,indent=2));b.close()
