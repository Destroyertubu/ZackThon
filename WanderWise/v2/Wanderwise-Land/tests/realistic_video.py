"""Short actual input recording; no teleports, offline frames, or image backgrounds."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/realistic-home/evidence');errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');ctx=b.new_context(viewport={'width':1920,'height':1080},record_video_dir=str(OUT/'video-tmp'),record_video_size={'width':1280,'height':720});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:18093/home');page.wait_for_function('()=>window.wanderwiseDiagnostics?.().sceneState==="ready"');page.wait_for_timeout(1000);page.locator('[data-action="roam"]').click();page.keyboard.down('w');page.wait_for_timeout(650);page.keyboard.up('w');page.wait_for_timeout(700)
 for x in [680,1180,1430,970]:
  page.mouse.move(960,510);page.mouse.down(button='right');page.mouse.move(x,525,steps=45);page.mouse.up(button='right');page.wait_for_timeout(1800)
 page.keyboard.press('Space');page.wait_for_timeout(1000);page.keyboard.down('s');page.wait_for_timeout(500);page.keyboard.up('s');page.wait_for_timeout(1200);page.keyboard.press('Escape');page.wait_for_timeout(800);
 if page.locator('#overlay-root [data-action="close"]').count():page.locator('#overlay-root [data-action="close"]').first.click()
 page.locator('.bottom-dock [data-action="journal"]').click();page.wait_for_timeout(1800);assert not errors,errors;video=page.video;ctx.close();path=Path(video.path());dest=OUT/'home-walkthrough.webm';path.rename(dest);(OUT/'video-tmp').rmdir();b.close();(OUT/'video.json').write_text(json.dumps({'file':dest.name,'errors':errors,'viewport':[1920,1080],'recordedSize':[1280,720],'actions':'Actual W/S walking, right-drag camera, Space jump, Escape pause and original journal panel; no QA teleports'},indent=2));print(dest)
