import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import MirrorSky from './MirrorSky'
import MirrorWater from './MirrorWater'
import CloudRay from './CloudRay'
import ParticleFloatingIslands from './ParticleFloatingIslands'
import { advanceAtmosphere, createTideSignal, type TideSignal } from './atmosphereMotion'
import type { QualityProfile } from '../../../state/gameStore'
import type { WaterShore } from './waterSurface'
import { mirrorIslandGeometry, type MirrorMode } from './MirrorGeometry'

export type MirrorSeaBackdropProps = {
  mode: MirrorMode; reducedMotion?: boolean; compactTextures?: boolean; waterLevel?: number
  skyTop?: string; skyBottom?: string; waterColor?: string; sunColor?: string
  cabinShore?: boolean; signal?: TideSignal; quality?: QualityProfile
  sunPosition?: [number, number, number]; shores?: readonly WaterShore[]; character?: 'pool' | 'bay' | 'ocean'
}

/** Existing non-walkable cabin footing is independent of the replaced distant scenery. */
function CabinFoundation({ waterLevel }: { waterLevel: number }) {
  const texture = useTexture('/models/garden/journey-textures/rock_face_diff_1k.webp')
  const geometry = useMemo(() => mirrorIslandGeometry({ x: 0, z: -1, width: 13.2, depth: 13.8, height: 1.1, seed: 132 }, waterLevel - .1), [waterLevel])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: texture, color: '#c3ccc7', roughness: .9, vertexColors: true }), [texture])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  return <mesh name="cabin-pearl-rock-foundation" geometry={geometry} material={material} receiveShadow dispose={null}/>
}

/** Star-dust islands share the scene clock, water and renderer with the playable garden. */
export default function MirrorSeaBackdrop({ mode, reducedMotion = false, compactTextures = false, waterLevel = -1.1, skyTop, skyBottom, waterColor, sunColor, cabinShore = false, signal: externalSignal, quality, sunPosition, shores, character }: MirrorSeaBackdropProps) {
  const localSignal = useMemo(() => createTideSignal(), []), signal = externalSignal ?? localSignal
  // Suspended particles have no physical shoreline; only the playable land shapes the surf.
  const coastlines = useMemo<readonly WaterShore[]>(() => [
    ...(cabinShore ? [{ center: [0, -1] as const, radii: [13.2, 13.8] as const }] : []), ...(shores ?? [])], [cabinShore, shores])
  useFrame((_, delta) => advanceAtmosphere(signal, delta, reducedMotion))
  return <group name={`mirror-sea-world-${mode}`}>
    <MirrorSky signal={signal} mode={mode} compactTextures={compactTextures} skyTop={skyTop} skyBottom={skyBottom} sunColor={sunColor} sunPosition={sunPosition}/>
    <ParticleFloatingIslands signal={signal} mode={mode} fine={quality?.postprocessing ?? true}/>
    {cabinShore && <CabinFoundation waterLevel={waterLevel}/>}
    <CloudRay signal={signal}/>
    <MirrorWater size={520} signal={signal} mode={mode} reducedMotion={reducedMotion} waterLevel={waterLevel} skyTop={skyTop} skyBottom={skyBottom} waterColor={waterColor} sunColor={sunColor} quality={quality} sunPosition={sunPosition} shores={coastlines} character={character}/>
  </group>
}
