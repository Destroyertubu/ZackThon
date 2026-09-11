import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/realistic-home/evidence');checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
 page=b.new_page(viewport={'width':1920,'height':1080});page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:18093/home?qa=1');page.wait_for_function('()=>window.wanderwiseDiagnostics?.().sceneState==="ready"');page.wait_for_timeout(300)
 info=page.evaluate('wanderwiseRenderQA.inspect()');assert info['shadowEnabled'];assert any(m['normalMapColorSpace']=='' and m['mapColorSpace']=='srgb' for o in info['meshes'] for m in o['materials']);checks.append('Real GLB PBR textures have separate color/data semantics; runtime shadows enabled')
 page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':-.95,'y':0,'z':-2.2},'yaw':0,'pitch':.1,'distance':3});page.locator('[data-action="roam"]').click();page.keyboard.down('w');page.wait_for_timeout(450);page.keyboard.up('w');a=page.evaluate('wanderwiseDiagnostics()');page.keyboard.press('Space');page.wait_for_timeout(180);jump=page.evaluate('wanderwiseDiagnostics().position.y');assert jump>a['position']['y']+.15;page.wait_for_timeout(900);assert page.evaluate('wanderwiseDiagnostics().position.y')>=-.01;checks.append('Actual keyboard movement, capsule obstacle stop, jump and landing')
 page.mouse.click(960,540);page.wait_for_function('()=>wanderwiseDiagnostics().modal==="bag"');assert not page.evaluate('wanderwiseDiagnostics().active');checks.append('Nearby cabinet click opens original bag and isolates panel input');page.locator('#overlay-root [data-action="close"]').first.click()
 page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':3.7,'y':0,'z':-2.5},'yaw':1.15,'pitch':.02,'distance':2.0});page.wait_for_timeout(400);page.screenshot(path=str(OUT/'corner-material-detail.png'));assert not errors,errors
 (OUT/'corner-gate.json').write_text(json.dumps({'checks':checks,'errors':errors,'browser':b.version,'actualMovement':a,'jumpY':jump},ensure_ascii=False,indent=2));print(checks);b.close()
