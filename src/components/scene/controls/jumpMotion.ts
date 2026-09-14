/** A short, grounded first-person hop. Horizontal collision stays with each scene. */
export const JUMP_SPEED = 4.6
export const JUMP_GRAVITY = 16.4
export const JUMP_MAX_DELTA = .05

export interface JumpMotion {
  height: number
  velocity: number
  ground: number
  grounded: boolean
}

export function createJumpMotion(ground = 0): JumpMotion {
  return { height: 0, velocity: 0, ground, grounded: true }
}

export function resetJump(motion: JumpMotion, ground = motion.ground): void {
  Object.assign(motion, createJumpMotion(ground))
}

/** Call once per fresh press; repeats and queued airborne presses cannot chain jumps. */
export function startJump(motion: JumpMotion): boolean {
  if (!motion.grounded) return false
  motion.grounded = false
  motion.velocity = JUMP_SPEED
  return true
}

/** Exact constant-gravity integration; preserve world height while crossing a slope.
 * Paused scenes do not step this state. A resumed frame cannot fast-forward the fall. */
export function stepJump(motion: JumpMotion, ground: number, rawDelta: number): number {
  if (!Number.isFinite(ground)) return motion.ground + motion.height
  if (!motion.grounded) motion.height += motion.ground - ground
  motion.ground = ground
  const dt = Number.isFinite(rawDelta) ? Math.max(0, Math.min(rawDelta, JUMP_MAX_DELTA)) : 0
  if (!motion.grounded) {
    motion.height += motion.velocity * dt - .5 * JUMP_GRAVITY * dt * dt
    motion.velocity -= JUMP_GRAVITY * dt
    if (motion.height <= 0 && motion.velocity <= 0) resetJump(motion, ground)
    else if (motion.height < 0) motion.height = 0
  }
  return ground + motion.height
}
