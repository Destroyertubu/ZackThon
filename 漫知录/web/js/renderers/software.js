/** Deterministic perspective software renderer, not a screenshot or a fake 3D UI.
 * Provides WASD / mouse and all product flows when WebGL2 or local Three is absent.
 * It trades material sophistication and speed for zero dependency availability.
 */
import { buildScene, geometryFaces } from '../scene-data.js';
import { projector, dot, normalize, mix, rgb, fogFactor } from '../math.js';
import { rng, clamp } from '../core.js';
const FOG = rgb('#b3ccc5'), SUN = normalize([-.6, 1, .65]);
export class SoftwareRenderer {
    constructor(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); if (!this.ctx)
        throw new Error('无法创建画布'); this.name = '兼容模式 · 软件 3D'; this.width = 1; this.height = 1; this.faces = []; this.beacons = []; this.dpr = 1; }
    resize(w, h, dpr = 1) { this.width = w; this.height = h; this.dpr = Math.min(dpr, 1.3); this.canvas.width = Math.round(w * this.dpr); this.canvas.height = Math.round(h * this.dpr); this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px'; }
    setWorld(world) { const scene = buildScene(world, { software: true }); this.faces = [...geometryFaces(scene.terrain), ...geometryFaces(scene.foliage)]; this.beacons = scene.beacons; this.lanterns = scene.lanterns; }
    render(camera, time, options = {}) {
        this.camera = camera;
        this.project = projector(camera, this.width, this.height, 58);
        const ctx = this.ctx, w = this.width, h = this.height;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        const horizon = clamp(h * .49 + camera.pitch * h * .82, h * .08, h * .86);
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#386574');
        sky.addColorStop(.45, '#9eb9b4');
        sky.addColorStop(.68, '#b1c8bb');
        sky.addColorStop(1, '#416e79');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
        // Atmospheric sun is painted in world-oriented sky coordinates.
        const sx = w * .76 + Math.sin(camera.yaw) * w * .21, sy = horizon - h * .22;
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * .3);
        halo.addColorStop(0, 'rgba(255,240,198,.8)');
        halo.addColorStop(.23, 'rgba(245,220,169,.28)');
        halo.addColorStop(1, 'rgba(235,219,183,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,245,210,.8)';
        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, 7);
        ctx.fill();
        // Distant silhouettes and layered haze; never intercepts UI interactions.
        for (let k = 0; k < 3; k++) {
            ctx.fillStyle = `rgba(69,113,119,${.08 + k * .035})`;
            ctx.beginPath();
            ctx.moveTo(0, horizon + 25 + k * 35);
            for (let i = 0; i <= 30; i++) {
                const x = i / 30 * w, y = horizon + 25 + k * 35 - Math.pow(Math.max(0, Math.sin(i * .6 + k)), 2) * (30 + k * 8);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.fill();
        }
        // Fine sea streaks: analytic, non-repeating motion without textures.
        const random = rng('water');
        ctx.strokeStyle = 'rgba(214,227,204,.13)';
        ctx.lineWidth = .7;
        for (let i = 0; i < 100; i++) {
            const y = horizon + random() * (h - horizon), x = random() * w;
            const move = options.reduced ? 0 : Math.sin(time * .0003 + i) * 8;
            ctx.beginPath();
            ctx.moveTo(x + move, y);
            ctx.lineTo(x + move + 8 + random() * 90, y);
            ctx.stroke();
        }
        const visible = [];
        for (const face of this.faces) {
            const a = this.project(face.a), b = this.project(face.b), c = this.project(face.c);
            if (a.depth < .5 || b.depth < .5 || c.depth < .5)
                continue;
            if ((a.x < 0 && b.x < 0 && c.x < 0) || (a.x > w && b.x > w && c.x > w) || (a.y < 0 && b.y < 0 && c.y < 0) || (a.y > h && b.y > h && c.y > h))
                continue;
            visible.push({ face, a, b, c, depth: (a.depth + b.depth + c.depth) / 3 });
        }
        visible.sort((a, b) => b.depth - a.depth);
        for (const item of visible) {
            const { face, a, b, c, depth } = item;
            const light = .72 + .32 * Math.abs(dot(face.normal, SUN));
            const base = face.color.map(v => clamp(v * light, 0, 1));
            const col = mix(base, FOG, fogFactor(depth));
            ctx.fillStyle = `rgb(${col.map(v => Math.round(v * 255)).join(',')})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.closePath();
            ctx.fill();
        }
        // Small emissive ring inset and lantern halo are overlaid as perspective strokes.
        for (const b of this.beacons) {
            const center = this.project([b.x, b.y, b.z + .06]);
            if (center.depth < 3 || center.depth > 230)
                continue;
            ctx.strokeStyle = b.color;
            ctx.globalAlpha = clamp(1 - center.depth / 250, .1, .8);
            ctx.lineWidth = 1.3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = b.color;
            ctx.beginPath();
            for (let i = 0; i <= 40; i++) {
                const a = i / 40 * Math.PI * 2, p = this.project([b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, b.z + .08]);
                if (i === 0)
                    ctx.moveTo(p.x, p.y);
                else
                    ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
        for (const b of this.lanterns) {
            const p = this.project([b.x, b.y, b.z]);
            if (p.depth < 1 || p.x < 0 || p.x > w)
                continue;
            ctx.fillStyle = b.color;
            ctx.shadowColor = b.color;
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.min(6, Math.max(1, p.scale * .15)), 0, 7);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
        // Foreground mist softens the geometric horizon without hiding readable overlays.
        const vignette = ctx.createRadialGradient(w * .5, h * .48, h * .12, w * .5, h * .48, w * .7);
        vignette.addColorStop(0, 'rgba(4,28,36,0)');
        vignette.addColorStop(1, 'rgba(4,28,36,.32)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
        this.stats = { triangles: visible.length, drawCalls: visible.length };
    }
    project(point) { return { x: 0, y: 0, depth: -1 }; }
    dispose() { this.faces = []; }
}
