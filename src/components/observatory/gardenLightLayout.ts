import type { Point } from './Primitives'

/** Fixture positions also drive the deck's soft, precomputed light pools. */
export const GARDEN_LANTERNS: { position: Point; height: number; power: number }[] = [
  { position: [-3.95, 0, .8], height: .64, power: 1 },
  { position: [-.25, 0, 1.05], height: .6, power: 1.2 },
  { position: [-4.9, 0, -.5], height: .48, power: .7 },
  { position: [-4.25, .35, -2.45], height: .5, power: .65 },
  { position: [-5.55, 0, 3.15], height: .62, power: 1 },
  { position: [-8.12, 0, 3.05], height: .47, power: .6 },
  { position: [-5.9, 0, -4.65], height: .51, power: .65 },
  { position: [.25, 0, -4.5], height: .52, power: .85 },
  { position: [4.65, 0, -5.6], height: .6, power: .9 },
  { position: [6.4, 0, -3.25], height: .62, power: 1 },
  { position: [8.05, 0, -3.45], height: .45, power: .5 },
  { position: [8.35, 0, 4.7], height: .6, power: .8 },
  { position: [-4.18, 0, 5.1], height: .57, power: .75 },
  { position: [-.5, .35, 5.48], height: .52, power: .65 },
]

export const DECK_LIGHT_POOLS = [
  ...GARDEN_LANTERNS.map(({ position, power }) => ({ x: position[0], z: position[2], power })),
  { x: -6.05, z: 1.35, power: 1.1 },
  { x: 2.7, z: -6.55, power: .7 },
]
