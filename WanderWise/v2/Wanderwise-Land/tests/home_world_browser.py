# Historical v1.1.0-home.1 browser script; expects the retired 2D interface.
# Current regression: tests/roaming_browser.py and tests/roaming_worker_browser.py.
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
out=Path('docs/home-upgrade/evidence');checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--disable-backgrounding-occluded-windows'])
 page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)))
 def mode2d(enabled):
  page.locator('[data-action="settings"]').first.click();page.locator('#setting-2d').set_checked(enabled);page.locator('[data-action="apply-settings"]').click();page.wait_for_function('(v) => wanderwiseDiagnostics().mode2d===v',arg=enabled)
  if not enabled:page.wait_for_function('() => wanderwiseDiagnostics().sceneState==="ready" && wanderwiseDiagnostics().sceneKind===wanderwiseDiagnostics().page')
 try:
  page.goto('http://127.0.0.1:18091/home?qa=1');page.bring_to_front();page.wait_for_function('() => wanderwiseDiagnostics().sceneState==="ready"');page.locator('.bottom-dock [data-action="seed"]').click();page.locator('[data-action="preset"]').first.click();page.wait_for_function('() => wanderwiseDiagnostics().page==="world" && wanderwiseDiagnostics().sceneKind==="world" && wanderwiseDiagnostics().sceneState==="ready"',timeout=30000);page.wait_for_timeout(1200);page.screenshot(path=str(out/'corner-world-adapter.png'));checks.append('real world geometry on Three renderer')
  mode2d(True);page.locator('.topics [data-action="topic"]').first.click();page.locator('[data-action="read-content"]').click();page.locator('.article-paragraph').first.wait_for();page.locator('[data-action="collect-excerpt"]').first.click();page.wait_for_timeout(300);page.locator('[data-action="enter-field"]').click();page.wait_for_function('() => wanderwiseDiagnostics().page==="field"');mode2d(False);page.wait_for_timeout(1200);page.screenshot(path=str(out/'corner-field-adapter.png'));checks.append('real article field on Three renderer')
  page.locator('.bottom-dock [data-action="return-world"]').click();page.wait_for_function('() => wanderwiseDiagnostics().page==="world" && wanderwiseDiagnostics().sceneKind==="world" && wanderwiseDiagnostics().sceneState==="ready"');checks.append('return checkpoint')
  page.locator('.bottom-dock [data-action="pause"]').click();page.locator('[data-action="pause-home"]').click();page.wait_for_function('() => wanderwiseDiagnostics().page==="home" && wanderwiseDiagnostics().sceneState==="ready"');page.reload();page.wait_for_function('() => wanderwiseDiagnostics().page==="home" && wanderwiseDiagnostics().sceneState==="ready"');page.locator('.bottom-dock [data-action="bag"]').click();page.locator('[data-bag]').first.wait_for();checks.append('saved collection survives home and refresh');assert not errors,errors
  result={'status':'passed','checks':checks,'errors':errors,'browser':b.version}
 except Exception as e:
  result={'status':'failed','checks':checks,'error':str(e),'errors':errors};page.screenshot(path=str(out/'corner-world-gate-failure.png'))
 finally:
  (out/'corner-world-gate.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
