#!/usr/bin/env python3
"""Real-browser/local-HTTP acceptance smoke. No transport, storage or history shims.
Start the app first. Use a separate browser context so no existing user records are changed.
Not reported as passed in this delivery environment (managed navigation/WebGL restrictions).
"""
import argparse,json,time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

class Checks(list):
    def append(self,value):
        super().append(value)
        print('PASS: '+value,flush=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('--base-url',default='http://127.0.0.1:8000');p.add_argument('--headed',action='store_true');p.add_argument('--require-3d',action='store_true');p.add_argument('--executable-path');p.add_argument('--output-dir',type=Path);a=p.parse_args()
    if urlparse(a.base_url).scheme not in ('http','https'):p.error('base-url must use http or https')
    out=a.output_dir or Path(__file__).resolve().parents[1]/'reports'/'browser';out.mkdir(parents=True,exist_ok=True)
    checks=Checks();errors=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=not a.headed,**({'executable_path':a.executable_path} if a.executable_path else {}));ctx=browser.new_context(viewport={'width':1440,'height':1000});page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        try:
            page.goto(a.base_url.rstrip('/')+('/' if a.require_3d else '/?mode=2d'),wait_until='domcontentloaded')
            page.locator('[data-action="enter-home"]').wait_for();page.locator('[data-action="enter-home"]').click();checks.append('real guest startup')
            if a.require_3d:
                assert page.evaluate('wanderwiseDiagnostics().renderer')=='native-webgl2','WebGL2 renderer unavailable'
                page.locator('[data-action="roam"]').click();page.wait_for_function('() => document.pointerLockElement!==null');before=page.evaluate('wanderwiseDiagnostics().position');page.keyboard.down('KeyW');page.wait_for_timeout(650);page.keyboard.up('KeyW');after=page.evaluate('wanderwiseDiagnostics().position');assert abs(before['x']-after['x'])+abs(before['z']-after['z'])>.2,'character did not move';page.keyboard.press('Space');page.wait_for_timeout(120);assert page.evaluate('wanderwiseDiagnostics().position.y')>0;page.keyboard.press('Escape');checks.append('WebGL2 / pointer lock / visible movement / jump')
                page.locator('[data-action="settings"]').first.click();page.locator('#setting-2d').check();page.locator('[data-action="apply-settings"]').click()
            page.locator('.two-d-home').wait_for();page.locator('.bottom-dock [data-action="seed"]').click();page.locator('[data-action="preset"]').first.click();page.locator('.topics [data-action="topic"]').first.wait_for(timeout=20000);checks.append('preset world')
            page.locator('.topics [data-action="topic"]').first.click();page.wait_for_timeout(2200);page.locator('[data-action="read-content"]').click();page.locator('.article-paragraph').first.wait_for();checks.append('source reader')
            page.locator('[data-action="collect-excerpt"]').nth(0).click();page.wait_for_timeout(250);page.locator('[data-action="collect-excerpt"]').nth(1).click();page.wait_for_timeout(250);page.locator('[data-action="collect-excerpt"]').nth(0).click();page.wait_for_timeout(250)
            page.locator('[data-action="enter-field"]').click();page.wait_for_function('() => wanderwiseDiagnostics().page==="field"');page.reload(wait_until='domcontentloaded');page.wait_for_function('() => wanderwiseDiagnostics().page==="field"');page.locator('.bottom-dock [data-action="return-world"]').click();page.wait_for_function('() => wanderwiseDiagnostics().page==="world"');checks.append('field reload and return')
            page.locator('.topics [data-action="topic"]').first.click();page.locator('#overlay-root [data-action="anchor"]').click();page.locator('#anchor-text').fill('自动测试：保留来源，再连接观点。');page.locator('#anchor-form button[type="submit"]').click();page.wait_for_timeout(350);page.locator('.bottom-dock [data-action="bag"]').click();page.locator('[data-bag]').first.wait_for();assert page.locator('[data-bag]').count()==2;checks.append('idempotent collections and private anchor')
            page.locator('[data-bag]').nth(0).check();page.locator('[data-bag]').nth(1).check();page.locator('[data-action="selected-synthesis"]').click();page.locator('#synthesis-question').fill('两份材料能产生什么联系？');page.locator('#synthesis-form button[type="submit"]').click();page.locator('#insight-form').wait_for();page.locator('#insight-title').fill('有出处的联系');page.locator('#insight-core').fill('这是自动测试输入的手工理解，不是AI生成结论。');page.locator('#insight-connection').fill('两份材料的出处共同支持可复查的记录。');page.locator('#insight-form button[type="submit"]').click();page.wait_for_function('() => wanderwiseDiagnostics().modal==="insight-view"');checks.append('manual synthesis save')
            page.locator('#overlay-root [data-action="close"]').click();page.locator('.bottom-dock [data-action="pause"]').click();page.locator('[data-action="pause-home"]').click();page.wait_for_function('() => wanderwiseDiagnostics().page==="home"');page.locator('.bottom-dock [data-action="journal"]').click();page.locator('.journal-card').first.wait_for();page.locator('[data-action="journey-map"]').first.click();page.locator('.map-wrap').wait_for();page.screenshot(path=str(out/'semantic-map.png'));checks.append('pause / journal / map');assert not errors,errors
            result={'status':'passed','browser':browser.version,'checks':checks,'pageErrors':errors,'transport':'real browser HTTP','storage':'real browser storage'}
        except Exception as exc:
            result={'status':'failed','browser':browser.version,'checks':checks,'pageErrors':errors,'error':str(exc)}
            page.screenshot(path=str(out/'failure.png'));raise
        finally:
            (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');browser.close()
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
