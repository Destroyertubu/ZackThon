import { useEffect, useMemo } from 'react'
import { Environment } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import type { QualityProfile } from '@/state/gameStore'
import GardenHomeDoor from './GardenHomeDoor'
import { Deck, GardenPergola } from './Architecture'
import { Telescope } from './Instruments'
import { GardenBeds, GardenLighting, StarTree } from './StarGarden'
import { ThoughtBar, TreeSeating } from './GardenFixtures'
import StarGate from './StarGate'
import NightLandscape from './NightLandscape'
import { GardenDetails } from './GardenDetails'
import { createObservatoryMaterials, disposeObservatoryMaterials } from './materials'

export default function ObservatoryScene({ quality, reducedMotion, onReturnHome, onEnterWorld, onOpenWorkshop }: {
  quality: QualityProfile; reducedMotion: boolean; onReturnHome: () => void
  onEnterWorld: () => void; onOpenWorkshop: () => void
}) {
  const materials = useMemo(() => createObservatoryMaterials(), [])
  useEffect(() => () => disposeObservatoryMaterials(materials), [materials])
  return <>
    <color attach="background" args={['#142331']} />
    <fog attach="fog" args={['#1c2c3d', 45, 175]} />
    <Environment files="/textures/kiara_7_late-afternoon_1k.hdr" environmentIntensity={0.28} environmentRotation={[0, 0.53, 0]} />
    <hemisphereLight args={['#7a9bdb', '#56391e', .38]} />
    <directionalLight position={[-10, 18, -9]} color="#9fbeff" intensity={1.1} castShadow
      shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
      shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15}
      shadow-camera-near={1} shadow-camera-far={55} shadow-bias={-0.00015} shadow-normalBias={0.035} />
    <directionalLight position={[-8, 7, 4]} color="#ffbc70" intensity={.6} />
    <NightLandscape reducedMotion={reducedMotion} />
    <Deck materials={materials} />
    <GardenPergola materials={materials} />
    <GardenBeds materials={materials} />
    <GardenDetails />
    <StarTree materials={materials} reducedMotion={reducedMotion} />
    <TreeSeating materials={materials} reducedMotion={reducedMotion} />
    <ThoughtBar materials={materials} reducedMotion={reducedMotion} onActivate={onOpenWorkshop} />
    <StarGate materials={materials} reducedMotion={reducedMotion} onActivate={onEnterWorld} />
    <Telescope materials={materials} />
    <GardenHomeDoor materials={materials} onActivate={onReturnHome} />
    <GardenLighting materials={materials} reducedMotion={reducedMotion} />
    {quality.postprocessing && <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={0.55} intensity={1.3} distanceFalloff={1.3} quality="performance" />
      <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1.0} luminanceSmoothing={0.4} />
      <Vignette eskil={false} offset={0.25} darkness={0.24} />
      <SMAA />
    </EffectComposer>}
  </>
}
