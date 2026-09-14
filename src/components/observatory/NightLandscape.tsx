import MirrorSeaBackdrop from '../../features/journeys/scene/MirrorSeaBackdrop'
import type { QualityProfile } from '@/state/gameStore'
import type { TideSignal } from '../../features/journeys/scene/atmosphereMotion'

/** Shared mirror-sea islands in blue hour, with the roof garden's stars and moon. */
export default function NightLandscape({ reducedMotion = false, signal, quality, sunPosition }: { reducedMotion?: boolean; signal?: TideSignal; quality?:QualityProfile; sunPosition?:[number,number,number] }) {
  return <MirrorSeaBackdrop compactTextures quality={quality} sunPosition={sunPosition} skyTop="#07152f" skyBottom="#293f62" mode="night" reducedMotion={reducedMotion} waterLevel={-3} signal={signal} />
}
