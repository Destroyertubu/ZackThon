import assert from 'node:assert/strict'
import test from 'node:test'
import type { BufferGeometry } from 'three'
import { CLOUD_ISLANDS, cloudfallArchGeometry, cloudfallWaterGeometry, floatingIslandGeometry, hangingRootsGeometry } from './cloudfallGeometry'
import { advanceAtmosphere, createTideSignal, triggerTide } from './atmosphereMotion'

function assertRenderable(geometry: BufferGeometry) {
  try {
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      assert.ok(Array.from(attribute.array).every(Number.isFinite), `${name} contains non-finite values`)
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    assert.ok(Number.isFinite(geometry.boundingSphere!.radius) && geometry.boundingSphere!.radius > 0)
    assert.ok(!geometry.boundingBox!.isEmpty())
    if (geometry.index) assert.ok(Array.from(geometry.index.array).every(index => index < geometry.attributes.position.count))
  } finally { geometry.dispose() }
}

test('all floating cliffs, roots, curved waterfalls and sky arch remain renderable at their poles and equator', () => {
  for (const island of CLOUD_ISLANDS) {
    const body = floatingIslandGeometry(island)
    body.computeBoundingBox()
    assert.ok(body.boundingBox!.min.y < -island.drop * .9, 'hanging rock must have real depth')
    assert.ok(body.boundingBox!.max.y > 2, 'planted shoulder must have volume')
    assertRenderable(body); assertRenderable(hangingRootsGeometry(island))
    for (const channel of [0, 1]) assertRenderable(cloudfallWaterGeometry(island, channel))
  }
  assertRenderable(cloudfallArchGeometry())
})

test('tide response can retrigger, decays after interaction and does not jump after a hidden tab', () => {
  const signal = createTideSignal()
  triggerTide(signal, { id: 1, origin: [2, -4], color: '#d888aa' })
  advanceAtmosphere(signal, 600, false)
  assert.equal(signal.time.value, .05)
  assert.deepEqual(signal.origin.value.toArray(), [2, -4])
  for (let i = 0; i < 240; i++) advanceAtmosphere(signal, 1 / 30, false)
  assert.ok(signal.pulse.value < .025)
  triggerTide(signal, { id: 2, origin: [-3, 1], color: '#89cdba' })
  assert.equal(signal.age.value, 0); assert.equal(signal.pulse.value, 1)
  assert.deepEqual(signal.origin.value.toArray(), [-3, 1])
  const previousTime = signal.time.value
  advanceAtmosphere(signal, 1, true)
  assert.equal(signal.time.value, previousTime); assert.equal(signal.pulse.value, 0)
})
