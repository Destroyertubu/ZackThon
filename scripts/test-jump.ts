import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Vector3 } from 'three'
import { createJumpMotion, resetJump, startJump, stepJump, JUMP_SPEED, JUMP_GRAVITY } from '../src/components/scene/controls/jumpMotion'
import { moveFirstPersonOnFloor, canStandAt } from '../src/components/home/player/navigation'
import { HOME_SPAWN, homeCameraTuning } from '../src/components/home/player/config'
import { isCameraInsideHome } from '../src/components/scene/roomEnvelope'
import { canStandOnObservatory, moveOnObservatory } from '../src/components/observatory/layout'
import { groundHeight, safePose, EYE_HEIGHT } from '../src/features/journeys/scene/navigation'
import { LAND_DEFINITION, REALM_DEFINITIONS } from '../src/features/journeys/realmDefinitions'

test('short jump follows the same arc at 20, 30, 60 and 144 FPS and permits another takeoff only after landing', () => {
  for (const fps of [20, 30, 60, 144]) {
    const motion = createJumpMotion(3.2)
    assert.equal(startJump(motion), true)
    let max = 0, time = 0
    while (!motion.grounded) {
      assert.equal(startJump(motion), false, 'airborne input cannot reset velocity')
      time += 1 / fps
      const y = stepJump(motion, 3.2, 1 / fps)
      max = Math.max(max, y - 3.2)
      assert.ok(y >= 3.2 && time < 1)
      if (!motion.grounded) assert.ok(Math.abs(y - 3.2 - (JUMP_SPEED * time - .5 * JUMP_GRAVITY * time * time)) < 1e-8)
    }
    assert.ok(max > .63 && max < .65)
    assert.ok(Math.abs(time - 2 * JUMP_SPEED / JUMP_GRAVITY) <= 1 / fps)
    for (let i = 0; i < fps; i++) assert.equal(stepJump(motion, 3.2, 1 / fps), 3.2, 'landing never auto-repeats')
    assert.equal(startJump(motion), true)
  }
})

test('slope changes preserve airborne world height, frame spikes are bounded, and reset lands safely', () => {
  const flat = createJumpMotion(), hill = createJumpMotion()
  startJump(flat); startJump(hill)
  for (let i = 0; i < 20; i++) {
    assert.ok(Math.abs(stepJump(flat, 0, .01) - stepJump(hill, i * .008, .01)) < 1e-8)
  }
  const before = { ...hill }
  assert.equal(stepJump(hill, hill.ground, Number.NaN), hill.ground + before.height)
  assert.equal(hill.velocity, before.velocity)
  const normal = { ...hill }
  assert.equal(stepJump(hill, hill.ground, 15), stepJump(normal, normal.ground, .05))
  resetJump(hill, 2)
  assert.deepEqual(hill, createJumpMotion(2))
})

test('jumping through the balcony opening keeps the first-person eye attached and below the lintel', () => {
  const p = new Vector3(0, HOME_SPAWN[1], -4.2), eye = new Vector3(), tuning = homeCameraTuning()
  const motion = createJumpMotion(HOME_SPAWN[1])
  for (const destination of [-6.8, -4.2]) {
    let frames = 0
    while (Math.abs(p.z - destination) > .035) {
      assert.ok(++frames < 200, 'the doorway must not strand the player')
      if (frames % 40 === 1) startJump(motion)
      p.y = stepJump(motion, HOME_SPAWN[1], 1 / 60)
      moveFirstPersonOnFloor(p, eye, 0, Math.sign(destination - p.z) * Math.min(Math.abs(destination - p.z), 3.1 / 60), tuning.eyeHeight)
      assert.ok(canStandAt(p.x, p.z))
      assert.ok(isCameraInsideHome(eye))
      assert.ok(Math.abs(eye.y - p.y - tuning.eyeHeight) < 1e-8)
    }
  }
})

test('jumping cannot escape observatory borders and all journey return poses land on their surfaces', () => {
  const p = new Vector3(9, 1.7, 0), motion = createJumpMotion()
  for (let i = 0; i < 240; i++) {
    if (i % 40 === 0) startJump(motion)
    p.y = 1.7 + stepJump(motion, 0, 1 / 60)
    moveOnObservatory(p, .1, 0)
    assert.ok(canStandOnObservatory(p.x, p.z))
  }
  for (const world of [LAND_DEFINITION, ...REALM_DEFINITIONS]) {
    const airborne = { ...world.spawn, position: [...world.spawn.position] as [number, number, number] }
    airborne.position[1] += .6
    const restored = safePose(world, airborne)
    assert.equal(restored.position[1], groundHeight(world, restored.position[0], restored.position[2])! + EYE_HEIGHT)
  }
})
