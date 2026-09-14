/** All distances use the cabin's metre-sized floor, x [-6, 6], z [-5, 5]. */
export interface HomeCameraTuning {
  /** Kept for compatibility with the previous shoulder camera profile. */
  distance: number
  pitch: number
  targetHeight: number
  followSpeed: number
  fov: number
  eyeHeight: number
  lookSensitivity: number
  pitchMin: number
  pitchMax: number
}

/** Indoor first-person camera: keep the eye above the collision capsule. */
export function homeCameraTuning(): HomeCameraTuning {
  return {
    distance: 0,
    pitch: 0.04,
    targetHeight: 1.55,
    followSpeed: 18,
    fov: 68,
    eyeHeight: 1.55,
    lookSensitivity: 0.0042,
    pitchMin: -0.7,
    pitchMax: 0.7,
  }
}

export const HOME_SPAWN: [number, number, number] = [3.4, 0.015, 1.9]
// Return on the doorway centreline, facing indoors and clear of the star gate.
export const BALCONY_SPAWN: [number, number, number] = [0, 0.015, -6.45]
export const BALCONY_YAW = Math.PI
export const HOME_YAW = 0.16
export const PLAYER_RADIUS = 0.28
export const WALK_SPEED = 1.8
export const RUN_SPEED = 3.1
