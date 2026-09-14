/** The rooftop has its own floor; the cabin's sealed envelope is never changed. */
import { GARDEN_DETAIL_OBSTACLES } from './gardenDetailLayout'
import { GARDEN_PERIMETER_OBSTACLES } from './gardenPerimeterLayout'
import { canUseTidePool, TIDE_POOL_OBSTACLES } from './starTideLayout'
export const OBSERVATORY_RADIUS = 11.2
export const OBSERVATORY_EYE_HEIGHT = 1.7
export const OBSERVATORY_SPAWN: [number, number, number] = [3.65, OBSERVATORY_EYE_HEIGHT, 7.15]
export const OBSERVATORY_LOOK_AT: [number, number, number] = [.7, 1.95, -2.9]
export const ATLAS_POSITION: [number, number, number] = [0, 0, -1.4]
export const TREE_POSITION: [number, number, number] = [-2, 0, -2]
export const GALAXY_GATE_POSITION: [number, number, number] = [2.7, 0, -6.8]
export const THOUGHT_BAR_POSITION: [number, number, number] = [-6.65, 0, 1.4]
export const TELESCOPE_POSITION: [number, number, number] = [8.0, 0, -1.2]
export const RETURN_GATE_POSITION: [number, number, number] = [7.3, 0, -3.8]
export const RETURN_GATE_RADIUS = 2.2

export function canUseReturnGate(x: number, z: number): boolean {
  return Math.hypot(x - RETURN_GATE_POSITION[0], z - RETURN_GATE_POSITION[2]) <= RETURN_GATE_RADIUS
}

export function canUseGalaxyGate(x: number, z: number): boolean {
  return Math.hypot(x - GALAXY_GATE_POSITION[0], z - GALAXY_GATE_POSITION[2]) <= 2.55
}

export function canUseThoughtBar(x: number, z: number): boolean {
  return Math.hypot(x - THOUGHT_BAR_POSITION[0], z - THOUGHT_BAR_POSITION[2]) <= 2.55
}

export const COLLECTION_TREE_RADIUS = 3.8
export function canUseCollectionTree(x: number, z: number): boolean {
  return canStandOnObservatory(x, z)
    && Math.hypot(x - TREE_POSITION[0], z - TREE_POSITION[2]) <= COLLECTION_TREE_RADIUS
}

/** The new tree never takes E away from an existing nearby interaction. */
export function getObservatoryInteraction(x: number, z: number): 'home' | 'galaxy' | 'bar' | 'tide' | 'tree' | null {
  return canUseReturnGate(x, z) ? 'home'
    : canUseGalaxyGate(x, z) ? 'galaxy'
      : canUseThoughtBar(x, z) ? 'bar'
        : canUseTidePool(x, z) ? 'tide'
          : canUseCollectionTree(x, z) ? 'tree' : null
}

export const DESK_POSITION: [number, number, number] = [-5.7, 0, -3.8]

// Footprints include room for the camera's near plane. Layout and movement share them.
export const OBSERVATORY_OBSTACLES = [
  { x: TREE_POSITION[0], z: TREE_POSITION[2], radius: 2.35 },
  { x: TELESCOPE_POSITION[0], z: TELESCOPE_POSITION[2], radius: 1.18 },
  { x: RETURN_GATE_POSITION[0], z: RETURN_GATE_POSITION[2], radius: .95 },
  ...GARDEN_DETAIL_OBSTACLES,
  ...GARDEN_PERIMETER_OBSTACLES,
  ...TIDE_POOL_OBSTACLES,
  // A chain of small footprints follows the crescent bench, leaving its ends open.
  ...[-0.95, -0.5, 0, 0.5, 0.95].map(a => ({ x: -2 + Math.sin(a) * 2.6, z: -2 + Math.cos(a) * 2.6, radius: 0.75 })),
  ...[-0.2, 0.55, 1.3, 2.05, 2.8].map(z => ({ x: -6.65, z, radius: 0.86 })),
  { x: -6.01, z: 2.28, radius: .83 },
  { x: -4.97, z: 1.95, radius: .48 },
  { x: -5.2, z: -4.8, radius: 1.05 },
  // Gate posts are solid; both destinations retain a clear, walkable opening.
  { x: 0.45, z: -6.8, radius: 0.46 },
  { x: 4.95, z: -6.8, radius: 0.46 },
  { x: 8.8, z: 4.5, radius: 0.85 },
  { x: 8.8, z: -5.5, radius: 0.85 },
  { x: -8.5, z: -5.7, radius: 0.8 },
  { x: -4.9, z: 5.6, radius: 1.3 },
  { x: 0, z: 5.4, radius: 1.05 },
  { x: -8.7, z: 3.9, radius: 0.3 },
  { x: -8.7, z: -1.1, radius: 0.3 },
  { x: -4.6, z: 3.9, radius: 0.3 },
  { x: -4.6, z: -1.1, radius: 0.3 },
] as const

export function canStandOnObservatory(x: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z)
    && Math.hypot(x, z) <= OBSERVATORY_RADIUS
    && OBSERVATORY_OBSTACLES.every((obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) >= obstacle.radius)
}

/** Short, axis-separated steps preserve sliding around the garden beds and rails. */
export function moveOnObservatory(position: { x: number; z: number }, dx: number, dz: number): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08))
  for (let i = 0; i < steps; i++) {
    if (canStandOnObservatory(position.x + dx / steps, position.z)) position.x += dx / steps
    if (canStandOnObservatory(position.x, position.z + dz / steps)) position.z += dz / steps
  }
}
