import { SoftwareRenderer } from './renderers/software.js';
import { lookAt } from './math.js';
import { clamp } from './core.js';
import { FLIGHT_KEYS, normalizePlayer, moveFlight, distanceToNode, advanceTracking, nodeLabelPosition, positionCards, selectAimTarget, contentLabel, createArticleField } from './exploration.js';

export class WorldView {
    constructor(host, callbacks = {}) {
        this.host = host;
        this.callbacks = callbacks;
        this.canvas = host.querySelector('canvas');
        this.labelLayer = host.querySelector('.world-labels');
        this.cardLayer = document.createElement('div');
        this.cardLayer.className = 'world-cards';
        this.cardLayer.setAttribute('aria-label', '话题周围的内容片段');
        host.append(this.cardLayer);
        this.labels = new Map();
        this.content = new Map();
        this.spatialCards = [];
        this.keys = new Set();
        this.camera = lookAt([52, 37, 64], [-3, -1, -9]);
        this.player = normalizePlayer();
        this.mode = 'overview';
        this.fov = 58;
        this.paused = false;
        this.lookEnabled = false;
        this.touchInput = matchMedia('(pointer: coarse)').matches;
        this.lastLookPoint = null;
        this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.quality = 'balanced';
        this.active = null;
        this.target = null;
        this.dwell = 0;
        this.lastVisit = null;
        this.lastFrame = 0;
        this.frameSum = 0;
        this.frameCount = 0;
        this.thoughts = [];
        this._fieldState = null;
        this._tracking = null;
        this.abort = new AbortController();
    }
    get inField() { return !!this._fieldState; }
    get tracking() { return this._tracking; }
    getTarget() { return this.paused || this.mode !== 'explore' ? null : this.target; }

    async init() {
        try {
            const health = await fetch('/api/health').then(r => r.json());
            if (!health.threeAvailable) throw new Error('本地尚未安装 Three.js');
            const { ThreeRenderer } = await import('./renderers/three.js');
            this.renderer = new ThreeRenderer(this.canvas);
        }
        catch (error) {
            const replacement = document.createElement('canvas');
            replacement.id = 'world-canvas';
            replacement.setAttribute('aria-label', '漫知录三维知识世界');
            this.canvas.replaceWith(replacement);
            this.canvas = replacement;
            this.renderer = new SoftwareRenderer(this.canvas);
            this.fallbackReason = error.message;
        }
        this.callbacks.onMode?.(this.renderer.name);
        const resize = () => {
            this.layoutVersion = (this.layoutVersion || 0) + 1;
            this.renderer.resize(Math.max(1, this.host.clientWidth), Math.max(1, this.host.clientHeight), devicePixelRatio || 1);
        };
        this.observer = new ResizeObserver(resize);
        this.observer.observe(this.host);
        resize();
        this.attachControls();
        const loop = t => {
            this.raf = requestAnimationFrame(loop);
            if (document.hidden) { this.lastFrame = t; return; }
            if (this.renderer instanceof SoftwareRenderer && t - this.lastFrame < 32) return;
            const dt = Math.min((t - this.lastFrame) / 1000 || .016, .05);
            this.lastFrame = t;
            this.tick(dt, t);
        };
        this.raf = requestAnimationFrame(loop);
        return this;
    }

    setWorld(world) {
        // An in-flight main-world expansion must never eject the reader from a field.
        if (this.inField && world.id === this._fieldState.world.id) {
            this._fieldState.world = world;
            return;
        }
        if (this.inField) this.exitField();
        const sameWorld = this.world?.id === world.id;
        if (!sameWorld) {
            this.content = new Map();
            this.active = null;
            this.dwell = 0;
            this.lastVisit = null;
            this.cancelTracking();
        }
        this.mountWorld(world);
    }
    mountWorld(world) {
        this.world = world;
        this.renderer?.setWorld(world);
        this.labels.forEach(el => el.remove());
        this.labels.clear();
        this.setTarget(null);
        for (const node of world.nodes) {
            const el = document.createElement('button');
            el.className = 'world-label';
            el.type = 'button';
            el.dataset.nodeId = node.id;
            el.style.setProperty('--topic-color', node.color || '#ddc390');
            const badge = document.createElement('span');
            badge.className = 'node-category';
            badge.textContent = node.category;
            const text = document.createElement('strong');
            text.textContent = node.title;
            el.append(badge, text, document.createElement('i'));
            el.addEventListener('click', () => {
                if (this.paused) return;
                if (this.inField) this.callbacks.onRead?.(this.content.get(node.id)?.[0]);
                else this.callbacks.onOpen?.(node.id);
            });
            this.labelLayer.append(el);
            this.labels.set(node.id, el);
        }
        this.refreshCards();
    }
    setContent(nodeId, cards) {
        if (!Array.isArray(cards)) return;
        if (this.inField && this._fieldState.world.nodes.some(node => node.id === nodeId)) {
            this._fieldState.content.set(nodeId, cards);
            return;
        }
        if (!this.world?.nodes.some(node => node.id === nodeId)) return;
        this.content.set(nodeId, cards);
        this.refreshCards();
    }
    refreshCards() {
        this.cardLayer.replaceChildren();
        this.spatialCards = [];
        for (const node of this.world?.nodes || []) {
            for (const item of positionCards(node, this.content.get(node.id) || [])) {
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'world-card';
                el.dataset.cardId = item.card.id;
                el.style.width = '232px';
                el.style.setProperty('--topic-color', node.color || '#ddc390');
                for (const [name, text] of [
                    ['provenance', contentLabel(item.card)], ['title', item.card.title],
                    ['text', String(item.card.text || item.card.body || '').slice(0, 108)],
                    ['hint', this.inField ? '点击阅读片段 · E 收纳' : '点击阅读 · F 进入场域 · E 收纳'],
                ]) {
                    const part = document.createElement(name === 'title' ? 'strong' : 'span');
                    part.className = `world-card-${name}`;
                    part.textContent = text;
                    el.append(part);
                }
                el.setAttribute('aria-label', `${item.card.title}，${contentLabel(item.card)}，点击阅读`);
                el.addEventListener('click', () => { if (!this.paused) this.callbacks.onRead?.(item.card); });
                el.hidden = true;
                this.cardLayer.append(el);
                this.spatialCards.push({ ...item, el });
            }
        }
    }
    setThoughts(thoughts = []) {
        if (this.inField) { this._fieldState.thoughts = thoughts; return; }
        this.thoughts = thoughts;
        this.mountThoughts(thoughts);
    }
    mountThoughts(thoughts) {
        const host = this.host.querySelector('.world-thoughts');
        if (!host) return;
        host.replaceChildren();
        this.thoughtMarkers = thoughts.filter(t => t.position).map(thought => {
            const el = document.createElement('button');
            el.className = 'thought-marker';
            el.type = 'button';
            el.textContent = '✧';
            el.title = thought.text.slice(0, 60);
            el.setAttribute('aria-label', '查看想法锚点');
            el.addEventListener('click', () => { if (!this.paused) this.callbacks.onThought?.(thought); });
            host.append(el);
            return { thought, el };
        });
    }
    setPlayer(player) {
        this.player = normalizePlayer(player);
        this.active = null;
        this.dwell = 0;
        this.lastVisit = null;
        this.cancelTracking();
        this.setTarget(null);
    }
    enter() {
        this.mode = 'explore';
        this.host.classList.add('is-exploring');
        this.callbacks.onMode?.(this.renderer.name);
        this.resumeLook();
    }
    overview() {
        if (this.inField) this.exitField();
        this.mode = 'overview';
        this.host.classList.remove('is-exploring');
        this.cancelTracking();
        this.setTarget(null);
        this.unlock();
    }
    jump(node) {
        if (!node) return false;
        if (this.inField && !this.world.nodes.some(n => n.id === node.id)) this.exitField();
        this.setPlayer({ x: node.x, y: node.y ?? 2.6, z: node.z + 9, yaw: 0, pitch: .22 });
        this.enter();
        if (!this.inField) this.callbacks.onMove?.(this.player, true);
        return true;
    }
    track(node) {
        const chosen = typeof node === 'string' ? this.world?.nodes.find(n => n.id === node) : node;
        if (!chosen || !this.world?.nodes.some(n => n.id === chosen.id) || this.paused) return false;
        this.keys.clear();
        this._tracking = chosen;
        this.host.classList.add('is-tracking');
        this.enter();
        this.callbacks.onTracking?.(chosen);
        return true;
    }
    cancelTracking() {
        const previous = this._tracking;
        this._tracking = null;
        this.host.classList.remove('is-tracking');
        if (previous) this.callbacks.onTracking?.(null);
    }

    enterField(card, node) {
        if (this.inField || !this.world || !card) return false;
        const origin = node || this.world.nodes.find(n => n.id === card.nodeId) || this.active;
        const field = createArticleField(card, origin);
        if (!field) return false;
        this.cancelTracking();
        this.keys.clear();
        this._fieldState = {
            world: this.world, player: { ...this.player }, content: this.content, active: this.active,
            dwell: this.dwell, lastVisit: this.lastVisit, visited: this.visited, thoughts: this.thoughts,
            fov: this.fov, mode: this.mode, card, node: origin,
        };
        this.content = new Map(field.world.nodes.map((n, i) => [n.id, [field.cards[i]]]));
        this.visited = [];
        this.active = null;
        this.lastVisit = null;
        this.dwell = 0;
        this.player = normalizePlayer({ x: 0, z: 12, pitch: .08 });
        this.fov = 58;
        this.paused = false;
        this.mountWorld(field.world);
        this.mountThoughts([]);
        this.enter();
        this.host.classList.add('is-field');
        this.showFieldBanner(card, field.notice);
        this.callbacks.onFieldChange?.({ inField: true, card, node: origin });
        return true;
    }
    showFieldBanner(card, notice) {
        this.fieldBanner?.remove();
        const banner = document.createElement('div');
        banner.className = 'field-banner';
        const copy = document.createElement('div');
        copy.className = 'field-banner-copy';
        const title = document.createElement('strong');
        title.textContent = `文章场域 · ${card.title}`;
        const detail = document.createElement('small');
        detail.textContent = notice;
        copy.append(title, detail);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'field-exit';
        button.textContent = '返回主世界';
        button.addEventListener('click', () => this.exitField());
        banner.append(copy, button);
        this.host.append(banner);
        this.fieldBanner = banner;
    }
    exitField() {
        const saved = this._fieldState;
        if (!saved) return false;
        this.keys.clear();
        this.cancelTracking();
        this._fieldState = null;
        this.content = saved.content;
        this.player = { ...saved.player };
        this.active = saved.active;
        this.dwell = saved.dwell;
        this.lastVisit = saved.lastVisit;
        this.visited = saved.visited;
        this.thoughts = saved.thoughts;
        this.fov = saved.fov;
        this.mode = saved.mode;
        this.paused = false;
        this.mountWorld(saved.world);
        this.mountThoughts(saved.thoughts);
        this.host.classList.remove('is-field');
        this.host.classList.toggle('is-exploring', this.mode === 'explore');
        this.fieldBanner?.remove();
        this.fieldBanner = null;
        if (this.mode === 'explore') this.resumeLook();
        this.callbacks.onFieldChange?.({ inField: false, card: saved.card, node: saved.node });
        return true;
    }

    syncLookClass() {
        this.host.classList.toggle('is-looking', this.mode === 'explore' && !this.paused && this.lookEnabled && !this.touchInput);
    }
    resumeLook(requestLock = true) {
        if (this.mode !== 'explore' || this.paused) return;
        this.lookEnabled = true;
        this.lastLookPoint = null;
        this.syncLookClass();
        // Async world loading or an embedded browser may deny pointer lock.
        // Ordinary mouse movement remains usable without any pressed button.
        if (requestLock && !this.touchInput && navigator.userActivation?.isActive !== false) this.lock();
    }
    lock() {
        if (this.mode !== 'explore' || this.paused || !this.lookEnabled || this._lockPending || document.pointerLockElement === this.canvas || !this.canvas.requestPointerLock) return;
        this._lockPending = true;
        try {
            const promise = this.canvas.requestPointerLock();
            Promise.resolve(promise).catch(() => {}).finally(() => { this._lockPending = false; });
        }
        catch { this._lockPending = false; }
    }
    unlock() {
        this.lookEnabled = false;
        this.lastLookPoint = null;
        this.syncLookClass();
        if (document.pointerLockElement === this.canvas) {
            this._expectedUnlock = true;
            document.exitPointerLock();
        }
        this.keys.clear();
        this.dragging = false;
    }
    pause(value) {
        this.paused = !!value;
        if (value) { this.unlock(); this.cancelTracking(); this.setTarget(null); }
        else this.resumeLook();
    }
    activateTarget() {
        const target = this.getTarget();
        if (!target) return;
        if (target.type === 'card') this.callbacks.onRead?.(target.card);
        else if (this.inField) this.callbacks.onRead?.(this.content.get(target.node.id)?.[0]);
        else this.callbacks.onOpen?.(target.node.id);
    }
    attachControls() {
        const signal = this.abort.signal;
        const typing = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable;
        const clear = () => { this.unlock(); this.cancelTracking(); };
        document.addEventListener('keydown', e => {
            if (typing(e)) { this.keys.clear(); return; }
            if (['Tab', 'Escape'].includes(e.code) && this.mode === 'explore' && !this.paused && this.lookEnabled) {
                if (e.code === 'Tab') e.preventDefault();
                this.unlock(); return;
            }
            if (FLIGHT_KEYS.has(e.code) && this.mode === 'explore' && !this.paused && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.cancelTracking();
                this.keys.add(e.code);
            }
        }, { signal });
        document.addEventListener('keyup', e => this.keys.delete(e.code), { signal });
        window.addEventListener('blur', clear, { signal });
        window.addEventListener('focus', () => this.resumeLook(false), { signal });
        document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); }, { signal });
        document.addEventListener('pointerlockchange', () => {
            const locked = document.pointerLockElement === this.canvas;
            if (locked && (!this.lookEnabled || this.paused || this.mode !== 'explore')) {
                this._expectedUnlock = true;
                document.exitPointerLock();
            }
            if (!locked) {
                this.keys.clear(); this.dragging = false;
                if (this._wasLocked && !this._expectedUnlock) this.lookEnabled = false;
                this._expectedUnlock = false;
            }
            this._wasLocked = locked;
            this.lastLookPoint = null;
            this.host.classList.toggle('is-locked', locked);
            this.syncLookClass();
        }, { signal });
        // Projected cards and labels are DOM overlays inside the same world. Their
        // bubbling wheel events must zoom exactly like the underlying canvas.
        this.host.addEventListener('wheel', e => {
            if (this.mode !== 'explore' || this.paused || e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            this.fov = clamp(this.fov + Math.sign(e.deltaY) * 3, 32, 86);
        }, { signal, passive: false });
        this.canvas.addEventListener('click', () => {
            if (this.paused || this.dragDistance > 6) return;
            if (this.lookEnabled) { if (!this.touchInput) this.lock(); this.activateTarget(); }
            else this.resumeLook();
        }, { signal });
        this.canvas.addEventListener('pointerdown', e => {
            if (e.button !== 0 || this.mode !== 'explore' || this.paused) return;
            this.touchInput = e.pointerType === 'touch' || e.pointerType === 'pen';
            this.lastLookPoint = null;
            this.syncLookClass();
            this.dragging = this.touchInput;
            this.dragDistance = 0;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            if (this.dragging) this.canvas.setPointerCapture?.(e.pointerId);
        }, { signal });
        window.addEventListener('pointerup', () => { this.dragging = false; }, { signal });
        this.canvas.addEventListener('pointercancel', () => { this.dragging = false; }, { signal });
        document.addEventListener('pointermove', e => {
            if (this.mode !== 'explore' || this.paused) return;
            const locked = document.pointerLockElement === this.canvas;
            const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
            let dx, dy;
            if (touch) {
                if (!this.dragging) return;
                dx = e.clientX - this.lastX; dy = e.clientY - this.lastY;
                this.lastX = e.clientX; this.lastY = e.clientY;
                this.dragDistance += Math.abs(dx) + Math.abs(dy);
            } else {
                if (this.touchInput) { this.touchInput = false; this.syncLookClass(); }
                const surface = e.target === this.canvas || e.target === this.host || this.cardLayer?.contains(e.target) || this.labelLayer?.contains(e.target);
                if (!this.lookEnabled || (!locked && !surface)) { this.lastLookPoint = null; return; }
                const previous = this.lastLookPoint;
                this.lastLookPoint = { x: e.clientX, y: e.clientY };
                if (!locked && !previous) return;
                dx = locked ? e.movementX : e.clientX - previous.x;
                dy = locked ? e.movementY : e.clientY - previous.y;
            }
            this.player.yaw -= dx * .002;
            this.player.pitch = clamp(this.player.pitch - dy * .002, -1.4, 1.4);
        }, { signal });
        this.host.querySelectorAll('[data-move]').forEach(el => {
            const code = el.dataset.move;
            el.addEventListener('pointerdown', e => {
                if (this.paused || this.mode !== 'explore') return;
                e.preventDefault();
                el.setPointerCapture(e.pointerId);
                this.cancelTracking();
                this.keys.add(code);
            }, { signal });
            for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(event, () => this.keys.delete(code), { signal });
        });
    }

    tick(dt, time) {
        if (!this.world || !this.renderer) return;
        if (this.mode === 'explore') {
            if (!this.paused) {
                const before = this.player;
                if (this._tracking) {
                    const step = advanceTracking(this.player, this._tracking, dt);
                    this.player = step.player;
                    if (step.arrived) this.cancelTracking();
                }
                else if (this.keys.size) this.player = moveFlight(this.player, this.keys, dt);
                const p = this.player;
                if (!this.inField && (p.x !== before.x || p.y !== before.y || p.z !== before.z)) this.callbacks.onMove?.(p, false);
            }
            this.camera = { ...this.player };
            const nearest = this.world.nodes.reduce((best, node) => {
                const distance = distanceToNode(this.player, node);
                return !best || distance < best.distance ? { node, distance } : best;
            }, null);
            if (nearest && nearest.distance < 16) {
                if (this.active?.id !== nearest.node.id) { this.active = nearest.node; this.dwell = 0; }
                if (!this.paused) this.dwell += dt;
                if (this.dwell > .65 && this.lastVisit !== nearest.node.id && !this.paused) {
                    this.lastVisit = nearest.node.id;
                    if (!this.inField) this.callbacks.onVisit?.(nearest.node.id);
                }
            }
            else if (!nearest || nearest.distance > 22) { this.active = null; this.dwell = 0; this.lastVisit = null; }
        }
        else {
            const sway = this.reduced ? 0 : Math.sin(time * .000045) * 3;
            this.camera = lookAt([52 + sway, 37, 64], [-3, -1, -9]);
        }
        const before = performance.now();
        this.renderer.render(this.camera, time, { reduced: this.reduced, quality: this.quality, fov: this.mode === 'explore' ? this.fov : 58 });
        this.updateLabels();
        this.frameSum += performance.now() - before;
        if (++this.frameCount === 100) {
            const ms = this.frameSum / 100;
            this.frameSum = 0;
            this.frameCount = 0;
            if (ms > 26 && this.quality !== 'low') {
                this.quality = 'low';
                this.renderer.quality = 'low';
                this.renderer.resize(this.host.clientWidth, this.host.clientHeight, 1);
                this.callbacks.onQuality?.('已自动降低像素密度，优先保持交互。');
            }
        }
    }
    setTarget(target) {
        const key = target ? target.type === 'card' ? `card:${target.nodeId}:${target.card.id}` : `node:${target.node.id}` : '';
        this.target = target;
        this.host.classList.toggle('has-target', !!target);
        if (key !== this.targetKey) { this.targetKey = key; this.callbacks.onTarget?.(target); }
    }
    updateLabels() {
        const w = this.host.clientWidth, h = this.host.clientHeight;
        const aimed = [];
        for (const { thought, el } of this.thoughtMarkers || []) {
            const p = this.renderer.project([thought.position.x, thought.position.y ?? 1.6, thought.position.z]);
            el.hidden = this.mode !== 'explore' || p.depth < 2 || p.depth > 85 || p.x < 0 || p.x > w || p.y < 0 || p.y > h;
            el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
        }
        const candidates = [];
        for (const node of this.world.nodes) {
            const p = this.renderer.project(nodeLabelPosition(node));
            if ((this.mode === 'overview' && (w < 800 || p.x < w * .43)) || p.depth < 1.5 || p.depth > 205 || p.x < 30 || p.x > w - 30 || p.y < 80 || p.y > h - 90) continue;
            candidates.push({ node, projection: p });
        }
        candidates.sort((a, b) => a.projection.depth - b.projection.depth);
        const placed = [];
        for (const el of this.labels.values()) el.hidden = true;
        for (const { node, projection: p } of candidates) {
            const width = Math.max(100, Math.min(330, node.title.length * 22 + 32));
            if (placed.some(r => Math.abs(p.x - r.x) < (width + r.width) / 2 + 16 && Math.abs(p.y - r.y) < 70)) continue;
            const el = this.labels.get(node.id);
            el.hidden = false;
            el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
            el.style.opacity = this.mode === 'overview' ? '.94' : String(clamp(1 - (p.depth - 55) / 210, .45, 1));
            el.classList.toggle('near', this.active?.id === node.id);
            el.classList.toggle('visited', this.visited?.includes(node.id));
            placed.push({ x: p.x, y: p.y, width });
            if (el._worldBox?.version !== this.layoutVersion) el._worldBox = { version: this.layoutVersion, width: el.offsetWidth || width, height: el.offsetHeight || 60 };
            aimed.push({ target: { type: 'node', node }, projection: p, width: Math.min(width, el._worldBox.width), height: el._worldBox.height });
            if (placed.length >= 12) break;
        }
        const cardCandidates = [];
        for (const item of this.spatialCards) {
            item.el.hidden = true;
            if (this.mode !== 'explore') continue;
            const node = this.world.nodes.find(n => n.id === item.nodeId);
            if (!node || distanceToNode(this.player, node) > 29) continue;
            const p = this.renderer.project(item.position);
            if (p.depth < 2 || p.depth > 48 || p.x < -90 || p.x > w + 90 || p.y < 80 || p.y > h - 85) continue;
            cardCandidates.push({ item, projection: p });
        }
        cardCandidates.sort((a, b) => a.projection.depth - b.projection.depth);
        const cardPlaced = [];
        for (const { item, projection: p } of cardCandidates) {
            const scale = clamp(13 / p.depth, .48, 1.05), width = 232 * scale, height = 180 * scale;
            // Only visible cards can be targeted. Avoid unreadable piles at the horizon.
            if (cardPlaced.some(r => Math.abs(p.x - r.x) < (width + r.width) / 2 + 8 && Math.abs(p.y - r.y) < (height + r.height) / 2 + 8)) continue;
            item.el.hidden = false;
            item.el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${scale})`;
            item.el.style.opacity = String(clamp(1 - (p.depth - 20) / 55, .55, 1));
            item.el.style.zIndex = String(100 - Math.round(p.depth));
            cardPlaced.push({ x: p.x, y: p.y, width, height });
            if (item.el._worldBox?.version !== this.layoutVersion) item.el._worldBox = { version: this.layoutVersion, height: item.el.offsetHeight || 180 };
            aimed.push({ target: { type: 'card', card: item.card, nodeId: item.nodeId }, projection: p, width, height: item.el._worldBox.height * scale });
            if (cardPlaced.length >= 8) break;
        }
        this.setTarget(this.mode === 'explore' && !this.paused ? selectAimTarget(aimed, w, h) : null);
        for (const [id, el] of this.labels) el.classList.toggle('is-targeted', this.target?.type === 'node' && this.target.node.id === id);
        for (const item of this.spatialCards) item.el.classList.toggle('is-targeted', this.target?.type === 'card' && this.target.card.id === item.card.id);
    }
    dispose() {
        cancelAnimationFrame(this.raf);
        this.observer?.disconnect();
        this.abort.abort();
        this.unlock();
        this.renderer?.dispose();
        this.cardLayer.remove();
        this.fieldBanner?.remove();
    }
}
