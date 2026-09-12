import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import type { WebGLRenderer } from 'three'
import { useGameStore } from '@/state/gameStore'
import Adventurer from './Adventurer'
import AvatarBoundary from './AvatarBoundary'
import type { Locomotion } from './Adventurer'
import { HOME_SPAWN, HOME_YAW, homeCameraTuning, RUN_SPEED, WALK_SPEED } from './config'
import { cameraSafeDistance, moveOnFloor, nearestInteraction } from './navigation'
import type { HomeInteraction } from './navigation'
import { clampToHome, constrainHomeCamera, followHomeTarget } from '../../scene/roomEnvelope'

export interface HomeInput { keys: Set<string> }
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight']
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(target.tagName))

// The renderer is an external Three.js object, not React-owned state.
function setFrameInfoReset(renderer: WebGLRenderer, enabled: boolean) {
  renderer.info.autoReset = enabled
}

export default function HomePlayer({ input, onNearby, onInteract }: {
  input: HomeInput
  onNearby: (spot: HomeInteraction | null) => void
  onInteract: (spot: HomeInteraction) => void
}) {
  const { camera, gl, size } = useThree()
  const panel = useGameStore((s) => s.panel)
  const player = useRef<Group>(null)
  const position = useRef(new Vector3(...HOME_SPAWN))
  const heading = useRef(HOME_YAW + Math.PI)
  const locomotion = useRef<Locomotion>('idle')
  const avatarOpacity = useRef(1)
  const tuning = useMemo(() => homeCameraTuning(), [])
  const orbit = useRef({ yaw: HOME_YAW, pitch: tuning.pitch, distance: tuning.distance })
  const nearby = useRef<HomeInteraction | null>(null)
  const frameRef = useRef({
    target: new Vector3(...HOME_SPAWN).add(new Vector3(0, tuning.targetHeight, 0)),
    goal: new Vector3(), desired: new Vector3(), offset: new Vector3(), previousCamera: new Vector3(),
    distance: tuning.distance, initialized: false, diagnosticTimer: 0,
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
    canvas.setAttribute('aria-label', '第三人称小屋：WASD 移动，拖动视角，E 交互')
    canvas.style.setProperty('touch-action', 'none')
    canvas.style.setProperty('outline', 'none')
    let drag: { id: number; x: number; y: number } | null = null
    const stopDrag = () => {
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id)
      drag = null
    }
    const clear = () => { input.keys.clear(); stopDrag() }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        clear()
        if (useGameStore.getState().panel) useGameStore.getState().closePanel()
        return
      }
      if (useGameStore.getState().panel || isTyping(event.target)) return
      if (MOVE_KEYS.includes(event.code)) { event.preventDefault(); input.keys.add(event.code) }
      if (event.code === 'KeyE' && !event.repeat && nearby.current) { event.preventDefault(); clear(); onInteract(nearby.current) }
      if (event.code === 'KeyC') input.keys.add('KeyC')
    }
    const onKeyUp = (event: KeyboardEvent) => { if (MOVE_KEYS.includes(event.code)) input.keys.delete(event.code) }
    const down = (event: PointerEvent) => {
      if (useGameStore.getState().panel || (event.button !== 0 && event.button !== 2) || drag) return
      canvas.focus({ preventScroll: true })
      canvas.setPointerCapture(event.pointerId)
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId || useGameStore.getState().panel) return
      orbit.current.yaw -= (event.clientX - drag.x) * 0.005
      orbit.current.pitch = MathUtils.clamp(orbit.current.pitch + (event.clientY - drag.y) * 0.004, -0.06, 0.48)
      drag.x = event.clientX; drag.y = event.clientY
    }
    const up = (event: PointerEvent) => { if (drag?.id === event.pointerId) stopDrag() }
    const wheel = (event: WheelEvent) => {
      if (useGameStore.getState().panel) return
      event.preventDefault()
      orbit.current.distance = MathUtils.clamp(orbit.current.distance + event.deltaY * 0.003, 1.6, 4.2)
    }
    const context = (event: Event) => event.preventDefault()
    const visibility = () => { if (document.hidden) clear() }
    const unsubscribe = useGameStore.subscribe((state, previous) => { if (state.panel !== previous.panel) clear() })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', visibility)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('lostpointercapture', stopDrag)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('contextmenu', context)
    return () => {
      clear(); unsubscribe()
      if (import.meta.env.DEV) setFrameInfoReset(gl, autoReset)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('lostpointercapture', stopDrag)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('contextmenu', context)
      canvas.removeAttribute('data-home-player')
    }
  }, [gl, input, onInteract])

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    const frame = frameRef.current
    const p = position.current, o = orbit.current, keys = input.keys
    if (keys.has('KeyC')) {
      o.yaw = heading.current - Math.PI; o.pitch = tuning.pitch; o.distance = tuning.distance
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
    const dx = (Math.cos(o.yaw) * right - Math.sin(o.yaw) * forward) / length * speed * dt
    const dz = (-Math.sin(o.yaw) * right - Math.cos(o.yaw) * forward) / length * speed * dt
    const oldX = p.x, oldZ = p.z
    moveOnFloor(p, dx, dz)
    const moved = Math.hypot(p.x - oldX, p.z - oldZ) > 0.0001
    locomotion.current = moved ? (running ? 'run' : 'walk') : 'idle'
    if (moved) heading.current = Math.atan2(p.x - oldX, p.z - oldZ)
    player.current?.position.copy(p)

    // Single camera owner: shoulder target follows the player, with immediate obstruction retraction.
    frame.goal.copy(p).y += tuning.targetHeight
    if (!frame.initialized) clampToHome(frame.target.copy(frame.goal))
    else followHomeTarget(frame.target, frame.goal, 1 - Math.exp(-tuning.followSpeed * dt))
    frame.offset.set(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch))
    frame.desired.copy(frame.target).addScaledVector(frame.offset, o.distance)
    const safe = cameraSafeDistance(frame.target, frame.desired)
    frame.distance = safe < frame.distance ? safe : MathUtils.lerp(frame.distance, safe, 1 - Math.exp(-8 * dt))
    frame.previousCamera.copy(camera.position)
    camera.position.copy(frame.target).addScaledVector(frame.offset, frame.distance)
    if (frame.initialized) constrainHomeCamera(frame.previousCamera, camera.position, frame.target, dt * 8)
    else clampToHome(camera.position)
    frame.distance = camera.position.distanceTo(frame.target)
    camera.lookAt(frame.target)
    // Use the real shoulder, since a doorway transition may briefly move the
    // camera's look target. Fade the avatar instead of letting its hat fill the
    // view when a wall or railing safely retracts the camera.
    const opacityGoal = MathUtils.smoothstep(camera.position.distanceTo(frame.goal), 1.45, 2.0)
    const fadeSpeed = opacityGoal < avatarOpacity.current ? 18 : 8
    avatarOpacity.current = frame.initialized
      ? MathUtils.lerp(avatarOpacity.current, opacityGoal, 1 - Math.exp(-fadeSpeed * dt))
      : opacityGoal
    if (opacityGoal === 0 && avatarOpacity.current < 0.01) avatarOpacity.current = 0
    if (opacityGoal === 1 && avatarOpacity.current > 0.999) avatarOpacity.current = 1
    frame.initialized = true

    const spot = panel ? null : nearestInteraction(p)
    if (spot?.id !== nearby.current?.id) { nearby.current = spot; onNearby(spot) }
    if (import.meta.env.DEV) {
      frame.diagnosticTimer += dt
      if (frame.diagnosticTimer > 0.15) {
        frame.diagnosticTimer = 0
        gl.domElement.setAttribute('data-home-player', JSON.stringify({
          position: p.toArray(), camera: camera.position.toArray(), target: frame.target.toArray(), cameraDistance: frame.distance,
          avatarOpacity: avatarOpacity.current,
          yaw: o.yaw, animation: locomotion.current, nearby: spot?.id ?? null, paused: !!panel,
          render: { calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures },
        }))
      }
      gl.info.reset()
    }
  }, -1)

  return (
    <group ref={player} position={HOME_SPAWN}>
      <AvatarBoundary opacity={avatarOpacity}><Adventurer locomotion={locomotion} heading={heading} opacity={avatarOpacity} /></AvatarBoundary>
    </group>
  )
}
