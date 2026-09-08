export const ICONS = {
    home: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
    bell: 'M6 8a6 6 0 0 1 12 0v7l3 3H3l3-3V8Zm4 13h4',
    compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm4 5-2.5 5.5L8 16l2.5-5.5L16 8Z',
    route: 'M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7 7h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8',
    bag: 'M7 8V6a5 5 0 0 1 10 0v2M5 8h14l1 13H4L5 8Zm3 5h8v5H8v-5Z',
    people: 'M9 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-6 16v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5',
    archive: 'M4 4h16v5H4V4Zm1 5v12h14V9M9 13h6',
    save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h9V3M7 21v-8h10v8',
    spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    close: 'm6 6 12 12M6 18 18 6',
    plus: 'M12 4v16M4 12h16',
    pin: 'M12 22s7-8.5 7-14A7 7 0 0 0 5 8c0 5.5 7 14 7 14Zm0-17a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    link: 'm10 14 4-4M8 16l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2',
    external: 'M14 3h7v7m-9 2 9-9M10 4H4v16h16v-6',
    check: 'm4 12 5 5L20 6',
    volume: 'm3 9 5 0 5-5v16l-5-5H3V9Zm14-3a9 9 0 0 1 0 12m-1-9a5 5 0 0 1 0 6',
    help: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-3 6a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.01',
    settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
    expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    book: 'M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2V4Zm9 2v15',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
    cloud: 'M7 19a5 5 0 0 1-1-10 6 6 0 0 1 12-1 5.5 5.5 0 0 1 0 11H7Z',
    flag: 'M5 22V3c5-3 9 3 14 0v10c-5 3-9-3-14 0',
};
export function icon(name) { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.5'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('icon'); const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', ICONS[name] || ICONS.spark); svg.append(p); return svg; }
export function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.replaceChildren(icon(el.dataset.icon)); }); }
export function el(tag, attrs = {}, ...children) { const node = document.createElement(tag); for (const [key, value] of Object.entries(attrs)) {
    if (value == null)
        continue;
    if (key === 'class')
        node.className = value;
    else if (key === 'text')
        node.textContent = value;
    else if (key.startsWith('on'))
        node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset')
        Object.assign(node.dataset, value);
    else if (key in node && !key.startsWith('aria'))
        node[key] = value;
    else
        node.setAttribute(key, String(value));
} for (const c of children.flat(Infinity)) {
    if (c == null || c === false)
        continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
} return node; }
export function button(text, action, { style = 'primary', glyph, disabled = false, title } = {}) { return el('button', { class: `button ${style}`, type: 'button', onclick: action, disabled, title }, glyph ? icon(glyph) : null, el('span', {}, text)); }
export function sourcePill(card) { return el('span', { class: 'source-pill ' + (card.source === 'demo' ? 'demo' : card.source === 'personal' ? 'personal' : '') }, card.source === 'demo' ? '原创演示' : card.kind === 'derived' ? '我的组合' : '知乎 · 搜索摘要'); }
export function emptyState(title, text, glyph = 'spark') { return el('div', { class: 'empty-state' }, icon(glyph), el('h3', {}, title), el('p', {}, text)); }
let toastTimer;
export function toast(text, error = false) { const node = document.getElementById('toast'); node.textContent = text; node.className = error ? 'visible error' : 'visible'; clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('visible'), 4200); }
export function formatTime(iso) { return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
export function safeUrl(value) { try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 'zhihu.com' || u.hostname.endsWith('.zhihu.com')) ? u.href : null;
}
catch {
    return null;
} }
export class Soundscape {
    async toggle() { if (this.context) {
        this.context.close();
        this.context = null;
        return false;
    } const C = window.AudioContext || window.webkitAudioContext; if (!C)
        throw new Error('这个浏览器不支持环境声音。'); this.context = new C(); const master = this.context.createGain(); master.gain.value = 0; master.connect(this.context.destination); master.gain.linearRampToValueAtTime(.035, this.context.currentTime + 3); for (const [i, f] of [98, 146.83, 196, 293.66].entries()) {
        const osc = this.context.createOscillator(), gain = this.context.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.value = .12 / (i + 1);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
    } await this.context.resume(); return true; }
}
