import { TREE_POSITION } from './layout'
import measurements from './jacarandaMeasurements.json'

export type GardenTreePoint = [number, number, number]

// This mature Jacaranda is exported at final scale, Y-up, with its root at [0, 0, 0].
export const GARDEN_TREE_HEIGHT = 7.85
export const GARDEN_TREE_ROOT_Y = .33

export function toGardenTreeWorld(point: readonly number[]): GardenTreePoint {
  return [TREE_POSITION[0] + point[0], GARDEN_TREE_ROOT_Y + point[1], TREE_POSITION[2] + point[2]]
}

/** Actual downward-facing wood vertices measured on the optimized Jacaranda. */
export const GARDEN_TREE_ANCHORS: readonly GardenTreePoint[] = measurements.hangingAnchors.map(toGardenTreeWorld)

/** Connected bark-edge routes, offset by 18 mm, keep gold shoots on the real forked trunk. */
export const GARDEN_TREE_VINE_PATHS: readonly (readonly GardenTreePoint[])[] = measurements.jewelryPaths.map(path => path.map(toGardenTreeWorld))
