import bundle from './data/zhihu-starter-v1.json'
import { emptyPersonalData, mergeSourceMetadata, validatePersonalData } from './persistence'
import type { PersonalData } from './types'

export const COLLECTION_SEED_VERSION = 'zhihu-starter-20260914-v1'

// Public API snapshots only. Shipping them with the app covers every browser/origin
// without spending another search request or distributing a player's private vault.
const starter = validatePersonalData({ ...emptyPersonalData(), ...bundle })

export function applyCollectionSeed(current: PersonalData): PersonalData {
  if (current.collectionSeedVersions?.includes(COLLECTION_SEED_VERSION)) return current

  const ids = new Set(starter.collections.map(record => record.id))
  // The earlier manual import used these same record IDs. If some/all leaves were
  // removed, their retained source snapshots also identify that completed import.
  const previouslyImported = current.collections.some(record => ids.has(record.id))
    || Object.keys(starter.sources).every(id => Object.hasOwn(current.sources, id))
  const sourceIds = new Set(current.collections.map(record => record.sourceId))
  const recordIds = new Set(current.collections.map(record => record.id))
  const additions = previouslyImported ? [] : starter.collections
    .filter(record => !recordIds.has(record.id) && !sourceIds.has(record.sourceId))
    .slice(0, Math.max(0, 5000 - current.collections.length))
  const sources = { ...current.sources }
  for (const record of additions) {
    sources[record.sourceId] = mergeSourceMetadata(sources[record.sourceId], starter.sources[record.sourceId])
  }
  return {
    ...current,
    sources,
    collections: [...current.collections, ...additions],
    collectionSeedVersions: [...(current.collectionSeedVersions ?? []), COLLECTION_SEED_VERSION],
  }
}
