import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/components/observatory/layout.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false,
})
const {
  canStandOnObservatory, moveOnObservatory, OBSERVATORY_SPAWN,
  OBSERVATORY_RADIUS, OBSERVATORY_OBSTACLES, TREE_POSITION, THOUGHT_BAR_POSITION,
  TELESCOPE_POSITION, GALAXY_GATE_POSITION, RETURN_GATE_POSITION, RETURN_GATE_RADIUS,
  canUseReturnGate, canUseGalaxyGate, canUseThoughtBar,
} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const detailResult = await build({
  entryPoints: ['src/components/observatory/gardenDetailLayout.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false,
})
const { READING_CORNER_POSITION, READING_CHAIR_ROTATION } = await import(`data:text/javascript;base64,${Buffer.from(detailResult.outputFiles[0].text).toString('base64')}`)

const epsilon = 1e-7
const [treeX, , treeZ] = TREE_POSITION
const [barX, , barZ] = THOUGHT_BAR_POSITION
const [galaxyX, , galaxyZ] = GALAXY_GATE_POSITION
const [homeX, , homeZ] = RETURN_GATE_POSITION
const [chairX, , chairZ] = READING_CORNER_POSITION
const homeYaw = -0.25
const inWorld = (x, z, centerX, centerZ, yaw = 0) => [centerX + Math.cos(yaw) * x + Math.sin(yaw) * z, centerZ - Math.sin(yaw) * x + Math.cos(yaw) * z]
const interactions = [
  { id: 'home', position: RETURN_GATE_POSITION, radius: RETURN_GATE_RADIUS, canUse: canUseReturnGate },
  { id: 'galaxy', position: GALAXY_GATE_POSITION, radius: 2.55, canUse: canUseGalaxyGate },
  { id: 'workshop', position: THOUGHT_BAR_POSITION, radius: 2.55, canUse: canUseThoughtBar },
]

assert.ok(canStandOnObservatory(OBSERVATORY_SPAWN[0], OBSERVATORY_SPAWN[2]), 'arrival must be on free floor')
for (const obstacle of OBSERVATORY_OBSTACLES) assert.equal(canStandOnObservatory(obstacle.x, obstacle.z), false)
for (const [x, z] of [[NaN, 0], [0, Infinity], [-Infinity, 0], [OBSERVATORY_RADIUS + 0.01, 0]]) {
  assert.equal(canStandOnObservatory(x, z), false, `invalid/off-deck position ${x},${z} must be rejected`)
}

// Dimensions of visible geometry are independent of collision radii, so removing
// an obstacle cannot quietly weaken the coverage of planter, bench and cabinet.
for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 32) {
  assert.equal(canStandOnObservatory(treeX + Math.sin(angle) * 2.13, treeZ + Math.cos(angle) * 2.13), false,
    'the raised tree planter must have no walk-through edge')
}
for (let angle = -0.85; angle <= 0.68; angle += 0.025) for (const radius of [2.36, 2.55, 2.835]) {
  assert.equal(canStandOnObservatory(treeX + Math.sin(angle) * radius, treeZ + Math.cos(angle) * radius), false,
    'all parts of the curved bench must block walking')
}
// Scan-derived chair extents and authored fixture dimensions are deliberately
// separate from layout's conservative collision circles.
const chairModel = JSON.parse(await readFile('public/models/ArmChair_01/ArmChair_01_2k.gltf', 'utf8'))
const chairBounds = chairModel.accessors[chairModel.meshes[0].primitives[0].attributes.POSITION]
const chairScale = 1.1 / (chairBounds.max[1] - chairBounds.min[1])
const chairHalfX = (chairBounds.max[0] - chairBounds.min[0]) * chairScale / 2
const chairHalfZ = (chairBounds.max[2] - chairBounds.min[2]) * chairScale / 2
for (const rectangle of [
  { name: 'solid home door', x: homeX, z: homeZ, yaw: homeYaw, halfX: 0.76, halfZ: 0.35 },
  { name: 'scanned reading chair', x: chairX, z: chairZ, yaw: READING_CHAIR_ROTATION, halfX: chairHalfX, halfZ: chairHalfZ },
]) for (let ix = -4; ix <= 4; ix++) for (let iz = -4; iz <= 4; iz++) {
  const point = inWorld(ix / 4 * rectangle.halfX, iz / 4 * rectangle.halfZ, rectangle.x, rectangle.z, rectangle.yaw)
  assert.equal(canStandOnObservatory(...point), false, `${rectangle.name} physical footprint must be solid at ${point}`)
}
for (const fixture of [
  { name: 'curved operating wing', x: barX + 0.64, z: barZ + 0.88, radius: 0.63 },
  { name: 'upholstered bar stool', x: barX + 1.68, z: barZ + 0.55, radius: 0.25 },
  { name: 'left galaxy foot', x: galaxyX - 2.25, z: galaxyZ, radius: 0.37 },
  { name: 'right galaxy foot', x: galaxyX + 2.25, z: galaxyZ, radius: 0.37 },
]) {
  assert.equal(canStandOnObservatory(fixture.x, fixture.z), false, `${fixture.name} center must be solid`)
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2
    assert.equal(canStandOnObservatory(fixture.x + Math.cos(angle) * fixture.radius, fixture.z + Math.sin(angle) * fixture.radius), false,
      `${fixture.name} must cover its visible rim`)
  }
}
for (let x = barX - 0.43; x <= barX + 0.46; x += 0.1) for (let z = barZ - 1.34; z <= barZ + 1.34; z += 0.1) {
  assert.equal(canStandOnObservatory(x, z), false, 'the solid thought cabinet must have no gaps between footprints')
}
function blockedApproach(start, delta, check, label) {
  assert.ok(canStandOnObservatory(start.x, start.z), `${label} needs a free starting point`)
  const player = { ...start }
  moveOnObservatory(player, ...delta)
  assert.ok(canStandOnObservatory(player.x, player.z), `${label} must finish on free floor`)
  assert.ok(check(player), `${label} tunnelled through its obstacle: ${JSON.stringify(player)}`)
}
blockedApproach({ x: treeX, z: treeZ - 4 }, [0, 30], p => p.z < treeZ - 2.3 && p.z > treeZ - 2.5, 'fast tree-planter approach')
blockedApproach({ x: treeX, z: treeZ + 5 }, [0, -30], p => p.z > treeZ + 2.81 && p.z < treeZ + 3.8, 'fast crescent-bench approach')
blockedApproach({ x: barX + 2.3, z: barZ }, [-30, 0], p => p.x > barX + 0.8 && p.x < barX + 1, 'fast thought-bar approach')
blockedApproach({ x: 0, z: 7 }, [0, 50], p => p.z <= OBSERVATORY_RADIUS && p.z > OBSERVATORY_RADIUS - 0.1, 'fast railing approach')
blockedApproach({ x: homeX, z: homeZ + 1.3 }, [0, -30], p => p.z >= homeZ + 0.85 && p.z < homeZ + 1.1, 'fast front approach to solid home door')
blockedApproach({ x: homeX, z: homeZ - 1.3 }, [0, 30], p => p.z <= homeZ - 0.85 && p.z > homeZ - 1.1, 'fast rear approach to solid home door')
const diagonal = { x: 3, z: 2 }
moveOnObservatory(diagonal, -7, -7)
assert.ok(canStandOnObservatory(diagonal.x, diagonal.z), 'diagonal movement must slide around garden furniture')

for (const interaction of interactions) {
  const [x, , z] = interaction.position
  assert.equal(interaction.canUse(x, z), true, `${interaction.id} center must be active`)
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) for (const [offset, expected] of [[-0.0001, true], [0.0001, false]]) {
    assert.equal(interaction.canUse(x + Math.cos(angle) * (interaction.radius + offset), z + Math.sin(angle) * (interaction.radius + offset)), expected,
      `${interaction.id} interaction radius must be ${interaction.radius}`)
  }
  for (const point of [[NaN, z], [x, Infinity], [-Infinity, z]]) assert.equal(interaction.canUse(...point), false)
  assert.equal(interaction.canUse(OBSERVATORY_SPAWN[0], OBSERVATORY_SPAWN[2]), false, 'arrival should not immediately activate a destination')
}
for (let i = 0; i < interactions.length; i++) for (let j = i + 1; j < interactions.length; j++) {
  const a = interactions[i], b = interactions[j]
  assert.ok(Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]) > a.radius + b.radius,
    `${a.id} and ${b.id} must not compete for E at any location`)
}

// Spawn-anchored flood fill checks actual movement along each edge. Legal endpoints
// alone would miss a blocked segment or a disconnected pocket between furniture.
const step = 0.12, bounds = Math.ceil(2 * OBSERVATORY_RADIUS / step)
const key = (ix, iz) => `${ix},${iz}`
function edgeRoute(from, to) {
  const forward = { x: from.x, z: from.z }, reverse = { x: to.x, z: to.z }
  moveOnObservatory(forward, to.x - from.x, to.z - from.z)
  moveOnObservatory(reverse, from.x - to.x, from.z - to.z)
  if (Math.hypot(forward.x - to.x, forward.z - to.z) < epsilon
    && Math.hypot(reverse.x - from.x, reverse.z - from.z) < epsilon) return [{ x: to.x, z: to.z }]
  // At a curved rail/planter corner, a full grid diagonal can reject a legal
  // approach. Retain small real axis moves, rather than calling the cell isolated.
  for (const order of [['x', 'z'], ['z', 'x']]) {
    const cursor = { x: from.x, z: from.z }, path = []
    let clear = true
    for (let i = 1; i <= 4 && clear; i++) for (const axis of order) {
      const target = from[axis] + (to[axis] - from[axis]) * i / 4
      moveOnObservatory(cursor, axis === 'x' ? target - cursor.x : 0, axis === 'z' ? target - cursor.z : 0)
      if (Math.abs(cursor[axis] - target) > epsilon) { clear = false; break }
      path.push({ ...cursor })
    }
    if (clear) return path
  }
  return null
}
const cells = new Map()
for (let ix = -bounds; ix <= bounds; ix++) for (let iz = -bounds; iz <= bounds; iz++) {
  const p = { x: OBSERVATORY_SPAWN[0] + ix * step, z: OBSERVATORY_SPAWN[2] + iz * step }
  if (canStandOnObservatory(p.x, p.z)) cells.set(key(ix, iz), { ...p, ix, iz, key: key(ix, iz), parent: null, edge: [] })
}
const queue = [cells.get('0,0')], reached = new Map([['0,0', queue[0]]])
for (let i = 0; i < queue.length; i++) {
  const p = queue[i]
  assert.ok(interactions.filter(interaction => interaction.canUse(p.x, p.z)).length <= 1, `ambiguous interaction at ${p.x},${p.z}`)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const id = key(p.ix + dx, p.iz + dz), next = cells.get(id)
    if (reached.has(id) || !next) continue
    const route = edgeRoute(p, next)
    if (!route) continue
    next.parent = p.key; next.edge = route; reached.set(id, next); queue.push(next)
  }
}
const isolated = [...cells.values()].filter(cell => !reached.has(cell.key))
assert.equal(isolated.length, 0, `all standing samples must connect to spawn; isolated examples: ${JSON.stringify(isolated.slice(0, 5))}`)

const viewpoints = [
  ['tree front', treeX, treeZ + 3.5], ['tree rear', treeX, treeZ - 3.5],
  ['tree left', treeX - 3.5, treeZ], ['tree right', treeX + 3.5, treeZ],
  ['galaxy front', galaxyX, galaxyZ + 1.2], ['galaxy rear', galaxyX, galaxyZ - 1.2],
  ['bar front', barX + 1.2, barZ], ['telescope approach', TELESCOPE_POSITION[0] - 1.5, TELESCOPE_POSITION[2] + 0.5],
  ['home front', homeX + Math.sin(homeYaw) * 1.2, homeZ + Math.cos(homeYaw) * 1.2],
  ['home rear', homeX - Math.sin(homeYaw) * 1.2, homeZ - Math.cos(homeYaw) * 1.2],
  ['reading chair approach', chairX + Math.sin(READING_CHAIR_ROTATION), chairZ + Math.cos(READING_CHAIR_ROTATION)],
  ['north rail', 0, -10], ['east rail', 10, 2.5], ['west rail', -10, 0], ['south rail', 0, 10],
]
for (const [label, x, z] of viewpoints) {
  assert.ok(canStandOnObservatory(x, z), `${label} must have room to stand`)
  const destination = queue.find(p => Math.hypot(p.x - x, p.z - z) < step)
  assert.ok(destination, `${label} must be reachable from arrival`)
  const route = []
  for (let cell = destination; cell; cell = cell.parent === null ? null : reached.get(cell.parent)) route.unshift(cell)
  const player = { x: OBSERVATORY_SPAWN[0], z: OBSERVATORY_SPAWN[2] }
  const points = [{ ...player }, ...route.flatMap(cell => cell.edge)]
  for (const cell of [...points, ...points.slice().reverse()]) {
    moveOnObservatory(player, cell.x - player.x, cell.z - player.z)
    assert.ok(Math.hypot(player.x - cell.x, player.z - cell.z) < epsilon, `${label} round trip must follow real movement at ${cell.x},${cell.z}`)
  }
  assert.ok(Math.hypot(player.x - OBSERVATORY_SPAWN[0], player.z - OBSERVATORY_SPAWN[2]) < epsilon, `${label} round trip must return to arrival`)
}

// The galaxy gateway is an open passage; the home destination is a solid door.
for (const [label, x, z, yaw, usable] of [
  ['galaxy', galaxyX, galaxyZ, 0, canUseGalaxyGate],
]) {
  const dx = Math.sin(yaw) * 1.2, dz = Math.cos(yaw) * 1.2
  const player = { x: x + dx, z: z + dz }
  assert.ok(usable(player.x, player.z), `${label} front must be in interaction range`)
  moveOnObservatory(player, -2 * dx, -2 * dz)
  assert.ok(Math.hypot(player.x - (x - dx), player.z - (z - dz)) < epsilon, `${label} opening must permit walking through`)
  assert.ok(usable(player.x, player.z), `${label} rear must be in interaction range`)
  moveOnObservatory(player, 2 * dx, 2 * dz)
  assert.ok(Math.hypot(player.x - (x + dx), player.z - (z + dz)) < epsilon, `${label} opening must permit returning through`)
}
const aroundDoor = Array.from({ length: 41 }, (_, index) => {
  const angle = homeYaw - index / 40 * Math.PI
  return { x: homeX + Math.sin(angle) * 1.3, z: homeZ + Math.cos(angle) * 1.3 }
})
const besideDoor = { ...aroundDoor[0] }
for (const waypoint of [...aroundDoor, ...aroundDoor.slice().reverse()]) {
  assert.ok(canStandOnObservatory(waypoint.x, waypoint.z), 'both door faces must connect around its left side')
  assert.ok(canUseReturnGate(waypoint.x, waypoint.z), 'door front, rear and side must stay in return interaction range')
  moveOnObservatory(besideDoor, waypoint.x - besideDoor.x, waypoint.z - besideDoor.z)
  assert.ok(Math.hypot(besideDoor.x - waypoint.x, besideDoor.z - waypoint.z) < epsilon, 'real movement must be able to circle the solid door and return')
}
// These are also the real-WASD waypoints in the v2 browser regression. Verify
// every intervening short movement, rather than relying on nearHome at the end.
function verifyBrowserRoute(label, waypoints, interaction) {
  const player = { x: OBSERVATORY_SPAWN[0], z: OBSERVATORY_SPAWN[2] }
  for (const [x, z] of waypoints) {
    const from = { ...player }, steps = Math.ceil(Math.hypot(x - from.x, z - from.z) / 0.035)
    for (let i = 1; i <= steps; i++) {
      const next = { x: from.x + (x - from.x) * i / steps, z: from.z + (z - from.z) * i / steps }
      moveOnObservatory(player, next.x - player.x, next.z - player.z)
      assert.ok(Math.hypot(player.x - next.x, player.z - next.z) < epsilon, `${label} WASD route hits furniture at ${next.x},${next.z}`)
    }
  }
  assert.ok(interaction(player.x, player.z), `${label} WASD endpoint must activate the intended nearby E action`)
}
verifyBrowserRoute('bar', [[0.7, 3.5], [-3.2, 2.6], [-4.55, 1.5]], canUseThoughtBar)
verifyBrowserRoute('galaxy', [[0.7, 3.5], [-3.2, 2.6], [-4.55, 1.5], [-3.1, 2.6], [1, 2.6], [1.5, -2.4], [2.7, -4.5]], canUseGalaxyGate)
verifyBrowserRoute('home', [[5.4, 3.4], [5.7, -2.75]], canUseReturnGate)
assert.ok(Math.hypot(5.7 - homeX, -2.75 - homeZ) + 0.22 < RETURN_GATE_RADIUS,
  'home endpoint must tolerate browser walkTo stopping up to 22cm short')
assert.ok(canUseThoughtBar(barX + 1.2, barZ), 'standing at the front of the cabinet must allow mixing')
for (const interaction of interactions) assert.ok(queue.some(p => interaction.canUse(p.x, p.z)), `${interaction.id} must be reachable`)
console.log(`Star-tree navigation passed: ${reached.size}/${cells.size} connected standing samples, ${viewpoints.length} real-movement round trips, three disjoint interactions, open galaxy passage, reachable front/rear and walk-around for solid home door, physical fixture coverage and no high-speed rail tunnelling.`)
