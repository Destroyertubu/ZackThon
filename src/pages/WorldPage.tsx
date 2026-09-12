import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Canvas } from '@react-three/fiber'
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib'
import { useGameStore } from '@/state/gameStore'
import WorldPanels from '@/components/panels/WorldPanels'
import GameHUD from '@/components/hud/GameHUD'
import WorldScene from '@/components/world/WorldScene'
import FlyRig from '@/components/world/FlyRig'
import SkyAndDust from '@/components/world/SkyAndDust'

/** E 收纳：聚焦金句 → 收金句；聚焦节点 → 收其首个作品的摘要 */
function collectFocused() {
  const s = useGameStore.getState()
  const t = s.focusTarget
  if (!t) {
    s.showToast('准星对准金句或话题词后再收纳')
    return
  }
  if (t.kind === 'quote' && t.workId) {
    const w = s.getWork(t.workId)
    if (!w) return
    s.collect({ workId: w.workId, kind: w.kind, title: w.title, text: t.label, topicWord: s.contextWord ?? undefined })
    return
  }
  if (t.kind === 'node') {
    const node = s.nodes.find((n) => n.word === t.label)
    const workId = t.workId ?? node?.workIds[0]
    const w = workId ? s.getWork(workId) : undefined
    if (!w) return
    s.collect({
      workId: w.workId,
      kind: w.kind,
      title: w.title,
      text: w.description || w.introduction.slice(0, 80),
      topicWord: node?.word ?? s.contextWord ?? undefined,
    })
  }
}

export default function WorldPage() {
  const navigate = useNavigate()
  const seed = useGameStore((s) => s.seed)
  const panel = useGameStore((s) => s.panel)
  const realmWorkId = useGameStore((s) => s.realmWorkId)
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  const controlsRef = useRef<PointerLockControlsImpl | null>(null)

  useEffect(() => {
    if (!seed) navigate('/')
  }, [seed, navigate])

  useEffect(() => {
    lockedRef.current = locked
  }, [locked])

  /* 打开面板或进入场域时释放指针锁，交互交还给对应模块 */
  useEffect(() => {
    if ((panel !== null || realmWorkId !== null) && document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [panel, realmWorkId])

  /* 页面卸载兜底：退出指针锁，避免锁态泄漏到其他路由 */
  useEffect(() => {
    return () => {
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [])

  /* 全局按键：仅 pointer lock 激活且无面板、无场域时响应 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!lockedRef.current) return
      const s = useGameStore.getState()
      if (s.panel !== null || s.realmWorkId !== null) return
      switch (e.code) {
        case 'KeyE':
          collectFocused()
          break
        case 'KeyF': {
          const t = s.focusTarget
          if (t?.workId) s.enterRealm(t.workId)
          else s.showToast('准星未对准可进入的内容')
          break
        }
        case 'KeyR':
        case 'KeyT':
          s.openPanel('anchors')
          break
        case 'KeyB':
          s.openPanel('backpack')
          break
      }
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !lockedRef.current) return
      const s = useGameStore.getState()
      if (s.panel !== null || s.realmWorkId !== null) return
      const t = s.focusTarget
      if (t?.kind === 'quote' && t.workId) s.openPanel('reader', t.workId)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  if (!seed) return null

  const showEnterMask = !locked && panel === null && realmWorkId === null

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05070f]">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 72, near: 0.1, far: 900, position: [0, 14, 78] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 1.35 }}
      >
        <color attach="background" args={['#05070f']} />
        <fog attach="fog" args={['#05070f', 65, 300]} />
        <hemisphereLight args={['#46527a', '#2a1f0e', 1.1]} />
        <ambientLight intensity={0.35} color="#8a8f9c" />
        <directionalLight position={[40, 80, 20]} intensity={1.6} color="#e8dcc0" />
        <directionalLight position={[-50, 30, -40]} intensity={0.5} color="#7fd4c1" />
        <SkyAndDust />
        <WorldScene />
        <FlyRig controlsRef={controlsRef} onLockChange={setLocked} />
      </Canvas>

      {showEnterMask && (
        <button
          type="button"
          className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-5 bg-black/50 backdrop-blur-sm"
          onClick={() => controlsRef.current?.lock()}
        >
          <span className="font-serif text-3xl tracking-[0.5em] text-[#e8dcc0]">点击进入世界</span>
          <span className="text-sm tracking-wider text-[#8a8f9c]">
            WASD 飞行 · Shift 上升 · Ctrl 下降 · 滚轮调速 · E 收纳 · F 进入场域 · T 锚点 · B 行囊 · V 自动前往
          </span>
        </button>
      )}

      <WorldPanels />
      <GameHUD area="world" />
    </div>
  )
}
