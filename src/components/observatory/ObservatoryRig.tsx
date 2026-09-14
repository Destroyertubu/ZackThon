import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { ScenePose } from '@/features/personal/types'
import { bindSceneLook } from '../scene/controls/bindSceneLook'
import { useGameStore } from '@/state/gameStore'
import { canUseCollectionTree, canUseGalaxyGate, canUseReturnGate, canUseThoughtBar, getObservatoryInteraction, moveOnObservatory, OBSERVATORY_EYE_HEIGHT, OBSERVATORY_LOOK_AT, OBSERVATORY_SPAWN } from './layout'
import { canUseTidePool, moonBridgeHeight } from './starTideLayout'
import { advanceCollectionTreeView, beginCollectionTreeView, captureObservatoryPose, restoreCollectionTreeView } from './collectionTreeCamera'
import type { CollectionTreeCameraView } from './collectionTreeCamera'

export interface ObservatoryInput {
  keys: Set<string>
  active: boolean
  reset: boolean
  canvas: HTMLCanvasElement | null
  pauseLook?: () => void
  resumeLook?: () => void
  capturePose?: () => ScenePose
}
// The input controller belongs to the page; these methods bridge its canvas lifecycle.
function attachCanvas(input: ObservatoryInput, canvas: HTMLCanvasElement | null) { input.canvas = canvas }
function consumeReset(input: ObservatoryInput) { const reset = input.reset; input.reset = false; return reset }
function attachLookBridge(input: ObservatoryInput, pauseLook?: () => void, resumeLook?: () => void) {
  input.pauseLook = pauseLook; input.resumeLook = resumeLook
}
function attachPoseBridge(input: ObservatoryInput, capturePose?: () => ScenePose) { input.capturePose = capturePose }

const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** Native pointer lock and touch drag share a single camera orientation and floor solver. */
export default function ObservatoryRig({ workshopOpen = false, treeOpen = false, reducedMotion = false, initialPose, onPose, input, onReady, onLockChange, onReturnHome, onEnterWorld, onOpenWorkshop, onOpenTree, onNearHome, onNearGalaxy, onNearWorkshop, onResonate, onNearTide, onNearTree }: {
  workshopOpen?: boolean; treeOpen?: boolean; reducedMotion?: boolean; initialPose?: ScenePose; onPose?: (pose:ScenePose)=>void
  input: RefObject<ObservatoryInput>; onReady: () => void; onLockChange: (locked: boolean) => void
  onReturnHome: () => void; onNearHome: (nearby: boolean) => void
  onEnterWorld: () => void; onOpenWorkshop: () => void
  onNearGalaxy: (nearby: boolean) => void; onNearWorkshop: (nearby: boolean) => void
  onResonate: () => void; onNearTide: (nearby: boolean) => void
  onOpenTree: () => void; onNearTree: (nearby: boolean) => void
}) {
  const { camera, gl, size } = useThree()
  const view = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const diagnostics = useRef(0)
  const nearHome = useRef(false)
  const nearGalaxy = useRef(false)
  const nearWorkshop = useRef(false)
  const nearTide = useRef(false)
  const nearTree = useRef(false)
  const treeView = useRef<CollectionTreeCameraView | null>(null)
  const workshopView = useRef<{original: THREE.Quaternion; target: THREE.Quaternion} | null>(null)
  const poseTimer = useRef(0)
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = size.width < size.height ? 76 : 68
      camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))))
    }
  }, [camera, size])
  useEffect(() => {
    const canvas = gl.domElement
    const controller = input.current
    const movementView = view.current
    attachCanvas(controller, canvas)
    camera.position.set(...OBSERVATORY_SPAWN)
    camera.lookAt(...OBSERVATORY_LOOK_AT)
    view.current.setFromQuaternion(camera.quaternion, 'YXZ')
    if(initialPose){camera.position.set(...initialPose.position);view.current.set(initialPose.pitch,initialPose.yaw,0,'YXZ');camera.quaternion.setFromEuler(view.current)}
    attachPoseBridge(controller, () => captureObservatoryPose(camera, treeView.current, workshopView.current?.original))
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('aria-label', '星树花园：鼠标移动环顾，Esc 释放，F 恢复，WASD 行走，靠近星门、调酒角、收藏树或回程门按 E，H 返回小屋')
    canvas.style.setProperty('touch-action', 'none')
    const bindLook = () => bindSceneLook(canvas, {
      isPaused: () => !input.current.active || !!treeView.current || !!useGameStore.getState().panel,
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
      if (useGameStore.getState().panel || treeView.current || !input.current.active || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return
      if (!e.repeat && e.code === 'KeyH') { e.preventDefault(); clear(); onReturnHome(); return }
      if (!e.repeat && e.code === 'KeyE') {
        const { x, z } = camera.position
        const interaction = getObservatoryInteraction(x, z)
        const action = interaction && { home: onReturnHome, galaxy: onEnterWorld, bar: onOpenWorkshop, tide: onResonate, tree: onOpenTree }[interaction]
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
      attachPoseBridge(controller)
      if (treeView.current) restoreCollectionTreeView(camera, treeView.current, movementView)
      treeView.current = null; workshopView.current = null
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      canvas.removeAttribute('data-observatory-camera')
    }
  }, [camera, gl, input, onReady, onLockChange, onReturnHome, onEnterWorld, onOpenWorkshop, onOpenTree, onResonate, initialPose])

  useFrame((_, delta) => {
    if (treeOpen && !treeView.current) {
      // Restore another temporary view before saving the actual walking camera.
      if (workshopView.current) {
        camera.quaternion.copy(workshopView.current.original)
        view.current.setFromQuaternion(camera.quaternion, 'YXZ')
        workshopView.current = null
      }
      treeView.current = beginCollectionTreeView(camera)
      input.current.keys.clear(); input.current.pauseLook?.()
      poseTimer.current = 0
      onPose?.(captureObservatoryPose(camera, treeView.current))
    } else if (!treeOpen && treeView.current) {
      restoreCollectionTreeView(camera, treeView.current, view.current)
      treeView.current = null
      input.current.keys.clear()
      poseTimer.current = 0
    }
    if (treeOpen && treeView.current) {
      advanceCollectionTreeView(camera, treeView.current, delta, reducedMotion)
    } else if (workshopOpen) {
      if (!workshopView.current) {
        const original = camera.quaternion.clone()
        camera.lookAt(-6.65, 1.8, 1.4)
        workshopView.current = { original, target: camera.quaternion.clone() }
        camera.quaternion.copy(original)
      }
      camera.quaternion.slerp(workshopView.current.target, 1 - Math.exp(-Math.min(delta,.05) * 5))
    } else if (workshopView.current) {
      camera.quaternion.copy(workshopView.current.original)
      view.current.setFromQuaternion(camera.quaternion,'YXZ')
      workshopView.current = null
    }
    if (!workshopOpen && !treeOpen) poseTimer.current+=delta
    if(!treeOpen && !workshopOpen && poseTimer.current>.75){poseTimer.current=0;if(new URLSearchParams(window.location.search).get('visualReview')!=='1')onPose?.(captureObservatoryPose(camera))}
    if (consumeReset(input.current) && !treeOpen && !workshopOpen) {
      camera.position.set(...OBSERVATORY_SPAWN); camera.lookAt(...OBSERVATORY_LOOK_AT)
      view.current.setFromQuaternion(camera.quaternion, 'YXZ'); input.current.keys.clear()
    }
    if (!treeOpen && !workshopOpen && input.current.active && !useGameStore.getState().panel) {
      const keys = input.current.keys
      const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'))
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3.8 : 2.4
      const step = Math.min(delta, 0.05) * speed / (Math.hypot(right, forward) || 1)
      moveOnObservatory(camera.position,
        (Math.cos(view.current.y) * right - Math.sin(view.current.y) * forward) * step,
        (-Math.sin(view.current.y) * right - Math.cos(view.current.y) * forward) * step)
      camera.position.setY(OBSERVATORY_EYE_HEIGHT + moonBridgeHeight(camera.position.x,camera.position.z))
    }
    // Prompts represent the player, never the floating reading camera.
    const playerPosition = treeView.current?.originalPosition ?? camera.position
    const nextNearHome = canUseReturnGate(playerPosition.x, playerPosition.z)
    if (nextNearHome !== nearHome.current) { nearHome.current = nextNearHome; onNearHome(nextNearHome) }
    const nextNearGalaxy = canUseGalaxyGate(playerPosition.x, playerPosition.z)
    if (nextNearGalaxy !== nearGalaxy.current) { nearGalaxy.current = nextNearGalaxy; onNearGalaxy(nextNearGalaxy) }
    const nextNearWorkshop = canUseThoughtBar(playerPosition.x, playerPosition.z)
    if (nextNearWorkshop !== nearWorkshop.current) { nearWorkshop.current = nextNearWorkshop; onNearWorkshop(nextNearWorkshop) }
    const nextNearTide = canUseTidePool(playerPosition.x, playerPosition.z)
    if (nextNearTide !== nearTide.current) { nearTide.current = nextNearTide; onNearTide(nextNearTide) }
    const nextNearTree = canUseCollectionTree(playerPosition.x, playerPosition.z)
    if (nextNearTree !== nearTree.current) { nearTree.current = nextNearTree; onNearTree(nextNearTree) }
    if (import.meta.env.DEV) {
      diagnostics.current += delta
      if (diagnostics.current > 0.25) {
        diagnostics.current = 0
        gl.domElement.setAttribute('data-observatory-camera', JSON.stringify({
          position: camera.position.toArray(), yaw: view.current.y, pitch: view.current.x,
          locked: document.pointerLockElement === gl.domElement, active: input.current.active,
          nearHome: nextNearHome, nearGalaxy: nextNearGalaxy, nearWorkshop: nextNearWorkshop, nearTree: nextNearTree, treeOpen,
          paused: treeOpen || workshopOpen || !input.current.active || !!useGameStore.getState().panel, dpr: gl.getPixelRatio(), calls: gl.info.render.calls,
        }))
      }
    }
  }, -1)
  return null
}
