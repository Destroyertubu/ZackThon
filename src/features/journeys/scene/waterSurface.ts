import * as THREE from 'three'

export type WaterShore =
  | { center: readonly [number, number]; radii: readonly [number, number] }
  | { points: readonly (readonly [number, number])[]; closed?: boolean; width?: number }

/** Amplitudes are metres; wavelength/speed use the same world scale as navigation. */
export const WATER_WAVES = [
  { direction: [0.93, 0.36], amplitude: .19, length: 27, steepness: .48 },
  { direction: [0.72, -0.69], amplitude: .105, length: 13, steepness: .38 },
  { direction: [-0.33, 0.94], amplitude: .057, length: 7.2, steepness: .31 },
  { direction: [0.97, 0.24], amplitude: .029, length: 4.8, steepness: .25 },
  { direction: [-0.76, -0.65], amplitude: .016, length: 3.1, steepness: .2 },
  { direction: [0.49, 0.87], amplitude: .009, length: 2.2, steepness: .18 },
] as const

/** Analytic reference used to verify displaced surface normals against finite differences. */
export function sampleWaterSurface(x: number, z: number, time: number, count: 4 | 6 = 6) {
  const position = new THREE.Vector3(x, 0, z), tangent = new THREE.Vector3(1, 0, 0), bitangent = new THREE.Vector3(0, 0, 1)
  for (let i = 0; i < count; i++) {
    const wave = WATER_WAVES[i], length = Math.hypot(...wave.direction), dx = wave.direction[0] / length, dz = wave.direction[1] / length
    const k = 2 * Math.PI / wave.length, phase = k * (dx * x + dz * z) - Math.sqrt(9.81 * k) * time
    const s = Math.sin(phase), c = Math.cos(phase), a = wave.amplitude, q = wave.steepness
    position.add(new THREE.Vector3(q * a * dx * c, a * s, q * a * dz * c))
    tangent.add(new THREE.Vector3(-q * a * k * dx * dx * s, a * k * dx * c, -q * a * k * dx * dz * s))
    bitangent.add(new THREE.Vector3(-q * a * k * dx * dz * s, a * k * dz * c, -q * a * k * dz * dz * s))
  }
  return { position, normal: bitangent.cross(tangent).normalize() }
}

function segmentDistance(x: number, z: number, a: readonly [number, number], b: readonly [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1], denominator = dx * dx + dz * dz
  const t = denominator ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / denominator)) : 0
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)
}

export function distanceToWaterShore(x: number, z: number, shore: WaterShore): number {
  if ('center' in shore) {
    const rx = Math.max(.05, Math.abs(shore.radii[0])), rz = Math.max(.05, Math.abs(shore.radii[1]))
    const px = x - shore.center[0], pz = z - shore.center[1]
    const k0 = Math.hypot(px / rx, pz / rz), k1 = Math.hypot(px / (rx * rx), pz / (rz * rz))
    return k1 > 1e-8 ? k0 * (k0 - 1) / k1 : -Math.min(rx, rz)
  }
  if (shore.points.length < 2) return 64
  let nearest = 64, inside = false
  const count = shore.closed ? shore.points.length : shore.points.length - 1
  for (let i = 0; i < count; i++) {
    const a = shore.points[i], b = shore.points[(i + 1) % shore.points.length]
    nearest = Math.min(nearest, segmentDistance(x, z, a, b))
    if (shore.closed && ((a[1] > z) !== (b[1] > z)) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside
  }
  return shore.closed ? (nearest === 0 ? 0 : nearest * (inside ? -1 : 1)) : nearest - Math.max(0, shore.width ?? .3)
}

/** A small signed-distance texture replaces dozens of shoreline tests per water pixel. */
export function createWaterShoreMap(shores: readonly WaterShore[], size: number, resolution = 512) {
  const pixels = new Uint8Array(resolution * resolution * 4)
  for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) {
    const x = ((i + .5) / resolution - .5) * size, z = ((j + .5) / resolution - .5) * size
    let distance = 56
    for (const shore of shores) distance = Math.min(distance, distanceToWaterShore(x, z, shore))
    const offset = (j * resolution + i) * 4
    pixels[offset] = Math.round(THREE.MathUtils.clamp((distance + 8) / 64, 0, 1) * 255)
    pixels[offset + 1] = pixels[offset + 2] = pixels[offset]; pixels[offset + 3] = 255
  }
  const texture = new THREE.DataTexture(pixels, resolution, resolution, THREE.RGBAFormat)
  texture.minFilter = texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false; texture.needsUpdate = true
  texture.name = 'water-shore-distance'; return texture
}

/** 75% of vertices serve the playable 128 m; the horizon receives a coarse ring. */
export function createWaterGeometry(size: number, requestedSegments: number) {
  const segments = Math.max(64, Math.min(320, Math.round(requestedSegments)))
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
  const positions = geometry.attributes.position, inner = Math.min(64, size * .32), extent = size / 2
  const spread = (value: number) => {
    const t = Math.abs(value) / extent
    return Math.sign(value) * (t <= .75 ? t / .75 * inner : inner + (t - .75) / .25 * (extent - inner))
  }
  for (let i = 0; i < positions.count; i++) positions.setXYZ(i, spread(positions.getX(i)), 0, -spread(positions.getY(i)))
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 1
  return geometry
}

export const WATER_WAVE_GLSL = `
uniform vec4 waves[6];
uniform float steepness[6];
void waveSurface(vec2 p, float t, float shelter, out vec3 displaced, out vec3 surfaceNormal) {
  displaced=vec3(p.x,0.,p.y); vec3 tx=vec3(1.,0.,0.),tz=vec3(0.,0.,1.);
  for(int i=0;i<WAVE_COUNT;i++) {
    vec2 d=waves[i].xy;float a=waves[i].z*shelter,k=waves[i].w,q=steepness[i];
    float f=k*dot(d,p)-sqrt(9.81*k)*t,s=sin(f),c=cos(f);
    displaced+=vec3(q*a*d.x*c,a*s,q*a*d.y*c);
    tx+=vec3(-q*a*k*d.x*d.x*s,a*k*d.x*c,-q*a*k*d.x*d.y*s);
    tz+=vec3(-q*a*k*d.x*d.y*s,a*k*d.y*c,-q*a*k*d.y*d.y*s);
  }
  surfaceNormal=normalize(cross(tz,tx));
}`
