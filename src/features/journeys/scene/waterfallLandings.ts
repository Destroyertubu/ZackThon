import { MIRROR_ISLANDS, type MirrorIsland } from './MirrorGeometry'
import { CLOUD_ISLANDS } from './cloudfallGeometry'

export type WaterfallLanding = { position: [number, number, number]; radius: number; phase: number; hitsWater: boolean }
export function waterfallReach(island: MirrorIsland, angle: number) { return .42 * Math.hypot(Math.cos(angle) * island.width, Math.sin(angle) * island.depth) }

/** Positions follow the actual last vertex of each authored waterfall strip. */
export function getWaterfallLandings(waterLevel: number): WaterfallLanding[] {
  const landings: WaterfallLanding[] = []
  for (const island of MIRROR_ISLANDS.filter((_, index) => index % 2 === 0)) for (let channel = 0; channel < 2; channel++) {
    const angle = Math.atan2(-island.z, -island.x) + (channel - .5) * .17
    const reach = waterfallReach(island, angle)
    landings.push({ position: [island.x + Math.cos(angle) * (island.width * .67 + reach), waterLevel + .075, island.z + Math.sin(angle) * (island.depth * .67 + reach)],
      radius: channel ? 2.1 : 3.2, phase: landings.length * 1.731, hitsWater: true })
  }
  for (const island of CLOUD_ISLANDS) for (let channel = 0; channel < 2; channel++) {
    const angle = Math.atan2(-island.z, -island.x) + (channel - .5) * .43
    const height = Math.min(island.y + 1.5, 28), bottom = island.y + 1 - height, curve = Math.sin(Math.PI * .72) * 2.4
    const hitsWater = bottom <= waterLevel + .85
    landings.push({ position: [island.x + Math.cos(angle) * (island.width * .8 + curve), hitsWater ? waterLevel + .075 : bottom, island.z + Math.sin(angle) * (island.depth * .8 + curve)],
      radius: channel ? 2.6 : 3.7, phase: landings.length * 1.731, hitsWater })
  }
  return landings
}
