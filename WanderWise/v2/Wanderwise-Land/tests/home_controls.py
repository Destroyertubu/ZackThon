"""Real Chrome pointer-lock and right-drag coexistence regression."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--disable-backgrounding-occluded-windows'])
 for fallback in [False,True]:
  ctx=b.new_context(viewport={'width':1280,'height':720})
  if fallback:ctx.add_init_script("HTMLCanvasElement.prototype.requestPointerLock=async function(){throw new DOMException('Unavailable test mode','NotAllowedError')}")
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:18091/home?qa=1');page.bring_to_front();page.wait_for_function('()=>wanderwiseDiagnostics?.().sceneState==="ready"');page.locator('[data-action="roam"]').click();page.wait_for_timeout(300)
  assert page.evaluate('wanderwiseDiagnostics().active');locked=page.evaluate('!!document.pointerLockElement');assert locked!=fallback
  old=page.evaluate('wanderwiseDiagnostics().camera.yaw');page.mouse.move(640,360);page.mouse.down(button='right');page.mouse.move(840,380,steps=20);page.mouse.up(button='right');page.wait_for_timeout(100)
  new=page.evaluate('wanderwiseDiagnostics().camera.yaw');assert abs(new-old)>.01;assert not errors,errors;checks.append('Right mouse safely coexists with pointer lock' if locked else 'Denied pointer lock falls back to real right-drag camera')
  page.keyboard.press('Escape');assert not page.evaluate('wanderwiseDiagnostics().active');ctx.close()
 b.close()
(ROOT/'docs/home-upgrade/evidence/home-controls.json').write_text(json.dumps({'status':'passed','checks':checks,'errors':errors},ensure_ascii=False,indent=2));print(checks)
