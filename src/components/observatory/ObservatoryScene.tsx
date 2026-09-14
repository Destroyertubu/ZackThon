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
import StarTideGarden from './StarTideGarden'
import { createTideSignal, setAtmosphereQuiet, triggerTide, type AtmosphereResponse } from '@/features/journeys/scene/atmosphereMotion'
import type { KnowledgeId } from './gardenRecipes'
import FrameDiagnostics from '@/features/journeys/scene/FrameDiagnostics'
import { NIGHT_ART } from '@/features/journeys/scene/sceneArt'
import GardenPerimeter from './GardenPerimeter'
import GardenShadowSchedule from './GardenShadowSchedule'

export default function ObservatoryScene({ quality, reducedMotion, quiet, collectionReading = false, onReturnHome, onEnterWorld, onOpenWorkshop, response, onResonate, onIngredient }: {
  quality: QualityProfile; reducedMotion: boolean; onReturnHome: () => void
  onEnterWorld: () => void; onOpenWorkshop: () => void
  response: AtmosphereResponse; quiet: boolean; collectionReading?: boolean; onResonate: (origin?: [number, number]) => void; onIngredient: (id: KnowledgeId) => void
}) {
  const signal = useMemo(() => createTideSignal(), [])
  const materials = useMemo(() => createObservatoryMaterials(signal), [signal])
  useEffect(() => setAtmosphereQuiet(signal, quiet), [signal, quiet])
  useEffect(() => { if (response.id) triggerTide(signal, response) }, [signal, response])
  useEffect(() => () => disposeObservatoryMaterials(materials), [materials])
  return <>
    <FrameDiagnostics/>
    <GardenShadowSchedule smooth={!quality.postprocessing}/>
    <color attach="background" args={['#142331']} />
    <fog attach="fog" args={['#1c2c3d', 45, 175]} />
    <Environment files="/textures/kiara_7_late-afternoon_1k.hdr" environmentIntensity={NIGHT_ART.environment} environmentRotation={[0, 0.53, 0]} />
    <hemisphereLight args={[NIGHT_ART.skyFill,NIGHT_ART.groundFill,NIGHT_ART.hemisphere]} />
    <directionalLight position={NIGHT_ART.keyPosition} color={NIGHT_ART.keyColor} intensity={NIGHT_ART.keyIntensity} castShadow
      shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
      shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={15} shadow-camera-bottom={-15}
      shadow-camera-near={1} shadow-camera-far={190} shadow-bias={-0.00015} shadow-normalBias={0.035} />
    <directionalLight position={[-8, 7, 4]} color="#ffbc70" intensity={.32} />
    <NightLandscape quality={quality} sunPosition={NIGHT_ART.keyPosition} reducedMotion={reducedMotion} signal={signal} />
    <Deck materials={materials} />
    <GardenPergola materials={materials} />
    <GardenBeds materials={materials} />
    <GardenPerimeter materials={materials} signal={signal} reducedMotion={reducedMotion} detail={quality.postprocessing?'fine':'smooth'}/>
    <GardenDetails />
    <StarTree materials={materials} reducedMotion={reducedMotion} />
    <TreeSeating materials={materials} reducedMotion={reducedMotion} />
    <ThoughtBar materials={materials} reducedMotion={reducedMotion} onActivate={onOpenWorkshop} showLabel={!collectionReading} />
    <StarTideGarden materials={materials} signal={signal} onResonate={onResonate} onIngredient={onIngredient}/>
    <StarGate materials={materials} reducedMotion={reducedMotion} onActivate={onEnterWorld} showLabel={!collectionReading} />
    <Telescope materials={materials} />
    <GardenHomeDoor materials={materials} onActivate={onReturnHome} showLabel={!collectionReading} />
    <GardenLighting materials={materials} reducedMotion={reducedMotion} />
    {quality.postprocessing ? <EffectComposer multisampling={0}>
      <N8AO halfRes aoRadius={0.55} intensity={1.3} distanceFalloff={1.3} quality="performance" />
      <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1.0} luminanceSmoothing={0.4} />
      <Vignette eskil={false} offset={0.25} darkness={0.24} />
      <SMAA />
    </EffectComposer> : <EffectComposer multisampling={0}><SMAA/></EffectComposer>}
  </>
}
