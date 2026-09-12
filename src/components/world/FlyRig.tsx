import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib'
import type { RefObject } from 'react'
import { useGameStore } from '@/state/gameStore'
import type { TopicNode } from '@/types/game'

const MOVE_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight', 'KeyC',
])

const BASE_SPEED = 16

const tmpDir = new THREE.Vector3()
const tmpRight = new THREE.Vector3()
const tmpMove = new THREE.Vector3()
const tmpPos = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/** 第一人称飞行控制：pointer lock + WASD/Shift/Ctrl 六向移动 + 滚轮调速 + V 自动追踪 */
export default function FlyRig({ controlsRef, onLockChange }: {
  controlsRef: RefObject<PointerLockControlsImpl | null>
  onLockChange: (locked: boolean) => void
}) {
  const camera = useThree((s) => s.camera)
  const locked = useRef(false)
  const keys = useRef(new Set<string>())
  const speedMul = useRef(1)
  const autoTarget = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    const startAutoTrack = () => {
      const s = useGameStore.getState()
      let node: TopicNode | undefined
      if (s.focusTarget?.kind === 'node') {
        node = s.nodes.find((n) => n.word === s.focusTarget!.label)
      }
      if (!node) {
        let best: TopicNode | undefined
        let bestDist = Infinity
        for (const n of s.nodes) {
          if (s.visitedWords.includes(n.word)) continue
          const d = tmpPos.set(n.position[0], n.position[1], n.position[2]).distanceTo(camera.position)
          if (d < bestDist) {
            bestDist = d
            best = n
          }
        }
        node = best
      }
      if (!node) {
        s.showToast('没有可前往的目标')
        return
      }
      autoTarget.current = new THREE.Vector3(node.position[0], node.position[1], node.position[2])
      s.showToast(`自动前往「${node.word}」，按移动键取消`)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!locked.current) return
      const s = useGameStore.getState()
      if (s.panel !== null || s.realmWorkId !== null) return
      if (MOVE_CODES.has(e.code)) {
        keys.current.add(e.code)
        autoTarget.current = null
        e.preventDefault()
      } else if (e.code === 'KeyV') {
        startAutoTrack()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code)
    }
    const onWheel = (e: WheelEvent) => {
      if (!locked.current) return
      const s = useGameStore.getState()
      if (s.panel !== null || s.realmWorkId !== null) return
      speedMul.current = THREE.MathUtils.clamp(speedMul.current * (e.deltaY < 0 ? 1.15 : 0.87), 0.3, 4)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('wheel', onWheel)
    }
  }, [camera])

  useFrame((_, delta) => {
    if (!locked.current) return
    const s = useGameStore.getState()
    if (s.panel !== null || s.realmWorkId !== null) return

    if (autoTarget.current) {
      camera.position.lerp(autoTarget.current, Math.min(1, delta * 2.2))
      if (camera.position.distanceTo(autoTarget.current) < 8) {
        autoTarget.current = null
        s.showToast('已抵达')
      }
    }

    const k = keys.current
    tmpMove.set(0, 0, 0)
    if (k.has('KeyW') || k.has('KeyS') || k.has('KeyA') || k.has('KeyD')) {
      camera.getWorldDirection(tmpDir)
      tmpDir.y = 0
      if (tmpDir.lengthSq() > 1e-6) tmpDir.normalize()
      tmpRight.crossVectors(tmpDir, UP).normalize()
      if (k.has('KeyW')) tmpMove.add(tmpDir)
      if (k.has('KeyS')) tmpMove.sub(tmpDir)
      if (k.has('KeyD')) tmpMove.add(tmpRight)
      if (k.has('KeyA')) tmpMove.sub(tmpRight)
    }
    if (k.has('ShiftLeft') || k.has('ShiftRight')) tmpMove.y += 1
    if (k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC')) tmpMove.y -= 1
    if (tmpMove.lengthSq() > 0) {
      tmpMove.normalize()
      camera.position.addScaledVector(tmpMove, BASE_SPEED * speedMul.current * delta)
    }
  })

  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={() => {
        locked.current = true
        onLockChange(true)
      }}
      onUnlock={() => {
        locked.current = false
        keys.current.clear()
        autoTarget.current = null
        onLockChange(false)
      }}
    />
  )
}
