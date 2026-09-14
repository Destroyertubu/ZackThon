import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bindSceneLook } from '../../../components/scene/controls/bindSceneLook'
import { createJumpMotion, resetJump, startJump, stepJump } from '../../../components/scene/controls/jumpMotion'
import { EYE_HEIGHT, groundHeight, nearestStation, safePose, type WalkWorld } from './navigation'
import type { RealmStation, WorldPose } from './types'

export interface WorldControllerProps {
  world: WalkWorld
  initialPose?: WorldPose
  initialStationId?: string
  onPose?: (pose: WorldPose) => void
  onNearStation?: (station: RealmStation | null) => void
  onInteract?: (stationId: string) => void
  disabled?: boolean
  onCaptureReady?: (capture: (() => string) | null) => void
}

const WALK_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])
const TOUCH_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'])
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement
  && (target.isContentEditable || !!target.closest('input,textarea,select,button,a,[role="dialog"]'))

/** Short collision steps preserve narrow borders; an invalid diagonal can slide along either axis. */
function moveAlongGround(world: WalkWorld, position: THREE.Vector3, dx: number, dz: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .055)), sx = dx / steps, sz = dz / steps
  const tryMove = (x: number, z: number) => {
    const height = groundHeight(world, x, z)
    if (height === null || Math.abs(height - (position.y - EYE_HEIGHT)) > .32) return false
    position.set(x, height + EYE_HEIGHT, z)
    return true
  }
  for (let step = 0; step < steps; step++) {
    if (!tryMove(position.x + sx, position.z + sz)) {
      if (sx) tryMove(position.x + sx, position.z)
      if (sz) tryMove(position.x, position.z + sz)
    }
  }
}

/** A Canvas child. World routes own persistence and business actions; this owns only input. */
export default function WorldController(props: WorldControllerProps) {
  const { world, disabled = false, onCaptureReady } = props
  const { camera, gl, scene } = useThree()
  const latest = useRef(props)
  const initial = useRef({pose:props.initialPose,station:props.initialStationId})
  const initializedWorld = useRef<string | null>(null)
  const input = useRef({ keyboard: new Set<string>(), touch: new Set<string>(), elapsed: 0,
    jump: createJumpMotion(), floor: new THREE.Vector3(),
    view: new THREE.Euler(0, 0, 0, 'YXZ'), point: [0, 0, 0] as [number, number, number], nearby: undefined as RealmStation | null | undefined })
  const worldId = world.id
  useLayoutEffect(() => { latest.current = props }, [props])

  useEffect(() => {
    // Read back immediately after a real render: preserveDrawingBuffer is unnecessary.
    const capture = () => { gl.render(scene, camera); return gl.domElement.toDataURL('image/jpeg', .7) }
    onCaptureReady?.(capture)
    return () => onCaptureReady?.(null)
  }, [camera, gl, scene, onCaptureReady])

  useEffect(() => {
    const state = input.current, canvas = gl.domElement
    if (initializedWorld.current !== worldId) {
      const pose = safePose(latest.current.world, initializedWorld.current === null ? initial.current.pose : undefined, initializedWorld.current === null ? initial.current.station : undefined)
      camera.position.set(...pose.position); camera.rotation.reorder('YXZ'); state.view.set(pose.pitch, pose.yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(state.view)
      resetJump(state.jump, pose.position[1] - EYE_HEIGHT)
      initializedWorld.current = worldId; state.nearby = undefined
    }
    const oldTabindex = canvas.getAttribute('tabindex'), oldLabel = canvas.getAttribute('aria-label'), oldTouchAction = canvas.style.touchAction
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', '镜海旅程：鼠标移动环顾，WASD 或方向键行走，空格跳跃，靠近阅读点按 E，C 回到入口，Esc 释放鼠标，F 恢复环顾')
    canvas.style.setProperty('touch-action', 'none')
    const emitPose = () => {
      state.elapsed = 0
      const ground = groundHeight(latest.current.world, camera.position.x, camera.position.z) ?? state.jump.ground
      if(new URLSearchParams(window.location.search).get('visualReview')!=='1')latest.current.onPose?.({ position: [camera.position.x, ground + EYE_HEIGHT, camera.position.z], yaw: state.view.y, pitch: state.view.x })
    }
    const setNearby = (station: RealmStation | null) => {
      if (state.nearby === undefined || station?.id !== state.nearby?.id) { state.nearby = station; latest.current.onNearStation?.(station) }
    }
    const clear = () => { state.keyboard.clear(); state.touch.clear() }
    clear()
    // Recreate the binding after reading closes; bindSceneLook deliberately suspends itself on Esc.
    const look = disabled ? null : bindSceneLook(canvas, {
      isPaused: () => !!latest.current.disabled || document.hidden,
      rotate: (dx, dy) => {
        state.view.y -= dx * .0015
        state.view.x = THREE.MathUtils.clamp(state.view.x - dy * .0014, -1.25, 1.25)
        camera.quaternion.setFromEuler(state.view)
      },
    })
    if (disabled) {
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      setNearby(null)
    } else {
      canvas.focus({ preventScroll: true })
      setNearby(nearestStation(latest.current.world, [camera.position.x, camera.position.y, camera.position.z]))
    }
    emitPose()
    const pause = () => { clear(); look?.release(); emitPose() }
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') { clear(); look?.release(); emitPose(); return }
      if (latest.current.disabled || document.hidden || event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return
      if (event.code === 'KeyE' && !event.repeat) {
        const nearby = nearestStation(latest.current.world, [camera.position.x, state.jump.ground + EYE_HEIGHT, camera.position.z])
        if (nearby) { event.preventDefault(); clear(); emitPose(); latest.current.onInteract?.(nearby.id) }
        return
      }
      if (event.code === 'KeyC' && !event.repeat) {
        event.preventDefault(); clear(); look?.reset()
        const pose = safePose(latest.current.world)
        camera.position.set(...pose.position); camera.rotation.reorder('YXZ'); state.view.set(pose.pitch, pose.yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(state.view)
        resetJump(state.jump, pose.position[1] - EYE_HEIGHT)
        setNearby(nearestStation(latest.current.world, pose.position)); emitPose(); return
      }
      if (WALK_CODES.has(event.code)) { event.preventDefault(); state.keyboard.add(event.code) }
      if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) state.keyboard.add('Space') }
    }
    const keyUp = (event: KeyboardEvent) => { if (event.code !== 'Space') state.keyboard.delete(event.code) }
    const touchMove = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail: unknown = event.detail
      if (!detail || typeof detail !== 'object' || !('code' in detail) || !('active' in detail)) return
      if (typeof detail.code !== 'string' || !TOUCH_CODES.has(detail.code) || typeof detail.active !== 'boolean') return
      if (!detail.active) { if (detail.code !== 'Space') state.touch.delete(detail.code); return }
      if (!latest.current.disabled && !document.hidden) state.touch.add(detail.code)
    }
    const visibility = () => { if (document.hidden) pause() }
    const focus = (event: FocusEvent) => { if (isTyping(event.target)) clear() }
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp)
    window.addEventListener('wanderwise:world-move', touchMove); window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', visibility); document.addEventListener('focusin', focus)
    return () => {
      clear(); look?.dispose(); emitPose()
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp)
      window.removeEventListener('wanderwise:world-move', touchMove); window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('focusin', focus)
      if (oldTabindex === null) canvas.removeAttribute('tabindex'); else canvas.setAttribute('tabindex', oldTabindex)
      if (oldLabel === null) canvas.removeAttribute('aria-label'); else canvas.setAttribute('aria-label', oldLabel)
      canvas.style.setProperty('touch-action', oldTouchAction)
      canvas.removeAttribute('data-world-player')
    }
  }, [camera, gl, worldId, disabled])

  useFrame((_, rawDelta) => {
    const state = input.current, current = latest.current
    if (current.disabled || document.hidden) return
    const held = (code: string) => state.keyboard.has(code) || state.touch.has(code)
    const right = Number(held('KeyD') || held('ArrowRight')) - Number(held('KeyA') || held('ArrowLeft'))
    const forward = Number(held('KeyW') || held('ArrowUp')) - Number(held('KeyS') || held('ArrowDown'))
    const dt = Math.min(Math.max(rawDelta, 0), .04)
    const jumpRequested = state.keyboard.delete('Space')
    const touchJumpRequested = state.touch.delete('Space')
    if (jumpRequested || touchJumpRequested) startJump(state.jump)
    const ground = groundHeight(current.world, camera.position.x, camera.position.z) ?? state.jump.ground
    state.floor.set(camera.position.x, ground + EYE_HEIGHT, camera.position.z)
    if (right || forward) {
      const speed = held('ShiftLeft') || held('ShiftRight') ? 5 : 3.6
      const step = dt * speed / Math.hypot(right, forward), yaw = state.view.y
      moveAlongGround(current.world, state.floor, (Math.cos(yaw) * right - Math.sin(yaw) * forward) * step,
        (-Math.sin(yaw) * right - Math.cos(yaw) * forward) * step)
    }
    camera.position.set(state.floor.x, stepJump(state.jump, state.floor.y - EYE_HEIGHT, rawDelta) + EYE_HEIGHT, state.floor.z)
    state.elapsed += Math.min(Math.max(rawDelta, 0), .25)
    if (state.elapsed >= .2) {
      state.elapsed = 0
      if(new URLSearchParams(window.location.search).get('visualReview')!=='1')current.onPose?.({ position: [state.floor.x, state.floor.y, state.floor.z], yaw: state.view.y, pitch: state.view.x })
      if (import.meta.env.DEV) gl.domElement.setAttribute('data-world-player', JSON.stringify({ position: camera.position.toArray(), jumpHeight: state.jump.height, grounded: state.jump.grounded, ground: state.jump.ground }))
    }
    state.point[0] = state.floor.x; state.point[1] = state.floor.y; state.point[2] = state.floor.z
    const nearby = nearestStation(current.world, state.point)
    if (state.nearby === undefined || nearby?.id !== state.nearby?.id) { state.nearby = nearby; current.onNearStation?.(nearby) }
  }, -1)
  return null
}
