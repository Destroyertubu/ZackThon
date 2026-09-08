/** Original procedural art. Shared mesh descriptions keep both renderers coherent.
 * No third-party textures, font files, network images or copyrighted mascot copies.
 */
import { rng } from './core.js';
import { rgb, faceNormal, mix } from './math.js';
export function meshBuilder() { const positions = [], colors = []; return { positions, colors, tri(a, b, c, color) { positions.push(...a, ...b, ...c); const cc = typeof color === 'string' ? rgb(color) : color; colors.push(...cc, ...cc, ...cc); } }; }
function box(m, x, y, z, w, h, d, col) { const a = [x - w / 2, y, z - d / 2], b = [x + w / 2, y, z - d / 2], c = [x + w / 2, y, z + d / 2], e = [x - w / 2, y, z + d / 2], A = [a[0], y + h, a[2]], B = [b[0], y + h, b[2]], C = [c[0], y + h, c[2]], E = [e[0], y + h, e[2]]; for (const [p, q, r, s] of [[a, b, B, A], [b, c, C, B], [c, e, E, C], [e, a, A, E], [A, B, C, E]]) {
    m.tri(p, q, r, col);
    m.tri(p, r, s, col);
} }
function cone(m, x, y, z, r, h, col, segments = 7) { for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
    m.tri([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x, y + h, z], [x + Math.cos(b) * r, y, z + Math.sin(b) * r], col);
} }
function torus(m, x, y, z, r, tube, col, segments = 40, tubeSegments = 7) { const pt = (a, b) => [x + Math.cos(a) * (r + Math.cos(b) * tube), y + Math.sin(a) * (r + Math.cos(b) * tube), z + Math.sin(b) * tube]; for (let i = 0; i < segments; i++)
    for (let j = 0; j < tubeSegments; j++) {
        const a = i / segments * 2 * Math.PI, A = (i + 1) / segments * 2 * Math.PI, b = j / tubeSegments * 2 * Math.PI, B = (j + 1) / tubeSegments * 2 * Math.PI;
        m.tri(pt(a, b), pt(A, b), pt(A, B), col);
        m.tri(pt(a, b), pt(A, B), pt(a, B), col);
    } }
function island(m, node, trees) {
    const random = rng(node.id), r = node.depth === 0 ? 12 : 9.8, n = 20, c = [node.x, 0, node.z];
    const rings = [];
    const top = rgb(node.depth === 0 ? '#d1d4b8' : '#becdb5'), cliff = rgb('#8baca4');
    const radii = Array.from({ length: n }, () => .88 + random() * .16);
    for (const [scale, y] of [[.48, .07], [1, -.2], [.88, -2.8], [.55, -6.6], [.14, -10.8]])
        rings.push(Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI; return [c[0] + Math.sin(a) * r * radii[i] * scale, y + (scale === .48 ? 0 : (random() - .5) * .9), c[2] + Math.cos(a) * r * radii[i] * scale]; }));
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        m.tri(c, rings[0][i], rings[0][next], mix(top, [1, 1, .92], random() * .07));
    }
    for (let k = 0; k < rings.length - 1; k++)
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n, a = rings[k][i], b = rings[k][j], A = rings[k + 1][i], B = rings[k + 1][j];
            const base = k === 0 ? top : cliff;
            const color = mix(base, k > 1 ? rgb('#466e76') : rgb('#edf0d2'), random() * (k === 0 ? .12 : .3));
            m.tri(a, A, b, color);
            m.tri(A, B, b, color);
        }
    // Slender cedars arranged away from the central arrival area.
    for (let i = 0; i < (node.depth === 0 ? 10 : 5); i++) {
        const a = random() * Math.PI * 2, rr = r * (.58 + random() * .17), x = c[0] + Math.sin(a) * rr, z = c[2] + Math.cos(a) * rr, scale = .7 + random() * .85;
        trees.push({ x, y: 0, z, scale, color: random() > .45 ? '#617f70' : '#779587' });
    }
    // Three simple stone steps and a quiet obelisk beside every topic.
    for (let i = 0; i < 3; i++)
        box(m, c[0] - 3, -.1 + i * .18, c[2] - 1, 2.3 - i * .36, .2, 2.3 - i * .36, '#d8d5b5');
    box(m, c[0] - 3, .5, c[2] - 1, .68, 2.2, .68, '#829994');
    // The root's sculptural stone ring is a visual landmark, not a branded mascot.
    const rGate = node.depth === 0 ? 3.15 : 1.65;
    torus(m, c[0], rGate + .15, c[2] - 1, rGate, node.depth === 0 ? .29 : .2, '#d6d9c1', node.depth === 0 ? 44 : 24, 6);
}
export function buildScene(world, { software = false } = {}) {
    const terrain = meshBuilder(), foliage = meshBuilder(), trees = [], beacons = [], lanterns = [];
    const ns = new Map(world.nodes.map(n => [n.id, n]));
    for (const n of world.nodes) {
        island(terrain, n, trees);
        beacons.push({ x: n.x, y: n.depth === 0 ? 3.3 : 1.8, z: n.z - 1, r: n.depth === 0 ? 2.84 : 1.4, color: n.color });
        lanterns.push({ x: n.x - 3, y: 3.2, z: n.z - 1, color: n.color });
    }
    // Flat, continuous causeways correspond exactly to walkability corridors.
    for (const e of world.edges) {
        const a = ns.get(e.source), b = ns.get(e.target);
        if (!a || !b)
            continue;
        const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz), px = -dz / l, pz = dx / l;
        const steps = Math.ceil(l / 2);
        for (let i = 0; i < steps; i++) {
            const t = i / steps, T = Math.min(1, (i + .88) / steps);
            const p = [a.x + dx * t, .11, a.z + dz * t], q = [a.x + dx * T, .11, a.z + dz * T], w = 1.65;
            const A = [p[0] + px * w, p[1], p[2] + pz * w], B = [p[0] - px * w, p[1], p[2] - pz * w], C = [q[0] - px * w, q[1], q[2] - pz * w], D = [q[0] + px * w, q[1], q[2] + pz * w];
            terrain.tri(A, B, C, '#d0d5bb');
            terrain.tri(A, C, D, '#d0d5bb');
        }
    }
    // Software fallback needs explicit tree geometry; GPU path instances shared cones.
    if (software)
        for (const t of trees) {
            box(foliage, t.x, 0, t.z, .15 * t.scale, 2.6 * t.scale, .15 * t.scale, '#707f6b');
            cone(foliage, t.x, 1.1 * t.scale, t.z, 1.02 * t.scale, 3.7 * t.scale, t.color, 7);
            cone(foliage, t.x, 2.1 * t.scale, t.z, .68 * t.scale, 3.15 * t.scale, t.color, 7);
        }
    return { terrain, foliage, trees, beacons, lanterns };
}
export function geometryFaces(mesh) {
    const out = [];
    for (let i = 0; i < mesh.positions.length; i += 9) {
        const a = mesh.positions.slice(i, i + 3), b = mesh.positions.slice(i + 3, i + 6), c = mesh.positions.slice(i + 6, i + 9);
        out.push({ a, b, c, color: mesh.colors.slice(i, i + 3), normal: faceNormal(a, b, c), center: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] });
    }
    return out;
}
