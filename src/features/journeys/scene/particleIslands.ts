import * as THREE from 'three'
import { mirrorRandom } from './MirrorGeometry'

export type ParticleIsland = {
  id: string; center: [number, number, number]; radius: [number, number]
  summit: number; keel: number; seed: number; hue: number
}

/** Separate silhouettes surround the playable island; no particle field enters its navigation area. */
export const PARTICLE_ISLANDS: readonly ParticleIsland[] = [
  { id: 'north-crown', center: [-5, 40, -122], radius: [24, 17], summit: 16, keel: 18, seed: 317, hue: .53 },
  { id: 'west-garden', center: [-71, 22, -59], radius: [20, 14], summit: 12, keel: 13, seed: 821, hue: .57 },
  { id: 'east-veil', center: [77, 29, -67], radius: [22, 15], summit: 15, keel: 17, seed: 427, hue: .67 },
  { id: 'far-west', center: [-132, 47, -193], radius: [23, 15], summit: 10, keel: 19, seed: 721, hue: .64 },
  { id: 'far-east', center: [101, 61, -206], radius: [25, 17], summit: 11, keel: 22, seed: 933, hue: .55 },
  { id: 'east-inlet', center: [103, 22, 45], radius: [20, 15], summit: 8, keel: 13, seed: 127, hue: .52 },
  { id: 'south-song', center: [27, 29, 124], radius: [24, 15], summit: 10, keel: 16, seed: 219, hue: .65 },
  { id: 'west-drift', center: [-99, 26, 60], radius: [23, 16], summit: 9, keel: 15, seed: 531, hue: .55 },
  { id: 'south-west', center: [-79, 44, 151], radius: [20, 13], summit: 8, keel: 19, seed: 627, hue: .7 },
]

function outline(angle: number, seed: number) {
  return 1 + .12 * Math.sin(angle * 3 + seed) + .065 * Math.cos(angle * 5 - seed * .3) + .025 * Math.sin(angle * 9)
}

/** A continuous height field only distributes stars; it never creates a solid terrain mesh. */
function altitude(x: number, z: number, island: ParticleIsland) {
  const edge = Math.max(0, 1 - Math.hypot(x, z) ** 1.6)
  const peak = Math.exp(-((x + .23) ** 2 * 7 + (z - .1) ** 2 * 10))
    + .61 * Math.exp(-((x - .35) ** 2 * 13 + (z + .22) ** 2 * 8))
  const ridges = .11 * Math.sin(x * 11 + z * 5 + island.seed) * Math.cos(z * 9 - x * 3)
  return .4 + island.summit * edge * (.18 + peak * .72 + ridges)
}

export function createParticleIsland(island: ParticleIsland, fine: boolean) {
  const random = mirrorRandom(island.seed)
  const positions: number[] = [], colors: number[] = [], data: number[] = [], motion: number[] = []
  const color = new THREE.Color(), warm = new THREE.Color('#ffe4aa')
  const bodyCount = fine ? 12500 : 6200
  function add(x: number, y: number, z: number, kind: number, opacity: number, size: number, travel = 0, gold = false) {
    positions.push(x, y, z)
    const lower = THREE.MathUtils.clamp(-y / island.keel, 0, 1)
    color.setHSL(island.hue + lower * .10 + random() * .035, .86 - lower * .08, .43 + random() * .10)
    if (gold) color.lerp(warm, .88)
    colors.push(color.r, color.g, color.b)
    data.push(kind, random(), size, opacity)
    motion.push(travel, random() * Math.PI * 2)
  }
  for (let i = 0; i < bodyCount; i++) {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random())
    const nx = Math.cos(angle) * radius, nz = Math.sin(angle) * radius
    const edge = outline(angle, island.seed)
    if (i < bodyCount * .56) {
      add(nx * island.radius[0] * edge, altitude(nx, nz, island), nz * island.radius[1] * edge,
        0, .36 + radius * .14, .13 + random() * .12, 0, random() < .028)
    } else {
      const depth = random(), width = Math.pow(1 - depth, .66)
      const swell = .94 + .06 * Math.sin(depth * 17 + angle * 3)
      add(Math.cos(angle) * island.radius[0] * edge * width * swell + depth * 2.1,
        -depth * island.keel, Math.sin(angle) * island.radius[1] * edge * width * swell,
        0, (.40 - depth * .22), .15 + random() * .15)
    }
  }
  // Nested broken contour currents reveal the island's curved underside without wireframe triangles.
  const contours = fine ? 13 : 10, ringCount = fine ? 300 : 180
  for (let ring = 0; ring < contours; ring++) for (let i = 0; i < ringCount; i++) {
    const angle = i / ringCount * Math.PI * 2, depth = ring / contours
    if (Math.sin(angle * 3 + depth * 21 + island.seed) < -.82) continue
    const width = Math.pow(1 - depth, .66), edge = outline(angle, island.seed)
    add(Math.cos(angle) * island.radius[0] * width * edge + depth * 2.1, -.08 - depth * island.keel,
      Math.sin(angle) * island.radius[1] * width * edge, 3, ring === 0 ? .62 : .36,
      ring === 0 ? .26 : .17, 0, ring === 0 && Math.sin(angle * 2 + island.seed) > .65)
  }
  // Flow begins at the front rim and dissolves in the air, always above the sea and the keel.
  const facing = Math.atan2(-island.center[2], -island.center[0])
  for (let fall = 0; fall < 3; fall++) {
    const angle = facing + (fall - 1) * .48, edge = outline(angle, island.seed)
    const nx = Math.cos(angle) * .94, nz = Math.sin(angle) * .94
    const length = Math.min(island.keel + 5, island.center[1] - 5) * (fall === 1 ? 1 : .77)
    for (let i = 0; i < (fine ? 530 : 250); i++) {
      const spread = (random() - .5) * (fall === 1 ? 1.4 : .8)
      add(nx * island.radius[0] * edge + Math.sin(angle) * spread, altitude(nx, nz, island),
        nz * island.radius[1] * edge - Math.cos(angle) * spread, 2, .43, .16 + random() * .14, length)
    }
  }
  for (let i = 0; i < (fine ? 520 : 260); i++) {
    const angle = random() * Math.PI * 2, distance = 1.05 + random() * .28
    add(Math.cos(angle) * island.radius[0] * distance, 1.5 + random() * 7,
      Math.sin(angle) * island.radius[1] * distance, 1, .28 + random() * .25, .15 + random() * .28, 0, i % 5 === 0)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('starData', new THREE.Float32BufferAttribute(data, 4))
  geometry.setAttribute('starMotion', new THREE.Float32BufferAttribute(motion, 2))
  // Account for shader travel; Three cannot infer an animated bound from the static rim positions.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -2, 0), Math.max(...island.radius, island.keel, island.summit) * 1.65 + 12)
  return geometry
}
