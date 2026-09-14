interface SceneLookOptions {
  rotate: (dx: number, dy: number) => void
  isPaused: () => boolean
  onLockChange?: (locked: boolean) => void
}

const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
const isControl = (target: EventTarget | null) => target instanceof HTMLElement
  && (target.isContentEditable || !!target.closest('input, textarea, select, button, a, [role="dialog"]'))

/** Mouse look starts on entry; pointer lock improves it when browser activation permits.
 * Touch/pen still use a captured drag, and HUD controls retain their normal pointer.
 */
export function bindSceneLook(canvas: HTMLCanvasElement, options: SceneLookOptions) {
  let cloud = false
  try { cloud = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('wanderwise-render-runtime') === 'rtx' } catch { /* Storage can be disabled. */ }
  let enabled = true
  let disposed = false
  let requesting = false
  let wasLocked = false
  let mouse: { x: number; y: number } | null = null
  let drag: { id: number; x: number; y: number } | null = null
  const reset = () => {
    mouse = null
    const previous = drag
    drag = null
    if (previous && canvas.hasPointerCapture(previous.id)) canvas.releasePointerCapture(previous.id)
  }
  const release = () => {
    reset()
    if (document.pointerLockElement === canvas) { wasLocked = false; document.exitPointerLock() }
  }
  const suspend = () => { enabled = false; release() }
  const requestLock = (explicit = false) => {
    // The cloud viewer acquires its own relative cursor first, then sends F.
    // Mounting a new route must not lock only the remote half of that pair.
    if (cloud && !explicit) return
    if (disposed || requesting || !enabled || options.isPaused() || document.pointerLockElement
      || !document.hasFocus() || !navigator.userActivation?.isActive
      || !window.matchMedia('(any-pointer: fine)').matches || !canvas.requestPointerLock) return
    requesting = true
    try {
      // Older implementations return void and signal completion through document events.
      const result = canvas.requestPointerLock()
      if (result) void result.then(() => {
        if (disposed && document.pointerLockElement === canvas) document.exitPointerLock()
      }).catch(() => { requesting = false })
    } catch { requesting = false }
  }
  const down = (event: PointerEvent) => {
    if (options.isPaused() || event.button !== 0) return
    canvas.focus({ preventScroll: true })
    if (event.pointerType === 'mouse') return
    if (drag) return
    canvas.setPointerCapture(event.pointerId)
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const move = (event: PointerEvent) => {
    if (options.isPaused() || document.hidden) { reset(); return }
    if (event.pointerType === 'mouse') {
      const cloudDrag = cloud && event.buttons === 1
      if ((!enabled && !cloudDrag) || document.pointerLockElement) { mouse = null; return }
      // A streamed desktop pointer is absolute. Ignore hover while unlocked;
      // retain left-drag look for touch clients that forward a mouse gesture.
      if (cloud && !cloudDrag) { mouse = null; return }
      if (mouse) options.rotate(event.clientX - mouse.x, event.clientY - mouse.y)
      mouse = { x: event.clientX, y: event.clientY }
    } else if (drag?.id === event.pointerId) {
      options.rotate(event.clientX - drag.x, event.clientY - drag.y)
      drag.x = event.clientX; drag.y = event.clientY
    }
  }
  const enter = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') mouse = { x: event.clientX, y: event.clientY }
  }
  const leave = () => { mouse = null }
  const up = (event: PointerEvent) => { if (drag?.id === event.pointerId) reset() }
  const lostCapture = () => { drag = null }
  const lockedMove = (event: MouseEvent) => {
    if (enabled && document.pointerLockElement === canvas && !options.isPaused()) options.rotate(event.movementX, event.movementY)
  }
  const lockChange = () => {
    requesting = false
    const locked = document.pointerLockElement === canvas
    reset()
    if (locked && (disposed || !enabled || options.isPaused())) { document.exitPointerLock(); return }
    if (wasLocked && !locked) enabled = false
    wasLocked = locked
    options.onLockChange?.(locked)
  }
  const lockError = () => { requesting = false }
  const key = (event: KeyboardEvent) => {
    if (event.code === 'Escape') { suspend(); return }
    // The streaming viewer releases on interaction keys. Release its remote
    // half even when E has no nearby target, without closing a panel via Escape.
    if (cloud && !event.altKey && !event.ctrlKey && !event.metaKey && (event.code === 'KeyE' || event.code === 'KeyH')) { release(); return }
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || options.isPaused()) return
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input, textarea, select, [role="dialog"]'))) return
    if (event.code === 'KeyF') {
      enabled = true; reset(); canvas.focus({ preventScroll: true }); event.preventDefault(); requestLock(true)
    } else if (enabled && WALK_KEYS.has(event.code) && !isControl(event.target)) requestLock()
  }
  const visibility = () => { if (document.hidden) release() }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerenter', enter)
  canvas.addEventListener('pointerleave', leave)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('lostpointercapture', lostCapture)
  document.addEventListener('mousemove', lockedMove)
  document.addEventListener('pointerlockchange', lockChange)
  document.addEventListener('pointerlockerror', lockError)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('blur', release)
  window.addEventListener('keydown', key)
  if (!options.isPaused() && !isControl(document.activeElement)) canvas.focus({ preventScroll: true })
  requestLock()
  return {
    reset,
    release,
    dispose() {
      disposed = true; release()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerenter', enter)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('lostpointercapture', lostCapture)
      document.removeEventListener('mousemove', lockedMove)
      document.removeEventListener('pointerlockchange', lockChange)
      document.removeEventListener('pointerlockerror', lockError)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', release)
      window.removeEventListener('keydown', key)
    },
  }
}
