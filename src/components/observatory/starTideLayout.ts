export const TIDE_POOL = { x: -2, z: -2, inner: 3.00, outer: 3.65, start: -.91, end: .46 } as const
export const ATELIER_RILL_POINTS: [number,number][] = [[-5.72,1.1],[-5.5,.62],[-5.18,.31],[-4.8,.12],[-4.60,.03]]
export const ATELIER_RILL_OBSTACLES = ATELIER_RILL_POINTS.map(([x,z])=>({x,z,radius:.23}))
export const TIDE_POOL_OBSTACLES = Array.from({ length: 19 }, (_, index) => {
  const angle = TIDE_POOL.start + (TIDE_POOL.end - TIDE_POOL.start) * index / 18
  return { x: TIDE_POOL.x + Math.sin(angle) * ((TIDE_POOL.inner + TIDE_POOL.outer) / 2), z: TIDE_POOL.z + Math.cos(angle) * ((TIDE_POOL.inner + TIDE_POOL.outer) / 2), radius: .43 }
}).filter(obstacle => Math.abs(obstacle.x - TIDE_POOL.x) > .90)

/** The level moon bridge is a real walking surface, with short ramps at its ends. */
export function moonBridgeHeight(x: number, z: number) {
  if (Math.abs(x - TIDE_POOL.x) > .68 || z < .91 || z > 2.0) return 0
  return .19 * Math.min(1, (z-.91)/.13, (2.0-z)/.13)
}
export function canUseTidePool(x: number, z: number) {
  return Math.hypot(x + 2.35, z - 2.0) < 1.75
}

export const THOUGHT_SEEDS = [
  { id: 'literature', x: -4.05, y: 3.35, z: .0, length: .7 },
  { id: 'photography', x: -3.25, y: 3.78, z: .35, length: .65 },
  { id: 'philosophy', x: -2.32, y: 3.58, z: .58, length: 1.1 },
  { id: 'nature', x: -1.38, y: 3.87, z: .33, length: .85 },
  { id: 'music', x: -.62, y: 3.2, z: -.16, length: .65 },
] as const
