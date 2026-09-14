import assert from 'node:assert/strict'
import { GARDEN_PERIMETER_BEDS, GARDEN_PERIMETER_COLUMNS, GARDEN_PERIMETER_OBSTACLES, perimeterPoint } from '../src/components/observatory/gardenPerimeterLayout'

const clear = (x: number, z: number, margin = 0) => GARDEN_PERIMETER_OBSTACLES.every(o => Math.hypot(x - o.x, z - o.z) >= o.radius + margin)
let checks = 0
// Collision coverage is sampled from physical wall dimensions, rather than from the proxy centres.
for (const arc of GARDEN_PERIMETER_BEDS) for (let angle = arc.start; angle <= arc.end; angle += .015) {
  for (const radius of [arc.inner, arc.inner + .15, (arc.inner + arc.outer) / 2, Math.min(11.19, arc.outer)]) {
    const [x, , z] = perimeterPoint(angle, radius)
    assert.equal(clear(x, z), false, `Planter wall must be solid at ${x},${z}`); checks++
  }
}
for (const [x, , z] of GARDEN_PERIMETER_COLUMNS) {
  assert.equal(clear(x, z), false, 'The carved column base must be protected by its bed footprint'); checks++
}
for (const angle of [.13, 1.66, 2.835]) for (let radius = 8.8; radius <= 11.1; radius += .05) {
  const [x, , z] = perimeterPoint(angle, radius)
  assert.ok(clear(x, z, .30), 'Each selected sea-view opening must remain a usable walk-through gap'); checks++
}
const route = [[3.65, 7.15], [1.3, 2.6], [1.5, -2.4], [2.7, -4.5], [5.7, -2.75], [6.5, -1.2]]
for (let i = 1; i < route.length; i++) for (let t = 0; t <= 1; t += .01) {
  const x = route[i - 1][0] * (1 - t) + route[i][0] * t
  const z = route[i - 1][1] * (1 - t) + route[i][1] * t
  assert.ok(clear(x, z, 1.25), 'New scenery must preserve a 2.5 m corridor around the main entrance/gate/telescope route'); checks++
}
console.log(`Garden perimeter passed ${checks} checks: physical walls and columns are solid, three sea openings are walkable, and new scenery leaves the main 2.5 m corridor clear.`)
