import type { KnowledgeId } from '../../../components/observatory/gardenRecipes'
import type { QualityMode } from '../../../state/gameStore'
import type { RealmId, RealmStation, WorldPose } from '../realmDefinitions'
export type { RealmStation, WorldPose } from '../realmDefinitions'
export interface WorldSceneProps {
  initialPose?: WorldPose
  initialStationId?: string
  onPose?: (pose: WorldPose) => void
  onNearStation?: (station: RealmStation | null) => void
  onInteract?: (stationId: string) => void
  onCaptureReady?: (capture: (() => string) | null) => void
  onReady?: () => void
  disabled?: boolean
  reducedMotion?: boolean
  qualityMode?: QualityMode
}
export interface JourneyWorldProps extends WorldSceneProps { realmId: RealmId; firstPercent?:number; primaryKnowledge?:KnowledgeId }
