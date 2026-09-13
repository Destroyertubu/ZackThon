import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { ArrowLeft, ArrowUpRight, Compass, Leaf, MoveUpRight, RotateCcw, Settings, Sparkles, Wine, X } from 'lucide-react'
import * as THREE from 'three'
import ObservatoryScene from '@/components/observatory/ObservatoryScene'
import ObservatoryRig from '@/components/observatory/ObservatoryRig'
import GardenWorkshop from '@/components/observatory/GardenWorkshop'
import type { ObservatoryInput } from '@/components/observatory/ObservatoryRig'
import { OBSERVATORY_SPAWN } from '@/components/observatory/layout'
import { getQualityProfile, useGameStore } from '@/state/gameStore'
import SettingsPanel from '@/components/hud/SettingsPanel'
import { Toast } from '@/components/hud/Toast'
import '@/components/hud/hud.css'
import './observatory.css'

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const change = () => setMatches(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [query])
  return matches
}

function LoadingProgress() {
  const progress = useProgress(s => s.progress)
  return <div className="observatory-loading" role="status">
    <Compass size={30} strokeWidth={1} />
    <span>正在唤醒星树下的花园</span>
    <span className="observatory-loading-track"><span style={{ width: `${progress}%` }} /></span>
  </div>
}

export default function ObservatoryPage() {
  const navigate = useNavigate()
  const qualityMode = useGameStore(s => s.qualityMode)
  const panel = useGameStore(s => s.panel)
  const quality = useMemo(() => getQualityProfile(qualityMode), [qualityMode])
  const input = useRef<ObservatoryInput>({ keys: new Set(), active: true, reset: false, canvas: null })
  const [ready, setReady] = useState(false)
  const [locked, setLocked] = useState(false)
  const [nearHome, setNearHome] = useState(false)
  const [nearGalaxy, setNearGalaxy] = useState(false)
  const [nearWorkshop, setNearWorkshop] = useState(false)
  const [seedPrompt, setSeedPrompt] = useState(false)
  const [workshopOpen, setWorkshopOpen] = useState(false)
  const wasBlocked = useRef(false)
  const blocked = !!panel || seedPrompt || workshopOpen
  const touch = useMedia('(pointer: coarse)')
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)')
  const onReady = useCallback(() => setReady(true), [])
  const onLockChange = useCallback((value: boolean) => setLocked(value), [])

  useEffect(() => {
    const previousTitle = document.title
    const controller = input.current
    document.title = '星树花园 · 漫思 Wanderwise'
    return () => { document.title = previousTitle; controller.keys.clear(); controller.active = false }
  }, [input])
  useEffect(() => {
    if (!seedPrompt) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSeedPrompt(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [seedPrompt, input])
  useEffect(() => {
    const controller = input.current
    controller.active = !blocked
    if (blocked) { controller.keys.clear(); controller.pauseLook?.() }
    else if (wasBlocked.current) controller.resumeLook?.()
    wasBlocked.current = blocked
  }, [blocked])

  const leave = useCallback(() => {
    input.current.keys.clear()
    if (document.pointerLockElement) document.exitPointerLock()
  }, [])
  const enterWorld = useCallback(() => {
    leave()
    if (useGameStore.getState().seed) navigate('/world')
    else { input.current.active = false; setSeedPrompt(true) }
  }, [leave, navigate])
  const openWorkshop = useCallback(() => {
    input.current.active = false
    input.current.pauseLook?.()
    leave(); setWorkshopOpen(true)
  }, [leave])
  const closeWorkshop = useCallback(() => setWorkshopOpen(false), [])
  const returnHome = useCallback(() => {
    leave(); useGameStore.getState().closePanel()
    navigate('/home', { state: { spawn: 'balcony-observatory' } })
  }, [leave, navigate])

  return <main className={`observatory-page ${locked ? 'is-locked' : ''}`}>
    <Canvas shadows dpr={quality.dprMax === 1 ? 1 : [1, quality.dprMax]}
      camera={{ fov: 68, near: 0.05, far: 240, position: OBSERVATORY_SPAWN }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05 }}>
      <Suspense fallback={null}>
        <ObservatoryScene quality={quality} reducedMotion={reducedMotion} onReturnHome={returnHome} onEnterWorld={enterWorld} onOpenWorkshop={openWorkshop} />
        <ObservatoryRig input={input} onReady={onReady} onLockChange={onLockChange} onReturnHome={returnHome} onEnterWorld={enterWorld} onOpenWorkshop={openWorkshop}
          onNearHome={setNearHome} onNearGalaxy={setNearGalaxy} onNearWorkshop={setNearWorkshop} />
      </Suspense>
    </Canvas>
    <div className="observatory-vignette" aria-hidden="true" />
    {!ready && <LoadingProgress />}

    <header className="observatory-header">
      <div className="observatory-identity">
        <span className="observatory-monogram" aria-hidden="true"><Leaf strokeWidth={1} /></span>
        <div><p className="observatory-eyebrow">漫思 WANDERWISE <span>/</span> 山间家园</p>
          <h1>星树花园</h1>
          <p className="observatory-subtitle">在树下收集灵感，沿星光走向星河。</p>
        </div>
      </div>
      <nav aria-label="观星台导航" className="observatory-nav">
        <button type="button" className="observatory-button return-home" onClick={returnHome} aria-keyshortcuts="H"><ArrowLeft size={15} />返回小屋{!touch && <kbd>H</kbd>}</button>
        <button type="button" className="observatory-icon-button" aria-label="设置画质" title="设置画质" onClick={() => { leave(); useGameStore.getState().openPanel('settings') }}><Settings size={17} strokeWidth={1.5} /></button>
      </nav>
    </header>

    {locked && <div className="observatory-reticle" aria-hidden="true" />}
    {nearHome && !blocked && <button type="button" className="observatory-return-prompt" aria-label="通过传送门返回小屋" aria-keyshortcuts="E" onClick={returnHome}>
      {!touch && <kbd>E</kbd>}返回小屋<ArrowLeft size={16} /><small>{touch ? '点击回到阳台' : '回到阳台，继续家园漫步'}</small>
    </button>}
    {!nearHome && nearGalaxy && !blocked && <button type="button" className="observatory-return-prompt garden-galaxy-prompt" aria-keyshortcuts="E" onClick={enterWorld}>
      {!touch && <kbd>E</kbd>}沿星光出发<Sparkles size={16} /><small>穿过树枝之间，进入你的星系</small>
    </button>}
    {!nearHome && !nearGalaxy && nearWorkshop && !blocked && <button type="button" className="observatory-return-prompt garden-workshop-prompt" aria-keyshortcuts="E" onClick={openWorkshop}>
      {!touch && <kbd>E</kbd>}调一杯思想<Wine size={16} /><small>两种知识，在这里相遇</small>
    </button>}
    <footer className="observatory-footer">
      <div className="observatory-location"><Leaf size={20} strokeWidth={1.2} /><div><span>星树下 · 花园与远方</span><small>{touch ? '方向键行走 · 拖动环顾 · 靠近后点击互动' : locked ? 'WASD 行走 · E 互动 · H 回家 · Esc 释放 · F 恢复' : '鼠标即环顾 · WASD 行走 · E 互动 · Esc 释放 · F 恢复 · H 回家'}</small></div></div>
      <div className="observatory-walk-controls">
        {!locked && <button type="button" className="observatory-icon-button" disabled={!ready} aria-label="回到观测起点" title="回到观测起点" onClick={() => { input.current.reset = true }}><RotateCcw size={16} /></button>}
      </div>
      <div className="garden-footer-actions">
        <button type="button" className="observatory-icon-button garden-workshop-shortcut" aria-label="打开思想调酒" title="思想调酒" onClick={openWorkshop}><Wine size={20} strokeWidth={1.3} /></button>
        <button type="button" className="observatory-world-button" onClick={enterWorld}><span><small>树枝之间 · 下一段旅程</small>进入星系</span><ArrowUpRight size={23} strokeWidth={1.2} /></button>
      </div>
    </footer>

    {touch && ready && !blocked && <div className="observatory-touch-pad" aria-label="行走方向键">
      {(['', 'KeyW', '', 'KeyA', 'KeyS', 'KeyD'] as const).map((key, i) => key ? <button key={key} type="button" aria-label={{ KeyW: '向前走', KeyA: '向左走', KeyS: '向后走', KeyD: '向右走' }[key]}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current.keys.add(key) }}
        onPointerUp={() => input.current.keys.delete(key)} onPointerCancel={() => input.current.keys.delete(key)} onLostPointerCapture={() => input.current.keys.delete(key)}>
        {{ KeyW: '↑', KeyA: '←', KeyS: '↓', KeyD: '→' }[key]}</button> : <span key={i} />)}
    </div>}
    {panel === 'settings' && <SettingsPanel />}
    <div className="observatory-toast"><Toast /></div>
    {workshopOpen && <GardenWorkshop onClose={closeWorkshop} />}
    {seedPrompt && <div className="observatory-dialog-backdrop" onClick={() => setSeedPrompt(false)}>
      <section className="observatory-dialog" role="dialog" aria-modal="true" aria-labelledby="seed-prompt-title" onClick={e => e.stopPropagation()} onKeyDown={event => {
        if (event.key !== 'Tab') return
        const buttons = event.currentTarget.querySelectorAll('button')
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }}>
        <button type="button" autoFocus className="observatory-icon-button dialog-close" aria-label="关闭提示" onClick={() => setSeedPrompt(false)}><X size={18} /></button>
        <Compass size={34} strokeWidth={1} />
        <p className="observatory-eyebrow">一段旅程，从好奇开始</p>
        <h2 id="seed-prompt-title">你的星空，还未点亮</h2>
        <p>先选一个想探索的话题，<br />它会成为这片星空的第一颗星。</p>
        <button type="button" className="observatory-button" onClick={() => navigate('/')} >选择启程话题<MoveUpRight size={16} /></button>
      </section>
    </div>}
  </main>
}
