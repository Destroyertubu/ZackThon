import assert from 'node:assert/strict'
import { build } from 'esbuild'

// Exercise pure navigation and actual architectural meshes without a DOM or WebGL context.
const result = await build({
  stdin: {
    contents: "export * from './src/components/home/player/navigation'; export * from './src/components/home/player/config'; export * from './src/components/scene/roomEnvelope'; export { Vector3, Group, Mesh, BoxGeometry, MeshBasicMaterial, Raycaster, DoubleSide } from 'three';",
    resolveDir: process.cwd(),
  },
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const {
  canStandAt, moveOnFloor, nearestInteraction, cameraSafeDistance,
  HOME_INTERACTIONS, HOME_SPAWN, PLAYER_RADIUS, homeCameraTuning,
  Vector3, Group, Mesh, BoxGeometry, MeshBasicMaterial, Raycaster, DoubleSide,
  ROOM, BALCONY, BALCONY_PORTAL, WALL_PANELS, CLOSED_DOOR, WINDOW_GLAZING,
  BALCONY_PORTAL_FRAME, BALCONY_RAILS, createGableGeometry, createRoofGeometry, ROOF_ANGLE,
  isCameraInsideRoom, isCameraInsideHome, clampToHome, followHomeTarget, constrainHomeCamera,
} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const epsilon = 1e-6
const roomBackInner = -ROOM.halfDepth + ROOM.wall / 2
const roomBackOuter = -ROOM.halfDepth - ROOM.wall / 2
const railInnerX = BALCONY.railX - BALCONY.railThickness / 2
const railInnerZ = BALCONY.railZ + BALCONY.railThickness / 2

assert.ok(canStandAt(HOME_SPAWN[0], HOME_SPAWN[2]), 'spawn must be on free floor')
assert.equal(canStandAt(0, 0), false, 'table is solid')
assert.equal(canStandAt(4.75, -0.7), false, 'phone booth is solid')
assert.equal(canStandAt(-4.2, 1.7), false, 'desk is solid')
const fast = new Vector3(0, 0, 3)
moveOnFloor(fast, 0, -20)
assert.ok(fast.z >= 2.03 && fast.z < 2.11, 'large movement must stop before the table, never tunnel through')
const boundary = new Vector3(...HOME_SPAWN)
moveOnFloor(boundary, 0, 20)
assert.ok(boundary.z <= 4.55, 'the closed front entrance must still keep the player inside')
const diagonal = new Vector3(1.8, 0, 2.8)
moveOnFloor(diagonal, -1.8, -2)
assert.ok(canStandAt(diagonal.x, diagonal.z), 'sliding must end outside furniture')

// The central opening must allow ordinary movement in both directions at the same floor height.
for (const x of [-0.65, 0, 0.65]) {
  const player = new Vector3(x, HOME_SPAWN[1], -4.2)
  assert.ok(canStandAt(player.x, player.z), `doorway approach ${x} must be free`)
  moveOnFloor(player, 0, -3)
  assert.ok(Math.abs(player.z + 7.2) < epsilon, `player must walk onto the balcony at x=${x}`)
  moveOnFloor(player, 0, 3)
  assert.ok(Math.abs(player.z + 4.2) < epsilon, `player must return through the same opening at x=${x}`)
  assert.equal(player.y, HOME_SPAWN[1], 'the balcony threshold must not change floor height')
}
// Large deltas cannot jump through either side window or a door post, from either side.
for (const x of [-1.5, -1.11, 1.11, 1.5]) {
  const inside = new Vector3(x, 0, -4.2)
  assert.ok(canStandAt(inside.x, inside.z), `window test needs a clear indoor approach at ${x}`)
  moveOnFloor(inside, 0, -20)
  assert.ok(inside.z >= roomBackInner + PLAYER_RADIUS - epsilon, `player crossed a window/post from inside at x=${x}`)
  const outside = new Vector3(x, 0, -5.7)
  assert.ok(canStandAt(outside.x, outside.z), `window test needs a clear balcony approach at ${x}`)
  moveOnFloor(outside, 0, 20)
  assert.ok(outside.z <= roomBackOuter - PLAYER_RADIUS + epsilon, `player crossed a window/post from outside at x=${x}`)
}
const towardRail = new Vector3(0, 0, -4.2)
moveOnFloor(towardRail, 0, -30)
assert.ok(towardRail.z >= railInnerZ + PLAYER_RADIUS - epsilon && towardRail.z < -8,
  'a large step must reach the balcony rail and stop before it')
for (const direction of [-1, 1]) {
  const player = new Vector3(0, 0, -7.8)
  moveOnFloor(player, direction * 30, -30)
  assert.ok(canStandAt(player.x, player.z), 'diagonal movement must finish on walkable deck')
  assert.ok(Math.abs(player.x) <= railInnerX - PLAYER_RADIUS + epsilon && player.z >= railInnerZ + PLAYER_RADIUS - epsilon,
    'large diagonal movement must not pass the side or end rail')
}
for (const [x, z] of [[0, -8.5], [3.15, -7], [-3.15, -7], [0, -10], [4, -6], [-4, -6], [1.11, -5], [-1.11, -5]]) {
  assert.equal(canStandAt(x, z), false, `player must not stand in a railing/post or off the deck at ${x},${z}`)
}

// Flood-fill the connected floor and replay the retained paths with real movement in BOTH directions.
const step = 0.14
const floorKey = (x, z) => `${Math.round((x - HOME_SPAWN[0]) / step)},${Math.round((z - HOME_SPAWN[2]) / step)}`
const spawnKey = floorKey(HOME_SPAWN[0], HOME_SPAWN[2])
const queue = [{ x: HOME_SPAWN[0], z: HOME_SPAWN[2], key: spawnKey, parent: null }]
const cells = new Map([[spawnKey, queue[0]]]), reached = new Set()
for (let i = 0; i < queue.length; i++) {
  const cell = queue[i], spot = nearestInteraction(new Vector3(cell.x, 0, cell.z))
  if (spot) reached.add(spot.id)
  for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
    const x = cell.x + dx, z = cell.z + dz, key = floorKey(x, z)
    if (cells.has(key) || !canStandAt(x, z)) continue
    const next = { x, z, key, parent: cell.key }
    cells.set(key, next); queue.push(next)
  }
}
for (const spot of HOME_INTERACTIONS) assert.ok(reached.has(spot.id), `${spot.label} must remain reachable from spawn`)
const balconyRoutes = []
for (const [x, z] of [[0, -7.2], [-1.6, -7.2], [1.6, -7.2]]) {
  const destination = queue.find((cell) => Math.hypot(cell.x - x, cell.z - z) < step)
  assert.ok(destination, `balcony viewpoint ${x},${z} must connect to the indoor floor`)
  const path = []
  for (let cell = destination; cell; cell = cell.parent === null ? null : cells.get(cell.parent)) path.unshift(cell)
  const player = new Vector3(...HOME_SPAWN)
  for (const cell of [...path, ...path.slice().reverse()]) {
    moveOnFloor(player, cell.x - player.x, cell.z - player.z)
    assert.ok(Math.hypot(player.x - cell.x, player.z - cell.z) < epsilon,
      `real movement must follow the round-trip path at ${cell.x},${cell.z}`)
  }
  assert.ok(player.distanceTo(new Vector3(...HOME_SPAWN)) < epsilon, 'balcony round trip must return to spawn')
  balconyRoutes.push(path)
}
console.log(`Home movement passed: ${cells.size} connected floor samples, all ${reached.size} interactions, three balcony round trips, windows/posts and high-speed railing collision.`)

// Actual shell geometry: transparent glass blocks cameras but permits exterior sightlines.
const material = new MeshBasicMaterial({ side: DoubleSide })
function makeShell({ glass = false, rails = false } = {}) {
  const shell = new Group()
  const panels = [...WALL_PANELS, CLOSED_DOOR, ...BALCONY_PORTAL_FRAME,
    { size: [12, 0.08, 10], position: [0, -0.04, 0] },
    { size: [BALCONY.halfWidth * 2, 0.14, BALCONY.nearZ - BALCONY.farZ], position: [0, -0.07, (BALCONY.nearZ + BALCONY.farZ) / 2] },
    ...(glass ? WINDOW_GLAZING : []), ...(rails ? BALCONY_RAILS : [])]
  panels.forEach((panel, index) => {
    const mesh = new Mesh(new BoxGeometry(...panel.size), material)
    mesh.name = `panel ${index}`; mesh.position.set(...panel.position); shell.add(mesh)
  })
  for (const side of [-1, 1]) {
    const roof = new Mesh(createRoofGeometry(), material)
    roof.name = `roof ${side}`; roof.position.set(0, 3.95, side * 2.5); roof.rotation.x = side * ROOF_ANGLE; shell.add(roof)
  }
  for (const x of [-6.125, 5.875]) {
    const gable = new Mesh(createGableGeometry(), material)
    gable.name = `gable ${x}`; gable.position.set(x, 0, 0); gable.rotation.y = Math.PI / 2; shell.add(gable)
  }
  shell.updateMatrixWorld(true)
  return shell
}
const opaqueShell = makeShell(), cameraShell = makeShell({ glass: true, rails: true })
const ray = new Raycaster()
function clearSegment(from, to, label) {
  const delta = to.clone().sub(from), length = delta.length()
  if (length < epsilon) return
  ray.set(from, delta.divideScalar(length)); ray.near = 1e-5; ray.far = length - 1e-5
  const hits = ray.intersectObjects(cameraShell.children)
  assert.equal(hits.length, 0, `${label} crosses physical ${hits[0]?.object.name}: ${from.toArray()} -> ${to.toArray()}`)
}
// Independent physical bounds mean weakening the production predicate cannot make the tests pass.
function cameraPositionIsSafe(p, label) {
  assert.ok(isCameraInsideHome(p), `${label} is outside camera navigation regions: ${p.toArray()}`)
  assert.ok(p.y > 0 && p.x > -5.875 && p.x < 5.875 && p.z < 4.875, `${label} escaped a side/front wall or floor`)
  if (p.z >= -4.85) assert.ok(p.y < 4.7 - 0.3 * Math.abs(p.z), `${label} escaped the pitched roof`)
  else if (p.z > -5.15) {
    assert.ok(Math.abs(p.x) < BALCONY_PORTAL.halfWidth && p.y < BALCONY_PORTAL.height,
      `${label} is inside a back wall/window/post instead of the central doorway`)
  } else assert.ok(Math.abs(p.x) < railInnerX && p.z > railInnerZ, `${label} escaped the balcony perimeter`)
}
function safeBoom(origin, direction, requested, label) {
  const desired = origin.clone().addScaledVector(direction, requested), safe = cameraSafeDistance(origin, desired)
  assert.ok(Number.isFinite(safe) && safe >= 0 && safe <= requested + epsilon, `${label} returned an invalid distance`)
  const actual = origin.clone().addScaledVector(direction, safe)
  cameraPositionIsSafe(actual, label); clearSegment(origin, actual, label)
  for (const part of [0.25, 0.5, 0.75]) {
    assert.ok(isCameraInsideHome(origin.clone().lerp(actual, part)), `${label} cuts across disconnected regions`)
  }
  return actual
}

const target = new Vector3(3.4, 1.05, 2.8), desired = new Vector3(3.4, 1.8, 5.8)
const closedDoorCamera = target.clone().addScaledVector(desired.clone().sub(target).normalize(), cameraSafeDistance(target, desired))
assert.ok(closedDoorCamera.z <= 4.65, 'camera must stay inside at the closed front entrance')
assert.ok(cameraSafeDistance(new Vector3(5.3, 1.1, 2.8), new Vector3(9, 1.8, 2.8)) < 0.6, 'camera retracts before side wall')
assert.ok(cameraSafeDistance(new Vector3(3, 1.1, -3), new Vector3(4.3, 1.8, -5)) < 2, 'camera retracts before cabinet')
assert.equal(isCameraInsideRoom(new Vector3(0, 1.5, -7)), false, 'the original room predicate must retain its indoor meaning')
for (const x of [-0.5, 0, 0.5]) {
  const actual = safeBoom(new Vector3(x, 1.5, -4.3), new Vector3(0, 0, -1), 2, `doorway crossing ${x}`)
  assert.ok(Math.abs(actual.z + 6.3) < epsilon, 'a boom through the central opening must reach the balcony')
}
for (const x of [-1.5, 1.5]) {
  const a = safeBoom(new Vector3(x, 1.5, -4.2), new Vector3(0, 0, -1), 3, `window inside ${x}`)
  const b = safeBoom(new Vector3(x, 1.5, -5.8), new Vector3(0, 0, 1), 3, `window outside ${x}`)
  assert.ok(a.z > roomBackInner && b.z < roomBackOuter, 'transparent windows must block cameras from both sides')
}
let poses = 0
function sweepCamera(x, z, label) {
  if (!canStandAt(x, z)) return
  const origin = clampToHome(new Vector3(x, 1.065, z))
  cameraPositionIsSafe(origin, `${label} target`)
  for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 24) for (const pitch of [-0.06, 0.24, 0.48, 1.2]) {
    const direction = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    safeBoom(origin, direction, 4.2, `${label} (${x},${z}), yaw ${yaw}, pitch ${pitch}`); poses++
  }
}
for (let x = -5.5; x <= 5.5; x += 1) for (let z = -8.1; z <= 4.5; z += 0.7) sweepCamera(x, z, 'floor sweep')
for (const x of [-2.5, -1.5, -0.74, -0.5, 0, 0.5, 0.74, 1.5, 2.5]) {
  for (const z of [-5.65, -5.4, -5.2, -5, -4.8, -4.6, -4.4]) sweepCamera(x, z, 'door corner sweep')
}

// Legal endpoints on opposite sides of a window are insufficient: the movement segment must be clear.
for (const [from, to, crossesDoor] of [
  [[1.5, 1.5, -4.2], [1.5, 1.5, -6.2], false],
  [[-1.5, 1.5, -6.2], [-1.5, 1.5, -4.2], false],
  [[2.3, 1.5, -4.2], [0.6, 1.5, -6.2], false],
  [[0.2, 1.5, -4.3], [0.2, 1.5, -6.2], true],
  [[-0.4, 1.5, -6.2], [0.4, 1.5, -4.3], true],
]) {
  const previous = new Vector3(...from), wanted = new Vector3(...to)
  const actual = constrainHomeCamera(previous.clone(), wanted.clone())
  cameraPositionIsSafe(actual, 'continuous camera move'); clearSegment(previous, actual, 'continuous camera move')
  if (crossesDoor) assert.ok(actual.distanceTo(wanted) < epsilon, 'continuous camera must cross the actual open doorway')
  else assert.ok(actual.distanceTo(wanted) > 0.5, 'continuous camera must not teleport through a side window/back wall')
}

// Follow real round trips at two frame rates, including abrupt view changes while shoulder tracking lags.
const tuning = homeCameraTuning()
let followFrames = 0
for (const path of balconyRoutes) for (const dt of [1 / 60, 0.05]) {
  const roundTrip = [...path, ...path.slice().reverse()], track = []
  const speed = dt < 0.02 ? 1.8 : 3.1
  for (let i = 1; i < roundTrip.length; i++) {
    const previous = roundTrip[i - 1], next = roundTrip[i]
    const ticks = Math.max(1, Math.ceil(Math.hypot(next.x - previous.x, next.z - previous.z) / (speed * dt)))
    for (let tick = 1; tick <= ticks; tick++) {
      track.push({ x: previous.x + (next.x - previous.x) * tick / ticks, z: previous.z + (next.z - previous.z) * tick / ticks })
    }
  }
  let smoothedTarget = clampToHome(new Vector3(...HOME_SPAWN).add(new Vector3(0, tuning.targetHeight, 0)))
  let previousCamera = smoothedTarget.clone(), distance = tuning.distance
  for (let i = 0; i < track.length; i++) {
    const cell = track[i], shoulder = new Vector3(cell.x, HOME_SPAWN[1] + tuning.targetHeight, cell.z)
    const previousTarget = smoothedTarget.clone()
    smoothedTarget = followHomeTarget(smoothedTarget, shoulder, 1 - Math.exp(-tuning.followSpeed * dt))
    cameraPositionIsSafe(smoothedTarget, 'smoothed shoulder target'); clearSegment(previousTarget, smoothedTarget, 'smoothed shoulder target')
    const yaw = Math.sin(i * 0.19) * Math.PI + (i % 29 > 14 ? Math.PI : 0)
    const pitch = [-0.06, 0.24, 0.48][Math.floor(i / 17) % 3]
    const direction = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    const wanted = safeBoom(smoothedTarget, direction, 4.2, 'walking camera boom'), safe = wanted.distanceTo(smoothedTarget)
    distance = safe < distance ? safe : distance + (safe - distance) * (1 - Math.exp(-8 * dt))
    const desired = smoothedTarget.clone().addScaledVector(direction, distance)
    const actual = constrainHomeCamera(previousCamera.clone(), desired, smoothedTarget, dt * 8)
    cameraPositionIsSafe(actual, 'walking camera'); clearSegment(previousCamera, actual, 'walking camera frame')
    clearSegment(smoothedTarget, actual, 'walking camera sightline')
    previousCamera = actual.clone(); followFrames++
  }
}

// Regression for the non-convex corner: running out and immediately turning right used to
// leave the camera trapped indoors, looking at its player through the fixed side pane.
let cornerFrames = 0
const cornerPlayer = new Vector3(1.8, HOME_SPAWN[1], -3.4)
const cornerTarget = new Vector3(1.8, HOME_SPAWN[1] + tuning.targetHeight, -3.4)
let cornerCamera = new Vector3(1.8, 1.85, -0.3), cornerDistance = 3.2
for (const [x, z] of [[0, -4.1], [0, -6], [1.6, -7.15], [1.6, -6.15], [0, -5.65], [0, -4.2], [1.8, -3.4]]) {
  let waypointFrames = 0
  while (Math.hypot(cornerPlayer.x - x, cornerPlayer.z - z) >= 0.03) {
    assert.ok(++waypointFrames < 300, `running path must reach ${x},${z} without becoming stuck`)
    const dt = 1 / 60, dx = x - cornerPlayer.x, dz = z - cornerPlayer.z
    const advance = Math.min(3.1 * dt / Math.hypot(dx, dz), 1)
    moveOnFloor(cornerPlayer, dx * advance, dz * advance)
    followHomeTarget(cornerTarget, cornerPlayer.clone().add(new Vector3(0, tuning.targetHeight, 0)), 1 - Math.exp(-12 * dt))
    const yaw = 0.7 * Math.sin(cornerFrames * 0.01), pitch = 0.24
    const direction = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
    const wanted = safeBoom(cornerTarget, direction, 3.2, 'running door-corner boom'), safe = wanted.distanceTo(cornerTarget)
    cornerDistance = safe < cornerDistance ? safe : cornerDistance + (safe - cornerDistance) * (1 - Math.exp(-8 * dt))
    const actual = constrainHomeCamera(cornerCamera.clone(), cornerTarget.clone().addScaledVector(direction, cornerDistance), cornerTarget, dt * 8)
    cameraPositionIsSafe(actual, 'running door-corner camera')
    clearSegment(cornerCamera, actual, 'running door-corner camera frame')
    clearSegment(cornerTarget, actual, 'running door-corner sightline')
    for (const part of [0.25, 0.5, 0.75]) {
      assert.ok(isCameraInsideHome(cornerTarget.clone().lerp(actual, part)), 'running camera must keep its entire boom in connected space')
    }
    assert.ok(cornerTarget.distanceTo(cornerPlayer.clone().add(new Vector3(0, tuning.targetHeight, 0))) < 1,
      'door-corner recovery must keep following the player instead of freezing a safe camera and target')
    cornerCamera = actual.clone(); cornerFrames++
  }
}
console.log(`Home camera passed: ${poses} orbit poses, ${followFrames} continuous follow frames, ${cornerFrames} running door-corner frames, glass/post collisions and bidirectional doorway crossings; physical wall/roof/rail segments checked.`)

// Only the intended rear opening and side windows expose the outdoors; the other walls and roof remain enclosed.
function allowedAperture(p) {
  if (!(p.y > 0 && p.y < BALCONY_PORTAL.height)) return false
  if (Math.abs(p.x) < BALCONY_PORTAL.halfWidth) return true
  return Math.abs(p.x) < 2.6 && p.y > 0.9
}
function exitsThroughRearOpening(origin, direction) {
  if (direction.z >= 0) return false
  return [roomBackInner, roomBackOuter].every((z) => {
    const t = (z - origin.z) / direction.z
    return t > 0 && allowedAperture(origin.clone().addScaledVector(direction, t))
  })
}
ray.near = 0; ray.far = Infinity
for (const x of [-1.8, 0, 1.8]) {
  const origin = new Vector3(0, 1.6, -3), direction = new Vector3(x, 1.6, -5).sub(origin).normalize()
  ray.set(origin, direction)
  assert.equal(ray.intersectObjects(opaqueShell.children).length, 0, `scenery must be visible through the ${x === 0 ? 'doorway' : 'side window'}`)
}
let shellRays = 0, visibleRays = 0
for (const point of [[0, 1.5, 0], [-4, 1.1, 3], [4, 1.1, -3], [0, 3.6, 0]]) {
  const origin = new Vector3(...point)
  for (let i = 0; i < 2000; i++) {
    const y = 1 - 2 * (i + 0.5) / 2000, radius = Math.sqrt(1 - y * y), angle = i * Math.PI * (3 - Math.sqrt(5))
    const direction = new Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    ray.set(origin, direction)
    if (ray.intersectObjects(opaqueShell.children).length === 0) {
      assert.ok(exitsThroughRearOpening(origin, direction), `unintended shell opening from ${point}, sample ${i}`)
      visibleRays++
    }
    shellRays++
  }
}
assert.ok(visibleRays > 30, 'transparent windows/open doorway must expose a meaningful exterior view')
console.log(`Architecture passed: ${shellRays} sightlines checked; ${visibleRays} leave through the intended rear openings, all others are blocked by the actual walls, closed front door, floor or pitched roof.`)
