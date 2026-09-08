import { clamp } from './core.js';
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map(v => v * s);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = a => mul(a, 1 / (Math.hypot(...a) || 1));
export function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function cameraBasis(camera) {
    const c = Math.cos(camera.pitch), s = Math.sin(camera.pitch), y = camera.yaw;
    const forward = [-Math.sin(y) * c, s, -Math.cos(y) * c];
    const right = [Math.cos(y), 0, -Math.sin(y)];
    const up = cross(right, forward);
    return { forward, right, up };
}
export function lookAt(position, target) { const d = sub(target, position); return { x: position[0], y: position[1], z: position[2], yaw: Math.atan2(-d[0], -d[2]), pitch: Math.atan2(d[1], Math.hypot(d[0], d[2])) }; }
export function projector(camera, width, height, fov = 58) {
    const { forward, right, up } = cameraBasis(camera), origin = [camera.x, camera.y, camera.z];
    const f = height / (2 * Math.tan(fov * Math.PI / 360));
    return point => { const d = sub(point, origin), depth = dot(d, forward); return { x: width / 2 + dot(d, right) * f / depth, y: height / 2 - dot(d, up) * f / depth, depth, scale: f / Math.max(.1, depth) }; };
}
export function faceNormal(a, b, c) { return normalize(cross(sub(b, a), sub(c, a))); }
export const fogFactor = depth => clamp(1 - Math.exp(-Math.max(0, depth - 20) * .005), 0, .94);
