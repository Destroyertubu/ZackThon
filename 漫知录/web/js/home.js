import { el, icon, button, sourcePill } from './ui.js';

const list = value => Array.isArray(value) ? value : [];
const timestamp = value => {
    if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
    const result = Date.parse(value || '');
    return Number.isFinite(result) ? result : 0;
};
const recentFirst = (a, b) => timestamp(b.updatedAt || b.collectedAt || b.createdAt || b.updated) - timestamp(a.updatedAt || a.collectedAt || a.createdAt || a.updated);
const uniqueById = values => [...new Map(values.map(value => [value.id, value])).values()];
const count = value => Array.isArray(value) ? value.length : Number(value) || 0;

/** Merge saved home contents with the current, possibly unsaved journey. Never mutate either input. */
export function deriveHomeData(homeData = {}, journey = null, world = null) {
    homeData ||= {};
    const nodes = new Map(list(world?.nodes).map(node => [node.id, node]));
    const currentId = journey?.id;
    const itemsById = new Map();
    const mergeItem = item => {
        if (!item?.id) return;
        const previous = itemsById.get(item.id);
        const origins = [...(previous?.origins || []), ...(item.origins || [])];
        itemsById.set(item.id, {
            ...previous, ...item,
            origins: [...new Map(origins.map(origin => [origin.journeyId, origin])).values()],
        });
    };
    for (const group of list(homeData.groups)) {
        for (const card of list(group.items)) {
            const origins = (list(card.origins).length ? card.origins : [{ journeyId: card.journeyId, journeyTitle: card.journeyTitle, topic: card.topic || group.topic }])
                .filter(origin => !currentId || origin.journeyId !== currentId);
            if (!origins.length) continue;
            const origin = origins[0];
            mergeItem({ ...card, journeyId: origin.journeyId, journeyTitle: origin.journeyTitle, topic: card.kind === 'derived' ? '我的洞察' : origin.topic || card.topic || group.topic || '沿途拾光', color: group.color, origins });
        }
    }
    for (const card of list(journey?.bag)) {
        const topic = card.kind === 'derived' ? '我的洞察' : card.topic || nodes.get(card.nodeId)?.title || '沿途拾光';
        mergeItem({ ...card, topic, color: nodes.get(card.nodeId)?.color, journeyId: currentId, journeyTitle: journey.title || world?.seed || '未命名旅程', origins: [{ journeyId: currentId, journeyTitle: journey.title || world?.seed || '未命名旅程', topic }] });
    }
    const items = [...itemsById.values()].sort(recentFirst);
    const groupsByTopic = new Map();
    for (const item of items) {
        if (!groupsByTopic.has(item.topic)) groupsByTopic.set(item.topic, { topic: item.topic, color: item.color, items: [] });
        groupsByTopic.get(item.topic).items.push(item);
    }
    const groups = [...groupsByTopic.values()].map(group => ({ ...group, count: group.items.length })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, 'zh-CN'));
    const replaceCurrent = values => list(values).filter(value => !currentId || value.journeyId !== currentId);
    const thoughts = uniqueById([
        ...replaceCurrent(homeData.thoughts),
        ...list(journey?.thoughts).map(thought => ({ ...thought, journeyId: currentId, journeyTitle: journey.title, topic: nodes.get(thought.nodeId)?.title || thought.topic || '沿途' })),
    ]).sort(recentFirst);
    const bridges = uniqueById([
        ...replaceCurrent(homeData.bridges),
        ...list(journey?.bridges).map(bridge => ({ ...bridge, journeyId: currentId, journeyTitle: journey.title })),
    ]).sort(recentFirst);
    const journals = list(homeData.journals).filter(entry => entry.id !== currentId).map(entry => ({ ...entry, isCurrent: false }));
    if (journey) journals.push({ id: currentId, title: journey.title || world?.seed || '未命名旅程', seed: world?.seed, updated: journey.updatedAt, startedAt: journey.startedAt, visited: new Set(list(journey.visited)).size, items: count(journey.bag), thoughts: count(journey.thoughts), bridges: count(journey.bridges), isCurrent: true });
    journals.sort(recentFirst);
    return { items, groups, journals, thoughts, bridges, stats: { journeys: journals.length, items: items.length, topics: groups.length, thoughts: thoughts.length, bridges: bridges.length } };
}

export function filterHomeItems(items, { topic = '', query = '' } = {}) {
    const words = query.trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean);
    return items.filter(item => {
        if (topic && item.topic !== topic) return false;
        const haystack = [item.title, item.text, item.body, item.author, item.personalNote, item.topic, item.journeyTitle, ...list(item.origins).map(origin => origin.journeyTitle)].join(' ').toLocaleLowerCase('zh-CN');
        return words.every(word => haystack.includes(word));
    });
}

/** A dated journal includes journeys, private/public thoughts and completed synthesis. */
export function buildHomeLog(model, kind = 'all') {
    const derived = model.items.filter(item => item.kind === 'derived');
    const derivedIds = new Set(derived.map(item => item.id));
    const entries = [
        ...model.journals.map(journal => ({ ...journal, key: `journey:${journal.id}`, kind: 'journey', at: journal.updated || journal.updatedAt || journal.startedAt, journeyId: journal.id })),
        ...model.thoughts.map(thought => ({ ...thought, key: `thought:${thought.id}`, kind: 'thought', at: thought.createdAt, title: thought.topic || '沿途的想法' })),
        ...derived.map(item => ({ ...item, key: `insight:${item.id}`, kind: 'insight', at: item.createdAt || item.collectedAt, card: item })),
        ...model.bridges.filter(bridge => !derivedIds.has(bridge.targetId)).map(bridge => ({ ...bridge, key: `bridge:${bridge.id}`, kind: 'insight', at: bridge.createdAt, title: '两束收获之间的新联系', text: bridge.note })),
    ];
    return entries.filter(entry => kind === 'all' || entry.kind === kind).sort((a, b) => timestamp(b.at) - timestamp(a.at) || a.key.localeCompare(b.key));
}

function displayTime(value) {
    const time = timestamp(value);
    return time ? new Date(time).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '时间未记录';
}

function landscape() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 900 310');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('home-landscape');
    const shapes = [
        ['circle', { cx: '654', cy: '68', r: '25', fill: '#ddcaa0', opacity: '.66' }],
        ['path', { d: 'M0 174 77 119 157 158 272 57 364 146 419 111 544 207 645 103 746 139 821 90 900 162V310H0Z', fill: '#82a395', opacity: '.28' }],
        ['path', { d: 'M0 213 108 171 188 190 312 130 421 215 511 188 626 235 743 150 829 178 900 154V310H0Z', fill: '#426f68', opacity: '.43' }],
        ['path', { d: 'M0 252Q150 203 305 254T632 252T900 239V310H0Z', fill: '#244c4d', opacity: '.58' }],
        ['path', { d: 'M121 284Q270 259 378 283T734 277M263 302Q414 280 601 299', fill: 'none', stroke: '#cbd4ba', 'stroke-width': '1', opacity: '.25' }],
    ];
    for (const [tag, attributes] of shapes) {
        const node = document.createElementNS(svg.namespaceURI, tag);
        for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
        svg.append(node);
    }
    return svg;
}

/** Render inside openSheet('home', ...). All application transitions belong to the supplied callbacks. */
export function renderHome(body, { homeData = null, journey = null, world = null, onSynthesis, onCompanions, onRead, onRestore, onExplore, onCanvas } = {}) {
    const model = deriveHomeData(homeData, journey, world);
    const selection = new Set();
    let activeView = 'cabinet', topic = '', query = '', logKind = 'all';
    const status = el('p', { class: 'home-feedback', role: 'status', 'aria-live': 'polite' });
    const run = callback => async () => {
        try {
            if (!callback) { status.textContent = '先开启一次漫游，再把沿途收获带回家。'; return; }
            await callback();
        } catch (error) { status.textContent = error?.message || '暂时没有完成，请再试一次。'; }
    };
    const root = el('div', { class: 'home-root' });
    body.replaceChildren(root);
    const facilityButtons = new Map();
    const workArea = el('section', { class: 'home-workspace', 'aria-label': '家园中的收获与记录' });
    const tabs = el('div', { class: 'home-tabs', role: 'tablist', 'aria-label': '家园工作区' });
    const pane = el('div', { class: 'home-pane', id: 'home-work-pane', role: 'tabpanel', tabIndex: 0 });
    const tabButtons = new Map();
    function showView(view, focus = false) {
        activeView = view;
        for (const [id, tab] of tabButtons) { tab.setAttribute('aria-selected', String(id === view)); tab.tabIndex = id === view ? 0 : -1; }
        for (const [id, facility] of facilityButtons) if (id === 'cabinet' || id === 'journal') facility.setAttribute('aria-pressed', String(id === view));
        pane.setAttribute('aria-labelledby', `home-tab-${view}`);
        if (view === 'cabinet') renderCabinet(); else renderJournal();
        if (focus) { pane.focus({ preventScroll: true }); workArea.scrollIntoView({ behavior: 'auto', block: 'nearest' }); }
    }
    const court = el('section', { class: 'home-courtyard', 'aria-label': '精神家园，选择一处设施' }, landscape());
    court.append(el('div', { class: 'home-court-caption' }, el('span', {}, '收好来路，再见远方'), el('p', {}, '此心安处，便是家园。')));
    const facilities = [
        { id: 'synthesis', title: '思维合成台', subtitle: '让不同的收获相遇', glyph: 'link', action: run(onSynthesis ? () => onSynthesis() : null) },
        { id: 'companions', title: '同频电话亭', subtitle: '从走过的路，遇见同路人', glyph: 'people', action: run(onCompanions) },
        { id: 'journal', title: '漫行者日志', subtitle: `${model.stats.journeys} 段旅程 · 每一步都算数`, glyph: 'book', action: () => showView('journal', true) },
        { id: 'cabinet', title: '想法收纳柜', subtitle: `${model.stats.items} 件收获 · 按话题安放`, glyph: 'archive', action: () => showView('cabinet', true) },
    ];
    for (const facility of facilities) {
        const node = el('button', { class: `home-facility home-facility-${facility.id}`, type: 'button', onclick: facility.action },
            el('span', { class: 'home-facility-object', 'aria-hidden': 'true' }, icon(facility.glyph)),
            el('span', { class: 'home-facility-label' }, el('strong', {}, facility.title), el('small', {}, facility.subtitle)),
            el('span', { class: 'home-facility-arrow', 'aria-hidden': 'true' }, icon('arrow')));
        if (facility.id === 'cabinet' || facility.id === 'journal') node.setAttribute('aria-controls', 'home-work-pane');
        facilityButtons.set(facility.id, node);
        court.append(node);
    }
    root.append(court);
    root.append(el('div', { class: 'home-arrival' },
        el('p', {}, journey ? `从「${journey.title || world?.seed || '这段旅程'}」归来` : model.journals.length ? '过去的收获已安放好，新的旅程随时可以开始。' : '先把一个问题交给世界，再把发现带回这里。'),
        button(journey ? '继续漫游' : model.journals.length ? '开启新的漫游' : '开启第一段漫游', run(onExplore), { style: 'secondary', glyph: 'compass' })));
    if (homeData === null && journey) root.append(el('p', { class: 'home-local-note' }, '正在展示当前旅程的收获。已保存的其他旅程会在连接恢复后归入家园。'));
    for (const [view, title, glyph] of [['cabinet', '想法收纳柜', 'archive'], ['journal', '漫行者日志', 'book']]) {
        const tab = el('button', { type: 'button', role: 'tab', id: `home-tab-${view}`, 'aria-controls': 'home-work-pane', onclick: () => showView(view) }, icon(glyph), title);
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'cabinet' : event.key === 'End' ? 'journal' : activeView === 'cabinet' ? 'journal' : 'cabinet';
            showView(next); tabButtons.get(next).focus();
        });
        tabButtons.set(view, tab); tabs.append(tab);
    }
    workArea.append(tabs, pane);
    root.append(workArea, el('footer', { class: 'home-footnote' }, icon('people'), el('p', {}, '同频电话亭依据你主动公开的路线寻找同路人。行囊、私人想法与家园记录只留给自己。')), status);

    function empty(title, description, action = null) {
        return el('div', { class: 'home-empty' }, icon('spark'), el('h3', {}, title), el('p', {}, description), action);
    }
    function renderCabinet() {
        pane.replaceChildren();
        const head = el('div', { class: 'home-section-heading' }, el('div', {}, el('h3', {}, '把一路拾得的光，安放在这里'), el('p', {}, `${model.stats.topics} 个话题 · ${model.stats.items} 件收获，汇集你保存的旅程与此刻的行囊`)));
        pane.append(head);
        if (!model.items.length) {
            pane.append(empty('柜子已经备好，等你带回第一束光', '在世界中对准喜欢的文章片段，按 E 收入行囊。回家后，它会按话题安放；收集两件以上，还能在合成台写下新的联系。', button('去世界里拾光', run(onExplore), { glyph: 'compass' })));
            return;
        }
        const topicInput = el('select', { class: 'select', id: 'home-topic' }, el('option', { value: '' }, '所有话题'), ...model.groups.map(group => el('option', { value: group.topic }, `${group.topic} · ${group.count}`)));
        topicInput.value = topic;
        const search = el('input', { class: 'input', id: 'home-search', type: 'search', value: query, placeholder: '找一句话、一个作者、一段想法…', maxLength: 200 });
        const results = el('div', { class: 'home-shelf-results' });
        const amount = el('p', { class: 'home-result-count', role: 'status', 'aria-live': 'polite' });
        const selectedLine = el('div', { class: 'home-selection' });
        const filterBar = el('div', { class: 'home-filterbar' }, el('div', {}, el('label', { htmlFor: 'home-topic' }, '按话题取阅'), topicInput), el('div', {}, el('label', { htmlFor: 'home-search' }, '在收获中寻找'), search));
        pane.append(filterBar, amount, selectedLine, results);
        function renderSelection() {
            const selectedItems = model.items.filter(item => selection.has(item.id));
            selectedLine.replaceChildren(el('p', {}, selection.size ? `已选 ${selection.size} 件收获，可跨旅程组合` : '选择 2–4 件收获，带到合成台写下联系。'), button(selection.size ? `带 ${selection.size} 件去合成台` : '去思维合成台', run(onSynthesis ? () => onSynthesis(selectedItems.length ? selectedItems : undefined) : null), { glyph: 'link', style: selection.size ? 'primary' : 'ghost' }));
            if (selection.size) selectedLine.append(button('清空选择', () => { selection.clear(); renderItems(); }, { style: 'ghost' }));
        }
        function renderItems() {
            const visible = filterHomeItems(model.items, { topic, query });
            amount.textContent = `找到 ${visible.length} 件收获${selection.size ? ` · 已选 ${selection.size} 件` : ''}`;
            renderSelection();
            results.replaceChildren();
            if (!visible.length) { results.append(empty('这里还没有找到这束光', '换个话题或关键词试试，也可以展开所有收获。', button('查看全部收获', () => { topic = ''; query = ''; renderCabinet(); }, { style: 'secondary' }))); return; }
            const shelf = el('div', { class: 'home-shelf' });
            for (const item of visible) {
                const selected = selection.has(item.id);
                const select = el('button', { type: 'button', class: `home-select-item${selected ? ' selected' : ''}`, 'aria-label': `${selected ? '取消选择' : '选作组合'}：${item.title}`, 'aria-pressed': String(selected), onclick: () => {
                    if (selection.has(item.id)) selection.delete(item.id);
                    else if (selection.size < 4) selection.add(item.id);
                    else { status.textContent = '一次最多组合 4 件收获。先取消一件，再加入新的。'; return; }
                    status.textContent = '';
                    renderItems();
                    for (const candidate of results.querySelectorAll('[data-home-select]')) if (candidate.dataset.homeSelect === item.id) candidate.focus({ preventScroll: true });
                }, dataset: { homeSelect: item.id } }, icon(selected ? 'check' : 'plus'));
                const article = el('article', { class: `home-keepsake${selected ? ' selected' : ''}` },
                    el('div', { class: 'home-keepsake-top' }, el('span', { class: 'home-topic-label' }, item.topic), select),
                    el('h4', {}, item.title || '沿途片段'),
                    el('p', { class: 'home-keepsake-text' }, item.text || item.body || '展开阅读这件收获。'),
                    el('div', { class: 'home-keepsake-origin' }, sourcePill(item), el('span', {}, item.author || '沿途拾光')),
                    el('p', { class: 'home-keepsake-journey' }, item.origins.length > 1 ? `在 ${item.origins.length} 段旅程中遇见` : `来自「${item.journeyTitle || '保存的旅程'}」`),
                    el('div', { class: 'home-keepsake-actions' }, button('展开阅读', run(onRead ? () => onRead(item) : null), { style: 'ghost', glyph: 'book' }), el('button', { class: 'text-button', type: 'button', onclick: run(onSynthesis ? () => onSynthesis([item]) : null) }, '放上合成台', icon('arrow'))));
                shelf.append(article);
            }
            results.append(shelf);
        }
        topicInput.addEventListener('change', () => { topic = topicInput.value; renderItems(); });
        search.addEventListener('input', () => { query = search.value; renderItems(); });
        renderItems();
    }

    function renderJournal() {
        pane.replaceChildren(el('div', { class: 'home-section-heading' }, el('div', {}, el('h3', {}, '你走过的路，也在慢慢写成你'), el('p', {}, `${model.stats.journeys} 段旅程 · ${model.stats.thoughts} 个想法 · ${model.stats.bridges} 次连接`)), button('看我的个人画布', run(onCanvas), { style: 'ghost', glyph: 'route' })));
        const filters = el('div', { class: 'home-log-filters', role: 'group', 'aria-label': '日志类型' });
        for (const [kind, title] of [['all', '全部记录'], ['journey', '旅程'], ['thought', '想法锚点'], ['insight', '新洞察']]) filters.append(el('button', { type: 'button', class: logKind === kind ? 'active' : '', 'aria-pressed': String(logKind === kind), onclick: () => { logKind = kind; renderJournal(); pane.querySelector(`[data-log-kind="${kind}"]`)?.focus({ preventScroll: true }); }, dataset: { logKind: kind } }, title));
        pane.append(filters);
        const entries = buildHomeLog(model, logKind);
        if (!entries.length) { pane.append(empty('下一页，留给下一次发现', logKind === 'thought' ? '在世界里按 R，记录你的疑问、赞叹或此刻的理解。' : logKind === 'insight' ? '从收纳柜中选出两件收获，在合成台写下它们之间的联系。' : '从一个问题出发，旅程和沿途的想法会留在这里。', button(logKind === 'insight' ? '去收纳柜挑选' : '继续探索世界', logKind === 'insight' ? () => showView('cabinet', true) : run(onExplore), { glyph: logKind === 'insight' ? 'archive' : 'compass' }))); return; }
        const timeline = el('ol', { class: 'home-journal' });
        for (const entry of entries) {
            const glyph = { journey: 'compass', thought: 'pin', insight: 'link' }[entry.kind];
            const label = { journey: entry.isCurrent ? '当前旅程' : '已保存的旅程', thought: '想法锚点', insight: '新洞察' }[entry.kind];
            const article = el('article', { class: 'home-log-entry' }, el('div', { class: 'home-log-meta' }, el('span', {}, label), el('time', timestamp(entry.at) ? { dateTime: new Date(timestamp(entry.at)).toISOString() } : {}, displayTime(entry.at))), el('h4', {}, entry.title));
            if (entry.kind === 'journey') {
                article.append(el('p', { class: 'home-log-counts' }, `${count(entry.visited)} 个话题 · ${count(entry.items)} 件收获 · ${count(entry.thoughts)} 个想法`));
                article.append(button(entry.isCurrent ? '继续这段漫游' : '回到这段旅程', entry.isCurrent ? run(onExplore) : run(onRestore ? () => onRestore(entry.journeyId) : null), { style: 'secondary', glyph: 'compass' }));
            } else {
                article.append(el('p', { class: 'home-log-text' }, entry.text || entry.body || entry.note || '一段被保存的思考。'));
                article.append(el('p', { class: 'home-log-origin' }, `来自「${entry.journeyTitle || '保存的旅程'}」${entry.kind === 'thought' ? entry.visibility === 'public' ? ' · 已选择公开' : ' · 仅自己可见' : ''}`));
                if (entry.card) article.append(button('展开这份洞察', run(onRead ? () => onRead(entry.card) : null), { style: 'ghost', glyph: 'book' }));
            }
            timeline.append(el('li', {}, el('span', { class: 'home-log-marker', 'aria-hidden': 'true' }, icon(glyph)), article));
        }
        pane.append(timeline);
    }
    showView('cabinet');
    return { model, showView };
}
