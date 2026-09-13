import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bindSceneLook } from '../scene/controls/bindSceneLook'
import { useGameStore } from '@/state/gameStore'
import { canUseGalaxyGate, canUseReturnGate, canUseThoughtBar, moveOnObservatory, OBSERVATORY_EYE_HEIGHT, OBSERVATORY_LOOK_AT, OBSERVATORY_SPAWN } from './layout'

export interface ObservatoryInput {
  keys: Set<string>
  active: boolean
  reset: boolean
  canvas: HTMLCanvasElement | null
  pauseLook?: () => void
  resumeLook?: () => void
}
// The input controller belongs to the page; these methods bridge its canvas lifecycle.
function attachCanvas(input: ObservatoryInput, canvas: HTMLCanvasElement | null) { input.canvas = canvas }
function consumeReset(input: ObservatoryInput) { const reset = input.reset; input.reset = false; return reset }
function attachLookBridge(input: ObservatoryInput, pauseLook?: () => void, resumeLook?: () => void) {
  input.pauseLook = pauseLook; input.resumeLook = resumeLook
}

const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** Native pointer lock and touch drag share a single camera orientation and floor solver. */
export default function ObservatoryRig({ input, onReady, onLockChange, onReturnHome, onEnterWorld, onOpenWorkshop, onNearHome, onNearGalaxy, onNearWorkshop }: {
  input: RefObject<ObservatoryInput>; onReady: () => void; onLockChange: (locked: boolean) => void
  onReturnHome: () => void; onNearHome: (nearby: boolean) => void
  onEnterWorld: () => void; onOpenWorkshop: () => void
  onNearGalaxy: (nearby: boolean) => void; onNearWorkshop: (nearby: boolean) => void
}) {
  const { camera, gl, size } = useThree()
  const view = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const diagnostics = useRef(0)
  const nearHome = useRef(false)
  const nearGalaxy = useRef(false)
  const nearWorkshop = useRef(false)
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = size.width < size.height ? 76 : 68
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))))
    }
  }, [camera, size])
  useEffect(() => {
    const canvas = gl.domElement
    const controller = input.current
    attachCanvas(controller, canvas)
    camera.position.set(...OBSERVATORY_SPAWN)
    camera.lookAt(...OBSERVATORY_LOOK_AT)
    view.current.setFromQuaternion(camera.quaternion, 'YXZ')
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', '星树花园：鼠标移动环顾，Esc 释放，F 恢复，WASD 行走，靠近星门、调酒角或回程门按 E，H 返回小屋')
    canvas.style.setProperty('touch-action', 'none')
    const bindLook = () => bindSceneLook(canvas, {
      isPaused: () => !input.current.active || !!useGameStore.getState().panel,
      onLockChange,
      rotate: (dx, dy) => {
        view.current.y -= dx * 0.0025
        view.current.x = THREE.MathUtils.clamp(view.current.x - dy * 0.0025, -1.15, 1.35)
        camera.quaternion.setFromEuler(view.current)
      },
    })
    let look = bindLook()
    // Return keyboard focus as well as hover look; modal triggers can otherwise keep WASD on a button.
    attachLookBridge(controller, () => { controller.keys.clear(); look.release() }, () => {
      look.dispose(); canvas.focus({ preventScroll: true }); look = bindLook()
    })
    const clear = () => { input.current.keys.clear(); look.reset() }
    const keyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        clear()
        if (document.pointerLockElement === canvas) document.exitPointerLock()
        useGameStore.getState().closePanel()
        return
      }
      if (useGameStore.getState().panel || !input.current.active || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return
      if (!e.repeat && e.code === 'KeyH') { e.preventDefault(); clear(); onReturnHome(); return }
      if (!e.repeat && e.code === 'KeyE') {
        const { x, z } = camera.position
        const action = canUseReturnGate(x, z) ? onReturnHome : canUseGalaxyGate(x, z) ? onEnterWorld : canUseThoughtBar(x, z) ? onOpenWorkshop : null
        if (action) { e.preventDefault(); clear(); action(); return }
      }
      if (!input.current.active || (e.target instanceof HTMLElement && e.target.closest('button, a'))) return
      if (MOVE_CODES.has(e.code)) { input.current.keys.add(e.code); e.preventDefault() }
    }
    const keyUp = (e: KeyboardEvent) => input.current.keys.delete(e.code)
    const blur = () => { clear(); if (document.pointerLockElement === canvas) document.exitPointerLock() }
    const visibility = () => { if (document.hidden) blur() }
    const unsubscribe = useGameStore.subscribe((state, previous) => {
      if (state.panel !== previous.panel) { clear(); if (state.panel) look.release() }
    })
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    onReady()
    return () => {
      blur(); unsubscribe(); look.dispose(); attachCanvas(controller, null)
      attachLookBridge(controller)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      canvas.removeAttribute('data-observatory-camera')
    }
  }, [camera, gl, input, onReady, onLockChange, onReturnHome, onEnterWorld, onOpenWorkshop])

  useFrame((_, delta) => {
    if (consumeReset(input.current)) {
      camera.position.set(...OBSERVATORY_SPAWN); camera.lookAt(...OBSERVATORY_LOOK_AT)
      view.current.setFromQuaternion(camera.quaternion, 'YXZ'); input.current.keys.clear()
    }
    if (input.current.active && !useGameStore.getState().panel) {
      const keys = input.current.keys
      const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'))
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.8 : 2.4
      const step = Math.min(delta, 0.05) * speed / (Math.hypot(right, forward) || 1)
      moveOnObservatory(camera.position,
        (Math.cos(view.current.y) * right - Math.sin(view.current.y) * forward) * step,
        (-Math.sin(view.current.y) * right - Math.cos(view.current.y) * forward) * step)
      camera.position.setY(OBSERVATORY_EYE_HEIGHT)
    }
    const nextNearHome = canUseReturnGate(camera.position.x, camera.position.z)
    if (nextNearHome !== nearHome.current) { nearHome.current = nextNearHome; onNearHome(nextNearHome) }
    const nextNearGalaxy = canUseGalaxyGate(camera.position.x, camera.position.z)
    if (nextNearGalaxy !== nearGalaxy.current) { nearGalaxy.current = nextNearGalaxy; onNearGalaxy(nextNearGalaxy) }
    const nextNearWorkshop = canUseThoughtBar(camera.position.x, camera.position.z)
    if (nextNearWorkshop !== nearWorkshop.current) { nearWorkshop.current = nextNearWorkshop; onNearWorkshop(nextNearWorkshop) }
    if (import.meta.env.DEV) {
      diagnostics.current += delta
      if (diagnostics.current > 0.25) {
        diagnostics.current = 0
        gl.domElement.setAttribute('data-observatory-camera', JSON.stringify({
          position: camera.position.toArray(), yaw: view.current.y, pitch: view.current.x,
          locked: document.pointerLockElement === gl.domElement, active: input.current.active,
          nearHome: nextNearHome, nearGalaxy: nextNearGalaxy, nearWorkshop: nextNearWorkshop,
          paused: !input.current.active || !!useGameStore.getState().panel, dpr: gl.getPixelRatio(), calls: gl.info.render.calls,
        }))
      }
    }
  }, -1)
  return null
}
