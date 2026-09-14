import { isShowcase } from '@/features/showcase/runtime'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import type { WebGLRenderer } from 'three'
import { useGameStore } from '@/state/gameStore'
import { HOME_SPAWN, HOME_YAW, homeCameraTuning, RUN_SPEED, WALK_SPEED } from './config'
import { bindSceneLook } from '../../scene/controls/bindSceneLook'
import { createJumpMotion, startJump, stepJump } from '../../scene/controls/jumpMotion'
import { moveFirstPersonOnFloor, nearestInteraction } from './navigation'
import type { HomeInteraction } from './navigation'

export interface HomeInput { keys: Set<string> }
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight']
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))

// The renderer is an external Three.js object, not React-owned state.
function setFrameInfoReset(renderer: WebGLRenderer, enabled: boolean) {
  renderer.info.autoReset = enabled
}

export default function HomePlayer({ input, onNearby, onInteract, initialSpawn = HOME_SPAWN, initialYaw = HOME_YAW }: {
  input: HomeInput
  onNearby: (spot: HomeInteraction | null) => void
  onInteract: (spot: HomeInteraction) => void
  initialSpawn?: [number, number, number]
  initialYaw?: number
}) {
  const { camera, gl, size } = useThree()
  const panel = useGameStore((s) => s.panel)
  const player = useRef<Group>(null)
  const position = useRef(new Vector3(...initialSpawn))
  const jump = useRef(createJumpMotion(HOME_SPAWN[1]))
  const heading = useRef(initialYaw + Math.PI)
  const tuning = useMemo(() => homeCameraTuning(), [])
  const view = useRef({ yaw: initialYaw, pitch: tuning.pitch })
  const nearby = useRef<HomeInteraction | null>(null)
  const frameRef = useRef({
    lookAt: new Vector3(), direction: new Vector3(), diagnosticTimer: 0,
  })

  useEffect(() => {
    // A portrait viewport needs a wider vertical field of view to keep the hat and room readable.
    if (camera instanceof PerspectiveCamera) {
      const fov = size.width < size.height ? 74 : tuning.fov
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(MathUtils.degToRad(fov / 2))))
    }
  }, [camera, size.width, size.height, tuning])

  useEffect(() => {
    const canvas = gl.domElement
    const autoReset = gl.info.autoReset
    // Postprocessing performs several render calls: measure the complete frame in dev.
    if (import.meta.env.DEV) setFrameInfoReset(gl, false)
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', '第一人称小屋：WASD 移动，空格跳跃，鼠标移动环顾，Esc 释放，F 恢复，E 交互')
    canvas.style.setProperty('touch-action', 'none')
    canvas.style.setProperty('outline', 'none')
    const look = bindSceneLook(canvas, {
      isPaused: () => !!useGameStore.getState().panel,
      rotate: (dx, dy) => {
        view.current.yaw -= dx * tuning.lookSensitivity
        view.current.pitch = MathUtils.clamp(view.current.pitch + dy * tuning.lookSensitivity, tuning.pitchMin, tuning.pitchMax)
      },
    })
    const clear = () => { input.keys.clear(); look.reset() }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        clear()
        if (useGameStore.getState().panel) useGameStore.getState().closePanel()
        return
      }
      if (useGameStore.getState().panel || document.hidden || event.altKey || event.ctrlKey || event.metaKey || isTyping(event.target)) return
      if (MOVE_KEYS.includes(event.code)) { event.preventDefault(); input.keys.add(event.code) }
      if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) input.keys.add('Space') }
      if (event.code === 'KeyE' && !event.repeat && nearby.current) { event.preventDefault(); clear(); onInteract(nearby.current) }
      if (event.code === 'KeyC') input.keys.add('KeyC')
    }
    const onKeyUp = (event: KeyboardEvent) => { if (MOVE_KEYS.includes(event.code)) input.keys.delete(event.code) }
    const wheel = (event: WheelEvent) => {
      if (useGameStore.getState().panel) return
      // The canvas fills the viewport. Prevent wheel scrolling while looking around.
      event.preventDefault()
    }
    const context = (event: Event) => event.preventDefault()
    const visibility = () => { if (document.hidden) clear() }
    const unsubscribe = useGameStore.subscribe((state, previous) => { if (state.panel !== previous.panel) { clear(); if (state.panel) look.release() } })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', visibility)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('contextmenu', context)
    return () => {
      clear(); unsubscribe(); look.dispose()
      if (import.meta.env.DEV) setFrameInfoReset(gl, autoReset)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('contextmenu', context)
      canvas.removeAttribute('data-home-player')
    }
  }, [gl, input, onInteract, tuning])

  useFrame((_, rawDelta) => {
    if (isShowcase()) return
    const dt = Math.min(rawDelta, 0.05)
    const frame = frameRef.current
    const p = position.current, viewState = view.current, keys = input.keys
    if (keys.has('KeyC')) {
      viewState.yaw = heading.current - Math.PI
      viewState.pitch = tuning.pitch
      keys.delete('KeyC')
    }
    let right = 0, forward = 0
    if (!panel) {
      right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
      forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'))
    }
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight')
    const speed = running ? RUN_SPEED : WALK_SPEED
    const length = Math.hypot(right, forward) || 1
    const dx = (Math.cos(viewState.yaw) * right - Math.sin(viewState.yaw) * forward) / length * speed * dt
    const dz = (-Math.sin(viewState.yaw) * right - Math.cos(viewState.yaw) * forward) / length * speed * dt
    const oldX = p.x, oldZ = p.z
    if (!panel && !document.hidden) {
      if (keys.delete('Space')) startJump(jump.current)
      p.y = stepJump(jump.current, HOME_SPAWN[1], dt)
    }
    moveFirstPersonOnFloor(p, camera.position, dx, dz, tuning.eyeHeight)
    const moved = Math.hypot(p.x - oldX, p.z - oldZ) > 0.0001
    if (moved) heading.current = Math.atan2(p.x - oldX, p.z - oldZ)
    player.current?.position.copy(p)

    // Positive pitch tilts the view downward, matching the previous drag gesture.
    const cosPitch = Math.cos(viewState.pitch)
    frame.direction.set(
      -Math.sin(viewState.yaw) * cosPitch,
      -Math.sin(viewState.pitch),
      -Math.cos(viewState.yaw) * cosPitch,
    )
    frame.lookAt.copy(camera.position).add(frame.direction)
    camera.lookAt(frame.lookAt)

    const spot = panel ? null : nearestInteraction(p)
    if (spot?.id !== nearby.current?.id) { nearby.current = spot; onNearby(spot) }
    if (import.meta.env.DEV) {
      frame.diagnosticTimer += dt
      if (frame.diagnosticTimer > 0.15) {
        frame.diagnosticTimer = 0
        gl.domElement.setAttribute('data-home-player', JSON.stringify({
          position: p.toArray(), camera: camera.position.toArray(), eye: [p.x, p.y + tuning.eyeHeight, p.z],
          yaw: viewState.yaw, pitch: viewState.pitch, nearby: spot?.id ?? null, paused: !!panel,
          jumpHeight: jump.current.height, grounded: jump.current.grounded,
          render: { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures },
        }))
      }
      gl.info.reset()
    }
  }, -1)

  return (
    // Keep a scene node for future third-person toggles while hiding the avatar in first-person.
    <group ref={player} position={initialSpawn} visible={false} />
  )
}
