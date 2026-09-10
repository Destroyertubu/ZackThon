import json,math
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/realistic-home/evidence')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');page=b.new_page(viewport={'width':1920,'height':1080});page.goto('http://127.0.0.1:18093/home?qa=1');page.wait_for_function('()=>window.wanderwiseDiagnostics?.().sceneState==="ready"');samples=[]
 # Clear left-wall position selected against the final furniture layout, not the old shelf location.
 for i in range(16):
  page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':-5.4,'y':0,'z':3.0},'yaw':i*math.pi/8,'pitch':.08,'distance':4});page.wait_for_timeout(100);d=page.evaluate('wanderwiseDiagnostics()');assert d['eye'][0]>-5.65 and d['eye'][2]<4.66,d;samples.append({'camera':d['camera'],'eye':d['eye']})
 page.evaluate('v=>wanderwiseRenderQA.setView(v)',{'position':{'x':4.8,'y':0,'z':1.85},'yaw':math.pi,'pitch':.1,'distance':3.8});page.locator('[data-action="roam"]').click();page.keyboard.down('w');page.wait_for_timeout(180);page.keyboard.up('w');d=page.evaluate('wanderwiseDiagnostics()');assert d['position']['z']>2.35,d;assert d['target']=='phone';page.screenshot(path=str(OUT/'phone-approach-final.png'));page.mouse.click(960,540);page.wait_for_function('()=>wanderwiseDiagnostics().modal==="phone"');assert '未开放' in page.locator('#overlay-root').inner_text()
 result={'status':'passed','checks':['16 camera rotations beside an unobstructed wall keep near-plane clearance','Real W input walks through the phone doorway and nearby click opens original unavailable panel'],'wallSamples':samples,'phone':d};(OUT/'spatial-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(result['checks']);b.close()
