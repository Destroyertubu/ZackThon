import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { build } from 'esbuild'
import { register } from 'tsx/esm/api'

register()
const cameraTools = await import('../src/components/observatory/collectionTreeCamera.ts')
const layout = await import('../src/components/observatory/layout.ts')
const { canUseTidePool } = await import('../src/components/observatory/starTideLayout.ts')
const { beginCollectionTreeView, advanceCollectionTreeView, restoreCollectionTreeView, captureObservatoryPose, COLLECTION_TREE_CAMERA_POSITION } = cameraTools
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, message)

test('reading transitions preserve an independent original pose and restore the movement Euler', () => {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(1.5, 1.7, -2.4)
  camera.quaternion.setFromEuler(new THREE.Euler(-.31, 1.04, 0, 'YXZ'))
  const original = captureObservatoryPose(camera)
  const reading = beginCollectionTreeView(camera)
  const before = camera.position.clone()
  advanceCollectionTreeView(camera, reading, 1 / 60, false)
  assert.ok(camera.position.distanceTo(before) > 0)
  assert.ok(camera.position.distanceTo(reading.targetPosition) > .1, 'ordinary motion must not snap')
  for (let i = 0; i < 360; i++) {
    advanceCollectionTreeView(camera, reading, 1 / 60, false)
    assert.deepEqual(captureObservatoryPose(camera, reading), original, 'mid-flight captures must be the player, never the reading camera')
  }
  assert.ok(camera.position.distanceTo(reading.targetPosition) < 1e-8)
  const movementView = new THREE.Euler()
  restoreCollectionTreeView(camera, reading, movementView)
  assert.deepEqual(captureObservatoryPose(camera), original)
  close(new THREE.Quaternion().setFromEuler(movementView).angleTo(camera.quaternion), 0, 'restored movement heading must agree with camera')
  camera.position.set(9, 9, 9)
  assert.deepEqual(reading.originalPosition.toArray(), original.position, 'snapshot cannot share the live position object')
})

test('reduced motion directly reaches the target while a zero or negative delta does not move an ordinary view', () => {
  const camera = new THREE.Camera()
  camera.position.set(1, 1.7, 4)
  const reading = beginCollectionTreeView(camera)
  for (const delta of [0, -1]) advanceCollectionTreeView(camera, reading, delta, false)
  assert.deepEqual(camera.position.toArray(), [1, 1.7, 4])
  advanceCollectionTreeView(camera, reading, 0, true)
  assert.deepEqual(camera.position.toArray(), COLLECTION_TREE_CAMERA_POSITION)
  close(camera.quaternion.angleTo(reading.targetQuaternion), 0)
})

test('tree E is reachable by real movement from arrival and cannot activate inside planters or off-deck', () => {
  const player = { x: layout.OBSERVATORY_SPAWN[0], z: layout.OBSERVATORY_SPAWN[2] }
  for (const [x, z] of [[.7, 3.5], [1, 2.6], [1.5, -2.4]]) {
    const from = { ...player }, steps = Math.ceil(Math.hypot(x - from.x, z - from.z) / .035)
    for (let i = 1; i <= steps; i++) {
      const target = { x: from.x + (x - from.x) * i / steps, z: from.z + (z - from.z) * i / steps }
      layout.moveOnObservatory(player, target.x - player.x, target.z - player.z)
      close(player.x, target.x, 'tree approach may not tunnel through furniture')
      close(player.z, target.z, 'tree approach may not tunnel through furniture')
    }
  }
  assert.equal(layout.getObservatoryInteraction(player.x, player.z), 'tree')
  for (const [x, z] of [[-2, -2], [NaN, 0], [Infinity, 0], [30, 0], [3.65, 7.15]]) assert.equal(layout.canUseCollectionTree(x, z), false)
})

test('every shared tree vicinity keeps the existing home, galaxy, bar and tide priority', () => {
  let samples = 0, overlaps = 0, treeOnly = 0
  for (let x = -11; x <= 11; x += .12) for (let z = -11; z <= 11; z += .12) {
    if (!layout.canStandOnObservatory(x, z)) continue
    const previous = layout.canUseReturnGate(x, z) ? 'home' : layout.canUseGalaxyGate(x, z) ? 'galaxy' : layout.canUseThoughtBar(x, z) ? 'bar' : canUseTidePool(x, z) ? 'tide' : null
    const tree = layout.canUseCollectionTree(x, z)
    assert.equal(layout.getObservatoryInteraction(x, z), previous ?? (tree ? 'tree' : null))
    samples++; if (tree && previous) overlaps++; if (tree && !previous) treeOnly++
  }
  assert.ok(samples > 10000 && overlaps > 0 && treeOnly > 100)
})

// Execute the real Rig frame/event code. Only React scheduling, browser surfaces
// and look-device binding are mocked; layout, pose helpers and Three math are real.
const mocks = {
  react: `const h=()=>globalThis.__treeRigHarness; export const useRef=value=>h().ref(value); export const useEffect=(fn,deps)=>h().effect(fn,deps);`,
  '@react-three/fiber': `export const useThree=()=>globalThis.__treeRigHarness.renderState; export const useFrame=fn=>{globalThis.__treeRigHarness.frame=fn};`,
  three: `export const { Camera, PerspectiveCamera, Euler, MathUtils }=globalThis.__treeRigHarness.THREE;`,
  '@/state/gameStore': `export const useGameStore={getState:()=>globalThis.__treeRigHarness.game,subscribe:()=>()=>{}};`,
  '../scene/controls/bindSceneLook': `export const bindSceneLook=(canvas,options)=>{globalThis.__treeRigHarness.look=options;return{reset(){},release(){},dispose(){}}};`,
}
const compiled = await build({
  entryPoints: ['src/components/observatory/ObservatoryRig.tsx'], bundle: true, write: false, platform: 'node', format: 'esm',
  define: { 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'tree-rig-test-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: 'mock' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }))
  } }],
})

test('actual Rig freezes movement and persistence during reading, restores exact pose, and does not reinitialize on open/close', async () => {
  const originalGlobals = new Map(['window', 'document', 'HTMLElement', '__treeRigHarness'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const slots = [], pending = [], saved = [], actions = [], nearTree = []
  let cursor = 0, ready = 0
  class Element extends EventTarget { setAttribute() {} removeAttribute() {} focus() {} closest() { return null } style = { setProperty() {} } }
  const camera = new THREE.PerspectiveCamera(), canvas = new Element()
  const input = { current: { keys: new Set(), active: true, reset: false, canvas: null } }
  const harness = {
    THREE, game: { panel: null, closePanel() {} },
    renderState: { camera, gl: { domElement: canvas }, size: { width: 1280, height: 720 } },
    ref(value) { const index = cursor++; return slots[index] ??= { current: value } },
    effect(fn, deps) {
      const index = cursor++, previous = slots[index]
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) pending.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() } })
    },
  }
  const set = (key, value) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  set('__treeRigHarness', harness); set('HTMLElement', Element)
  set('window', Object.assign(new EventTarget(), { location: { search: '' } }))
  set('document', Object.assign(new EventTarget(), { hidden: false, pointerLockElement: null, exitPointerLock() {} }))
  let props
  try {
    const { default: Rig } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
    props = { input, onReady: () => ready++, onLockChange() {}, onReturnHome: () => actions.push('home'), onEnterWorld: () => actions.push('galaxy'), onOpenWorkshop: () => actions.push('bar'), onResonate: () => actions.push('tide'), onOpenTree: () => actions.push('tree'), onNearHome() {}, onNearGalaxy() {}, onNearWorkshop() {}, onNearTide() {}, onNearTree: value => nearTree.push(value), onPose: pose => saved.push(pose) }
    const render = patch => { props = { ...props, ...patch }; cursor = 0; Rig(props); pending.splice(0).forEach(effect => effect()) }
    const frame = (delta = 1 / 60) => harness.frame({}, delta)
    const key = code => { const event = new Event('keydown', { cancelable: true }); Object.assign(event, { code, repeat: false }); window.dispatchEvent(event) }
    render({})
    camera.position.set(1.5, 1.7, -2.4)
    harness.look.rotate(130, 54)
    const original = input.current.capturePose()
    const originalQuaternion = camera.quaternion.clone()
    frame(); key('KeyE')
    assert.deepEqual(actions, ['tree'])
    render({ treeOpen: true }); frame()
    assert.equal(ready, 1, 'tree prop must not re-run the spawn initialization effect')
    assert.deepEqual(saved, [original], 'opening must immediately persist the real player pose once')
    assert.equal(harness.look.isPaused(), true)
    key('KeyE'); key('KeyW'); key('KeyH')
    assert.deepEqual(actions, ['tree'], 'reading must not trigger walking-scene shortcuts')
    for (let i = 0; i < 240; i++) {
      input.current.keys.add('KeyW'); input.current.keys.add('KeyD'); input.current.reset = true
      frame()
      assert.deepEqual(input.current.capturePose(), original)
    }
    assert.equal(saved.length, 1, 'reading camera may never reach onPose periodic persistence')
    assert.ok(camera.position.distanceTo(new THREE.Vector3(...COLLECTION_TREE_CAMERA_POSITION)) < 1e-7, 'held movement/reset cannot displace reading target')
    assert.deepEqual(nearTree, [true], 'nearby state belongs to the saved player position')
    render({ treeOpen: false }); frame()
    assert.equal(ready, 1)
    assert.deepEqual(input.current.capturePose(), original)
    assert.ok(camera.quaternion.equals(originalQuaternion), 'close must restore exact quaternion')
    assert.equal(input.current.keys.size, 0)
    harness.look.rotate(0, 0)
    close(camera.quaternion.angleTo(originalQuaternion), 0, 'mouse look must use restored Euler')
    render({ treeOpen: true, reducedMotion: true }); frame()
    assert.deepEqual(camera.position.toArray(), COLLECTION_TREE_CAMERA_POSITION)
    const recaptured = input.current.capturePose()
    assert.deepEqual(recaptured.position, original.position)
    close(recaptured.yaw, original.yaw)
    close(recaptured.pitch, original.pitch)
    for (const slot of slots) slot?.cleanup?.()
    assert.equal(input.current.capturePose, undefined, 'unmount must detach pose bridge')
    assert.deepEqual(camera.position.toArray(), original.position)
  } finally {
    for (const [key, descriptor] of originalGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key] }
  }
})
