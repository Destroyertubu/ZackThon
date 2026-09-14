import JourneyWorld from '@/features/journeys/scene/JourneyWorld'

/** Warm the real scene without mounting JourneyPage or creating a saved journey. */
export default function ShowcaseWarmup() {
  return <JourneyWorld realmId="sunset-boulevard" qualityMode="fine" firstPercent={60} primaryKnowledge="literature" disabled />
}
