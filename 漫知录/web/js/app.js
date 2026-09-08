import { api, post, put, del, localSave, localLoad, localErase, download } from './api.js';
import { WorldView } from './world-view.js';
import { makeJourney, collect, synthesize, exportMarkdown, appendTrace, RELATIONS, validateBackup, restoreCachedContent } from './core.js';
import { el, button, icon, hydrateIcons, toast, emptyState, sourcePill, formatTime, safeUrl, Soundscape } from './ui.js';
import { drawMiniMap, makeGraph } from './graph.js';
import { renderHome } from './home.js';
const $ = selector => document.querySelector(selector);
const state = { session: null, world: null, journey: null, content: new Map(), homeCards: new Map(), contentInFlight: new Map(), activeId: 'root', selected: new Set(), panel: null, dirty: 0, saved: 0, publicSlug: null, remoteMode: 'demo', booted: false };
let worldView, localTimer, savePromise = null, overlayToken = 0, lastFocus = null;
let panelCleanups = [];
function disposePanel() { for (const cleanup of panelCleanups.splice(0)) cleanup(); }
const sounds = new Soundscape();
const safe = fn => async (...args) => { try {
    return await fn(...args);
}
catch (error) {
    toast(error.message || '操作未完成，请重试。', true);
    return null;
} };
const currentNode = () => state.world?.nodes.find(n => n.id === state.activeId) || state.world?.nodes[0];
const currentCards = () => state.content.get(state.activeId) || [];
function snapshot() { return { schema: 1, owner: state.session?.id, world: state.world, journey: state.journey, content: [...state.content.entries()], contentMode: state.remoteMode, savedAt: new Date().toISOString() }; }
function cacheLocal(immediate = false) { clearTimeout(localTimer); const write = () => localSave(snapshot()).catch(() => toast('本地存储空间不足，请及时导出旅程。', true)); if (immediate)
    write();
else
    localTimer = setTimeout(write, 400); }
function markDirty() { if (!state.journey)
    return; state.dirty++; state.journey.updatedAt = new Date().toISOString(); cacheLocal(); $('#save-label').textContent = '保存旅程'; updateHUD(); }
async function saveJourney(showToast = false, target = state.journey) {
    if (!target)
        return;
    // A late anchor response may belong to an earlier journey. Serialize writes
    // without changing which journey this call was asked to persist.
    while (savePromise) {
        await savePromise;
    }
    const current = state.journey === target, generation = current ? state.dirty : null;
    if (current && state.world && worldView.mode === 'explore' && !worldView.inField)
        target.position = { ...worldView.player };
    const { id, ...payload } = structuredClone(target);
    if (current) $('#save-label').textContent = '保存中…';
    savePromise = put(`/api/journeys/${encodeURIComponent(id)}`, payload).then(result => { target.revision = result.revision; if (state.journey === target) {
        state.saved = generation;
        cacheLocal(true);
        $('#save-label').textContent = state.dirty === state.saved ? '已保存' : '保存旅程';
    } if (showToast)
        toast('旅程已保存，本地备份也已更新。'); }).catch(error => { if (state.journey === target) { cacheLocal(true); $('#save-label').textContent = '本地已备份'; } throw error; }).finally(() => savePromise = null);
    return savePromise;
}
function updateHUD() { if (!state.journey || !state.world)
    return; const j = state.journey; $('#bag-count').textContent = j.bag.length; $('#visited-count').textContent = String(new Set(j.visited).size).padStart(2, '0'); $('#journey-stats').textContent = `${new Set(j.visited).size} 个话题 · ${j.bag.length} 件收获 · ${j.thoughts.length} 个想法`; worldView.visited = j.visited; drawMiniMap($('#minimap'), state.world, j); }
function updateMode() { const live = state.remoteMode === 'live'; $('#mode-badge').textContent = live ? '知乎内容 · 本地优先' : '原创演示 · 未连接知乎'; }
function enterExploration() { document.body.classList.add('exploring'); $('#intro').hidden = true; $('#explore-hud').hidden = false; $('#world-caption').hidden = true; $('#key-guide').hidden = false; $('#minimap-open').hidden = false; worldView.enter(); $('#hud-title').textContent = currentNode()?.title || '问题的原点'; $('#hud-question').textContent = state.world.seed; updateHUD(); }
function returnToIntro() { closePanel(); worldView.exitField?.(); if (state.journey) {
    cacheLocal(true);
    safe(() => saveJourney())();
} worldView.overview(); document.body.classList.remove('exploring'); $('#intro').hidden = false; $('#explore-hud').hidden = true; $('#nearby').hidden = true; $('#minimap-open').hidden = true; $('#key-guide').hidden = true; $('#world-caption').hidden = false; $('#seed-input').focus(); }
async function startJourney(seed) {
    const btn = $('#start-btn');
    btn.disabled = true;
    try {
        worldView.exitField?.();
        worldView.cancelTracking?.();
        if (state.journey && state.dirty !== state.saved)
            await saveJourney();
        const world = await post('/api/worlds', { seed });
        state.world = world;
        $('#seed-input').value = world.seed;
        state.journey = makeJourney(world);
        state.publicSlug = null;
        state.content.clear();
        state.contentInFlight.clear();
        state.selected.clear();
        state.activeId = 'root';
        state.dirty = 0;
        state.saved = 0;
        worldView.setWorld(world);
        worldView.setPlayer(state.journey.position);
        worldView.setThoughts?.([]);
        enterExploration();
        markDirty();
        await saveJourney();
        await visitNode('root');
        toast('WASD 漫行，Shift 上升、Ctrl 下降。对准片段按 F，进入文章场域。');
    }
    finally {
        btn.disabled = false;
    }
}
async function contentFor(nid) { if (state.content.has(nid)) {
    worldView.setContent?.(nid, state.content.get(nid)); return state.content.get(nid); } if (state.contentInFlight.has(nid))
    return state.contentInFlight.get(nid); const worldId = state.world.id; const p = api(`/api/worlds/${worldId}/nodes/${nid}/content`).then(result => { if (state.world.id !== worldId)
    return []; state.content.set(nid, result.items); worldView.setContent?.(nid, result.items); cacheLocal(); return result.items; }).finally(() => { if (state.contentInFlight.get(nid) === p)
    state.contentInFlight.delete(nid); }); state.contentInFlight.set(nid, p); return p; }
async function visitNode(nid) {
    if (!state.journey || !state.world || worldView.inField)
        return;
    const node = state.world.nodes.find(n => n.id === nid);
    if (!node)
        return;
    const initialWorldId = state.world.id;
    state.activeId = nid;
    if (state.journey.visited.at(-1) !== nid) {
        if (state.journey.visited.length < 100)
            state.journey.visited.push(nid);
        markDirty();
    }
    $('#hud-title').textContent = node.title;
    $('#hud-question').textContent = node.question;
    renderNearby(true);
    try {
        await contentFor(nid);
        if (state.activeId === nid)
            renderNearby();
    }
    catch (error) {
        if (state.activeId === nid)
            renderNearby(false, error.message);
    }
    if (state.world.id !== initialWorldId)
        return;
    const worldId = initialWorldId;
    if (!node.expanded) {
        try {
            const expanded = await post(`/api/worlds/${worldId}/expand/${nid}`);
            if (state.world.id === worldId) {
                state.world = expanded;
                worldView.setWorld(expanded);
                worldView.setThoughts?.(state.journey.thoughts);
                markDirty();
            }
        }
        catch (error) {
            toast(error.message, true);
        }
    }
}
function collectCard(card) { if (!state.journey)
    return; try {
    if (collect(state.journey, { ...card, topic: card.topic || state.world.nodes.find(n => n.id === card.nodeId)?.title || currentNode()?.title })) {
        markDirty();
        toast('已收入知识行囊。试着把它与另一张卡片搭一座桥。');
        renderNearby();
    }
    else
        toast('这张卡片已在行囊中。');
}
catch (error) {
    toast(error.message, true);
} }
function renderNearby(loading = false, error = null) {
    const host = $('#nearby');
    host.replaceChildren();
    if (!state.journey || worldView.mode !== 'explore' || worldView.inField) {
        host.hidden = true;
        return;
    }
    host.hidden = false;
    const node = currentNode();
    host.append(el('div', { class: 'nearby-heading' }, icon('spark'), el('span', {}, `${node.title} · 沿途拾得`)));
    if (loading && !state.content.has(node.id)) {
        host.append(el('div', { class: 'near-card muted' }, '正在打开这个话题…'));
        return;
    }
    if (error) {
        host.append(el('div', { class: 'near-card' }, el('p', { class: 'muted' }, error), button('重试', safe(async () => { await contentFor(node.id); renderNearby(); }), { style: 'secondary' })));
        return;
    }
    const cards = currentCards();
    if (!cards.length) {
        host.append(el('div', { class: 'near-card' }, '这个话题暂未返回内容。可以继续探索，或留下自己的问题。'));
    }
    for (const card of cards.slice(0, 2)) {
        const collected = state.journey.bag.some(c => c.id === card.id);
        host.append(el('button', { class: 'near-card content-preview', type: 'button', onclick: () => openReader(card) }, sourcePill(card), el('p', { class: 'near-text' }, card.text), el('span', { class: 'near-footer' }, el('span', {}, card.author), el('span', {}, collected ? '已收纳' : '点击阅读', icon(collected ? 'check' : 'arrow')))));
    }
    host.append(el('div', { class: 'nearby-actions' }, button(`浏览 ${cards.length} 条片段`, () => { const { body } = openSheet('reader', node.title, '这个话题周围的声音'); body.append(...cards.map(card => button(card.title, () => openReader(card), { style: 'secondary', glyph: 'book' }))); }, { style: 'secondary', glyph: 'book', disabled: !cards.length }), button('留下想法', () => openAnchors(), { style: 'ghost', glyph: 'pin' })));
}
function closePanel() { disposePanel(); const root = $('#overlay-root'); root.replaceChildren(); state.panel = null; overlayToken++; worldView?.pause(false); if (worldView) updateTargetHint(worldView.getTarget?.()); document.querySelectorAll('.primary-nav button').forEach(b => b.classList.toggle('active', b.id === 'roam-nav')); if (lastFocus?.isConnected)
    lastFocus.focus({ preventScroll: true }); }
function openSheet(kind, title, kicker) { disposePanel(); lastFocus = document.activeElement; state.panel = kind; $('#target-hint').hidden = true; worldView.pause(true); overlayToken++; const token = overlayToken; const root = $('#overlay-root'); const overlay = el('div', { class: 'overlay' }); const sheet = el('section', { class: `sheet ${kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title', tabIndex: -1 }); const close = el('button', { class: 'icon-button', type: 'button', 'aria-label': '关闭面板', onclick: closePanel }, icon('close')); sheet.append(el('header', { class: 'sheet-head' }, el('div', {}, el('div', { class: 'sheet-kicker' }, kicker || 'MANZHILU · WALK YOUR MIND'), el('h2', { class: 'sheet-title', id: 'sheet-title' }, title)), close)); const body = el('div', { class: 'sheet-body' }); sheet.append(body); overlay.append(sheet); root.replaceChildren(overlay); overlay.addEventListener('click', e => { if (e.target === overlay)
    closePanel(); }); sheet.addEventListener('keydown', e => { if (e.key === 'Escape') {
    e.preventDefault();
    closePanel();
} if (e.key === 'Tab') {
    const focusables = [...sheet.querySelectorAll('button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]')].filter(n => !n.hidden);
    const first = focusables[0], last = focusables.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
        e.preventDefault();
        last?.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
    }
} }); queueMicrotask(() => sheet.focus()); document.querySelectorAll('.primary-nav button').forEach(b => b.classList.toggle('active', b.dataset.panel === kind)); return { body, token, active: () => overlayToken === token }; }
function requireJourney() { if (state.journey)
    return true; toast('先用一个问题开启旅程，再收纳路上的发现。'); return false; }
function openReader(card) {
    const { body } = openSheet('reader', '一束沿途的光', 'READ · PAUSE · THINK');
    body.append(sourcePill(card), el('h3', { class: 'reader-title' }, card.title), el('div', { class: 'reader-meta' }, el('span', {}, card.author), el('span', {}, card.provenance)), el('article', { class: 'reader-body' }, card.body || card.text));
    if (card.source === 'zhihu' && card.retrievedAt != null) {
        const retrieved = typeof card.retrievedAt === 'number' ? card.retrievedAt * 1000 : Date.parse(card.retrievedAt);
        if (Number.isFinite(new Date(retrieved).getTime())) body.append(el('p', { class: 'muted tiny' }, '本地保存于 ' + formatTime(retrieved)));
    }
    if (card.source === 'zhihu')
        body.append(el('div', { class: 'notice warning', style: 'margin-top:20px' }, '这里展示搜索接口返回的摘要，不等同于完整文章或逐字引文。上下文、作者署名与最新内容以知乎原文为准。'));
    if (card.sourceIds) {
        const sources = el('div', { class: 'stack', style: 'margin-top:20px' }, el('div', { class: 'field-label' }, '这张组合卡的来源'));
        for (const id of card.sourceIds) {
            const origin = state.journey?.bag.find(c => c.id === id) || state.homeCards.get(id);
            if (origin)
                sources.append(button(origin.title, () => openReader(origin), { style: 'ghost', glyph: 'link' }));
        }
        body.append(sources);
    }
    const actions = el('div', { class: 'reader-actions' }, button(state.journey?.bag.some(c => c.id === card.id) ? '已在行囊 · 查看' : '收入知识行囊', () => { if (state.journey?.bag.some(c => c.id === card.id))
        openBag();
    else
        collectCard(card); }, { glyph: 'bag' }), button('记下此刻的想法', () => openAnchors(), { style: 'secondary', glyph: 'pin' }));
    const url = safeUrl(card.url);
    if (url)
        actions.append(el('a', { class: 'button ghost original-link', href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('external'), '在知乎阅读原文'));
    body.append(actions);
    if (state.journey && !worldView.inField)
        actions.prepend(button('进入这篇文章的场域 · F', () => enterArticle(card), { style: 'secondary', glyph: 'compass' }));
}
function updateTargetHint(target) {
    const hint = $('#target-hint');
    hint.hidden = !target || !!state.panel || worldView.mode !== 'explore';
    if (!target) return;
    hint.querySelector('strong').textContent = target.type === 'card' ? target.card.title : target.node.title;
    hint.querySelector('span').textContent = target.type === 'card'
        ? (worldView.inField ? '左键 阅读这一段 · E 收入行囊' : '左键 阅读 · F 进入场域 · E 收入行囊')
        : (worldView.inField ? '靠近，阅读这里的思路' : 'V 自动追踪 · 靠近展开观点');
}
function enterArticle(card) {
    if (!requireJourney() || !card) return;
    if (worldView.inField) { toast('你已在文章场域中，可点击上方按钮返回主世界。'); return; }
    state.journey.position = { ...worldView.player };
    const node = state.world.nodes.find(n => n.id === card.nodeId) || currentNode();
    closePanel();
    if (worldView.enterField(card, node)) {
        markDirty();
        toast('沿着片段之间的路径阅读，随时可返回刚才的位置。');
    }
}
function fieldChanged({ inField, card }) {
    document.body.classList.toggle('article-field', inField);
    $('#hud-title').textContent = inField ? '文章场域' : currentNode()?.title || '自由漫游';
    $('#hud-question').textContent = inField ? card.title : currentNode()?.question || state.world.seed;
    $('#nearby').hidden = inField;
    if (!inField) renderNearby();
}
async function openHome() {
    const { body, active } = openSheet('home', '把沿途的光，带回家', '漫知录 · 精神家园');
    body.append(el('p', { class: 'muted' }, '正在整理这次旅程的收获…'));
    let homeData = null;
    try {
        if (state.journey) await saveJourney();
        homeData = await api('/api/home');
    } catch (error) {
        if (active()) toast('暂时无法读取家园存档，将展示当前旅程。' + error.message, true);
    }
    if (!active()) return;
    body.replaceChildren();
    if (homeData) state.homeCards = new Map(homeData.groups.flatMap(g => g.items || []).map(c => [c.id, c]));
    renderHome(body, {
        homeData, journey: state.journey, world: state.world,
        onRead: openReader, onRestore: safe(restoreJourney), onCanvas: safe(openCanvas),
        onCompanions: safe(openCompanions),
        onExplore: () => { closePanel(); if (state.journey) enterExploration(); else returnToIntro(); },
        onSynthesis: safe(async (cards = []) => {
            if (!state.journey && cards.length) await startJourney(homeData?.journals?.[0]?.seed || '');
            if (!requireJourney()) return;
            const available = new Map((homeData?.groups || []).flatMap(g => g.items || []).map(c => [c.id, c]));
            const add = (card, seen = new Set()) => {
                if (!card || seen.has(card.id)) return;
                seen.add(card.id);
                for (const id of card.sourceIds || []) add(available.get(id), seen);
                const node = state.world.nodes.find(n => n.title === card.topic);
                collect(state.journey, { ...card, originNodeId: card.originNodeId || card.nodeId, nodeId: node?.id || null });
            };
            for (const card of cards) add(card);
            if (cards.length) { state.selected = new Set(cards.slice(0, 4).map(c => c.id)); markDirty(); }
            openBag();
        })
    });
    refreshNotifications().catch(() => {});
}
async function refreshNotifications() {
    const result = await api('/api/notifications');
    const badge = $('#notification-count');
    badge.textContent = result.unread > 99 ? '99+' : result.unread;
    badge.hidden = !result.unread;
    return result;
}
async function openNotifications() {
    const { body, active } = openSheet('notifications', '来自同路人的回声', '共鸣消息');
    const result = await refreshNotifications();
    if (!active()) return;
    if (!result.items.length) body.append(emptyState('山谷里，等待第一声回响', '公开锚点被同路人共鸣或评论后，消息会留在这里。', 'bell'));
    for (const item of result.items) {
        body.append(el('article', { class: 'anchor-item notification-item' + (item.read ? '' : ' unread') },
            el('p', {}, item.text), el('div', { class: 'anchor-meta' },
                el('span', {}, `${item.topic} · ${formatTime(item.created * 1000)}`),
                button('看看这个锚点', safe(async () => {
                    if (!active()) return;
                    const row = await post('/api/anchors/' + item.anchorId + '/read');
                    if (!active()) return;
                    if (row) await openAnchorThread(row); else toast('这个锚点已被移除或暂不可见。');
                }), { style: 'ghost', glyph: 'pin' }))));
    }
    const unreadIds = result.items.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length) {
        await post('/api/notifications/read', { ids: unreadIds });
        if (active()) await refreshNotifications();
    }
}
function openBag() {
    if (!requireJourney())
        return;
    const { body } = openSheet('bag', '知识行囊', 'COLLECT LESS. CONNECT MORE.');
    body.append(el('p', { class: 'section-intro' }, '不是把答案装满，而是让两段知识相遇。选 2–4 张卡片，写下它们之间的联系，生成属于你的新问题、观点草稿或行动实验。'));
    const layout = el('div', { class: 'bag-layout' }), left = el('div'), list = el('div', { class: 'bag-list' });
    left.append(el('div', { class: 'bag-count-line' }, el('span', {}, `${state.journey.bag.length} 件沿途收获`), button('导出 Markdown', () => exportMd(), { style: 'ghost', glyph: 'download' })), list);
    layout.append(left);
    const studio = el('aside', { class: 'synthesis-studio' });
    layout.append(studio);
    body.append(layout);
    if (!state.journey.bag.length)
        list.append(emptyState('行囊，还在等第一束光', '在话题附近按 E，或打开一张内容卡，把值得带走的片段收进来。', 'bag'));
    function renderStudio() {
        studio.replaceChildren(el('div', { class: 'studio-kicker' }, 'THE IDEA ATELIER'), el('h3', {}, '让知识，长出桥梁'), el('p', {}, '选择并不构成理解。你写下的那句联系，才是组合的开始。'));
        const selected = [...state.selected].map(id => state.journey.bag.find(c => c.id === id)).filter(Boolean);
        const progress = el('div', { class: 'selection-progress' }, ...Array.from({ length: 4 }, (_, i) => el('span', { class: i < selected.length ? 'filled' : '' })), el('small', {}, `已选 ${selected.length} / 4`));
        studio.append(progress);
        const relation = el('select', { class: 'select', id: 'relation-select', 'aria-label': '知识之间的联系类型' }, ...Object.entries(RELATIONS).map(([value, text]) => el('option', { value }, text)));
        const output = el('select', { class: 'select', id: 'output-select', 'aria-label': '组合输出类型' }, el('option', { value: 'question' }, '一个新问题'), el('option', { value: 'insight' }, '一张观点草稿'), el('option', { value: 'experiment' }, '一次行动实验'));
        const note = el('textarea', { class: 'textarea', id: 'synthesis-note', maxLength: 2000, placeholder: '例如：热爱不一定先于行动。把“自我认知”与“刻意练习”放在一起，我想试着从行动中寻找热爱。', 'aria-label': '我发现的知识联系' });
        studio.append(el('div', { class: 'form-group' }, el('label', { class: 'field-label', htmlFor: 'relation-select' }, '01 · 它们如何相遇'), relation), el('div', { class: 'form-group' }, el('label', { class: 'field-label', htmlFor: 'synthesis-note' }, '02 · 写下你的联系，而非让 AI 替你理解'), note), el('div', { class: 'form-group' }, el('label', { class: 'field-label', htmlFor: 'output-select' }, '03 · 让这次组合变成'), output));
        studio.append(button('搭一座灵感桥', () => { try {
            const card = synthesize(selected, relation.value, note.value, output.value);
            collect(state.journey, card);
            state.journey.bridges.push({ id: crypto.randomUUID(), sourceIds: selected.map(c => c.id), targetId: card.id, relation: relation.value, note: note.value.trim(), createdAt: new Date().toISOString() });
            state.selected.clear();
            markDirty();
            openBag();
            toast('新的组合卡已生成，原始来源与联系说明一并保留。');
        }
        catch (e) {
            toast(e.message, true);
        } }, { glyph: 'link', disabled: selected.length < 2 }));
        studio.append(el('p', { class: 'tiny', style: 'margin-top:14px' }, '本地组合，不消耗直答额度。不把类比或因果假设包装成事实。'));
    }
    for (const card of [...state.journey.bag].reverse()) {
        const checkbox = el('input', { class: 'selection-box', type: 'checkbox', checked: state.selected.has(card.id), 'aria-label': `选择卡片：${card.title}` });
        const row = el('article', { class: 'knowledge-card' + (state.selected.has(card.id) ? ' selected' : '') });
        checkbox.addEventListener('change', () => { if (checkbox.checked) {
            if (state.selected.size >= 4) {
                checkbox.checked = false;
                toast('每次最多选择 4 张卡片。');
                return;
            }
            state.selected.add(card.id);
        }
        else
            state.selected.delete(card.id); row.classList.toggle('selected', checkbox.checked); renderStudio(); });
        const note = el('textarea', { class: 'card-note', maxLength: 1000, value: card.personalNote || '', placeholder: '收藏时的我，想到了什么？', 'aria-label': `给 ${card.title} 添加备注` });
        note.addEventListener('input', () => { card.personalNote = note.value; markDirty(); });
        row.append(el('div', { class: 'row' }, sourcePill(card), checkbox), el('h3', {}, card.title), el('p', {}, card.text.length > 210 ? card.text.slice(0, 210) + '…' : card.text), note, el('div', { class: 'card-actions' }, el('button', { class: 'text-button', type: 'button', onclick: () => openReader(card) }, '展开阅读', icon('arrow')), el('button', { class: 'icon-button', type: 'button', 'aria-label': `移除 ${card.title}`, onclick: () => { if (state.journey.bag.some(c => c.sourceIds?.includes(card.id))) {
                toast('这张卡片被组合卡引用。请先移除引用它的组合卡，避免丢失来源。');
                return;
            } state.journey.bag = state.journey.bag.filter(c => c.id !== card.id); state.journey.bridges = state.journey.bridges.filter(b => b.targetId !== card.id); state.selected.delete(card.id); markDirty(); openBag(); } }, icon('trash'))));
        list.append(row);
    }
    renderStudio();
}
function exportMd() { if (!requireJourney())
    return; download('漫知录_心路手记.md', exportMarkdown(state.journey, state.world), 'text/markdown;charset=utf-8'); toast('Markdown 手记已导出，保留来源与组合关系。'); }
function exportJson() { if (!requireJourney())
    return; download('漫知录_旅程备份.json', JSON.stringify(snapshot(), null, 2), 'application/json'); }
async function openCanvas(view = 'mine') {
    if (!requireJourney()) return;
    if (typeof view !== 'string') view = 'mine';
    const { body, active } = openSheet('canvas', '词云小径 · 我的个人画布', '每一条路，都留下认知的形状');
    const tabs = el('div', { class: 'canvas-tabs', role: 'tablist', 'aria-label': '小径视图' });
    for (const [value, label] of [['mine', '我的足迹'], ['companions', '同频人足迹'], ['popular', '全员热门小径']]) {
        tabs.append(el('button', { type: 'button', role: 'tab', 'aria-selected': value === view,
            class: value === view ? 'active' : '', onclick: safe(() => openCanvas(value)) }, label));
    }
    body.append(tabs, el('p', { class: 'section-intro' }, view === 'mine'
        ? '金色是你的足迹，紫色是知识之间的桥梁。点一个话题，继续探路。'
        : '每一条公开路线为小径添一点光。走过的人越多，连线越亮、越宽。'));
    const layout = el('div', { class: 'canvas-layout' }), side = el('aside', { class: 'canvas-sidebar' });
    body.append(layout);
    if (view !== 'mine') {
        layout.append(el('p', { class: 'muted' }, '正在汇聚同路人的足迹…'));
        try {
            const result = await api(`/api/trails?view=${view}&journeyId=${encodeURIComponent(state.journey.id)}`);
            if (!active()) return;
            layout.replaceChildren();
            if (!result.enabled || !result.nodes.length) {
                layout.append(emptyState(result.enabled ? '小径，等待更多脚步' : '从公开一条自己的路开始',
                    result.enabled ? '还没有符合条件的公开路线。私人旅程不会被计入热度。' : '主动公开路线后，可以查看与你话题相近的同频人足迹。', 'route'));
                if (!result.enabled) layout.append(button('到同频电话亭看看', safe(openCompanions), { glyph: 'people' }));
                return;
            }
            side.append(el('div', { class: 'metric' }, el('strong', {}, result.pathCount), el('span', {}, '条主动公开的路线')),
                el('p', { class: 'muted' }, '热度只表达同行人数，你依然可以走向任何方向。'));
            const details = el('div', { class: 'stack' }); side.append(details);
            layout.append(makeGraph(result, { visited: [], trace: [], thoughts: [] }, node => {
                details.replaceChildren(el('h3', {}, node.title), el('p', {}, `${node.heat} 条公开路线经过这里`),
                    button('以这个话题启程', safe(async () => { closePanel(); await startJourney(node.title); }), { glyph: 'compass' }));
            }, { heat: true }), side);
        } catch (error) {
            if (active()) layout.replaceChildren(el('div', { class: 'notice warning' }, error.message));
        }
        return;
    }
    const info = el('div', { class: 'stack' });
    const go = node => info.replaceChildren(el('h3', {}, node.title), el('p', {}, node.question),
        button('自动追踪这个话题', () => {
            closePanel(); worldView.exitField?.(); enterExploration(); worldView.track(node);
        }, { glyph: 'compass' }),
        button('直接到这里看看', () => {
            closePanel(); worldView.exitField?.(); state.activeId = node.id; worldView.jump(node); enterExploration(); safe(() => visitNode(node.id))();
        }, { style: 'ghost', glyph: 'route' }));
    const j = state.journey;
    side.append(el('div', { class: 'metric-grid' }, ...[['话题', new Set(j.visited).size], ['收获', j.bag.length], ['锚点', j.thoughts.length], ['桥梁', j.bridges.length]].map(([label, value]) => el('div', { class: 'metric' }, el('strong', {}, String(value).padStart(2, '0')), el('span', {}, label)))), info,
        button('回家整理收获', safe(openHome), { style: 'secondary', glyph: 'home' }),
        button('导出心路手记', exportMd, { style: 'ghost', glyph: 'download' }));
    layout.append(makeGraph(state.world, j, go), side); go(currentNode());
    if (j.thoughts.length) body.append(el('div', { class: 'timeline' }, el('div', { class: 'field-label' }, '想法留下的时间刻度'),
        ...j.thoughts.slice(-5).reverse().map(t => el('div', { class: 'timeline-item' }, el('time', {}, formatTime(t.createdAt)), el('p', {}, t.text)))));
}
async function openAnchors(nodeId, { reading = false } = {}) {
    if (!requireJourney())
        return;
    const journey = state.journey, world = state.world;
    const node = world.nodes.find(n => n.id === nodeId) || currentNode();
    const { body, active } = openSheet('anchors', reading ? '听一听，同路人的声音' : '我在这里，想到了……', '想法锚点 · ' + node.title);
    body.append(el('p', { class: 'section-intro' }, '一句质疑、一声赞叹，或一个尚未成形的问题，都值得有一个落脚的地方。默认只有自己能看见。'));
    const text = el('textarea', { class: 'textarea', id: 'anchor-text', maxLength: 2000, placeholder: `关于「${node.title}」，我此刻想到……`, 'aria-label': '写下想法锚点' }), pub = el('input', { type: 'checkbox', id: 'anchor-public' });
    const save = button('把想法留在这里', safe(async () => { if (!text.value.trim()) {
        toast('写下一句话，再放下锚点。');
        return;
    } save.disabled = true;
    const submitted = { worldId: world.id, nodeId: node.id, text: text.value.trim(), visibility: pub.checked ? 'public' : 'private' };
    const position = node.id === state.activeId ? { ...journey.position } : { x: node.x, y: 2.6, z: node.z + 2 };
    try {
        const result = await post('/api/anchors', submitted);
        // Restoring the same journey may replace its object while the request is
        // pending. Use that current copy, otherwise save the original journey.
        const target = state.journey?.id === journey.id ? state.journey : journey;
        target.thoughts.push({ ...result, nodeId: node.id, text: submitted.text, position, createdAt: new Date().toISOString() });
        target.updatedAt = new Date().toISOString();
        if (state.journey === target) {
            worldView.setThoughts?.(target.thoughts);
            markDirty();
        }
        await saveJourney(false, target);
        if (active()) {
            text.value = '';
            pub.checked = false;
            await renderThoughts();
        }
        toast(result.status === 'pending' ? '想法已保存；公开申请进入审核队列，尚未向他人展示。' : '想法锚点已落下，仅自己可见。');
    }
    finally {
        save.disabled = false;
    } }), { glyph: 'pin' });
    if (reading) {
        body.append(button('留下我的想法', () => openAnchors(node.id), { style: 'secondary', glyph: 'pin' }));
    } else {
        body.append(text, el('div', { class: 'form-group' }, el('label', { class: 'check-label' }, pub, el('span', {}, '申请公开这个想法', el('small', {}, '审核通过后在这个话题旁展示给同路人。私人想法始终留给自己。')))), save);
    }
    body.append(el('div', { class: 'divider' }));
    const list = el('div', { class: 'stack' });
    body.append(el('div', { class: 'field-label' }, '留在这个话题旁的声音'), list);
    async function renderThoughts() { const rows = await api('/api/anchors?topic=' + encodeURIComponent(node.title)); if (!active())
        return; list.replaceChildren(); if (!rows.length)
        list.append(emptyState('这里还很安静', '写下第一个想法，等待另一位同路人。公开想法审核通过后会在这里相遇。', 'pin')); for (const row of rows) {
        const actions = el('div', { class: 'row wrap' }, button(`阅读与共鸣 · ${row.resonance || 0}`, safe(() => openAnchorThread({ ...row, topic: node.title })), { style: 'ghost', glyph: 'spark' }));
        if (row.own)
            actions.append(el('button', { class: 'text-button', type: 'button', onclick: safe(async () => { await del('/api/anchors/' + row.id); state.journey.thoughts = state.journey.thoughts.filter(t => t.id !== row.id); worldView.setThoughts?.(state.journey.thoughts); markDirty(); await renderThoughts(); }) }, '删除'));
        else
            actions.append(el('button', { class: 'text-button', type: 'button', onclick: safe(async () => { await post('/api/anchors/' + row.id + '/report', { reason: '用户认为该公开想法不适宜，请管理员复核。' }); toast('举报已记录，将由管理员复核。'); }) }, '举报'));
        list.append(el('article', { class: 'anchor-item' }, el('p', {}, row.text), el('div', { class: 'anchor-meta' }, el('span', {}, `${row.own ? '我' : row.alias} · ${row.status === 'pending' ? '待审核' : row.visibility === 'private' ? '仅自己可见' : '公开'} · ${formatTime(row.created * 1000)}`), actions)));
    } }
    try {
        await renderThoughts();
    }
    catch (e) {
        if (active())
            list.append(el('div', { class: 'notice warning' }, e.message));
    }
}
async function openAnchorThread(anchor) {
    const { body, active } = openSheet('anchor-thread', '在这里，听见回声', anchor.topic || '想法锚点');
    let row = { ...anchor }, busy = false, holdTimer, repeatTimer, held = false;
    const stats = el('div', { class: 'resonance-stats' });
    const resonance = el('button', { class: 'button primary resonance-button', type: 'button' });
    const stopHold = () => { clearTimeout(holdTimer); clearInterval(repeatTimer); };
    panelCleanups.push(stopHold);
    const update = () => {
        stats.textContent = `${row.readCount || 0} 位同路人读过 · ${row.resonance || 0} 共鸣`;
        resonance.textContent = row.own ? '这是我留下的锚点' : (row.myResonance >= 3 ? '已连鸣 3 次' : `共鸣 ${row.myResonance || 0} / 3 · 长按连鸣`);
        resonance.disabled = row.own || row.myResonance >= 3;
    };
    const resonate = safe(async () => {
        if (busy || !active() || row.own || row.myResonance >= 3) return;
        busy = true;
        try {
            const result = await post('/api/anchors/' + row.id + '/resonate');
            row = { ...row, ...result };
            if (active()) update();
        } finally { busy = false; }
    });
    resonance.addEventListener('pointerdown', e => {
        if (e.button !== 0 || resonance.disabled) return;
        held = false;
        resonance.setPointerCapture(e.pointerId);
        holdTimer = setTimeout(() => { held = true; resonate(); repeatTimer = setInterval(resonate, 650); }, 600);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) resonance.addEventListener(name, stopHold);
    resonance.addEventListener('click', () => { if (held) { held = false; return; } resonate(); });
    body.append(el('blockquote', { class: 'anchor-quote' }, row.text),
        el('p', { class: 'muted' }, `${row.own ? '我' : row.alias} · ${formatTime(row.created * 1000)}`), stats,
        el('div', { class: 'row wrap' }, resonance, button('另设一个想法锚点', () => {
            const node = state.world?.nodes.find(n => n.title === row.topic);
            openAnchors(node?.id);
        }, { style: 'secondary', glyph: 'pin' })),
        el('p', { class: 'muted tiny' }, '首次阅读留下一点共鸣。深受触动时，再轻按或长按传递回声，每人最多三次。'),
        el('div', { class: 'divider' }));
    update();
    const comments = el('div', { class: 'comment-list stack', 'aria-live': 'polite' });
    const input = el('textarea', { class: 'textarea', maxLength: 1000, rows: 3, placeholder: '写下与你产生共鸣的地方…', 'aria-label': '评论这个想法锚点' });
    const send = button('留下这句回应', safe(async () => {
        if (!input.value.trim()) { toast('写下一句话，再把回应留下。'); return; }
        send.disabled = true;
        try {
            await post('/api/anchors/' + row.id + '/comments', { text: input.value.trim() });
            if (!active()) return;
            input.value = '';
            await loadComments();
        } finally { send.disabled = false; }
    }), { glyph: 'people' });
    body.append(el('h3', {}, '在这句话之后'), comments, input, send);
    async function loadComments() {
        const result = await api('/api/anchors/' + row.id + '/comments');
        if (!active()) return;
        comments.replaceChildren();
        if (!result.items.length) comments.append(el('p', { class: 'muted' }, '还没有回应，你可以留下第一句。'));
        for (const comment of result.items) comments.append(el('article', { class: 'comment-item' },
            el('p', {}, comment.text), el('small', { class: 'muted' }, `${comment.own ? '我' : comment.alias} · ${formatTime(comment.created * 1000)}`)));
    }
    try {
        if (!row.own) { row = { ...row, ...await post('/api/anchors/' + row.id + '/read') }; if (active()) update(); }
        await loadComments();
    } catch (error) {
        if (active()) comments.append(el('div', { class: 'notice warning' }, error.message));
    }
}
async function openArchives() {
    const { body, active } = openSheet('archives', '长路本身，已是圆满', 'YOUR SAVED JOURNEYS');
    body.append(el('p', { class: 'section-intro' }, '保存的不只是走到哪儿，还有当时的收获、疑问与想法。访客存档属于当前浏览器会话；导出备份可以把旅程带走。'));
    const list = el('div', { class: 'archive-list' });
    body.append(list);
    list.append(el('p', { class: 'muted' }, '正在打开旅程存档…'));
    try {
        const rows = await api('/api/journeys');
        if (!active())
            return;
        list.replaceChildren();
        if (!rows.length)
            list.append(emptyState('还没有被保存的旅程', '开始一次漫游，或点击右上角的“保存旅程”。', 'archive'));
        for (const row of rows) {
            list.append(el('article', { class: 'archive-item' }, el('div', {}, el('h3', {}, row.title), el('p', {}, `${formatTime(row.updated * 1000)} · ${row.visited} 次话题停留${row.publicSlug ? ' · 已选择公开路线' : ''}`)), el('div', { class: 'row' }, button('继续这段路', safe(() => restoreJourney(row.id)), { style: 'secondary', glyph: 'compass' }), el('button', { class: 'icon-button', type: 'button', 'aria-label': `删除存档 ${row.title}`, onclick: () => { const confirmSheet = openSheet('settings', '删除这份存档？', 'THIS ACTION CANNOT BE UNDONE'); confirmSheet.body.append(el('p', { class: 'section-intro' }, '服务器存档及其公开路线将被删除。当前正在探索的内存副本仍可重新保存；锚点请在话题面板单独删除。'), button('确认删除存档', safe(async () => { await del('/api/journeys/' + row.id); if (state.journey?.id === row.id) {
                    state.journey.revision = 0;
                    state.publicSlug = null;
                    state.saved = state.dirty;
                    cacheLocal();
                } openArchives(); }), { style: 'danger', glyph: 'trash' })); } }, icon('trash')))));
        }
    }
    catch (e) {
        if (active())
            list.replaceChildren(el('div', { class: 'notice warning' }, e.message));
    }
}
async function restoreJourney(id) { worldView.exitField?.(); if (state.journey && state.dirty !== state.saved)
    await saveJourney(); const result = await api('/api/journeys/' + encodeURIComponent(id)); state.world = result.world; state.journey = { id: result.id, ...result.data }; state.publicSlug = result.publicSlug; state.activeId = state.journey.visited.at(-1) || 'root'; state.content.clear(); state.contentInFlight.clear(); state.selected.clear(); state.dirty = 0; state.saved = 0; worldView.setWorld(state.world); worldView.setPlayer(state.journey.position); worldView.setThoughts?.(state.journey.thoughts); closePanel(); enterExploration(); cacheLocal(true); await visitNode(state.activeId); toast('已回到上次停下的地方。'); }
async function openCompanions() {
    if (!requireJourney())
        return;
    const { body, active } = openSheet('companions', '世界很大，也有人与你同路', 'FIND RESONANCE, NOT A LABEL');
    body.append(el('p', { class: 'section-intro' }, '同频来自公开选择的路线，而不是对你的隐秘推断。我们比较话题与连接方式，不分析私人锚点，也不推断人格。'));
    if (!state.publicSlug) {
        const sharing = el('div', { class: 'stack' }), confirm = el('input', { type: 'checkbox', id: 'publish-confirm' }), alias = el('input', { class: 'input', value: state.session.alias, maxLength: 40, id: 'public-alias', 'aria-label': '公开路线显示的昵称' });
        sharing.append(el('div', { class: 'notice warning' }, `公开预览：种子问题「${state.world.seed}」，以及 ${new Set(state.journey.visited).size} 个访问过的话题和它们之间的图上连线。问题本身也可能包含个人信息，请先确认适合公开。`), el('div', { class: 'form-group' }, el('label', { class: 'field-label', htmlFor: 'public-alias' }, '给这条路线署个名字'), alias), el('label', { class: 'check-label' }, confirm, el('span', {}, '我确认公开这份路线快照', el('small', {}, '不包含行囊、私人锚点、思考时间线和连续坐标；后续修改不会自动更新公开快照。'))));
        const publish = button('公开路线，寻找同路人', safe(async () => { await saveJourney(); const result = await post('/api/journeys/' + state.journey.id + '/publish', { confirm: true, alias: alias.value.trim() }); state.publicSlug = result.slug; cacheLocal(); openCompanions(); toast('路线快照已公开。可以随时撤回。'); }), { glyph: 'people', disabled: true });
        confirm.addEventListener('change', () => publish.disabled = !confirm.checked);
        sharing.append(publish);
        body.append(sharing, emptyState('先决定被看见什么', '公开是你主动做出的选择，不是使用漫知录的前提。', 'eye'));
        return;
    }
    const actionRow = el('div', { class: 'row wrap' }, button('复制公开路线链接', safe(async () => { const link = location.origin + '/?trail=' + encodeURIComponent(state.publicSlug); try {
        await navigator.clipboard.writeText(link);
        toast('公开路线链接已复制。');
    }
    catch {
        const input = el('input', { class: 'input', readOnly: true, value: link, 'aria-label': '公开路线链接' });
        body.prepend(input);
        input.select();
        toast('复制不可用，链接已选中，可手动复制。');
    } }), { style: 'secondary', glyph: 'link' }), button('更新公开快照', safe(async () => { await saveJourney(); await post('/api/journeys/' + state.journey.id + '/publish', { confirm: true, alias: state.session.alias }); toast('公开路线快照已更新，仍不包含私人内容。'); openCompanions(); }), { style: 'ghost' }), button('撤回公开', safe(async () => { await del('/api/journeys/' + state.journey.id + '/publish'); state.publicSlug = null; cacheLocal(); openCompanions(); toast('公开路线已撤回，旧链接立即失效。'); }), { style: 'ghost' }));
    body.append(actionRow, el('div', { class: 'divider' }));
    const list = el('div', { class: 'companion-grid' });
    body.append(list);
    try {
        const result = await api('/api/companions/' + state.journey.id);
        if (!active())
            return;
        if (!result.items.length) {
            body.append(emptyState('此刻，还没有相遇的路线', '其他真实用户主动公开相近路线之后，会出现在这里。没有机器人填场，也没有虚构的同频人数。', 'people'));
            return;
        }
        for (const item of result.items) {
            list.append(el('article', { class: 'companion-card' }, el('h3', { class: 'traveler-id' }, item.alias), el('div', { class: 'match' }, `${Math.round(item.score * 100)}%`, el('small', {}, '公开路线相似度')), el('p', {}, item.seed), el('div', { class: 'topic-chips' }, ...item.commonTopics.slice(0, 5).map(t => el('span', {}, t))), button('看看 TA 走过的路', safe(() => openPublicTrail(item.slug)), { style: 'secondary', glyph: 'route' })));
        }
        body.append(el('p', { class: 'muted tiny', style: 'margin-top:20px' }, result.algorithm));
    }
    catch (e) {
        if (active())
            body.append(el('div', { class: 'notice warning' }, e.message));
    }
}
async function openPublicTrail(slug) { const p = await api('/api/public/' + encodeURIComponent(slug)); const { body } = openSheet('canvas', `${p.alias} 的公开心路`, 'A SHARED PATH'); body.append(el('p', { class: 'section-intro' }, p.seed)); const journey = { visited: p.nodes.map(n => n.id), trace: [], thoughts: [] }; body.append(makeGraph(p, journey, n => toast(n.title), { readOnly: true }), el('div', { class: 'notice', style: 'margin-top:20px' }, '这是用户主动公开的路线快照。不包含私人记录，也不是他们完整的兴趣画像。'), button('带着这个问题出发', safe(async () => { closePanel(); $('#seed-input').value = p.seed; await startJourney(p.seed); }), { glyph: 'compass' })); }
function openHelp() {
    const { body } = openSheet('help', '给第一次启程的你', '漫行指南');
    const items = [
        ['自由飞行', 'WASD · Shift / Ctrl', 'WASD 沿视角方向在水平面移动；Shift 上升，Ctrl 下降。鼠标转动视角，滚轮拉近或拉远。进入探索后鼠标自然跟随，无需按住。Tab 或 Esc 释放，点击画面恢复；打开面板暂停，关闭后继续。'],
        ['进入文章', '左键 · F · Q', '靠近话题会浮现文章片段。用屏幕中央准星选中，左键阅读，F 进入文章场域。子地图按已有内容分段呈现；Q 或上方按钮返回原位置。'],
        ['收获与联结', 'E · B', '对准片段按 E 收入知识行囊，B 整理行囊。选择 2–4 件收获，在思维合成台写下联系，生成新的洞察。'],
        ['留下与听见', 'R · T', 'R 写下自己的想法锚点；T 阅读同话题的声音。展开锚点可评论、共鸣或长按连鸣，每人最多三次。'],
        ['追踪与回顾', 'V · M', '对准话题词按 V，自动飞向它；按方向键可随时停止。M 打开个人画布，切换我的足迹、同频人足迹或热门小径。'],
        ['回到家园', 'H', '把沿途的收获带回家。想法收纳柜自动按话题整理，日志回顾历次旅程，同频电话亭连接主动公开路线的同路人。']
    ];
    body.append(el('div', { class: 'help-grid' }, ...items.map(([title, key, text]) => el('div', {}, el('div', { class: 'row between' }, el('h3', {}, title), el('kbd', {}, key)), el('p', {}, text)))),
        el('div', { class: 'notice', style: 'margin-top:20px' }, '内容卡会注明来源。仅有搜索摘要时，文章场域也只组织这些已取得的片段；原文可通过知乎链接继续阅读。'),
        button('出发，按自己的节奏', closePanel, { glyph: 'compass' }));
}
function preferences() { try {
    return JSON.parse(localStorage.getItem('zhiye-preferences') || '{}');
}
catch {
    return {};
} }
function savePreferences(p) { localStorage.setItem('zhiye-preferences', JSON.stringify(p)); }
function applyPreferences() { const p = preferences(); worldView.reduced = p.reduced ?? matchMedia('(prefers-reduced-motion: reduce)').matches; worldView.quality = p.quality || 'balanced'; document.body.classList.toggle('high-contrast', !!p.contrast); document.body.classList.toggle('large-text', !!p.large); if (worldView.renderer) {
    worldView.renderer.quality = worldView.quality;
    worldView.renderer.resize(worldView.host.clientWidth, worldView.host.clientHeight, devicePixelRatio || 1);
} }
async function openSettings() {
    const { body, active } = openSheet('settings', '按自己的节奏探索', 'COMFORT · PRIVACY · PROVENANCE');
    const prefs = preferences();
    body.append(el('p', { class: 'muted tiny' }, `漫知录 v${document.querySelector('meta[name="application-version"]').content} · 自由漫游与精神家园`));
    body.append(el('div', { class: 'notice' }, '当前是访客会话，不是知乎 OAuth 登录。数据保存在本浏览器的本地备份及本应用服务器；未接入跨设备身份同步。'));
    const group = el('div', { class: 'stack', style: 'margin-top:22px' });
    for (const [key, title, detail] of [['reduced', '减少动态效果', '关闭背景漂移、水面动画与泛光。'], ['contrast', '增强界面与标签对比度', '让文字比氛围更优先。'], ['large', '放大正文文字', '阅读卡片使用更大的字号。']]) {
        const input = el('input', { type: 'checkbox', checked: key === 'reduced' ? worldView.reduced : !!prefs[key] });
        input.addEventListener('change', () => { const p = preferences(); p[key] = input.checked; savePreferences(p); applyPreferences(); });
        group.append(el('label', { class: 'check-label' }, input, el('span', {}, title, el('small', {}, detail))));
    }
    body.append(group);
    const quality = el('select', { class: 'select', 'aria-label': '渲染画质' }, el('option', { value: 'balanced' }, '均衡 · 适度泛光与阴影'), el('option', { value: 'low' }, '轻量 · 低像素密度，无动态泛光'));
    quality.value = worldView.quality;
    quality.addEventListener('change', () => { const p = preferences(); p.quality = quality.value; savePreferences(p); applyPreferences(); });
    body.append(el('div', { class: 'form-group' }, el('label', { class: 'field-label' }, '画面质量'), quality), el('p', { class: 'muted tiny' }, `当前引擎：${worldView.renderer.name}。软件兼容模式不具备 GPU 材质、阴影与后期处理。`), el('div', { class: 'divider' }));
    const status = el('div', { class: 'notice warning' }, '正在核查数据模式与调用预算…');
    body.append(status);
    api('/api/status').then(result => { if (active())
        status.textContent = `${result.mode === 'demo' ? '原创演示模式：不消耗知乎额度。' : '实时模式：前端只调用本应用后端。'} 开发者今日搜索 ${result.developerUsed} / ${result.developerBudget}；当前访客 ${result.guestUsed} / ${result.guestBudget}。预算按 ${result.dayTimezone} 重置。`; }).catch(e => status.textContent = e.message);
    body.append(el('div', { class: 'divider' }), el('div', { class: 'row wrap' }, button('导出 Markdown', exportMd, { style: 'secondary', glyph: 'download', disabled: !state.journey }), button('导出完整 JSON', exportJson, { style: 'ghost', glyph: 'archive', disabled: !state.journey })), el('p', { class: 'muted tiny', style: 'margin-top:12px' }, 'JSON 包含当前世界、连续轨迹、行囊、来源与私人锚点。请像保管日记一样保管，不要直接发到公开群聊。'));
    body.append(el('div', { class: 'divider' }), button('删除我的全部应用数据', () => { const x = openSheet('settings', '让这次旅程真正离开', 'DELETE MY DATA'); x.body.append(el('div', { class: 'notice warning' }, '将删除本应用中的所有旅程、世界、锚点、公开路线，以及此浏览器的本地备份。不会删除知乎账号或知乎原文。操作不可撤销，建议先导出。'), el('div', { class: 'row wrap', style: 'margin-top:20px' }, button('先导出 JSON', exportJson, { style: 'secondary', disabled: !state.journey }), button('确认全部删除', safe(async () => { clearInterval(autoSaveTimer); clearTimeout(localTimer); if (savePromise)
        await savePromise.catch(() => { }); await del('/api/me/data'); await localErase(); localStorage.removeItem('zhiye-preferences'); state.journey = null; location.href = location.origin; }), { style: 'danger', glyph: 'trash' }))); }, { style: 'danger', glyph: 'trash' }));
}
const panels = { home: openHome, notifications: openNotifications, bag: openBag, canvas: openCanvas, anchors: openAnchors, archives: openArchives, companions: openCompanions, help: openHelp, settings: openSettings };
let autoSaveTimer;
async function boot() {
    hydrateIcons();
    worldView = new WorldView($('#world'), { onMode: name => $('#renderer-tag').textContent = name, onQuality: toast, onOpen: safe(async (nid) => { if (!state.journey) {
            $('#seed-input').focus();
            return;
        } state.activeId = nid; const cards = await contentFor(nid); if (cards.length)
            openReader(cards[0]);
        else
            openAnchors(nid); }), onVisit: safe(visitNode), onRead: openReader, onTarget: updateTargetHint, onFieldChange: fieldChanged, onTracking: node => { const control = $('#tracking-cancel'); control.hidden = !node; control.textContent = node ? `正在追踪「${node.title}」 · 点击或按方向键停止` : ''; }, onMove: (p, force) => { if (!state.journey || worldView.inField)
            return; state.journey.position = { ...p }; const next = appendTrace(state.journey.trace, p, Date.now(), force); if (next !== state.journey.trace) {
            state.journey.trace = next;
            markDirty();
        } } });
    await worldView.init();
    worldView.callbacks.onThought = t => openAnchors(t.nodeId);
    state.session = await post('/api/session');
    state.remoteMode = state.session.mode;
    updateMode();
    applyPreferences();
    const local = await localLoad().catch(() => null);
    let restored = false;
    if (local?.owner === state.session.id && local.journey?.id) {
        try {
            const saved = await api('/api/journeys/' + local.journey.id);
            const useLocal = local.journey.revision >= saved.data.revision;
            state.world = saved.world;
            state.journey = useLocal ? local.journey : { id: saved.id, ...saved.data };
            state.publicSlug = saved.publicSlug;
            state.activeId = state.journey.visited.at(-1) || 'root';
            if (useLocal)
                state.content = new Map(restoreCachedContent(local.content, state.remoteMode, local.contentMode ?? local.mode));
            worldView.setWorld(state.world);
            worldView.setPlayer(state.journey.position);
            for (const [nid, cards] of state.content) worldView.setContent(nid, cards);
            worldView.setThoughts?.(state.journey.thoughts);
            $('#seed-input').value = state.world.seed;
            $('#start-btn span:first-child').textContent = '继续漫游';
            restored = true;
            markDirty();
        }
        catch { /* A deleted/expired server session never silently steals a local backup. */ }
    }
    if (!restored) {
        state.world = await post('/api/worlds', { seed: $('#seed-input').value });
        worldView.setWorld(state.world);
    }
    updateHUD();
    state.booted = true;
    refreshNotifications().catch(() => {});
    $('#random-start').addEventListener('click', safe(() => startJourney('')));
    $('#tracking-cancel').addEventListener('click', () => worldView.cancelTracking());
    $('#seed-form').addEventListener('submit', e => { e.preventDefault(); safe(async () => { const seed = $('#seed-input').value.trim(); if (seed && state.journey && seed === state.world.seed) {
        enterExploration();
        await visitNode(state.activeId);
        toast('欢迎回来，继续走自己的路。');
    }
    else
        await startJourney(seed); })(); });
    document.querySelectorAll('[data-seed]').forEach(b => b.addEventListener('click', () => { $('#seed-input').value = b.dataset.seed; $('#start-btn span:first-child').textContent = '开始漫游'; $('#seed-input').focus(); }));
    $('#seed-input').addEventListener('input', () => { $('#start-btn span:first-child').textContent = state.journey && $('#seed-input').value === state.world.seed ? '继续漫游' : '开始漫游'; });
    document.querySelectorAll('[data-panel]').forEach(b => b.addEventListener('click', safe(() => panels[b.dataset.panel]?.())));
    $('#home-btn').addEventListener('click', returnToIntro);
    $('#seed-change').addEventListener('click', returnToIntro);
    $('#roam-nav').addEventListener('click', () => { closePanel(); if (state.journey)
        enterExploration();
    else
        $('#seed-input').focus(); });
    $('#save-btn').addEventListener('click', safe(async () => { if (requireJourney())
        await saveJourney(true); }));
    $('#minimap-open').addEventListener('click', openCanvas);
    $('#audio-btn').addEventListener('click', safe(async () => { const on = await sounds.toggle(); $('#audio-btn').style.opacity = on ? '1' : '.6'; $('#audio-btn').setAttribute('aria-label', on ? '关闭环境声音' : '开启环境声音'); toast(on ? '环境声音已开启。' : '环境声音已关闭。'); }));
    document.addEventListener('keydown', e => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable || e.repeat || e.metaKey || e.altKey) return;
        if (state.panel) return;
        if (e.code === 'KeyH') { e.preventDefault(); safe(openHome)(); return; }
        if (!state.journey || worldView.mode !== 'explore') return;
        if (['KeyE', 'KeyR', 'KeyT', 'KeyB', 'KeyM', 'KeyF', 'KeyV', 'KeyQ'].includes(e.code)) e.preventDefault();
        const target = worldView.getTarget?.();
        if (e.code === 'KeyE') {
            if (target?.type === 'card') collectCard(target.card); else toast('将十字准星对准一个观点片段，再按 E 收纳。');
        }
        if (e.code === 'KeyF') {
            if (target?.type === 'card') enterArticle(target.card); else toast('将十字准星对准文章片段，再按 F 进入它的场域。');
        }
        if (e.code === 'KeyV') {
            if (target?.type === 'node') worldView.track(target.node); else toast('对准感兴趣的话题词，再按 V 自动追踪。');
        }
        if (e.code === 'KeyQ' && worldView.inField) worldView.exitField();
        if (e.code === 'KeyR') safe(() => openAnchors())();
        if (e.code === 'KeyT') safe(() => openAnchors(undefined, { reading: true }))();
        if (e.code === 'KeyB') openBag();
        if (e.code === 'KeyM') safe(openCanvas)();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.journey)
        cacheLocal(true); });
    window.addEventListener('beforeunload', () => { if (state.journey)
        cacheLocal(true); });
    autoSaveTimer = setInterval(() => { if (state.journey && state.dirty !== state.saved && !savePromise)
        safe(() => saveJourney())(); }, 10000);
    const trail = new URLSearchParams(location.search).get('trail');
    if (trail)
        await openPublicTrail(trail);
    // Test hooks are opt-in and local only. They expose no credentials or other users.
    if (['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('debug'))
        window.__manzhilu = window.__zhiye = { state, worldView, saveJourney, startJourney, visitNode, collectCard, enterArticle, openReader, openHome, openBag, openCanvas, openAnchors, openAnchorThread, openCompanions, openNotifications, restoreJourney };
}
boot().catch(error => { $('#fatal').hidden = false; $('#fatal').textContent = `世界暂时没有准备好。\n${error.message}\n请确认后端已经启动，然后刷新。`; $('body').classList.add('boot-error'); });
