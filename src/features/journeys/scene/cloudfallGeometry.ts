import * as THREE from 'three'
import { mergeMirrorGeometry, mirrorRandom } from './MirrorGeometry'

export const CLOUD_ISLANDS = [
  { x: -54, y: 20, z: -74, width: 14, depth: 10, drop: 17, seed: 14 },
  { x: 36, y: 32, z: -111, width: 20, depth: 13, drop: 27, seed: 31 },
  { x: 88, y: 14, z: -72, width: 13, depth: 9, drop: 16, seed: 43 },
  { x: -108, y: 38, z: -120, width: 17, depth: 12, drop: 21, seed: 67 },
  { x: 58, y: 25, z: 76, width: 15, depth: 11, drop: 20, seed: 83 },
] as const
export type CloudIsland = typeof CLOUD_ISLANDS[number]

function finish(positions: number[], uvs: number[], colors: number[], indices: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices); g.computeVertexNormals(); g.computeBoundingSphere()
  return g
}

/** Closed, weathered rock volume: a planted shoulder above an asymmetrical hanging root. */
export function floatingIslandGeometry(island: CloudIsland) {
  const p: number[] = [], uv: number[] = [], colors: number[] = [], ids: number[] = []
  const around = 96, vertical = 38
  const pearl = new THREE.Color('#d7d9da'), shade = new THREE.Color('#5f7087'), moss = new THREE.Color('#718976'), tint = new THREE.Color()
  for (let j = 0; j <= vertical; j++) {
    const t = j / vertical, theta = t * Math.PI
    const radius = t <= .5 ? Math.pow(Math.sin(theta), .62) : Math.pow(Math.max(0, 2 - t * 2), 1.35)
    const y = t < .5 ? Math.pow(Math.max(0, Math.cos(theta)), 1.8) * 2.9 : -Math.pow(Math.max(0, -Math.cos(theta)), .85) * island.drop
    for (let i = 0; i <= around; i++) {
      const a = i / around * Math.PI * 2
      const stratum = Math.sin(y * 1.15 + a * .6) * .021 + Math.sin(y * 2.7 + a * 3) * .014
      const erosion = 1 + Math.sin(a * 3 + island.seed) * .18 + Math.sin(a * 7 - island.seed * .7) * .085 + Math.cos(a * 13 + t * 7) * .027 + stratum
      const drift = Math.pow(Math.max(0, t - .45), 1.4)
      const x = Math.cos(a) * island.width * radius * erosion + drift * island.width * .43
      const z = Math.sin(a) * island.depth * radius * erosion + drift * island.depth * .21
      const cleft = (Math.sin(a * 3 + island.seed) * 1.6 + Math.sin(a * 7 - island.seed) * .85) * Math.sin(theta)
      p.push(x, y * (1 + Math.sin(a * 4 + island.seed) * .12 * Math.sin(theta)) + cleft, z)
      uv.push(x / 5 + y / 10, z / 5 + y / 7)
      tint.copy(shade).lerp(pearl, .35 + .65 * Math.pow(Math.max(0, 1 - t), .7))
      if (t < .38) tint.lerp(moss, .45 + Math.sin(a * 9 + t * 13) * .2)
      tint.multiplyScalar(.89 + Math.sin(a * 11 + y * .8) * .07)
      colors.push(tint.r, tint.g, tint.b)
      if (j < vertical && i < around) { const k = j * (around + 1) + i, n = k + around + 1; ids.push(k, k + 1, n, k + 1, n + 1, n) }
    }
  }
  return finish(p, uv, colors, ids)
}

/** An incomplete geological arch: no perfect torus silhouette or repeated polygon wall. */
export function cloudfallArchGeometry() {
  const p: number[] = [], uv: number[] = [], colors: number[] = [], ids: number[] = []
  const along = 144, radial = 18, color = new THREE.Color()
  for (let i = 0; i <= along; i++) {
    const t = i / along, a = -.3 + t * Math.PI * 1.63
    const centre = new THREE.Vector3(Math.cos(a) * 25 + Math.sin(a * 3) * 2.3, Math.sin(a) * 21 + Math.cos(a * 2) * 2.2, Math.sin(a * 2) * 3.5)
    const thickness = (1.5 + Math.sin(a * 3 + .5) * .65) * (.45 + .55 * Math.pow(Math.sin(t * Math.PI), .24))
    for (let j = 0; j <= radial; j++) {
      const b = j / radial * Math.PI * 2, weather = 1 + Math.sin(a * 21 + b * 3) * .13 + Math.cos(a * 43 - b * 5) * .065
      const r = thickness * weather
      p.push(centre.x + Math.cos(a) * Math.cos(b) * r, centre.y + Math.sin(a) * Math.cos(b) * r, centre.z + Math.sin(b) * r * 1.4)
      uv.push(t * 27, j / radial * 4)
      color.set('#c3cdd4').multiplyScalar(.74 + .2 * Math.sin(b) + .08 * Math.sin(a * 13))
      if (a > .4 && a < 2.6 && Math.cos(b) > .3) color.lerp(new THREE.Color('#768b73'), .4)
      colors.push(color.r, color.g, color.b)
      if (i < along && j < radial) { const k = i * (radial + 1) + j, n = k + radial + 1; ids.push(k, n, k + 1, k + 1, n, n + 1) }
    }
  }
  return finish(p, uv, colors, ids)
}

export function hangingRootsGeometry(island: CloudIsland) {
  const random = mirrorRandom(island.seed * 931), parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 13; i++) {
    const a = random() * Math.PI * 2, r = .64 + random() * .18
    const x = Math.cos(a) * island.width * r, z = Math.sin(a) * island.depth * r, length = 3 + random() * 10
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, -.8, z), new THREE.Vector3(x * 1.04, -length * .35, z * 1.08),
      new THREE.Vector3(x * .95 + Math.sin(a) * 1.3, -length * .72, z * 1.03), new THREE.Vector3(x * .9, -length, z * .98),
    ])
    parts.push(new THREE.TubeGeometry(curve, 22, .055 + random() * .045, 5, false))
  }
  return mergeMirrorGeometry(parts)
}

/** Strip curves away from the cliff and widens into mist, with world-scale wave vertices. */
export function cloudfallWaterGeometry(island: CloudIsland, channel: number) {
  const toward = Math.atan2(-island.z, -island.x) + (channel - .5) * .43
  const x = Math.cos(toward) * island.width * .8, z = Math.sin(toward) * island.depth * .8
  const height = Math.min(island.y + 1.5, 28), width = channel ? 1.15 : 2.25
  const g = new THREE.PlaneGeometry(width, height, 8, 44), p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const fall = .5 - p.getY(i) / height
    p.setXYZ(i, p.getX(i) * (1 + fall * .85), 1 - fall * height, Math.sin(fall * Math.PI * .72) * 2.4)
  }
  g.rotateY(Math.PI / 2 - toward); g.translate(x, 0, z); g.computeVertexNormals(); g.computeBoundingSphere()
  return g
}
