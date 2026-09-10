from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'reports/G06_browser';out.mkdir(parents=True,exist_ok=True);errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True);page=b.new_page(viewport={'width':1920,'height':1440});page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:18095/home?room=corner&qa=1');page.wait_for_function('()=>window.wanderwiseDiagnostics?.().sceneState !== "loading"',timeout=30000);assert page.evaluate('()=>wanderwiseDiagnostics().sceneState')=='ready',page.locator('body').inner_text()
 for camera in json.loads((ROOT/'design/home/cameras.json').read_text()):
  if camera['id'] not in ['CAM03','CAM11']:continue
  page.evaluate('v=>wanderwiseRenderQA.photograph(v)',{'position':camera['position_m'],'target':camera['target_m'],'fov':camera['fov_deg']});page.wait_for_timeout(700);page.screenshot(path=str(out/(camera['id']+'.png')))
 checks=[]
 info=page.evaluate('()=>wanderwiseRenderQA.inspect()');assert info['canvasCount']==1 and info['shadowEnabled'];checks.append('one Canvas with real WebGL shadows')
 for i in range(12):
  page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':-3.4,'y':0,'z':-1.55},'yaw':i*3.141592653589793/6,'pitch':.12,'distance':3.2});page.wait_for_timeout(120)
  eye=page.evaluate('()=>wanderwiseDiagnostics().eye')
  assert not any(c.get('camera',True) and all(c['min'][j]+.025<eye[j]<c['max'][j]-.025 for j in range(3)) for c in info['colliders']),eye
 checks.append('12 actual character-camera orientations around reading approach outside opaque colliders')
 page.evaluate('()=>wanderwiseRenderQA.setView({position:{x:-4.2,y:0,z:-1.5},yaw:0,distance:2.4})');page.locator('[data-action="roam"]').click();page.keyboard.down('w');page.wait_for_timeout(650);page.keyboard.up('w');position=page.evaluate('()=>wanderwiseDiagnostics().position');assert position['z']>-2.35,position
 page.keyboard.press('Space');page.wait_for_timeout(180);assert page.evaluate('()=>wanderwiseDiagnostics().position.y')>.15;page.wait_for_timeout(1000);assert page.evaluate('()=>wanderwiseDiagnostics().position.y')>-.01;page.keyboard.press('Escape');checks.append('actual WASD stops at chair; jump and landing')
 page.evaluate('()=>wanderwiseRenderQA.setView({position:{x:-2.6,y:0,z:1.25},yaw:1.57,distance:2.4})');page.locator('[data-action="roam"]').click();page.mouse.click(800,700);page.wait_for_function('()=>wanderwiseDiagnostics().modal==="journal"');checks.append('original journal opens through nearby 3D left-click');page.locator('#overlay-root [data-action="close"]').first.click()
 (out/'interaction.json').write_text(json.dumps({'checks':checks,'errors':errors,'collisionStop':position},ensure_ascii=False,indent=2))

 (out/'result.json').write_text(json.dumps({'state':page.evaluate('()=>wanderwiseDiagnostics()'),'inspection':page.evaluate('()=>wanderwiseRenderQA.inspect()'),'errors':errors,'browser':b.version},ensure_ascii=False,indent=2));print('Captured CAM03/CAM11',errors);b.close()
