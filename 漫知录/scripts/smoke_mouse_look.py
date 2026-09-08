"""Real Chromium mouse-look regression; isolated demo DB, no Zhihu calls.

Run from the project virtualenv. Set CHROMIUM_PATH for a non-macOS browser.
Pointer-lock unavailable/rejected cases deliberately replace only that browser
API. The mobile drag uses Chromium's CDP touch input; an unpressed touch hover
is synthetic because a touchscreen cannot physically hover.
"""
from pathlib import Path
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'previews' / 'mouse-look'
OUT.mkdir(parents=True, exist_ok=True)
POSE = '({yaw:window.__manzhilu.worldView.player.yaw,pitch:window.__manzhilu.worldView.player.pitch})'
STATE = '''({mode:window.__manzhilu.worldView.mode,paused:window.__manzhilu.worldView.paused,
    panel:window.__manzhilu.state.panel,locked:document.pointerLockElement===document.querySelector('canvas'),
    lookEnabled:window.__manzhilu.worldView.lookEnabled,requests:window.__pointerLockRequests})'''


def wait(page, expression, arg=None, timeout=15):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        if page.evaluate(expression, arg):
            return
        time.sleep(.05)
    raise AssertionError('Timed out: ' + expression + ' | ' + json.dumps(page.evaluate(STATE), ensure_ascii=False))


def pose(page):
    return page.evaluate(POSE)


def canvas_point(page):
    """Find a true canvas hit, avoiding fixed HUD and floating article controls."""
    return page.evaluate('''() => {
        const canvas=document.querySelector('canvas');
        for (const y of [.45,.55,.35,.65,.75]) for (const x of [.85,.7,.55,.4,.2]) {
            const p={x:innerWidth*x,y:innerHeight*y};
            if (document.elementFromPoint(p.x,p.y)===canvas) return p;
        }
        throw new Error('No clear canvas point');
    }''')


def mouse_follow(page):
    point = canvas_point(page)
    # Mouse position setup is also an ordinary move with no pressed button.
    page.mouse.move(point['x'], point['y'])
    before = pose(page)
    page.mouse.move(point['x'] - 65, point['y'] - 35, steps=5)
    after = pose(page)
    assert abs(after['yaw'] - before['yaw']) > .01, (before, after, page.evaluate(STATE))
    assert abs(after['pitch'] - before['pitch']) > .01, (before, after, page.evaluate(STATE))
    return {'yawDelta':round(after['yaw']-before['yaw'], 5), 'pitchDelta':round(after['pitch']-before['pitch'], 5)}


def mouse_stays_still(page):
    before = pose(page)
    point = canvas_point(page) if not page.evaluate('window.__manzhilu.state.panel') else {'x':800,'y':450}
    page.mouse.move(point['x'], point['y'])
    page.mouse.move(point['x'] - 50, point['y'] + 30, steps=4)
    assert pose(page) == before, (before, pose(page), page.evaluate(STATE))


def click_resume(page):
    point = canvas_point(page)
    page.mouse.click(point['x'], point['y'])
    wait(page, 'window.__manzhilu.worldView.lookEnabled && !window.__manzhilu.state.panel')
    page.wait_for_timeout(100)


def install_pointer_probe(context, mode):
    context.add_init_script('''(() => {
        window.__pointerLockRequests=[];
        const native=Element.prototype.requestPointerLock;
        const mode=MODE;
        if (mode==='unavailable') {
            Object.defineProperty(Element.prototype,'requestPointerLock',{configurable:true,value:undefined});
        } else {
            Object.defineProperty(Element.prototype,'requestPointerLock',{configurable:true,value:function(...args) {
                const attempt={active:navigator.userActivation.isActive,mode,connected:this.isConnected,worldCanvas:this===window.__manzhilu?.worldView.canvas,ownerDocument:this.ownerDocument===document,focused:document.hasFocus()};
                window.__pointerLockRequests.push(attempt);
                const result=mode==='rejected' ? Promise.reject(new DOMException('Deliberate test rejection','NotAllowedError')) : native?.apply(this,args);
                if (!result?.then) return result;
                return result.then(value=>{attempt.result='resolved';return value;},error=>{
                    attempt.result='rejected';attempt.reason=error.name+': '+error.message;throw error;
                });
            }});
        }
    })();'''.replace('MODE', json.dumps(mode)))


def desktop_case(browser, origin, mode, errors):
    context = browser.new_context(viewport={'width':1440,'height':960}, reduced_motion='reduce')
    install_pointer_probe(context, mode)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append({'case':mode,'error':str(error)}))
    page.goto(origin + '/?debug=1')
    wait(page, 'window.__manzhilu?.state.booted')
    page.click('#start-btn')
    wait(page, 'window.__manzhilu.worldView.mode === "explore" && window.__manzhilu.worldView.spatialCards.length > 1')
    # Do not press or click anything else before verifying natural mouse look.
    result = {'entryState':page.evaluate(STATE), 'entryMouseMove':mouse_follow(page)}
    assert page.evaluate('window.__manzhilu.worldView.lookEnabled')
    if mode != 'native':
        assert not page.evaluate('!!document.pointerLockElement')
    if mode == 'rejected':
        # Starting a journey may legitimately lose transient activation during
        # HTTP work; a later real canvas click guarantees a request opportunity.
        page.keyboard.press('Tab')
        wait(page, '!window.__manzhilu.worldView.lookEnabled && !document.pointerLockElement')
        click_resume(page)
        assert page.evaluate('window.__pointerLockRequests.length') > 0
        result['afterRejectedRequest'] = mouse_follow(page)
    page.keyboard.press('b')
    wait(page, 'window.__manzhilu.state.panel === "bag" && !document.pointerLockElement')
    mouse_stays_still(page)
    result['panelPausesMouseLook'] = True
    page.get_by_role('button', name='关闭面板', exact=True).click()
    wait(page, '!window.__manzhilu.state.panel && !window.__manzhilu.worldView.paused')
    result['closePanelResumesMouseLook'] = mouse_follow(page)
    page.keyboard.press('Tab')
    wait(page, '!window.__manzhilu.worldView.lookEnabled && !document.pointerLockElement')
    mouse_stays_still(page)
    page.locator('.primary-nav [data-panel="bag"]').click()
    wait(page, 'window.__manzhilu.state.panel === "bag"')
    result['tabReleasesCursorForUI'] = True
    page.get_by_role('button', name='关闭面板', exact=True).click()
    wait(page, '!window.__manzhilu.state.panel')
    page.keyboard.press('Tab')
    wait(page, '!window.__manzhilu.worldView.lookEnabled && !document.pointerLockElement')
    click_resume(page)
    result['canvasClickResumesMouseLook'] = mouse_follow(page)
    page.keyboard.press('Escape')
    wait(page, '!window.__manzhilu.worldView.lookEnabled && !document.pointerLockElement')
    mouse_stays_still(page)
    result['escapeReleasesCursor'] = True
    click_resume(page)
    result['afterEscapeResume'] = mouse_follow(page)
    result['finalState'] = page.evaluate(STATE)
    context.close()
    return result


def touch_case(browser, origin, errors):
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    install_pointer_probe(context, 'native')
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append({'case':'touch','error':str(error)}))
    page.goto(origin + '/?debug=1')
    wait(page, 'window.__manzhilu?.state.booted')
    page.locator('#start-btn').tap()
    wait(page, 'window.__manzhilu.worldView.mode === "explore" && window.__manzhilu.worldView.spatialCards.length > 1')
    assert not page.evaluate('!!document.pointerLockElement')
    point = canvas_point(page)
    cdp = context.new_cdp_session(page)
    before = pose(page)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[point]})
    for step in range(1, 5):
        cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':point['x']-step*15,'y':point['y']-step*8}]})
    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    after = pose(page)
    assert abs(after['yaw'] - before['yaw']) > .01, (before,after)
    assert abs(after['pitch'] - before['pitch']) > .01, (before,after)
    assert not page.evaluate('!!document.pointerLockElement')
    released = pose(page)
    page.evaluate('''() => document.querySelector('canvas').dispatchEvent(new PointerEvent('pointermove',{
        pointerType:'touch',pointerId:99,buttons:0,clientX:280,clientY:380,movementX:50,movementY:25,bubbles:true}))''')
    assert pose(page) == released
    assert page.evaluate('window.__pointerLockRequests.length') == 0
    result = {'cdpTouchDragChangesView':True,'syntheticTouchHoverIgnored':True,'touchNeverRequestsPointerLock':True,
              'yawDelta':round(after['yaw']-before['yaw'],5),'pitchDelta':round(after['pitch']-before['pitch'],5)}
    context.close()
    return result


def main():
    with tempfile.TemporaryDirectory(prefix='manzhilu-mouse-look-') as tmp:
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        env = dict(os.environ, ZHIYE_MODE='demo', ZHIYE_PROVIDER='http', ZHIHU_ACCESS_SECRET='',
                   ZHIYE_DB=str(Path(tmp)/'test.sqlite3'), ZHIYE_ALLOWED_ORIGINS=origin)
        with open(Path(tmp)/'server.log', 'w+') as log:
            server = subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port',str(port)],
                                      cwd=ROOT,env=env,stdout=log,stderr=log)
            try:
                for _ in range(100):
                    try:
                        urllib.request.urlopen(origin+'/api/health',timeout=1)
                        break
                    except OSError:
                        if server.poll() is not None:
                            log.seek(0)
                            raise RuntimeError(log.read())
                        time.sleep(.1)
                errors = []
                with sync_playwright() as p:
                    path = os.environ.get('CHROMIUM_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
                    browser = p.chromium.launch(executable_path=path,headless=os.environ.get('MANZHILU_TEST_HEADED') != '1',args=['--enable-unsafe-swiftshader'])
                    result = {mode:desktop_case(browser,origin,mode,errors) for mode in ['native','unavailable','rejected']}
                    result['touch'] = touch_case(browser,origin,errors)
                    browser.close()
                result['errors'] = errors
                assert not errors, errors
                result['scope'] = 'Real HTTP + Chromium; demo-only isolated database. API absence/rejection is injected; mobile drag is CDP touch, touch-hover is synthetic.'
                result['headless'] = os.environ.get('MANZHILU_TEST_HEADED') != '1'
                (OUT/('browser-smoke.json' if result['headless'] else 'browser-smoke-headed.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
                print(json.dumps(result,ensure_ascii=False,indent=2))
            finally:
                server.terminate()
                try:
                    server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait(timeout=5)


if __name__ == '__main__':
    main()
