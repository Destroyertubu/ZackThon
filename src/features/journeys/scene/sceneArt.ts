import type { WorldPoint } from '../realmDefinitions'

/** One vector drives the sky disc, shadow camera and water light path. */
export type SceneArtProfile = {
  keyPosition: WorldPoint; keyColor: string; keyIntensity: number
  skyFill: string; groundFill: string; hemisphere: number; environment: number
  exposure: number; wind: readonly [number, number]; windStrength: number
  water: 'pool' | 'bay' | 'ocean'
}
export const SUNSET_ART: SceneArtProfile = {
  keyPosition: [48, 25, -140], keyColor: '#ffb477', keyIntensity: 3.25,
  skyFill: '#adb4db', groundFill: '#615260', hemisphere: .78, environment: .32,
  exposure: 1.08, wind: [.86, .35], windStrength: .28, water: 'bay',
}
export const NIGHT_ART: SceneArtProfile = {
  keyPosition: [72, 49, -110], keyColor: '#a5c8ff', keyIntensity: 1.6,
  skyFill: '#839fc5', groundFill: '#463e50', hemisphere: .42, environment: .24,
  exposure: 1.12, wind: [.86, .35], windStrength: .28, water: 'ocean',
}
export function sceneArt(night: boolean): SceneArtProfile { return night ? NIGHT_ART : SUNSET_ART }
