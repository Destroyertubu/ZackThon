import { MaterialCaustics } from '@/features/typography/LightVfx'
import InteractionAccent from '@/features/presentation/InteractionAccent'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, useProgress } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, Vignette, SMAA } from '@react-three/postprocessing'
import HomePlayer from '@/components/home/player/HomePlayer'
import HomeControls from '@/components/home/player/HomeControls'
import type { HomeInput } from '@/components/home/player/HomePlayer'
import type { HomeInteraction } from '@/components/home/player/navigation'
import { BALCONY_SPAWN, BALCONY_YAW, HOME_SPAWN, HOME_YAW, homeCameraTuning } from '@/components/home/player/config'
import { useLocation, useNavigate } from 'react-router'
import { useGameStore } from '@/state/gameStore'
import { getQualityProfile } from '@/state/gameStore'
import PhoneBooth from '@/components/home/PhoneBooth'
import Room from './Room'
import RoundTable from './RoundTable'
import DeskArea from './DeskArea'
import DisplayCabinet from './DisplayCabinet'
import Decor from './Decor'
import Lighting from './Lighting'
import Atmosphere from './Atmosphere'
import Balcony from './Balcony'
import Backdrop from './Backdrop'
import CompanionAtHome from '@/components/home/mascot/CompanionAtHome'
import { usePersonalStore } from '@/features/personal/store'
import { activateHomeFixture } from '@/components/home/fixtureInteraction'

const PCF_SHADOW_MAP = 1

function HotspotLayer({onLand}:{onLand:()=>void}) {
  const openPanel = useGameStore((s) => s.openPanel)
  const mascotHints = usePersonalStore(s => s.data.settings.mascotHints)
  const panel = useGameStore(s => s.panel)
  return (
    <group>
      {/* 展示柜 → 想法收纳柜 */}
      <InteractionAccent position={[4.3, .75, -4.01]} disabled={!!panel} onActivate={() => openPanel('cabinet')} />
      {/* 圆桌中央水晶 → 思维合成台 */}
      <InteractionAccent position={[0, .984, 1.15]} size={1.7} rotation={[-Math.PI/2,0,0]} disabled={!!panel} onActivate={() => openPanel('synth')} />
      {/* 左侧书桌 → 漫行者日志 */}
      <InteractionAccent position={[-4.2, .801, 1.97]} rotation={[-Math.PI/2,0,.35]} disabled={!!panel} onActivate={() => openPanel('journal')} />
      <InteractionAccent position={[-5.2, 1.2, -2.4]} rotation={[0,Math.PI/2,0]} disabled={!!panel} onActivate={() => openPanel('library')} />
      {/* 电话亭 → 同频电话亭 */}
      <InteractionAccent position={[4.214, 1.55, -.563]} rotation={[0,-1.32,0]} disabled={!!panel} onActivate={() => openPanel('phone')} />
      {mascotHints && <InteractionAccent position={[-2.95, .1, -2.62]} rotation={[-Math.PI/2,0,0]} disabled={!!panel} onActivate={() => openPanel('mascot')} />}
      {/* 房间门口 → 镜海群岛 */}
      <InteractionAccent position={[3.65, 1.35, 4.74]} rotation={[0,Math.PI,0]} disabled={!!panel} onActivate={onLand} />
    </group>
  )
}

function LoaderOverlay() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0c10]">
      <div className="px-8 py-5 text-center">
        <p className="font-serif text-lg tracking-widest text-[#d8c9a3]">Wanderwise</p>
        <p className="mt-2 text-xs tracking-wider text-[#8a8f9c]">
          正在点亮烛火 … {Math.round(progress)}%
        </p>
      </div>
    </div>
  )
}

export default function Experience() {
  const navigate = useNavigate()
  const location = useLocation()
  const returningFromObservatory = (location.state as { spawn?: string } | null)?.spawn === 'balcony-observatory'
  const initialSpawn = returningFromObservatory ? BALCONY_SPAWN : HOME_SPAWN
  const initialYaw = returningFromObservatory ? BALCONY_YAW : HOME_YAW
  const qualityMode = useGameStore((s) => s.qualityMode)
  const quality = useMemo(() => getQualityProfile(qualityMode), [qualityMode])
  const input = useMemo<HomeInput>(() => ({ keys: new Set() }), [])
  const [nearby, setNearby] = useState<HomeInteraction | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [destination, setDestination] = useState('observatory')
  const transitionTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
  }, [])
  const enterObservatory = useCallback(() => {
    if (transitioning) return
    setTransitioning(true)
    setDestination('observatory')
    input.keys.clear()
    useGameStore.getState().closePanel()
    transitionTimer.current = window.setTimeout(() => {
      navigate('/observatory', { state: { spawn: 'balcony-observatory' } })
    }, 1200)
  }, [input, navigate, transitioning])
  const enterLand = useCallback(() => {
    if (transitioning) return
    setDestination('land'); setTransitioning(true); input.keys.clear(); useGameStore.getState().closePanel()
    transitionTimer.current = window.setTimeout(() => navigate('/land'), 700)
  }, [input, navigate, transitioning])
  const interact = useCallback((spot: HomeInteraction) => {
    if (transitioning) return
    input.keys.clear()
    if (spot.id === 'world') enterLand()
    else if (spot.id === 'observatory') enterObservatory()
    else useGameStore.getState().openPanel(spot.id)
  }, [input, enterLand, enterObservatory, transitioning])
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0a0c10]">
      <LoaderOverlay />
      <Canvas
        shadows={{type:PCF_SHADOW_MAP}}
        dpr={quality.dprMax === 1 ? 1 : [1, quality.dprMax]}
        gl={{ antialias: true }}
        camera={{ position: [HOME_SPAWN[0], 1.85, 4.3], fov: homeCameraTuning().fov, near: 0.05, far: 240 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.25
        }}
      >
        <color attach="background" args={['#9aaeb4']} />
        <fog attach="fog" args={['#a4a7bb', 55, 210]} />
        <Suspense fallback={null}>
          {/* Match the room IBL to the Kiara valley panorama used outside. */}
          <Environment files="/textures/kiara_7_late-afternoon_1k.hdr" environmentIntensity={0.35} />
          <Lighting shadowMapSize={quality.shadowMapSize} crystalShadow={quality.postprocessing} />
          <Backdrop />
          <Room />
          <Balcony onObservatory={enterObservatory} />
          <group onClick={e=>activateHomeFixture(e,'synth')}><RoundTable /></group>
          <MaterialCaustics position={[.3,.973,.5]} scale={2.1}/>
          <DeskArea />
          <group onClick={e=>activateHomeFixture(e,'cabinet')}><DisplayCabinet /></group>
          <group onClick={e=>activateHomeFixture(e,'phone')}><PhoneBooth position={[4.75, 0, -0.7]} rotation={-1.32} /></group>
          <Decor />
          <Atmosphere />
          <CompanionAtHome />
          <HotspotLayer onLand={enterLand} />
          <HomePlayer input={input} initialSpawn={initialSpawn} initialYaw={initialYaw} onNearby={setNearby} onInteract={interact} />
        </Suspense>
        {quality.postprocessing && (
          <EffectComposer multisampling={0}>
            <N8AO halfRes aoRadius={1.1} intensity={1.6} distanceFalloff={1.6} quality="performance" />
            <Bloom mipmapBlur intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.25} />
            <Vignette eskil={false} offset={0.22} darkness={0.38} />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>

      <HomeControls input={input} nearby={nearby} interact={interact} />
      {transitioning && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#05070f]/75 opacity-100 transition-opacity duration-700">
          <div className="text-center">
            <div className="mx-auto mb-5 h-20 w-20 animate-pulse rounded-full border border-[#9ed7dc]/70 bg-[#9ed7dc]/10 shadow-[0_0_50px_rgba(126,216,220,0.45)]" />
            <p className="font-serif text-sm tracking-[0.35em] text-[#d8c9a3]">{destination === 'land' ? '镜海的风，正穿过门廊' : '星光之门已开启'}</p>
            <p className="mt-2 text-xs tracking-widest text-[#9ed7dc]/80">{destination === 'land' ? '正在走进镜海群岛' : '正在前往屋顶观测台'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
