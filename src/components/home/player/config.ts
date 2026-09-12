/** All distances use the cabin's metre-sized floor, x [-6, 6], z [-5, 5]. */
export interface HomeCameraTuning {
  distance: number
  pitch: number
  targetHeight: number
  followSpeed: number
  fov: number
}

/** Indoor shoulder camera: balance character presence with a readable furniture layout. */
export function homeCameraTuning(): HomeCameraTuning {
  return {
    distance: 3.2,
    pitch: 0.24,
    targetHeight: 1.05,
    followSpeed: 12,
    fov: 58,
  }
}

export const HOME_SPAWN: [number, number, number] = [3.4, 0.015, 1.9]
export const HOME_YAW = 0.16
export const PLAYER_RADIUS = 0.28
export const WALK_SPEED = 1.8
export const RUN_SPEED = 3.1
