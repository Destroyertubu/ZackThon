export const TIDE_POOL = { x: -2, z: -2, inner: 2.97, outer: 3.27, start: -.91, end: .46 } as const
export const TIDE_POOL_OBSTACLES = Array.from({ length: 19 }, (_, index) => {
  const angle = TIDE_POOL.start + (TIDE_POOL.end - TIDE_POOL.start) * index / 18
  return { x: TIDE_POOL.x + Math.sin(angle) * ((TIDE_POOL.inner + TIDE_POOL.outer) / 2), z: TIDE_POOL.z + Math.cos(angle) * ((TIDE_POOL.inner + TIDE_POOL.outer) / 2), radius: .28 }
})
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
