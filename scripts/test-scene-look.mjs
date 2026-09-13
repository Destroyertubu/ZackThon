import assert from 'node:assert/strict'
import { build } from 'esbuild'

// An isolated DOM event harness exercises input behavior without a GPU or scene assets.
const compiled = await build({ entryPoints: ['src/components/scene/controls/bindSceneLook.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const { bindSceneLook } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const emit = (target, type, props = {}) => {
  const event = new Event(type, { cancelable: true })
  for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value })
  target.dispatchEvent(event)
}
class Element extends EventTarget {
  constructor(tag = 'canvas') { super(); this.tag = tag; this.isContentEditable = false; this.captured = new Set(); this.requests = 0 }
  closest(selector) { return selector.split(',').some(s => s.trim() === this.tag) ? this : null }
  focus() { document.activeElement = this }
  hasPointerCapture(id) { return this.captured.has(id) }
  setPointerCapture(id) { this.captured.add(id) }
  releasePointerCapture(id) { this.captured.delete(id); emit(this, 'lostpointercapture') }
  requestPointerLock() {
    this.requests++
    document.pointerLockElement = this; emit(document, 'pointerlockchange')
    return Promise.resolve()
  }
}
const document = new EventTarget(), window = new EventTarget(), activation = { isActive: false }
document.pointerLockElement = null; document.activeElement = null; document.hidden = false
document.hasFocus = () => true
document.exitPointerLock = () => { document.pointerLockElement = null; emit(document, 'pointerlockchange') }
window.matchMedia = () => ({ matches: true })
Object.defineProperties(globalThis, {
  HTMLElement: { value: Element, configurable: true }, document: { value: document, configurable: true },
  window: { value: window, configurable: true }, navigator: { value: { userActivation: activation }, configurable: true },
})
const canvas = new Element(), rotations = [], locks = []
let paused = false
const look = bindSceneLook(canvas, { rotate: (x, y) => rotations.push([x, y]), isPaused: () => paused, onLockChange: l => locks.push(l) })
const mouse = (x, y) => emit(canvas, 'pointermove', { pointerType: 'mouse', pointerId: 1, clientX: x, clientY: y, buttons: 0 })
const key = (code, target = canvas) => emit(window, 'keydown', { code, target })
assert.equal(canvas.requests, 0, 'fresh navigation without activation must not issue a forbidden lock request')
assert.equal(document.activeElement, canvas, 'walking receives focus without a click')
emit(canvas, 'pointerenter', { pointerType: 'mouse', clientX: 100, clientY: 100 })
mouse(130, 112); assert.deepEqual(rotations.at(-1), [30, 12], 'zero-button mouse movement immediately rotates')
emit(canvas, 'pointerleave'); const count = rotations.length
mouse(600, 500); assert.equal(rotations.length, count, 're-entry has no stale-coordinate jump')
mouse(610, 505); assert.deepEqual(rotations.at(-1), [10, 5])
paused = true; mouse(800, 600); assert.equal(rotations.length, count + 1, 'panel freezes looking')
paused = false; mouse(900, 700); assert.equal(rotations.length, count + 1, 'panel resume resets the baseline')
mouse(910, 700); assert.deepEqual(rotations.at(-1), [10, 0])
key('Escape'); const escaped = rotations.length; mouse(950, 750)
activation.isActive = true; key('KeyW')
assert.equal(canvas.requests, 0, 'walking must not recapture after explicit Escape')
assert.equal(rotations.length, escaped)
key('KeyF', new Element('input')); assert.equal(canvas.requests, 0, 'typing F never captures the cursor')
key('KeyF', new Element('button')); assert.equal(document.pointerLockElement, canvas, 'F resumes without clicking the scene, even with button focus')
mouse(999, 999); assert.equal(rotations.length, escaped, 'locked look must not double-count pointermove')
emit(document, 'mousemove', { movementX: 17, movementY: -4 }); assert.deepEqual(rotations.at(-1), [17, -4])
look.release(); mouse(100, 100); mouse(110, 100); assert.deepEqual(rotations.at(-1), [10, 0], 'programmatic panel release preserves automatic look')
look.reset(); const beforeTouch = rotations.length
emit(canvas, 'pointermove', { pointerType: 'touch', pointerId: 2, clientX: 30, clientY: 30 })
assert.equal(rotations.length, beforeTouch, 'touch hover cannot rotate')
emit(canvas, 'pointerdown', { pointerType: 'touch', pointerId: 2, button: 0, clientX: 30, clientY: 30 })
emit(canvas, 'pointermove', { pointerType: 'touch', pointerId: 2, clientX: 70, clientY: 40 })
assert.deepEqual(rotations.at(-1), [40, 10]); assert.ok(canvas.hasPointerCapture(2))
emit(canvas, 'pointercancel', { pointerId: 2 }); assert.equal(canvas.hasPointerCapture(2), false)
key('KeyF'); const beforeDispose = rotations.length
look.dispose(); assert.equal(document.pointerLockElement, null)
mouse(130, 100); emit(document, 'mousemove', { movementX: 20, movementY: 10 }); key('KeyF')
assert.equal(rotations.length, beforeDispose, 'scene unmount removes all input handlers')
const second = new Element(); document.activeElement = null
const secondLook = bindSceneLook(second, { rotate: () => {}, isPaused: () => false })
assert.equal(document.pointerLockElement, second, 'a route entered with valid activation locks automatically')
secondLook.dispose()
let resolveLock
const delayed = new Element(); document.activeElement = null
delayed.requestPointerLock = () => new Promise(resolve => { resolveLock = resolve })
const pending = bindSceneLook(delayed, { rotate: () => {}, isPaused: () => false })
pending.dispose(); document.pointerLockElement = delayed; resolveLock(); await Promise.resolve(); await Promise.resolve()
assert.equal(document.pointerLockElement, null, 'a lock granted after navigation is released')
assert.ok(locks.includes(true) && locks.includes(false))
console.log('Scene look passed: immediate zero-click mouse look, automatic authorized lock, Escape/F, panel pause, no jump/double rotation, touch drag, and route cleanup.')
