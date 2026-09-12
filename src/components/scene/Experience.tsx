import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, useProgress } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, Vignette, SMAA } from '@react-three/postprocessing'
import HomePlayer from '@/components/home/player/HomePlayer'
import HomeControls from '@/components/home/player/HomeControls'
import type { HomeInput } from '@/components/home/player/HomePlayer'
import type { HomeInteraction } from '@/components/home/player/navigation'
import { HOME_SPAWN, homeCameraTuning } from '@/components/home/player/config'
import { useNavigate } from 'react-router'
import { useGameStore } from '@/state/gameStore'
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

/* ---------- hotspot markers (drei Html, throttled raycast occlusion) ---------- */

const hotspotCss = `
.ww-hotspot { display: flex; align-items: center; gap: 7px; padding: 0; border: none; background: none; cursor: pointer; appearance: none; transition: transform 0.25s ease; }
.ww-hotspot:hover { transform: scale(1.14); }
.ww-hotspot-dot { width: 10px; height: 10px; border-radius: 9999px; background: #c9973f; box-shadow: 0 0 10px 3px rgba(201, 151, 63, 0.75); animation: ww-breathe 2.6s ease-in-out infinite; }
.ww-hotspot-label { font-family: ui-serif, Georgia, "Songti SC", "SimSun", serif; font-size: 11px; letter-spacing: 0.18em; color: #e8dcc0; white-space: nowrap; padding: 3px 10px; border-radius: 10px; border: 1px solid rgba(201, 151, 63, 0.4); background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(6px); }
@keyframes ww-breathe { 0%, 100% { opacity: 0.55; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.12); } }
`

const occRay = new THREE.Raycaster()

function Hotspot({
  position,
  label,
  onClick,
}: {
  position: [number, number, number]
  label: string
  onClick: () => void
}) {
  const { camera, scene } = useThree()
  const [occluded, setOccluded] = useState(false)
  const timer = useRef(Math.abs(position[0] * 0.037 + position[2] * 0.021) % 0.18) // desync the markers' raycasts
  const target = useMemo(() => new THREE.Vector3(...position), [position])
  const dir = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, delta) => {
    timer.current += delta
    if (timer.current < 0.18) return
    timer.current = 0
    dir.copy(target).sub(camera.position)
    const dist = dir.length()
    occRay.set(camera.position, dir.normalize())
    occRay.far = dist - 0.4
    const hit = occRay
      .intersectObjects(scene.children, true)
      .some((h) => (h.object as THREE.Mesh).isMesh)
    setOccluded(hit)
  })
  return (
    <Html
      position={position}
      center
      distanceFactor={10}
      zIndexRange={[9, 0]}
      style={{
        opacity: occluded ? 0 : 1,
        pointerEvents: occluded ? 'none' : 'auto',
        transition: 'opacity 0.3s ease',
      }}
    >
      <button
        type="button"
        className="ww-hotspot"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <span className="ww-hotspot-dot" />
        <span className="ww-hotspot-label">{label}</span>
      </button>
    </Html>
  )
}

function HotspotLayer() {
  const openPanel = useGameStore((s) => s.openPanel)
  const navigate = useNavigate()
  return (
    <group>
      {/* 展示柜 → 想法收纳柜 */}
      <Hotspot position={[4.3, 2.95, -4.2]} label="想法收纳柜" onClick={() => openPanel('cabinet')} />
      {/* 圆桌中央水晶 → 思维合成台 */}
      <Hotspot position={[0, 2.0, 0]} label="思维合成台" onClick={() => openPanel('synth')} />
      {/* 左侧书桌 → 漫行者日志 */}
      <Hotspot position={[-4.2, 1.85, 1.7]} label="漫行者日志" onClick={() => openPanel('journal')} />
      {/* 电话亭 → 同频电话亭 */}
      <Hotspot position={[4.75, 3.1, -0.7]} label="同频电话亭" onClick={() => openPanel('phone')} />
      {/* 房间门口 → 启程探索 */}
      <Hotspot position={[3.65, 2.1, 4.75]} label="启程探索" onClick={() => navigate('/world')} />
    </group>
  )
}

function LoaderOverlay() {
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0c10]">
      <div className="rounded-xl border border-[#c9973f]/30 bg-white/5 px-8 py-5 text-center backdrop-blur-md">
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
  const input = useMemo<HomeInput>(() => ({ keys: new Set() }), [])
  const [nearby, setNearby] = useState<HomeInteraction | null>(null)
  const interact = useCallback((spot: HomeInteraction) => {
    input.keys.clear()
    if (spot.id === 'world') navigate('/world')
    else useGameStore.getState().openPanel(spot.id)
  }, [navigate, input])
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0a0c10]">
      <style>{hotspotCss}</style>
      <LoaderOverlay />
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [HOME_SPAWN[0], 1.85, 4.3], fov: homeCameraTuning().fov, near: 0.05, far: 120 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.25
        }}
      >
        <color attach="background" args={['#9aaeb4']} />
        <fog attach="fog" args={['#c8b99a', 38, 105]} />
        <Suspense fallback={null}>
          {/* soft IBL so metals / glass / crystal have something real to reflect */}
          <Environment files="./textures/kloppenheim_06_puresky_1k.hdr" environmentIntensity={0.35} />
          <Lighting />
          <Backdrop />
          <Room />
          <Balcony />
          <RoundTable />
          <DeskArea />
          <DisplayCabinet />
          <PhoneBooth position={[4.75, 0, -0.7]} rotation={-1.32} />
          <Decor />
          <Atmosphere />
          <HotspotLayer />
          <HomePlayer input={input} onNearby={setNearby} onInteract={interact} />
        </Suspense>
        <EffectComposer multisampling={0}>
          <N8AO halfRes aoRadius={1.1} intensity={1.6} distanceFalloff={1.6} quality="performance" />
          <Bloom mipmapBlur intensity={0.55} luminanceThreshold={1.0} luminanceSmoothing={0.25} />
          <Vignette eskil={false} offset={0.22} darkness={0.38} />
          <SMAA />
        </EffectComposer>
      </Canvas>

      <HomeControls input={input} nearby={nearby} interact={interact} />
    </div>
  )
}
