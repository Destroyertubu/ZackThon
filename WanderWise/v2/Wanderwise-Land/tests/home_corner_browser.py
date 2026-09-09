from playwright.sync_api import sync_playwright
from pathlib import Path
import time,json
out=Path('docs/home-upgrade/evidence');checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--window-size=1920,1080','--disable-backgrounding-occluded-windows'])
 page=b.new_page(viewport={'width':1920,'height':1080},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto('http://127.0.0.1:18091/home?qa=1');page.bring_to_front();page.wait_for_function('() => wanderwiseDiagnostics().sceneState==="ready"');page.wait_for_timeout(1200)
  page.screenshot(path=str(out/'corner-spawn.png'))
  print('inspect before',page.evaluate('wanderwiseRenderQA.inspect().hasFocus'),flush=True)
  page.locator('[data-action="roam"]').click();page.wait_for_timeout(400)
  print('active',page.evaluate('wanderwiseDiagnostics().active'),'focus',page.evaluate('document.hasFocus()'),'toasts',page.locator('#toasts').inner_text(),flush=True)
  before=page.evaluate('wanderwiseDiagnostics().position');page.keyboard.down('w');page.wait_for_timeout(600);page.keyboard.up('w');after=page.evaluate('wanderwiseDiagnostics().position');assert abs(after['z']-before['z'])>.3,(before,after)
  page.keyboard.press('Space');page.wait_for_timeout(130);assert page.evaluate('wanderwiseDiagnostics().position.y')>.05;page.keyboard.press('Escape');checks.append('real keyboard movement and jump')
  page.evaluate('wanderwiseRenderQA.setView({position:{x:1.1,y:0,z:-1.1},yaw:-.38,pitch:.12,distance:3.2})');page.wait_for_timeout(700);page.screenshot(path=str(out/'corner-detail.png'))
  info=page.evaluate('wanderwiseRenderQA.inspect()');assert any(m['materials'] and any(x['map'] for x in m['materials']) for m in info['meshes']);assert info['shadowEnabled'];checks.append('textured real furniture and runtime shadow map')
  page.evaluate('wanderwiseRenderQA.setView({position:{x:-.76,y:0,z:-1.5},yaw:0,pitch:0,distance:3})');page.wait_for_timeout(500);page.locator('[data-action="roam"]').click();page.wait_for_timeout(500)
  print('aim',page.evaluate('wanderwiseDiagnostics()'),flush=True)
  page.locator('canvas').click(position={'x':960,'y':540});page.wait_for_function('() => wanderwiseDiagnostics().modal==="bag"',timeout=5000);checks.append('left click real cabinet opens existing bag panel')
  page.screenshot(path=str(out/'corner-cabinet-panel.png'));assert not errors,errors
  result={'status':'passed','checks':checks,'browser':b.version,'errors':errors,'scene':page.evaluate('wanderwiseDiagnostics()'),'inspection':info}
 except Exception as e:
  result={'status':'failed','checks':checks,'error':str(e),'errors':errors};page.screenshot(path=str(out/'corner-gate-failure.png'));print(str(e),flush=True)
 finally:
  (out/'corner-gate.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ['inspection']},ensure_ascii=False),flush=True);b.close()
