/** Pure domain logic, shared by UI and node:test. No renderer or network coupling. */
export const VERSION = 1;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function hash32(s) { let h = 2166136261; for (const c of String(s)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
} return h >>> 0; }
export function rng(seed) { let s = hash32(seed); return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function segmentDistance(p, a, b) { const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz; const t = l ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / l, 0, 1) : 0; return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz); }
export function walkable(p, world) {
    if (world.nodes.some(n => distance(p, n) < (n.depth === 0 ? 12 : 9.8)))
        return true;
    const nodes = new Map(world.nodes.map(n => [n.id, n]));
    return world.edges.some(e => segmentDistance(p, nodes.get(e.source), nodes.get(e.target)) < 2.35);
}
export function nearestNode(p, nodes) { return nodes.reduce((best, n) => { const d = distance(p, n); return !best || d < best.distance ? { node: n, distance: d } : best; }, null); }
export function appendTrace(trace, p, t, force = false) {
    const prev = trace.at(-1);
    if (!force && prev && Math.hypot(prev.x - p.x, prev.z - p.z) < 1.6 && t - prev.t < 8000)
        return trace;
    const next = [...trace, { x: +p.x.toFixed(2), z: +p.z.toFixed(2), t }];
    if (next.length <= 2800)
        return next;
    // Preserve start/end and coarsen old samples instead of discarding the beginning.
    return [...next.slice(0, 2000).filter((_, i) => i % 2 === 0), ...next.slice(2000)];
}
export function makeJourney(world) {
    const date = new Date().toISOString();
    return { id: crypto.randomUUID(), worldId: world.id, revision: 0, title: world.seed, position: { x: 0, z: 8, yaw: 0, pitch: 0 }, visited: ['root'], trace: [], bag: [], thoughts: [], bridges: [], startedAt: date, updatedAt: date };
}
export function collect(journey, card) {
    if (journey.bag.some(c => c.id === card.id))
        return false;
    if (journey.bag.length >= 300)
        throw new Error('行囊已到 300 张上限，请先导出整理。');
    journey.bag.push({ ...card, personalNote: '', collectedAt: new Date().toISOString() });
    return true;
}
export const RELATIONS = { complement: '互相补充', contrast: '形成分歧', analogy: '跨界类比', cause: '因果假设' };
export function synthesize(cards, relation, note, output = 'question') {
    if (cards.length < 2 || cards.length > 4)
        throw new Error('请选择 2–4 张卡片。');
    if (!Object.hasOwn(RELATIONS, relation))
        throw new Error('请选择联系类型。');
    if (note.trim().length < 6)
        throw new Error('请用至少 6 个字说明你发现的联系。');
    const titles = cards.map(c => c.title).join(' × ');
    const prefix = { question: '新问题', insight: '观点草稿', experiment: '行动实验' }[output] || '新问题';
    const q = relation === 'contrast' ? '这两种观点分别在什么条件下成立？' : relation === 'analogy' ? '这种类比在哪些地方有效，在哪些地方会失效？' : relation === 'cause' ? '什么观察能支持或推翻这条因果假设？' : '把两种理解放在一起，是否遗漏了另一种解释？';
    const body = output === 'experiment' ? `我要尝试：${note.trim()}\n\n观察记录：写下行动前的预期、实际发生的变化和未被解释的现象。\n\n反证条件：${q}` : output === 'insight' ? `我的暂时理解：${note.trim()}\n\n仍需验证：${q}` : `${note.trim()}\n\n继续追问：${q}`;
    return { id: crypto.randomUUID(), title: `${prefix} · ${titles}`, text: body, body, kind: 'derived', source: 'personal', provenance: '我的组合草稿 · 不代表已证实结论', author: '我', url: null, verifiedQuote: false, sourceIds: cards.map(c => c.id), relation, output, personalNote: note.trim(), createdAt: new Date().toISOString() };
}
export function exportMarkdown(journey, world) {
    const mdEscape = s => String(s ?? '').replace(/[\[\]<>]/g, c => ({ '[': '\\[', ']': '\\]', '<': '&lt;', '>': '&gt;' }[c]));
    let s = `---\ntitle: ${JSON.stringify(journey.title)}\napp: 知野\ncreated: ${journey.startedAt}\nschema_version: 1\n---\n\n# ${mdEscape(journey.title)}\n\n> 问题是世界的种子；走过的路，是自己的答案。\n\n## 我走过的话题\n\n`;
    const ns = new Map(world.nodes.map(n => [n.id, n]));
    s += journey.visited.map((id, i) => `${i + 1}. ${mdEscape(ns.get(id)?.title || id)}`).join('\n');
    s += '\n\n## 知识行囊\n';
    for (const c of journey.bag) {
        s += `\n### ${mdEscape(c.title)}\n\n${mdEscape(c.text)}\n\n来源标记：${mdEscape(c.provenance)}\n\n作者：${mdEscape(c.author)}\n`;
        if (c.url && /^https:\/\//.test(c.url))
            s += `\n原文：<${c.url.replace(/[<>\n]/g, '')}>\n`;
        if (c.personalNote)
            s += `\n我的联系或备注：${mdEscape(c.personalNote)}\n`;
        if (c.sourceIds)
            s += `\n来源卡片 ID：${c.sourceIds.join('、')}\n`;
    }
    s += '\n## 想法锚点\n';
    for (const t of journey.thoughts)
        s += `\n### ${mdEscape(ns.get(t.nodeId)?.title || '沿途')}\n\n${mdEscape(t.text)}\n\n记录于 ${t.createdAt}；${t.visibility === 'public' ? '已申请公开' : '仅自己可见'}\n`;
    s += '\n## 灵感桥梁\n';
    for (const b of journey.bridges)
        s += `\n- ${mdEscape(RELATIONS[b.relation] || b.relation)}：${mdEscape(b.note)}\n`;
    return s;
}
export function validateBackup(data) {
    if (!data || data.schema !== 1 || !data.world || !data.journey)
        throw new Error('不支持的备份格式。');
    if (!Array.isArray(data.world.nodes) || data.world.nodes.length > 64 || !Array.isArray(data.world.edges) || data.world.edges.length > 200)
        throw new Error('世界数据不合法。');
    if (!Array.isArray(data.journey.bag) || data.journey.bag.length > 300)
        throw new Error('行囊数据不合法。');
    if (!Array.isArray(data.journey.visited) || data.journey.visited.length > 100)
        throw new Error('轨迹数据不合法。');
    if (!data.world.nodes.every(n => typeof n.id === 'string' && typeof n.title === 'string' && Number.isFinite(n.x) && Number.isFinite(n.z) && Math.abs(n.x) < 1000 && Math.abs(n.z) < 1000))
        throw new Error('地图坐标不合法。');
    const ids = new Set(data.world.nodes.map(n => n.id));
    if (data.world.edges.some(e => !ids.has(e.source) || !ids.has(e.target)))
        throw new Error('图边引用不存在的话题。');
    return data;
}
