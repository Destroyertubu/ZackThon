"""Real HTTP + Chromium regression for 漫知录. Uses an isolated demo database."""
from pathlib import Path
import json, os, socket, subprocess, sys, tempfile, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SOFTWARE = os.environ.get('MANZHILU_TEST_SOFTWARE') == '1'
OUT = ROOT / 'previews' / ('v11-software' if SOFTWARE else 'v11')
OUT.mkdir(parents=True, exist_ok=True)


def wait(page, expression, arg=None, timeout=25):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        if page.evaluate(expression, arg): return
        time.sleep(.08)
    page.screenshot(path=str(OUT / 'failure.png'))
    raise AssertionError('Timed out: ' + expression + ' | fatal: ' + page.locator('#fatal').inner_text())


def aim_card(page, index=0):
    card_id = page.evaluate('''index => {
        const w = window.__manzhilu.worldView;
        const item = w.spatialCards[index];
        if (!item) throw new Error('No spatial content card');
        const p = w.player, [x,y,z] = item.position;
        p.yaw = Math.atan2(-(x-p.x), -(z-p.z));
        p.pitch = Math.atan2(y-p.y, Math.hypot(x-p.x,z-p.z));
        return item.card.id;
    }''', index)
    wait(page, "id => window.__manzhilu.worldView.getTarget()?.card?.id === id", arg=card_id)
    return card_id


def close_panel(page):
    page.get_by_role('button', name='关闭面板', exact=True).click()


with tempfile.TemporaryDirectory(prefix='manzhilu-e2e-') as tmp:
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    env = dict(os.environ, ZHIYE_MODE='demo', ZHIYE_PROVIDER='http', ZHIHU_ACCESS_SECRET='',
               ZHIYE_DB=str(Path(tmp) / 'test.sqlite3'), ZHIYE_ALLOWED_ORIGINS=origin,
               ZHIYE_ADMIN_TOKEN='local-e2e-only')
    log = open(Path(tmp) / 'server.log', 'w+')
    server = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', str(port)], cwd=ROOT, env=env, stdout=log, stderr=log)
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(origin + '/api/health', timeout=1)
                break
            except OSError:
                if server.poll() is not None:
                    log.seek(0); raise RuntimeError(log.read())
                time.sleep(.1)
        errors, checks = [], {}
        with sync_playwright() as p:
            browser_path = os.environ.get('CHROMIUM_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
            browser = p.chromium.launch(executable_path=browser_path, headless=True, args=['--enable-unsafe-swiftshader'] + (['--disable-webgl'] if SOFTWARE else []))
            context = browser.new_context(viewport={'width':1440,'height':960}, reduced_motion='reduce')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin + '/?debug=1')
            wait(page, 'window.__manzhilu?.state.booted')
            page.screenshot(path=str(OUT/'01-landing.png'))
            assert page.title().startswith('漫知录')
            page.click('#start-btn')
            wait(page, 'window.__manzhilu.worldView.spatialCards.length >= 2 && !window.__manzhilu.state.panel')
            checks['renderer'] = page.evaluate('window.__manzhilu.worldView.renderer.name')
            y = page.evaluate('window.__manzhilu.worldView.player.y')
            page.keyboard.down('Shift');page.wait_for_timeout(400);page.keyboard.up('Shift')
            assert page.evaluate('window.__manzhilu.worldView.player.y') > y + .3
            high = page.evaluate('window.__manzhilu.worldView.player.y')
            page.keyboard.down('Control');page.wait_for_timeout(200);page.keyboard.up('Control')
            assert page.evaluate('window.__manzhilu.worldView.player.y') < high
            checks['vertical_flight'] = True
            fov = page.evaluate('window.__manzhilu.worldView.fov')
            page.mouse.move(1000,500);page.mouse.wheel(0,-180)
            wait(page, 'old => window.__manzhilu.worldView.fov < old', arg=fov)
            checks['wheel_zoom'] = True
            first = aim_card(page, 0)
            page.keyboard.press('e')
            wait(page, 'id => window.__manzhilu.state.journey.bag.some(c=>c.id===id)', arg=first)
            second = aim_card(page, 1)
            page.keyboard.press('e')
            wait(page, 'id => window.__manzhilu.state.journey.bag.some(c=>c.id===id)', arg=second)
            checks['reticle_collects_selected_card'] = first != second
            page.screenshot(path=str(OUT/'02-exploration.png'))
            before = page.evaluate('({player:{...window.__manzhilu.worldView.player},visited:[...window.__manzhilu.state.journey.visited]})')
            page.keyboard.press('f')
            wait(page, 'window.__manzhilu.worldView.inField')
            page.screenshot(path=str(OUT/'03-article-field.png'))
            page.keyboard.down('w');page.wait_for_timeout(250);page.keyboard.up('w')
            page.evaluate('window.__manzhilu.saveJourney()')
            saved_position = context.request.get(origin + '/api/journeys/' + page.evaluate('window.__manzhilu.state.journey.id')).json()['data']['position']
            assert saved_position == before['player'], (saved_position,before['player'])
            page.click('.field-exit')
            assert page.evaluate('window.__manzhilu.worldView.player') == before['player']
            assert page.evaluate('window.__manzhilu.state.journey.visited') == before['visited']
            checks['article_return_and_save_isolation'] = True
            # Automatic tracking must be cancellable with real movement input.
            page.evaluate('window.__manzhilu.worldView.track(window.__manzhilu.state.world.nodes[1])')
            wait(page, 'window.__manzhilu.worldView.tracking !== null')
            page.keyboard.press('a')
            assert page.evaluate('window.__manzhilu.worldView.tracking') is None
            checks['tracking_interrupt'] = True
            page.keyboard.press('h')
            page.wait_for_selector('.home-facility')
            assert page.locator('.home-facility').count() == 4
            page.screenshot(path=str(OUT/'04-home.png'))
            paused = page.evaluate('window.__manzhilu.worldView.player')
            page.keyboard.down('w');page.wait_for_timeout(200);page.keyboard.up('w')
            assert page.evaluate('window.__manzhilu.worldView.player') == paused
            checks['modal_pauses_movement'] = True
            page.locator('.home-facility-synthesis').click()
            page.wait_for_selector('.selection-box')
            page.locator('.selection-box').nth(0).check();page.locator('.selection-box').nth(1).check()
            page.fill('#synthesis-note','把不同角度放在一起，我发现可以从行动中重新理解兴趣。')
            page.select_option('#output-select','insight')
            page.get_by_role('button',name='搭一座灵感桥',exact=True).click()
            wait(page, 'window.__manzhilu.state.journey.bridges.length === 1')
            checks['synthesis'] = True
            close_panel(page)
            page.keyboard.press('r')
            page.fill('#anchor-text','测试旅程里的一束光：在尝试中重新认识自己。')
            page.get_by_role('button',name='把想法留在这里',exact=True).click()
            wait(page, 'window.__manzhilu.state.journey.thoughts.length === 1')
            wait(page, 'document.querySelector("#anchor-text").value === ""')
            close_panel(page)
            page.keyboard.press('h');page.wait_for_selector('.home-courtyard')
            page.locator('.home-facility-journal').click()
            assert page.locator('.home-log-entry').count() >= 3
            page.screenshot(path=str(OUT/'05-journal.png'))
            checks['home_journal'] = True
            close_panel(page)
            page.keyboard.press('m');page.wait_for_selector('.graph-frame')
            assert page.locator('.knowledge-bridge').count() == 1
            page.get_by_role('tab', name='全员热门小径').click()
            wait(page, 'document.querySelector(".canvas-layout").textContent.includes("小径，等待")')
            close_panel(page)
            # Prepare an approved public anchor and route using only this disposable test app.
            data = page.evaluate('({worldId:window.__manzhilu.state.world.id,nodeId:window.__manzhilu.state.activeId})')
            response = context.request.post(origin + '/api/anchors', data={**data,'text':'给同路人的测试锚点：每一次好奇都值得一次出发。','visibility':'public'})
            assert response.ok,response.text()
            anchor_id = response.json()['id']
            assert context.request.post(origin+f'/api/admin/anchors/{anchor_id}/approve',headers={'Authorization':'Bearer local-e2e-only'}).ok
            page.evaluate('async()=>{const x=window.__manzhilu;await x.visitNode(x.state.world.nodes[1].id);await x.saveJourney();}')
            jid = page.evaluate('window.__manzhilu.state.journey.id')
            assert context.request.post(origin+f'/api/journeys/{jid}/publish',data={'confirm':True,'alias':'测试漫行者'}).ok
            # Other browser has independent cookies; never borrow the author's session.
            other = browser.new_context(viewport={'width':1280,'height':900},reduced_motion='reduce')
            visitor = other.new_page();visitor.on('pageerror',lambda error: errors.append(str(error)))
            visitor.goto(origin+'/?debug=1');wait(visitor, 'window.__manzhilu?.state.booted')
            visitor.click('#start-btn');wait(visitor, 'window.__manzhilu.worldView.spatialCards.length >= 2')
            visitor.keyboard.press('t')
            visitor.get_by_role('button', name='阅读与共鸣 · 0', exact=True).click()
            wait(visitor, 'document.querySelector(".resonance-stats").textContent.includes("1 位")')
            resonance_box = visitor.locator('.resonance-button').bounding_box()
            visitor.mouse.move(resonance_box['x'] + resonance_box['width']/2, resonance_box['y'] + resonance_box['height']/2)
            visitor.mouse.down()
            try:
                wait(visitor, 'document.querySelector(".resonance-button").disabled && document.querySelector(".resonance-button").textContent.includes("已连鸣 3 次")')
            finally:
                visitor.mouse.up()
            assert visitor.locator('.resonance-button').is_disabled()
            checks['hold_resonance_caps_at_three'] = True
            visitor.get_by_role('textbox',name='评论这个想法锚点').fill('愿每位同路人都能找到自己的方向。')
            visitor.get_by_role('button',name='留下这句回应').click()
            visitor.wait_for_selector('.comment-item')
            visitor.screenshot(path=str(OUT/'06-resonance.png'))
            checks['public_anchor_resonance_comments'] = True
            page.evaluate('window.__manzhilu.openNotifications()')
            page.wait_for_selector('.notification-item')
            assert page.locator('.notification-item').count() >= 2
            checks['persistent_notifications'] = True
            # Delay the real response, leave the panel, then ensure it cannot
            # reopen an obsolete notification detail over the current bag.
            pending_reads = []
            read_pattern = origin + '/api/anchors/*/read'
            page.route(read_pattern, lambda route: pending_reads.append(route))
            page.get_by_role('button', name='看看这个锚点', exact=True).first.click()
            page.wait_for_timeout(100)
            assert len(pending_reads) == 1
            close_panel(page)
            page.evaluate('window.__manzhilu.openBag()')
            delayed_read = pending_reads.pop()
            delayed_read.fulfill(response=delayed_read.fetch())
            page.wait_for_timeout(150)
            assert page.evaluate('window.__manzhilu.state.panel') == 'bag'
            page.unroute(read_pattern)
            checks['stale_notification_does_not_reopen_panel'] = True
            close_panel(page)
            page.evaluate('window.__manzhilu.openCanvas("popular")')
            page.wait_for_selector('.path-heat', state='attached')
            page.screenshot(path=str(OUT/'07-popular-paths.png'))
            checks['real_public_heat'] = True
            close_panel(page)
            page.evaluate('window.__manzhilu.saveJourney()')
            saved = page.evaluate('({id:window.__manzhilu.state.journey.id,y:window.__manzhilu.state.journey.position.y})')
            page.reload();wait(page, 'window.__manzhilu?.state.booted')
            assert page.evaluate('window.__manzhilu.state.journey.id') == saved['id']
            assert page.evaluate('window.__manzhilu.state.journey.position.y') == saved['y']
            checks['native_storage_reload'] = True
            # An anchor written before a journey switch belongs only to the
            # captured journey, even when its HTTP response arrives afterwards.
            old_journey_id = page.evaluate('window.__manzhilu.state.journey.id')
            old_thoughts = page.evaluate('window.__manzhilu.state.journey.thoughts.length')
            pending_anchors = []
            anchor_pattern = origin + '/api/anchors'
            page.route(anchor_pattern, lambda route: pending_anchors.append(route))
            page.evaluate('window.__manzhilu.openAnchors()')
            submitted_text = '这个延迟抵达的想法，应该留在原来的旅程里。'
            page.fill('#anchor-text', submitted_text)
            page.get_by_role('button', name='把想法留在这里', exact=True).click()
            page.wait_for_timeout(100)
            assert len(pending_anchors) == 1
            page.fill('#anchor-text', '提交之后修改输入框，不应改变已提交的文字。')
            close_panel(page)
            page.evaluate('window.__manzhilu.startJourney("科学与好奇")')
            page.evaluate('async()=>{const x=window.__manzhilu;x.collectCard(x.state.content.get("root")[0]);await x.saveJourney();}')
            current_before = page.evaluate('({journey:structuredClone(window.__manzhilu.state.journey),dirty:window.__manzhilu.state.dirty,saved:window.__manzhilu.state.saved})')
            assert current_before['journey']['id'] != old_journey_id
            delayed_anchor = pending_anchors.pop()
            with page.expect_response(lambda response: response.url == origin + '/api/journeys/' + old_journey_id and response.request.method == 'PUT'):
                delayed_anchor.fulfill(response=delayed_anchor.fetch())
            page.wait_for_timeout(100)
            page.unroute(anchor_pattern)
            current_after = page.evaluate('({journey:structuredClone(window.__manzhilu.state.journey),dirty:window.__manzhilu.state.dirty,saved:window.__manzhilu.state.saved})')
            assert current_after == current_before, (current_before,current_after)
            old_saved = context.request.get(origin + '/api/journeys/' + old_journey_id).json()['data']
            assert len(old_saved['thoughts']) == old_thoughts + 1
            assert old_saved['thoughts'][-1]['text'] == submitted_text
            assert not current_after['journey']['thoughts']
            checks['delayed_anchor_saves_original_journey'] = True
            mobile = browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
            phone = mobile.new_page();phone.on('pageerror',lambda error: errors.append(str(error)))
            phone.goto(origin+'/?debug=1');wait(phone, 'window.__manzhilu?.state.booted')
            phone.screenshot(path=str(OUT/'08-mobile-landing.png'))
            phone.click('#random-start');wait(phone, 'window.__manzhilu.state.journey !== null')
            phone.locator('[data-panel="home"]').first.click();phone.wait_for_selector('.home-courtyard')
            phone.screenshot(path=str(OUT/'09-mobile-home.png'))
            assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
            checks['mobile_and_random_start'] = True
            assert not errors, errors
            checks['browser_errors'] = errors
            checks['transport'] = 'Real HTTP, isolated SQLite, real browser cookies and IndexedDB'
            (OUT/'browser-smoke.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
            print(json.dumps(checks,ensure_ascii=False,indent=2))
            browser.close()
    finally:
        server.terminate()
        try: server.wait(timeout=5)
        except subprocess.TimeoutExpired: server.kill();server.wait()
        log.close()
