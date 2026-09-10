"""Fixed cameras in a running local Chrome/WebGL application. No offline scene renders."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'reports/full-browser';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
 page=b.new_page(viewport={'width':1920,'height':1440},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:18095/home?room=full&qa=1');page.wait_for_function('()=>window.wanderwiseDiagnostics?.().sceneState!=="loading"',timeout=90000)
 assert page.evaluate('()=>wanderwiseDiagnostics().sceneState')=='ready',page.locator('body').inner_text()
 page.screenshot(path=str(out/'spawn.png'))
 for c in json.loads((ROOT/'design/home/cameras.json').read_text()):
  page.evaluate('v=>wanderwiseRenderQA.photograph(v)',{'position':c['position_m'],'target':c['target_m'],'fov':c['fov_deg'],'cutaway':c['mode']=='cutaway_only'});page.wait_for_timeout(350);page.screenshot(path=str(out/(c['id']+'.png')))
 (out/'inspection.json').write_text(json.dumps({'inspection':page.evaluate('()=>wanderwiseRenderQA.inspect()'),'errors':errors,'browser':b.version},ensure_ascii=False,indent=2));assert not errors,errors;print('12 fixed real-browser views and spawn captured');b.close()
