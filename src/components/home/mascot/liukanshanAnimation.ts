export type LiukanshanState = 'idle' | 'greeting' | 'searching' | 'reading' | 'collected'
export type MascotPoint = [number, number, number]

export interface LiukanshanPose {
  rootY: number
  bodyY: number
  body: MascotPoint
  armL: MascotPoint
  armR: MascotPoint
  forearmL: MascotPoint
  forearmR: MascotPoint
  legL: MascotPoint
  legR: MascotPoint
  tail: MascotPoint
  eyeY: number
  laptopVisible: boolean
  laptopY: number
  armsForward: number
}

/** States reference the supplied GIFs; motion is entirely volumetric joint poses.
 * Reading means the companion quietly dozes while the user reads.
 * With motion disabled, every state has a fixed, meaningful pose.
 */
export function sampleLiukanshanPose(state: LiukanshanState, seconds: number, animated: boolean): LiukanshanPose {
  const time = animated ? seconds : 0
  const pose: LiukanshanPose = {
    rootY: 0, bodyY: animated ? Math.sin(time * 1.3) * .0025 : 0,
    body: [0, animated ? Math.sin(time * .36) * .014 : 0, 0],
    armL: [0, 0, 0], armR: [0, 0, 0], forearmL: [0, 0, 0], forearmR: [0, 0, 0],
    legL: [0, 0, 0], legR: [0, 0, 0], tail: [0, animated ? Math.sin(time * .8) * .05 : 0, 0],
    eyeY: 1, laptopVisible: false, laptopY: 0, armsForward: 0,
  }
  if (animated) {
    const blink = (time + 1.65) % 5.2
    pose.eyeY = blink < .18 ? .08 + .92 * Math.abs(blink - .09) / .09 : 1
  }
  if (state === 'greeting') {
    pose.body = [0, -.06, -.025]
    pose.armL = [-.18, .12, 2.18]
    pose.forearmL = [0, animated ? Math.sin(time * 5) * .14 : 0, animated ? -.18 + Math.sin(time * 5) * .28 : -.18]
  } else if (state === 'searching') {
    pose.rootY = -.095
    pose.body = [.08, 0, 0]
    pose.bodyY = animated ? Math.sin(time * 1.2) * .0015 : 0
    const typing = animated ? Math.sin(time * 6.4) * .075 : 0
    pose.armL = [-.75, -.06, -.70]
    pose.armR = [-.75, .06, .70]
    pose.forearmL = [-.85 + typing, -.10, 0]
    pose.forearmR = [-.85 - typing, .10, 0]
    pose.legL = [-1.02, 0, -.055]
    pose.legR = [-1.02, 0, .055]
    pose.laptopVisible = true
    pose.laptopY = .095
    pose.armsForward = .075
  } else if (state === 'reading') {
    pose.body = [.105 + (animated ? Math.sin(time * .72) * .026 : 0), -.025, .02]
    pose.bodyY = animated ? Math.sin(time * .9) * .002 : 0
    pose.armL = [.04, 0, .03]
    pose.armR = [.04, 0, -.03]
    pose.eyeY = .12
    pose.tail = [0, 0, 0]
  } else if (state === 'collected') {
    const nod = animated && time < 1.8 ? Math.sin(time / 1.8 * Math.PI * 4) * Math.sin(time / 1.8 * Math.PI) : 0
    pose.body = [.025 + nod * .16, 0, 0]
    pose.armL = [-.04, 0, .04]
    pose.armR = [-.04, 0, -.04]
  }
  return pose
}
