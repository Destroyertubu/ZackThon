"""Read-only staged visual/physics QA in actual Chrome against isolated local app."""
from pathlib import Path
import json,math,sys,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];stage=sys.argv[1] if len(sys.argv)>1 else 'graybox';out=ROOT/'reports'/('G02_browser' if stage=='calibration' else 'G03_screenshots');out.mkdir(parents=True,exist_ok=True)
errors=[];results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True);page=b.new_page(viewport={'width':1440,'height':1080});page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:18095/home?qa=1&room='+stage);page.wait_for_function('()=>window.wanderwiseDiagnostics?.().sceneState !== "loading"',timeout=30000)
 assert page.evaluate('()=>wanderwiseDiagnostics().sceneState')=='ready',page.locator('body').inner_text()
 if stage=='calibration':
  page.evaluate('()=>wanderwiseRenderQA.photograph({position:[2,1.65,2.8],target:[-.35,.45,0],fov:48})');page.wait_for_timeout(400);page.screenshot(path=str(out/'metre-positive-Z-furniture.png'))
 else:
  layout=json.loads((ROOT/'design/home/room_layout.json').read_text())
  # Actual keyboard traversals, position/aim QA used only to set each independent route start.
  for route in layout['primary_routes']:
   pts=route['points_xz'];page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':pts[0][0],'y':0,'z':pts[0][1]},'distance':2.4});page.locator('[data-action="roam"]').click();path=[]
   for tx,tz in pts[1:]:
    for attempt in range(4):
     state=page.evaluate('()=>wanderwiseDiagnostics()');pos=state['position'];dx,dz=tx-pos['x'],tz-pos['z'];distance=math.hypot(dx,dz)
     if distance<.17:break
     yaw=math.atan2(-dx,-dz);page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'yaw':yaw,'distance':2.4});page.locator('[data-action="roam"]').click();page.keyboard.down('w');page.wait_for_timeout(min(1500,round(distance/4.5*1000)));page.keyboard.up('w')
    actual=page.evaluate('()=>wanderwiseDiagnostics().position');path.append({'target':[tx,tz],'actual':actual,'error':math.hypot(actual['x']-tx,actual['z']-tz)})
   page.keyboard.press('Escape');page.screenshot(path=str(out/(route['id']+'.png')));results.append({'route':route['id'],'points':path,'passed':all(pt['error']<.3 for pt in path)})
  for name,pos in {'door':[0,3.6],'synthesis':[2.5,.3],'journal':[-2.6,1.25],'cabinet':[3.55,-1.45],'phone':[3.7,3.45]}.items():
   page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':pos[0],'y':0,'z':pos[1]},'distance':2.4});page.locator('[data-action="roam"]').click();page.mouse.click(700,540);page.wait_for_timeout(350);modal=page.evaluate('()=>wanderwiseDiagnostics().modal');results.append({'facility':name,'modal':modal});page.screenshot(path=str(out/(name+'.png')))
   close=page.locator('#overlay-root [data-action="close"]');
   if close.count():close.first.click()
 report={'stage':stage,'state':page.evaluate('()=>wanderwiseDiagnostics()'),'inspection':page.evaluate('()=>wanderwiseRenderQA.inspect()'),'results':results,'errors':errors,'browser':b.version};(out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'results':results,'errors':errors},ensure_ascii=False));b.close()
