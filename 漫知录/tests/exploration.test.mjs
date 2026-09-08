import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlayer, moveFlight, advanceTracking, positionCards, selectAimTarget, createArticleField, contentLabel } from '../web/js/exploration.js';
import { projector } from '../web/js/math.js';
import { WorldView } from '../web/js/world-view.js';

const node = { id: 'root', title: '好奇心', x: 0, z: 0, depth: 0, color: '#ddbb88' };
const source = { id: 'article-1', nodeId: 'root', title: '关于好奇心', body: '先观察一个具体的场景。\n\n再去寻找另一种解释。\n\n最后记录自己尚未理解的地方。', text: '摘要', kind: 'demo_original', source: 'demo', provenance: '原创演示 · 非知乎原文' };
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('legacy positions gain altitude and invalid camera values cannot reach renderer', () => {
    assert.equal(normalizePlayer({ x: 4, z: 5 }).y, 2.6);
    assert.deepEqual(normalizePlayer({ x: Infinity, y: NaN, pitch: 7 }), { x: 0, y: 2.6, z: 8, yaw: 0, pitch: 1.4 });
    assert.equal(normalizePlayer({ y: 25 }).y, 25);
});

test('WASD follows heading horizontally even when looking straight upward', () => {
    const p = normalizePlayer({ x: 0, y: 20, z: 0, yaw: Math.PI / 2, pitch: 1.4 });
    const forward = moveFlight(p, new Set(['KeyW']), 1, 10);
    close(forward.x, -10); close(forward.z, 0); close(forward.y, 20);
    const right = moveFlight(p, new Set(['KeyD']), 1, 10);
    close(right.x, 0); close(right.z, -10);
});

test('Shift ascends and Ctrl descends; diagonal flight has no speed advantage', () => {
    const p = normalizePlayer({ x: 0, y: 20, z: 0 });
    const up = moveFlight(p, new Set(['ShiftLeft']), 1, 10);
    assert.equal(up.y, 30); assert.equal(up.z, 0);
    assert.equal(moveFlight(p, new Set(['ControlRight']), 1, 10).y, 10);
    const diagonal = moveFlight(p, new Set(['KeyW', 'KeyD', 'ShiftLeft']), 1, 10);
    close(Math.hypot(diagonal.x, diagonal.y - 20, diagonal.z), 10);
    assert.deepEqual(moveFlight(p, new Set(['KeyW', 'KeyS', 'ShiftLeft', 'ControlLeft']), 1), p);
});

test('free flight can cross a gap without island/causeway collision constraints', () => {
    const p = normalizePlayer({ x: 20, z: 8 });
    const next = moveFlight(p, new Set(['KeyD']), 1, 10);
    assert.equal(next.x, 30); assert.equal(next.z, 8);
});

test('tracking arrives without overshoot, preserving valid altitude', () => {
    let p = normalizePlayer({ x: -20, y: 40, z: 50 }), arrived = false;
    for (let i = 0; i < 1000 && !arrived; i++) ({ player: p, arrived } = advanceTracking(p, node, .05));
    assert(arrived);
    close(p.x, node.x); close(p.z, node.z + 9); close(p.y, 2.6);
    assert.deepEqual(advanceTracking(p, node, 0).player, p);
});

test('reticle chooses its intersected frontmost object, never the nearest off-center topic', () => {
    const off = { type: 'node', node: { id: 'nearby' } }, hit = { type: 'card', card: source, nodeId: 'root' };
    const candidates = [
        { target: off, projection: { x: 100, y: 100, depth: 2 }, width: 100, height: 60 },
        { target: hit, projection: { x: 500, y: 350, depth: 20 }, width: 232, height: 180 },
    ];
    assert.equal(selectAimTarget(candidates, 1000, 700), hit);
    assert.equal(selectAimTarget(candidates.slice(0, 1), 1000, 700), null);
    assert.equal(selectAimTarget([{ ...candidates[1], projection: { x: 500, y: 350, depth: -5 } }], 1000, 700), null);
    assert.equal(selectAimTarget([...candidates, { ...candidates[1], target: off, projection: { x: 500, y: 350, depth: 10 } }], 1000, 700), off);
});

test('zoom changes projection consistently without moving the camera', () => {
    const p = normalizePlayer({ x: 0, z: 0 }), point = [3, 2.6, -10];
    const wide = projector(p, 1000, 700, 86)(point), zoomed = projector(p, 1000, 700, 32)(point);
    assert(zoomed.x - 500 > wide.x - 500); assert.equal(zoomed.depth, wide.depth);
    assert.equal(projector(p, 1000, 700, 32)([0, 2.6, -10]).x, 500);
});

test('spatial cards are deterministic, bounded and attached to their source topic', () => {
    const cards = Array.from({ length: 20 }, (_, i) => ({ ...source, id: String(i) }));
    const positioned = positionCards(node, cards);
    assert.equal(positioned.length, 6); assert.deepEqual(positioned, positionCards(node, cards));
    assert(positioned.every(p => p.nodeId === node.id && p.position.every(Number.isFinite)));
    assert.equal(new Set(positioned.map(p => p.position.join(','))).size, 6);
});

test('article field preserves source text and order without inventing logical connections', () => {
    const field = createArticleField(source, node);
    assert.equal(field.world.nodes.length, 3);
    assert.equal(field.cards.map(c => c.body).join('\n\n'), source.body);
    assert(field.cards.every(c => c.fieldExcerpt && c.nodeId === node.id && c.sourceCardId === source.id));
    assert(field.world.edges.every(e => e.kind === 'reading-order'));
    assert.equal(field.world.edges[0].target, field.world.nodes[1].id);
    assert.match(field.notice, /不代表文章完整结构/);
});

test('search summary with a body is still explicitly a summary in every excerpt', () => {
    const summary = { ...source, kind: 'search_summary', source: 'zhihu', provenance: '知乎搜索摘要 · 非经核验的逐字引文' };
    const field = createArticleField(summary, node);
    assert.equal(contentLabel(summary), '搜索摘要 · 非全文');
    assert(field.cards.every(c => /搜索摘要 · 非全文/.test(c.provenance)));
    assert.match(field.notice, /非全文/);
    assert.equal(createArticleField({ ...source, body: '', text: '' }, node), null);
});

test('long returned text bounds field geometry without dropping source words', () => {
    const body = Array.from({ length: 60 }, (_, i) => `第${i}段：${'阅读和观察'.repeat(100)}`).join('\n\n');
    const field = createArticleField({ ...source, body }, node);
    assert(field.world.nodes.length <= 8);
    assert.equal(field.cards.map(c => c.body).join('').replace(/\s/g, ''), body.replace(/\s/g, ''));
});

function testView() {
    const classes = new Set(), view = Object.create(WorldView.prototype);
    const counters = { visits: 0, moves: 0, fields: [] };
    Object.assign(view, {
        host: { classList: { add: c => classes.add(c), remove: c => classes.delete(c), toggle: (c, enabled) => enabled ? classes.add(c) : classes.delete(c) } },
        world: { id: 'main', nodes: [node], edges: [] }, player: normalizePlayer({ x: 2, y: 18, z: 3, yaw: .7, pitch: -.2 }),
        content: new Map([[node.id, [source]]]), active: node, dwell: .4, lastVisit: node.id, visited: [node.id],
        thoughts: [{ id: 'thought' }], fov: 42, mode: 'explore', keys: new Set(), paused: false,
        renderer: { name: 'test', render() {} }, quality: 'balanced', frameCount: 0, frameSum: 0,
        callbacks: { onVisit: () => counters.visits++, onMove: () => counters.moves++, onFieldChange: change => counters.fields.push(change.inField) },
        unlock() { this.keys.clear(); }, resumeLook() {}, mountWorld(world) { this.world = world; }, mountThoughts() {}, showFieldBanner() {}, updateLabels() {},
    });
    return { view, counters };
}

test('field flight never pollutes main position/visits and return restores exact exploration state', () => {
    const { view, counters } = testView();
    const position = { ...view.player }, content = view.content, visited = view.visited, world = view.world;
    assert(view.enterField(source, node)); assert(view.inField);
    assert.equal(view.enterField(source, node), false);
    view.keys.add('ShiftLeft');
    for (let i = 0; i < 50; i++) view.tick(.05, i * 50);
    assert(view.player.y > 2.6); assert.equal(counters.moves, 0); assert.equal(counters.visits, 0);
    assert(view.exitField()); assert(!view.inField);
    assert.deepEqual(view.player, position);
    assert.equal(view.content, content); assert.equal(view.visited, visited); assert.equal(view.world, world);
    assert.equal(view.active, node); assert.equal(view.dwell, .4); assert.equal(view.fov, 42);
    assert.deepEqual(counters.fields, [true, false]); assert.equal(view.exitField(), false);
});

test('main-world expansion and late content responses remain available after leaving the field', () => {
    const { view } = testView();
    view.enterField(source, node);
    const fieldWorld = view.world;
    const expansion = { id: 'main', nodes: [node, { ...node, id: 'second', x: 50 }], edges: [] };
    view.setWorld(expansion);
    const more = [{ ...source, id: 'article-2', nodeId: 'second' }];
    view.setContent('second', more); assert.equal(view.world, fieldWorld);
    view.exitField();
    assert.equal(view.world, expansion); assert.equal(view.content.get('second'), more);
});

test('pause cancels tracking and hides actionable target', () => {
    const { view } = testView();
    view.setTarget = target => { view.target = target; };
    view.enter = () => { view.mode = 'explore'; };
    assert(view.track(node)); assert.equal(view.tracking, node);
    view.pause(true);
    assert.equal(view.tracking, null); assert.equal(view.getTarget(), null); assert.equal(view.track(node), false);
});

test('wheel events bubbling from spatial cards zoom the world host, respecting pause and browser zoom', () => {
    const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    try {
        globalThis.document = new EventTarget();
        globalThis.window = new EventTarget();
        const { view } = testView();
        view.host = Object.assign(new EventTarget(), view.host, { querySelectorAll: () => [] });
        view.canvas = new EventTarget();
        view.abort = { signal: undefined };
        view.attachControls();
        const wheel = (overrides = {}) => {
            const event = new Event('wheel', { bubbles: true, cancelable: true });
            // Browser bubbling delivers the overlay's event to the world ancestor.
            Object.defineProperties(event, Object.fromEntries(Object.entries({
                target: { className: 'world-card' }, deltaY: -100, ctrlKey: false, metaKey: false, ...overrides,
            }).map(([key, value]) => [key, { value }])));
            view.host.dispatchEvent(event);
            return event;
        };
        assert(wheel().defaultPrevented);
        assert.equal(view.fov, 39);
        view.paused = true;
        assert(!wheel().defaultPrevented); assert.equal(view.fov, 39);
        view.paused = false;
        assert(!wheel({ ctrlKey: true }).defaultPrevented); assert.equal(view.fov, 39);
        assert(!wheel({ metaKey: true }).defaultPrevented); assert.equal(view.fov, 39);
        view.mode = 'overview';
        assert(!wheel().defaultPrevented); assert.equal(view.fov, 39);
        view.mode = 'explore'; view.fov = 32;
        wheel(); assert.equal(view.fov, 32);
        view.fov = 86;
        wheel({ deltaY: 100 }); assert.equal(view.fov, 86);
    }
    finally {
        if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
        else delete globalThis.document;
        if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow);
        else delete globalThis.window;
    }
});

function withControlEvents(run) {
    const descriptors = ['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    try {
        globalThis.document = Object.assign(new EventTarget(), { pointerLockElement: null });
        globalThis.window = new EventTarget();
        const { view } = testView();
        delete view.unlock; delete view.resumeLook;
        view.host = Object.assign(new EventTarget(), view.host, { querySelectorAll: () => [] });
        view.canvas = new EventTarget();
        view.abort = { signal: undefined };
        view.lookEnabled = false;
        view.touchInput = false;
        view.attachControls();
        const emit = (host, type, values = {}) => {
            const event = new Event(type, { cancelable: true });
            Object.defineProperties(event, Object.fromEntries(Object.entries({ pointerType: 'mouse', buttons: 0, target: view.canvas, ...values }).map(([key, value]) => [key, { value }])));
            host.dispatchEvent(event);
            return event;
        };
        run(view, emit);
    } finally {
        for (const [key, descriptor] of descriptors) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

test('entering exploration follows unpressed mouse movement without pointer-lock support', () => withControlEvents((view, emit) => {
    view.enter();
    const start = { ...view.player };
    emit(document, 'pointermove', { clientX: 200, clientY: 100 });
    emit(document, 'pointermove', { clientX: 240, clientY: 115 });
    close(view.player.yaw, start.yaw - .08); close(view.player.pitch, start.pitch - .03);
    const beforeUI = { ...view.player };
    emit(document, 'pointermove', { target: { tagName: 'BUTTON' }, clientX: 800, clientY: 40 });
    emit(document, 'pointermove', { clientX: 810, clientY: 50 });
    assert.deepEqual(view.player, beforeUI, 'returning from UI starts a new mouse baseline');
    view.pause(true);
    emit(document, 'pointermove', { clientX: 850, clientY: 60 });
    assert.deepEqual(view.player, beforeUI);
    view.pause(false);
    emit(document, 'pointermove', { clientX: 850, clientY: 60 });
    emit(document, 'pointermove', { clientX: 860, clientY: 60 });
    close(view.player.yaw, beforeUI.yaw - .02);
    for (const code of ['Tab', 'Escape']) {
        emit(document, 'keydown', { code });
        assert.equal(view.lookEnabled, false);
        const released = { ...view.player };
        emit(document, 'pointermove', { clientX: 900, clientY: 100 });
        assert.deepEqual(view.player, released);
        emit(view.canvas, 'click');
        assert.equal(view.lookEnabled, true);
    }
    view.overview();
    const ended = { ...view.player };
    emit(document, 'pointermove', { clientX: 950, clientY: 120 });
    assert.deepEqual(view.player, ended);
}));

test('touch requires a drag and releasing it stops rotation while mouse remains hands-free', () => withControlEvents((view, emit) => {
    view.enter();
    const start = { ...view.player };
    emit(document, 'pointermove', { pointerType: 'touch', clientX: 200, clientY: 100 });
    assert.deepEqual(view.player, start);
    emit(view.canvas, 'pointerdown', { pointerType: 'touch', button: 0, clientX: 200, clientY: 100 });
    assert.equal(view.touchInput, true);
    emit(document, 'pointermove', { pointerType: 'touch', clientX: 220, clientY: 110 });
    close(view.player.yaw, start.yaw - .04); close(view.player.pitch, start.pitch - .02);
    emit(window, 'pointerup', { pointerType: 'touch' });
    const released = { ...view.player };
    emit(document, 'pointermove', { pointerType: 'touch', clientX: 250, clientY: 120 });
    assert.deepEqual(view.player, released);
    emit(document, 'pointermove', { clientX: 250, clientY: 120 });
    emit(document, 'pointermove', { clientX: 260, clientY: 120 });
    assert.equal(view.touchInput, false);
    close(view.player.yaw, released.yaw - .02);
}));
