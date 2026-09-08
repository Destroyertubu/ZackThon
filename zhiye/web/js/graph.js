import { el, button, toast } from './ui.js';
export const NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, text) { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs))
    n.setAttribute(k, String(v)); if (text !== undefined)
    n.textContent = text; return n; }
export function graphBounds(nodes) { const xs = nodes.map(n => n.x), zs = nodes.map(n => n.z); return { x: Math.min(-20, ...xs) - 20, y: Math.min(-20, ...zs) - 20, w: Math.max(20, ...xs) - Math.min(-20, ...xs) + 40, h: Math.max(20, ...zs) - Math.min(-20, ...zs) + 40 }; }
export function drawMiniMap(svg, world, journey) { svg.replaceChildren(); if (!world)
    return; const b = graphBounds(world.nodes), scale = Math.min(170 / b.w, 95 / b.h), tx = n => 5 + (n.x - b.x) * scale, ty = n => 7 + (n.z - b.y) * scale, ns = new Map(world.nodes.map(n => [n.id, n])); for (const e of world.edges) {
    const a = ns.get(e.source), c = ns.get(e.target);
    if (!a || !c)
        continue;
    svg.append(svgEl('line', { x1: tx(a), y1: ty(a), x2: tx(c), y2: ty(c), stroke: '#7a9c90', 'stroke-width': .6, opacity: .45 }));
} for (const n of world.nodes) {
    const visited = journey.visited.includes(n.id);
    svg.append(svgEl('circle', { cx: tx(n), cy: ty(n), r: visited ? 2.8 : 1.7, fill: visited ? '#e6c691' : '#789f90', opacity: visited ? 1 : .6 }));
} const p = journey.position; svg.append(svgEl('circle', { cx: tx(p), cy: ty(p), r: 3.2, fill: '#f6ead0', stroke: '#284c44', 'stroke-width': 1 })); }
export function makeGraph(world, journey, onSelect, { readOnly = false } = {}) {
    const frame = el('div', { class: 'graph-frame' }), svg = svgEl('svg', { role: 'img', 'aria-label': '心路画布：话题、探索轨迹与知识联系' }), bounds = graphBounds(world.nodes);
    let box = { ...bounds };
    const view = () => svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
    view();
    frame.append(svg);
    const ns = new Map(world.nodes.map(n => [n.id, n]));
    // Background topographic guide rings.
    for (let i = 1; i < 9; i++)
        svg.append(svgEl('ellipse', { cx: 0, cy: 0, rx: i * 15, ry: i * 13, fill: 'none', stroke: '#cbd6bf', 'stroke-width': .16, opacity: .65 }));
    for (const e of world.edges) {
        const a = ns.get(e.source), b = ns.get(e.target);
        if (!a || !b)
            continue;
        svg.append(svgEl('line', { x1: a.x, y1: a.z, x2: b.x, y2: b.z, stroke: e.kind === 'alternative' ? '#c8a58c' : e.kind === 'bridge' ? '#aeb0c0' : '#a9bb9a', 'stroke-width': .65, 'stroke-dasharray': e.kind === 'deepen' ? '0' : '1.6 1.6', opacity: .8 }));
    }
    if (journey.trace?.length > 1) {
        svg.append(svgEl('polyline', { points: journey.trace.map(p => `${p.x},${p.z}`).join(' '), fill: 'none', stroke: '#af8745', 'stroke-width': .85, opacity: .72, 'stroke-linejoin': 'round' }));
    }
    const visits = journey.visited || [];
    for (let i = 1; i < visits.length; i++) {
        const a = ns.get(visits[i - 1]), b = ns.get(visits[i]);
        if (a && b)
            svg.append(svgEl('line', { x1: a.x, y1: a.z, x2: b.x, y2: b.z, stroke: '#b58c46', 'stroke-width': .75, opacity: .8 }));
    }
    // A separate semantic layer: derived cards join their actual source topics.
    // Recursive provenance makes combinations of earlier combinations traceable.
    const cards = new Map((journey.bag || []).map(c => [c.id, c]));
    const origins = (id, seen = new Set()) => { if (seen.has(id))
        return []; seen.add(id); const c = cards.get(id); if (!c)
        return []; return c.nodeId && ns.has(c.nodeId) ? [c.nodeId] : (c.sourceIds || []).flatMap(x => origins(x, seen)); };
    for (const b of (journey.bridges || []).slice(-60)) {
        const ids = [...new Set((b.sourceIds || []).flatMap(id => origins(id)))], sources = ids.map(id => ns.get(id));
        if (!sources.length)
            continue;
        const x = sources.reduce((a, n) => a + n.x, 0) / sources.length + 7, z = sources.reduce((a, n) => a + n.z, 0) / sources.length - 5;
        const g = svgEl('g', { class: 'knowledge-bridge', tabindex: 0, role: 'button', 'aria-label': '知识组合：' + b.note });
        g.append(svgEl('title', {}, b.note));
        for (const n of sources)
            g.append(svgEl('path', { d: `M ${n.x} ${n.z} Q ${(n.x + x) / 2 + 7} ${(n.z + z) / 2 - 5} ${x} ${z}`, fill: 'none', stroke: '#9780a5', 'stroke-width': .65, 'stroke-dasharray': '2 1 0.5 1', opacity: .85 }));
        g.append(svgEl('path', { d: `M ${x} ${z - 2} l 2 2 -2 2 -2 -2 Z`, fill: '#ac92b7', stroke: '#806a8b', 'stroke-width': .5 }), svgEl('text', { x: x + 3, y: z + .6 }, cards.get(b.targetId)?.output === 'experiment' ? '行动实验' : cards.get(b.targetId)?.output === 'insight' ? '观点草稿' : '新问题'));
        g.addEventListener('click', () => toast(b.note));
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toast(b.note);
        } });
        svg.append(g);
    }
    for (const n of world.nodes) {
        const visited = visits.includes(n.id), g = svgEl('g', { class: 'graph-node', tabindex: 0, role: 'button', 'aria-label': n.title, transform: `translate(${n.x},${n.z})` });
        g.append(svgEl('circle', { r: visited ? 3.4 : 2.4, fill: visited ? '#efdfb0' : '#e5ebd8', stroke: visited ? '#a9894c' : '#9fb28e', 'stroke-width': .7 }));
        if (visited)
            g.append(svgEl('circle', { r: .8, fill: '#a2864d' }));
        const text = svgEl('text', { class: 'graph-label', x: 0, y: 8.5, 'text-anchor': 'middle' }, n.title.length > 13 ? n.title.slice(0, 12) + '…' : n.title);
        g.append(text);
        g.addEventListener('click', () => onSelect(n));
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(n);
        } });
        svg.append(g);
    }
    for (const t of journey.thoughts || []) {
        const n = ns.get(t.nodeId);
        if (n)
            svg.append(svgEl('path', { d: `M${n.x + 4},${n.z - 6}l1.5 3-1.5 3-1.5-3Z`, fill: '#7c9181' }));
    }
    frame.append(el('div', { class: 'graph-legend' }, el('span', {}, el('i'), '我走过的路'), el('span', {}, el('i'), '可能的方向'), el('span', {}, el('i'), '知识组合')));
    const zoom = factor => { const cx = box.x + box.w / 2, cy = box.y + box.h / 2; box.w = Math.min(bounds.w * 3, Math.max(25, box.w * factor)); box.h = box.w * bounds.h / bounds.w; box.x = cx - box.w / 2; box.y = cy - box.h / 2; view(); };
    frame.append(el('div', { class: 'graph-tools' }, el('button', { type: 'button', onclick: () => zoom(.8), 'aria-label': '放大画布' }, '+'), el('button', { type: 'button', onclick: () => zoom(1.25), 'aria-label': '缩小画布' }, '−'), el('button', { type: 'button', onclick: () => { box = { ...bounds }; view(); }, 'aria-label': '重置画布' }, '⤢')));
    svg.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.08 : .92); }, { passive: false });
    let down = null;
    svg.addEventListener('pointerdown', e => { if (e.target.closest('.graph-node,.knowledge-bridge'))
        return; down = { x: e.clientX, y: e.clientY, bx: box.x, by: box.y }; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener('pointermove', e => { if (!down)
        return; const r = svg.getBoundingClientRect(); box.x = down.bx - (e.clientX - down.x) / r.width * box.w; box.y = down.by - (e.clientY - down.y) / r.height * box.h; view(); });
    for (const kind of ['pointerup', 'pointercancel'])
        svg.addEventListener(kind, () => down = null);
    return frame;
}
