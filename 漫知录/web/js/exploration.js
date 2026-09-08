/** Pure exploration rules, shared by the GPU and software worlds. */
import { clamp } from './core.js';

export const FLIGHT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']);
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export function normalizePlayer(player = {}) {
    return {
        x: clamp(finite(player.x, 0), -990, 990),
        y: clamp(finite(player.y, 2.6), .8, 120),
        z: clamp(finite(player.z, 8), -990, 990),
        yaw: finite(player.yaw, 0),
        pitch: clamp(finite(player.pitch, 0), -1.4, 1.4),
    };
}

export function moveFlight(player, keys, dt, speed = 7.4) {
    const p = normalizePlayer(player);
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const vertical = Number(keys.has('ShiftLeft') || keys.has('ShiftRight')) - Number(keys.has('ControlLeft') || keys.has('ControlRight'));
    const length = Math.hypot(forward, side, vertical);
    if (!length) return p;
    const step = Math.max(0, dt) * speed / length;
    p.x += (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * side) * step;
    p.z += (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * side) * step;
    p.y += vertical * step;
    return normalizePlayer(p);
}

export const nodeLabelPosition = node => [node.x, node.labelY ?? (node.depth === 0 ? 8.8 : 6.6), node.z - 1];
export const distanceToNode = (player, node) => Math.hypot(player.x - node.x, player.y - (node.y ?? 2.6), player.z - node.z);

export function advanceTracking(player, node, dt, speed = 17) {
    const destination = { x: node.x, y: node.y ?? 2.6, z: node.z + 9 };
    const dx = destination.x - player.x, dy = destination.y - player.y, dz = destination.z - player.z;
    const distance = Math.hypot(dx, dy, dz);
    const amount = distance ? Math.min(1, Math.max(0, dt) * speed / distance) : 1;
    const next = normalizePlayer({ ...player, x: player.x + dx * amount, y: player.y + dy * amount, z: player.z + dz * amount });
    const focus = nodeLabelPosition(node), tx = focus[0] - next.x, ty = focus[1] - next.y, tz = focus[2] - next.z;
    const yaw = Math.atan2(-tx, -tz), pitch = Math.atan2(ty, Math.hypot(tx, tz));
    // Shortest angular turn avoids spinning when crossing the -π / π seam.
    const turn = Math.min(1, Math.max(0, dt) * 4);
    next.yaw += Math.atan2(Math.sin(yaw - next.yaw), Math.cos(yaw - next.yaw)) * turn;
    next.pitch += (pitch - next.pitch) * turn;
    return { player: next, arrived: amount === 1 };
}

export function positionCards(node, cards) {
    const visible = cards.filter(card => card && typeof card.id === 'string').slice(0, 6);
    return visible.map((card, i) => {
        const angle = -Math.PI / 2 + (i - (visible.length - 1) / 2) * .69;
        return { card, nodeId: node.id, position: [node.x + Math.cos(angle) * 6.8, (node.y ?? 2.6) + 1.2 + (i % 2) * 1.2, node.z + Math.sin(angle) * 6.8] };
    });
}

/** Only the reticle's visible screen intersection counts; proximity is not aim. */
export function selectAimTarget(candidates, width, height) {
    const x = width / 2, y = height / 2;
    const hits = candidates.filter(c => c.projection.depth > .5 && Number.isFinite(c.projection.x) && Number.isFinite(c.projection.y)
        && Math.abs(c.projection.x - x) <= c.width / 2 && Math.abs(c.projection.y - y) <= c.height / 2);
    hits.sort((a, b) => a.projection.depth - b.projection.depth || Math.hypot(a.projection.x - x, a.projection.y - y) - Math.hypot(b.projection.x - x, b.projection.y - y));
    return hits[0]?.target || null;
}

export function contentLabel(card) {
    if (/summary/i.test(card.kind || '') || /摘要/.test(card.provenance || '')) return '搜索摘要 · 非全文';
    if (card.source === 'demo' || card.kind === 'demo_original') return '原创演示 · 非知乎原文';
    if (card.source === 'personal' || card.kind === 'derived') return '我的思考草稿';
    return card.body ? '已有内容片段' : '内容摘要 · 非全文';
}

/** Preserve source order and exact wording; this is a reading map, not inferred claims. */
export function createArticleField(card, originNode) {
    const source = (typeof card?.body === 'string' && card.body.trim() ? card.body : card?.text || '').trim();
    if (!source) return null;
    const paragraphs = source.split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean);
    const chunks = [];
    for (const paragraph of paragraphs) {
        // Long unbroken extracts remain readable without inventing section headings.
        for (let start = 0; start < paragraph.length; start += 360) chunks.push(paragraph.slice(start, start + 360));
    }
    // Keep all words while bounding scene geometry, even for long official responses.
    const groupSize = Math.max(1, Math.ceil(chunks.length / 8));
    const excerpts = [];
    for (let i = 0; i < chunks.length; i += groupSize) excerpts.push(chunks.slice(i, i + groupSize).join('\n\n'));
    const color = originNode?.color || '#e3bf82', prefix = `field:${card.id}`;
    const label = contentLabel(card);
    const nodes = excerpts.map((text, i) => ({
        id: `${prefix}:${i}`, title: `片段 ${String(i + 1).padStart(2, '0')}`, question: text,
        category: '按原有顺序阅读', color, depth: i ? 1 : 0, x: Math.sin(i * .72) * 19, z: -i * 25,
        expanded: true, sourceNodeId: originNode?.id || card.nodeId,
    }));
    const cards = nodes.map((node, i) => ({
        ...card, id: `${prefix}:card:${i}`, sourceCardId: card.id, nodeId: originNode?.id || card.nodeId,
        title: `${node.title} · ${card.title}`, text: excerpts[i], body: excerpts[i],
        provenance: `${label} · 第 ${i + 1} / ${nodes.length} 段`, fieldExcerpt: true,
    }));
    const world = { id: prefix, seed: card.title, type: 'article-field', nodes, edges: nodes.slice(1).map((node, i) => ({ id: `${prefix}:edge:${i}`, source: nodes[i].id, target: node.id, kind: 'reading-order', reason: '仅表示已有文本顺序，不推断因果。' })) };
    return { world, cards, label, notice: `${label}；按已有文本分段，不代表文章完整结构。` };
}
