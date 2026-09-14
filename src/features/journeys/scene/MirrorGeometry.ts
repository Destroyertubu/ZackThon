import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type MirrorMode = 'dusk' | 'night'
export type MirrorIsland = { x: number; z: number; width: number; depth: number; height: number; seed: number }
export const MIRROR_SUN_POSITION: [number, number, number] = [48, 13, -140]
export const MIRROR_MOON_POSITION: [number, number, number] = [48, 81, -140]

// The complete shoreline of every backdrop island is outside the playable 55 m circle.
export const MIRROR_ISLANDS: readonly MirrorIsland[] = [
  { x: -69, z: -48, width: 21, depth: 15, height: 12, seed: 3 },
  { x: 71, z: -52, width: 22, depth: 16, height: 17, seed: 9 },
  { x: -19, z: -91, width: 15, depth: 11, height: 7, seed: 16 },
  { x: 64, z: 42, width: 14, depth: 17, height: 8, seed: 27 },
  { x: -76, z: 29, width: 18, depth: 16, height: 11, seed: 41 },
  { x: 17, z: 82, width: 17, depth: 15, height: 13, seed: 51 },
  { x: -45, z: 96, width: 19, depth: 15, height: 9, seed: 64 },
  { x: 112, z: -5, width: 19, depth: 24, height: 18, seed: 71 },
  { x: -111, z: -13, width: 17, depth: 21, height: 22, seed: 88 },
]

export function mirrorRandom(seed: number) {
  let value = seed >>> 0
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296 }
}

export function mergeMirrorGeometry(parts: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  if (!merged) throw new Error('Mirror sea geometry attributes must match')
  merged.computeBoundingSphere()
  return merged
}

/** Stratified shelves, undercuts and asymmetric crowns, rather than cone-shaped islands. */
export function mirrorIslandGeometry(island: MirrorIsland, waterLevel: number, mountain = false) {
  const segments = mountain ? 56 : 72
  const radii = [0, .17, .34, .45, .52, .58, .61, .70, .74, .82, .86, .94, 1, 1.08]
  const heights = mountain ? [1, .88, .76, .64, .56, .48, .40, .32, .26, .19, .14, .07, -.04, -.18]
    : [.97, .97, .93, .88, .86, .65, .64, .43, .42, .22, .21, .08, -.045, -.19]
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = []
  const chalk = new THREE.Color(mountain ? '#9b9eae' : '#dce0d4'), moss = new THREE.Color('#657d68'), color = new THREE.Color()
  for (let ring = 0; ring < radii.length; ring++) {
    for (let j = 0; j <= segments; j++) {
      const a = j / segments * Math.PI * 2, radius = radii[ring]
      const boundary = 1 + Math.sin(a * 3 + island.seed) * .07 + Math.sin(a * 7 - island.seed) * .045 + Math.sin(a * 5 + ring * .4 + island.seed) * .022 * Math.min(1, radius * 2)
      const x = island.x + Math.cos(a) * island.width * radius * boundary
      const z = island.z + Math.sin(a) * island.depth * radius * boundary
      const detail = Math.sin(x * .79 + z * .24) * Math.cos(z * .61) * .17
      const ridge = Math.sin(a * 3 + island.seed) * .032 + Math.sin(a * 5.4 + radius * 7) * .023
      const crown = Math.max(0, 1 - radius * 1.4) * Math.min(1, radius * 6)
      const height = heights[ring] + ridge * crown + (Math.sin(a * 2 + island.seed) * .026 + Math.sin(a * 5) * .012) * Math.min(1, radius * 6) + (mountain ? Math.abs(Math.sin(a * 4.5 + radius * 8)) * crown * .45 : 0)
      const y = waterLevel + .22 + height * island.height + detail
      positions.push(x, y, z); uvs.push((x + y * .25) / 4, (z + y * .9) / 4)
      const top = ring < 6 && !mountain ? THREE.MathUtils.smoothstep(Math.sin(x * .4) * Math.cos(z * .38), -.25, .65) * .72 : .03
      color.copy(chalk).lerp(moss, top).multiplyScalar(.9 + Math.sin(a * 17 + ring) * .055)
      colors.push(color.r, color.g, color.b)
      if (ring < radii.length - 1 && j < segments) {
        const k = ring * (segments + 1) + j, n = k + segments + 1
        indices.push(k, n + 1, n, k, k + 1, n + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

export function mirrorBoulderGeometry() {
  const source = new THREE.IcosahedronGeometry(1, 2)
  const positions = source.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    const rough = 1 + Math.sin(x * 5 + z * 7) * .085 + Math.sin(y * 9 - z * 4) * .07
    positions.setXYZ(i, x * rough, y * rough * .7, z * rough)
  }
  source.computeVertexNormals()
  return source
}

/** A leafy crown cluster has real cutout silhouettes, no solid spherical canopy. */
export function mirrorCrownGeometry() {
  const random = mirrorRandom(742)
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 68; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()), y = (random() - .5) * .8
    const card = new THREE.PlaneGeometry(.66 + random() * .32, .52 + random() * .26)
    card.rotateX((random() - .5) * 2.5); card.rotateY(a); card.rotateZ((random() - .5) * 1.5)
    card.translate(Math.cos(a) * r * 1.25, y, Math.sin(a) * r)
    parts.push(card)
  }
  return mergeMirrorGeometry(parts)
}

export function mirrorBranchGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 1, 0), end = new THREE.Vector3(), begin = new THREE.Vector3(), delta = new THREE.Vector3()
  for (let branch = 0; branch < 7; branch++) {
    const angle = branch * 2.39996
    begin.set(0, branch ? 1.3 + (branch % 3) * .32 : 0, 0)
    end.set(branch ? Math.cos(angle) * (1.3 + branch * .09) : .1, branch ? 2.6 + (branch % 3) * .36 : 2.5, branch ? Math.sin(angle) * 1.3 : -.06)
    delta.subVectors(end, begin)
    const geometry = new THREE.CylinderGeometry(branch ? .045 : .13, branch ? .095 : .22, delta.length(), 7, 2)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, delta.clone().normalize()))
    geometry.translate((begin.x + end.x) / 2, (begin.y + end.y) / 2, (begin.z + end.z) / 2)
    parts.push(geometry)
  }
  return mergeMirrorGeometry(parts)
}

/** Mutate a Three.js uniform, independently of React render state. */
export function advanceMirrorTime(uniform: { value: number }, delta: number) {
  uniform.value += Math.min(delta, .05)
}

/** Broad overlapping ridges use a continuous heightfield, without a radial peak fan. */
export function mirrorMountainGeometry(island: MirrorIsland, waterLevel: number) {
  const geometry = new THREE.PlaneGeometry(island.width * 2.2, island.depth * 2.2, 36, 26)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position, uv = geometry.attributes.uv
  const colors = new Float32Array(positions.count * 3)
  const low = new THREE.Color('#858dac'), high = new THREE.Color('#b0b3c7'), tint = new THREE.Color()
  const orientation = island.seed * .371, cosine = Math.cos(orientation), sine = Math.sin(orientation)
  for (let i = 0; i < positions.count; i++) {
    const localX = positions.getX(i), localZ = positions.getZ(i), x = localX / island.width, z = localZ / island.depth
    const envelope = Math.pow(Math.max(0, 1 - x * x - z * z), .68)
    const ridgeA = Math.exp(-((x + .35) ** 2 * 5.5 + (z + .1) ** 2 * 2.8))
    const ridgeB = Math.exp(-((x - .34) ** 2 * 7 + (z - .14) ** 2 * 4))
    const ridgeC = Math.exp(-((x - .05) ** 2 * 12 + (z + .35) ** 2 * 8))
    const height = (.34 + ridgeA * .53 + ridgeB * .4 + ridgeC * .16) * envelope
    const weathering = Math.sin(localX * .24 + island.seed) * Math.sin(localZ * .19) * .24 * envelope
    positions.setXYZ(i, island.x + localX * cosine + localZ * sine,
      waterLevel - .32 + island.height * height + weathering, island.z - localX * sine + localZ * cosine)
    uv.setXY(i, localX / 6, localZ / 6)
    tint.copy(low).lerp(high, height * .75); colors.set([tint.r, tint.g, tint.b], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals(); geometry.computeBoundingSphere()
  return geometry
}
