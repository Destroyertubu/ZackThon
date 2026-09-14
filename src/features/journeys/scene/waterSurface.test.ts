import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createWaterGeometry, createWaterShoreMap, distanceToWaterShore, sampleWaterSurface } from './waterSurface'
import { WaterReflection } from './waterReflection'
import { getWaterfallLandings } from './waterfallLandings'
import { MIRROR_ISLANDS } from './MirrorGeometry'

test('both wave tiers remain finite and analytical normals match the displaced surface', () => {
  const epsilon = .0001
  for (const count of [4, 6] as const) for (const time of [0, 2.7, 67.1, 3600]) for (const [x, z] of [[0, 0], [4, -12], [-71, 28], [190, -180]]) {
    const sample = sampleWaterSurface(x, z, time, count)
    const dx = sampleWaterSurface(x + epsilon, z, time, count).position.sub(sample.position).divideScalar(epsilon)
    const dz = sampleWaterSurface(x, z + epsilon, time, count).position.sub(sample.position).divideScalar(epsilon)
    const numerical = dz.cross(dx).normalize()
    assert.ok(sample.position.toArray().every(Number.isFinite)); assert.ok(sample.normal.y > .94)
    assert.ok(sample.normal.distanceTo(numerical) < .0001, `${count}-wave normal differs from geometry`)
    assert.ok(Math.abs(sample.position.y) < .5)
  }
  assert.ok(sampleWaterSurface(0, 0, 1).position.distanceTo(sampleWaterSurface(0, 0, 3).position) > .03, 'the origin must no longer be a frozen disc')
})

test('shoreline distance supports elliptical islands and actual polygon edges rather than a world-centre mask', () => {
  const island = { center: [20, -10] as const, radii: [4, 2] as const }
  assert.ok(distanceToWaterShore(20, -10, island) < 0)
  assert.ok(Math.abs(distanceToWaterShore(24, -10, island)) < .0001)
  assert.ok(distanceToWaterShore(28, -10, island) > 3)
  const shore = { points: [[-3, -2], [3, -2], [3, 2], [-3, 2]] as const, closed: true }
  assert.equal(distanceToWaterShore(0, 0, shore), -2)
  assert.equal(distanceToWaterShore(4, 0, shore), 1)
  assert.equal(distanceToWaterShore(0, -2, shore), 0)
  assert.equal(distanceToWaterShore(0, 0, { points: [] }), 64)
})

test('water mesh concentrates density near navigation and all indices and normals remain valid', () => {
  for (const segments of [128, 192]) {
    const geometry = createWaterGeometry(400, segments), position = geometry.attributes.position
    let near = 0
    for (let i = 0; i < position.count; i++) {
      assert.ok(Number.isFinite(position.getX(i)) && Number.isFinite(position.getZ(i)))
      if (Math.abs(position.getX(i)) <= 64.01 && Math.abs(position.getZ(i)) <= 64.01) near++
      assert.ok(geometry.attributes.normal.getY(i) > .99)
    }
    assert.ok(near / position.count > .54)
    assert.ok(Array.from(geometry.index!.array).every(index => index >= 0 && index < position.count))
    assert.equal(geometry.boundingBox!.min.x, -200); assert.equal(geometry.boundingBox!.max.z, 200)
    geometry.dispose()
  }
})

test('cached shoreline texture preserves deep water and shallow transitions', () => {
  const map = createWaterShoreMap([{ center: [0, 0], radii: [3, 3] }], 32, 64)
  const data = map.image.data
  assert.ok(data)
  const centre = Number(data[(32 * 64 + 32) * 4]) / 255 * 64 - 8
  const outside = Number(data[(32 * 64 + 47) * 4]) / 255 * 64 - 8
  assert.ok(centre < -2.4); assert.ok(outside > 4)
  assert.equal(map.generateMipmaps, false); assert.equal(map.minFilter, THREE.LinearFilter)
  map.dispose()
})

function reflectionFixture(hz = 15) {
  const reflection = new WaterReflection(-1, hz, 256, 128), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera()
  camera.position.y = 2
  const water = new THREE.Object3D(), particles = new THREE.Points(); scene.add(water, particles)
  let target: THREE.WebGLRenderTarget | null = null
  const viewport = new THREE.Vector4(1, 2, 600, 300)
  const gl = {
    xr: { enabled: true }, shadowMap: { autoUpdate: true },
    getRenderTarget: () => target, setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { target = value },
    getViewport: (value: THREE.Vector4) => value.copy(viewport), setViewport: (value: THREE.Vector4) => { viewport.copy(value) },
  } as unknown as THREE.WebGLRenderer
  return { reflection, scene, camera, water, particles, gl, viewport }
}

test('reflection failure restores renderer state and exclusions before the main scene resumes', () => {
  const { reflection, scene, camera, water, particles, gl, viewport } = reflectionFixture()
  reflection.reflector.onBeforeRender = () => {
    assert.equal(water.visible, false); assert.equal(particles.visible, false)
    gl.xr.enabled = false; gl.shadowMap.autoUpdate = false; gl.setRenderTarget(reflection.reflector.getRenderTarget())
    gl.setViewport(new THREE.Vector4(0, 0, 256, 128)); throw new Error('render interrupted')
  }
  assert.throws(() => reflection.capture(gl, scene, camera, water), /interrupted/)
  assert.equal(gl.getRenderTarget(), null); assert.equal(gl.xr.enabled, true); assert.equal(gl.shadowMap.autoUpdate, true)
  assert.equal(water.visible, true); assert.equal(particles.visible, true); assert.deepEqual(viewport.toArray(), [1, 2, 600, 300])
  reflection.dispose()
})

test('reflection cadence is bounded and all owned GPU resources dispose exactly once', () => {
  for (const hz of [15, 30]) {
    const { reflection, scene, camera, water, gl } = reflectionFixture(hz)
    let captures = 0, targetDisposals = 0, geometryDisposals = 0, materialDisposals = 0
    reflection.reflector.onBeforeRender = () => { captures++ }
    for (let frame = 0; frame < 60; frame++) { reflection.advance(1 / 60); reflection.capture(gl, scene, camera, water) }
    assert.ok(captures >= hz - 1 && captures <= hz + 1, `${captures} captures at ${hz} Hz`)
    reflection.reflector.getRenderTarget().addEventListener('dispose', () => { targetDisposals++ })
    reflection.reflector.geometry.addEventListener('dispose', () => { geometryDisposals++ })
    ;(reflection.reflector.material as THREE.ShaderMaterial).addEventListener('dispose', () => { materialDisposals++ })
    reflection.dispose(); reflection.dispose(); reflection.advance(1); reflection.capture(gl, scene, camera, water)
    assert.equal(targetDisposals, 1); assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1)
    assert.equal(reflection.ready.value, 0)
  }
})

test('only explicitly opted-in island particles enter the water reflection', () => {
  const { reflection, scene, camera, water, particles, gl } = reflectionFixture()
  const island = new THREE.Points(); island.userData.reflectInWater = true; scene.add(island)
  reflection.reflector.onBeforeRender = () => {
    assert.equal(island.visible, true)
    assert.equal(particles.visible, false)
  }
  reflection.capture(gl, scene, camera, water)
  assert.equal(island.visible, true); assert.equal(particles.visible, true)
  reflection.dispose(); island.geometry.dispose(); (island.material as THREE.Material).dispose()
})

test('reflection budget requires sustained load, degrades in order and never oscillates within a scene', () => {
  const { reflection, scene, camera, water, gl } = reflectionFixture(30)
  reflection.reflector.onBeforeRender = () => undefined
  for (let frame = 0; frame < 600; frame++) { reflection.advance(1 / 60); reflection.capture(gl, scene, camera, water) }
  assert.equal(reflection.budgetStage, 0)
  const stages = new Set<number>([0])
  for (let frame = 0; frame < 800; frame++) { reflection.advance(.05); reflection.capture(gl, scene, camera, water); stages.add(reflection.budgetStage) }
  assert.deepEqual([...stages], [0, 1, 2, 3]); assert.equal(reflection.currentHz, 15); assert.equal(reflection.resolutionRatio, .7)
  assert.equal(reflection.reflector.getRenderTarget().width, 179)
  for (let frame = 0; frame < 1200; frame++) { reflection.advance(1 / 60); reflection.capture(gl, scene, camera, water) }
  assert.equal(reflection.budgetStage, 3); assert.equal(reflection.currentHz, 15)
  reflection.dispose()
})

test('waterfall foam is anchored outside the cliff and suspended cloudfalls end in mist', () => {
  const night = getWaterfallLandings(-3), day = getWaterfallLandings(-1.1)
  assert.equal(night.length, 20); assert.equal(night.filter(landing => landing.hitsWater).length, 10)
  assert.ok(day.filter(landing => landing.hitsWater).length > 10)
  assert.ok(night.every(landing => landing.position.every(Number.isFinite) && landing.radius > 0))
  assert.ok(night.filter(landing => !landing.hitsWater).every(landing => landing.position[1] > -3))
  assert.ok(night.filter(landing => landing.hitsWater).every(landing => Math.abs(landing.position[1] + 2.925) < .0001))
  night.slice(0, 10).forEach((landing, index) => {
    const island = MIRROR_ISLANDS[Math.floor(index / 2) * 2]
    assert.ok(distanceToWaterShore(landing.position[0], landing.position[2], { center: [island.x, island.z], radii: [island.width, island.depth] }) > 0, 'landing foam must not be buried inside the cliff')
  })
})

test('looking away from water does not downgrade its reflection budget', () => {
  const { reflection, scene, camera, water, gl } = reflectionFixture(30)
  reflection.reflector.onBeforeRender = () => undefined
  for (let frame = 0; frame < 180; frame++) { reflection.advance(1 / 60); reflection.capture(gl, scene, camera, water) }
  camera.lookAt(0, 20, 0)
  for (let frame = 0; frame < 700; frame++) { reflection.advance(.05); reflection.capture(gl, scene, camera, water) }
  assert.equal(reflection.budgetStage, 0)
  reflection.dispose()
})
