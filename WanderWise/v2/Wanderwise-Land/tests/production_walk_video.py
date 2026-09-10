"""Record an actual local browser walkthrough; no rendered-image substitution."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports/full-browser';TMP=Path('/private/tmp/wanderwise-production-walk-video');TMP.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args=['--disable-backgrounding-occluded-windows'])
 ctx=b.new_context(viewport={'width':1280,'height':720},device_scale_factor=1,record_video_dir=str(TMP),record_video_size={'width':1280,'height':720});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:18095/home');page.bring_to_front();page.wait_for_function('()=>wanderwiseDiagnostics?.().sceneState==="ready"');page.wait_for_timeout(1200)
 page.locator('[data-action="roam"]').click();page.wait_for_timeout(500);positions=[page.evaluate('wanderwiseDiagnostics().position')]
 # Traverse the clear central aisle using real keys, with short turns.
 for key,ms in [('d',650),('w',900),('a',180),('s',350)]:
  page.keyboard.down(key);page.wait_for_timeout(ms);page.keyboard.up(key);page.wait_for_timeout(1100);positions.append(page.evaluate('wanderwiseDiagnostics().position'))
 page.keyboard.press('Space');page.wait_for_timeout(1200)
 for dx in [260,260,-520]:
  page.mouse.move(640,360);page.mouse.down(button='right');page.mouse.move(640+dx,390,steps=35);page.mouse.up(button='right');page.wait_for_timeout(1800)
 page.keyboard.press('Escape');page.locator('.bottom-dock [data-action="journal"]').click();page.wait_for_timeout(1600)
 video=page.video;ctx.close();video.save_as(str(OUT/'home-walkthrough.webm'));b.close()
 (OUT/'video-recording.json').write_text(json.dumps({'browser':'Chrome installed locally','viewport':[1280,720],'source':'Actual headed app and real keyboard/mouse, isolated visitor; no QA pose API','positions':positions,'errors':errors},ensure_ascii=False,indent=2));assert not errors,errors
