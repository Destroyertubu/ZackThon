import { SoftwareRenderer } from './renderers/software.js';
import { lookAt } from './math.js';
import { clamp, walkable, nearestNode, appendTrace, distance } from './core.js';
export class WorldView {
    constructor(host, { onVisit, onMove, onOpen, onMode, onQuality } = {}) {
        this.host = host;
        this.callbacks = { onVisit, onMove, onOpen, onMode, onQuality };
        this.canvas = host.querySelector('canvas');
        this.labelLayer = host.querySelector('.world-labels');
        this.labels = new Map();
        this.keys = new Set();
        this.camera = lookAt([52, 37, 64], [-3, -1, -9]);
        this.player = { x: 0, z: 8, yaw: 0, pitch: 0 };
        this.mode = 'overview';
        this.paused = false;
        this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.quality = 'balanced';
        this.active = null;
        this.dwell = 0;
        this.lastVisit = null;
        this.lastFrame = 0;
        this.frameSum = 0;
        this.frameCount = 0;
        this.abort = new AbortController();
    }
    async init() {
        try {
            const health = await fetch('/api/health').then(r => r.json());
            if (!health.threeAvailable)
                throw new Error('本地尚未安装 Three.js');
            const { ThreeRenderer } = await import('./renderers/three.js');
            this.renderer = new ThreeRenderer(this.canvas);
        }
        catch (error) {
            const replacement = document.createElement('canvas');
            replacement.id = 'world-canvas';
            replacement.setAttribute('aria-label', '知野三维知识世界');
            this.canvas.replaceWith(replacement);
            this.canvas = replacement;
            this.renderer = new SoftwareRenderer(this.canvas);
            this.fallbackReason = error.message;
        }
        this.callbacks.onMode?.(this.renderer.name);
        const resize = () => this.renderer.resize(this.host.clientWidth, this.host.clientHeight, devicePixelRatio || 1);
        this.observer = new ResizeObserver(resize);
        this.observer.observe(this.host);
        resize();
        this.attachControls();
        const loop = t => { this.raf = requestAnimationFrame(loop); if (document.hidden)
            return; if (this.renderer instanceof SoftwareRenderer && t - this.lastFrame < 32)
            return; const dt = Math.min((t - this.lastFrame) / 1000 || .016, .05); this.lastFrame = t; this.tick(dt, t); };
        this.raf = requestAnimationFrame(loop);
        return this;
    }
    setWorld(world) { this.world = world; this.renderer.setWorld(world); this.labels.forEach(el => el.remove()); this.labels.clear(); for (const node of world.nodes) {
        const el = document.createElement('button');
        el.className = 'world-label';
        el.type = 'button';
        el.dataset.nodeId = node.id;
        el.style.setProperty('--topic-color', node.color);
        const badge = document.createElement('span');
        badge.className = 'node-category';
        badge.textContent = node.category;
        const text = document.createElement('strong');
        text.textContent = node.title;
        const dot = document.createElement('i');
        el.append(badge, text, dot);
        el.addEventListener('click', () => this.callbacks.onOpen?.(node.id));
        this.labelLayer.append(el);
        this.labels.set(node.id, el);
    } }
    setThoughts(thoughts) { const host = this.host.querySelector('.world-thoughts'); if (!host)
        return; host.replaceChildren(); this.thoughtMarkers = thoughts.filter(t => t.position).map(t => { const el = document.createElement('button'); el.className = 'thought-marker'; el.type = 'button'; el.textContent = '✧'; el.title = t.text.slice(0, 60); el.setAttribute('aria-label', '查看想法锚点'); el.addEventListener('click', () => this.callbacks.onThought?.(t)); host.append(el); return { thought: t, el }; }); }
    setPlayer(p) { this.player = { ...p }; this.active = null; this.dwell = 0; this.lastVisit = null; }
    enter() { this.mode = 'explore'; this.callbacks.onMode?.(this.renderer.name); }
    overview() { this.mode = 'overview'; this.unlock(); }
    jump(node) { this.player = { x: node.x, z: node.z + 6.5, yaw: 0, pitch: .05 }; this.active = null; this.dwell = 0; this.lastVisit = null; this.mode = 'explore'; this.callbacks.onMove?.(this.player, true); }
    lock() { if (this.mode !== 'explore' || this.paused)
        return; const p = this.canvas.requestPointerLock?.(); p?.catch?.(() => this.callbacks.onMode?.(this.renderer.name + ' · 拖拽看向')); }
    unlock() { if (document.pointerLockElement)
        document.exitPointerLock(); this.keys.clear(); }
    pause(value) { this.paused = value; if (value)
        this.unlock(); }
    attachControls() {
        const signal = this.abort.signal;
        const typing = e => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable;
        document.addEventListener('keydown', e => { if (typing(e))
            return; if (e.code === 'Tab' && document.pointerLockElement) {
            e.preventDefault();
            this.unlock();
            return;
        } if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code) && this.mode === 'explore' && !this.paused) {
            e.preventDefault();
            this.keys.add(e.code);
        } }, { signal });
        document.addEventListener('keyup', e => this.keys.delete(e.code), { signal });
        window.addEventListener('blur', () => this.keys.clear(), { signal });
        document.addEventListener('visibilitychange', () => { if (document.hidden)
            this.keys.clear(); }, { signal });
        document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement)
            this.keys.clear(); this.host.classList.toggle('is-locked', !!document.pointerLockElement); }, { signal });
        this.canvas.addEventListener('click', () => { if (document.pointerLockElement === this.canvas && this.active)
            this.callbacks.onOpen?.(this.active.id);
        else
            this.lock(); }, { signal });
        let drag = false, lastX = 0, lastY = 0;
        this.canvas.addEventListener('pointerdown', e => { drag = true; lastX = e.clientX; lastY = e.clientY; }, { signal });
        window.addEventListener('pointerup', () => drag = false, { signal });
        document.addEventListener('pointermove', e => { if (this.mode !== 'explore' || this.paused)
            return; const locked = document.pointerLockElement === this.canvas; if (!locked && !drag)
            return; const dx = locked ? e.movementX : e.clientX - lastX, dy = locked ? e.movementY : e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; this.player.yaw -= dx * .002; this.player.pitch = clamp(this.player.pitch - dy * .002, -1.15, 1.1); }, { signal });
        this.host.querySelectorAll('[data-move]').forEach(el => { const code = el.dataset.move; el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); this.keys.add(code); }, { signal }); for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
            el.addEventListener(event, () => this.keys.delete(code), { signal }); });
    }
    tick(dt, time) {
        if (!this.world || !this.renderer)
            return;
        const p = this.player;
        if (this.mode === 'explore') {
            if (!this.paused) {
                const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0), side = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
                if (forward || side) {
                    const inv = 1 / Math.hypot(forward, side), speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 8.2 : 5.4) * dt;
                    const dx = (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * side) * inv * speed, dz = (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * side) * inv * speed;
                    let next = { x: p.x + dx, z: p.z + dz };
                    if (walkable(next, this.world)) {
                        p.x = next.x;
                        p.z = next.z;
                    }
                    else {
                        next = { x: p.x + dx, z: p.z };
                        if (walkable(next, this.world))
                            p.x = next.x;
                        next = { x: p.x, z: p.z + dz };
                        if (walkable(next, this.world))
                            p.z = next.z;
                    }
                    this.callbacks.onMove?.(p, false);
                }
            }
            this.camera = { ...p, y: 2.6 };
            const near = nearestNode(p, this.world.nodes);
            if (near.distance < 13) {
                if (this.active?.id !== near.node.id) {
                    this.active = near.node;
                    this.dwell = 0;
                }
                this.dwell += dt;
                if (this.dwell > .65 && this.lastVisit !== near.node.id && !this.paused) {
                    this.lastVisit = near.node.id;
                    this.callbacks.onVisit?.(near.node.id);
                }
            }
            else if (near.distance > 20) {
                this.active = null;
                this.dwell = 0;
                this.lastVisit = null;
            }
        }
        else {
            const sway = this.reduced ? 0 : Math.sin(time * .000045) * 3;
            this.camera = lookAt([52 + sway, 37, 64], [-3, -1, -9]);
        }
        const before = performance.now();
        this.renderer.render(this.camera, time, { reduced: this.reduced, quality: this.quality });
        this.updateLabels();
        this.frameSum += performance.now() - before;
        this.frameCount++;
        if (this.frameCount === 100) {
            const ms = this.frameSum / 100;
            this.frameSum = 0;
            this.frameCount = 0;
            if (ms > 26 && this.quality !== 'low') {
                this.quality = 'low';
                if ('quality' in this.renderer)
                    this.renderer.quality = 'low';
                this.renderer.resize(this.host.clientWidth, this.host.clientHeight, 1);
                this.callbacks.onQuality?.('已自动降低像素密度，优先保持交互。');
            }
        }
    }
    updateLabels() {
        const w = this.host.clientWidth, h = this.host.clientHeight;
        for (const { thought, el } of this.thoughtMarkers || []) {
            const p = this.renderer.project([thought.position.x, 1.6, thought.position.z]);
            el.hidden = this.mode !== 'explore' || p.depth < 2 || p.depth > 85;
            el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
        }
        const candidates = [];
        for (const n of this.world.nodes) {
            const p = this.renderer.project([n.x, n.depth === 0 ? 8.8 : 6.6, n.z - 1]);
            if ((this.mode === 'overview' && (w < 800 || p.x < w * .43)) || p.depth < 3 || p.depth > 205 || p.x < 100 || p.x > w - 100 || p.y < 95 || p.y > h - 160)
                continue;
            candidates.push({ n, p });
        }
        candidates.sort((a, b) => a.p.depth - b.p.depth);
        const placed = [];
        let count = 0;
        for (const el of this.labels.values())
            el.hidden = true;
        for (const { n, p } of candidates) {
            const width = Math.max(100, Math.min(270, n.title.length * 19));
            if (placed.some(r => Math.abs(p.x - r.x) < (width + r.width) / 2 + 16 && Math.abs(p.y - r.y) < 74))
                continue;
            const el = this.labels.get(n.id);
            el.hidden = false;
            el.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,-50%)`;
            el.style.opacity = this.mode === 'overview' ? '.94' : String(clamp(1 - (p.depth - 55) / 210, .45, 1));
            el.classList.toggle('near', this.active?.id === n.id);
            el.classList.toggle('visited', this.visited?.includes(n.id));
            placed.push({ x: p.x, y: p.y, width });
            if (++count >= 10)
                break;
        }
    }
    dispose() { cancelAnimationFrame(this.raf); this.observer.disconnect(); this.abort.abort(); this.renderer.dispose(); this.unlock(); }
}
