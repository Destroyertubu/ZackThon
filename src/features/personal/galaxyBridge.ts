import type { SavedItem, Reflection, JourneyStop } from '../galaxy/types'
import { usePersonalStore } from './store'
import type { CollectionRecord, ContentSource } from './types'
import { canonicalSource, safeSourceUrl } from './persistence'

function collectionGroups() {
  const { data } = usePersonalStore.getState()
  const groups = new Map<string, { source: ContentSource; collections: CollectionRecord[]; item: SavedItem }>()
  for (const collection of data.collections) {
    const source = data.sources[collection.sourceId]
    if (!source) continue
    const id = source.galaxy?.id ?? collection.id
    const type = source.galaxy?.type ?? 'answer'
    const key = `${type}:${id}`
    const existing = groups.get(key)
    if (existing) { existing.collections.push(collection); continue }
    groups.set(key, { source, collections: [collection], item: { id, type, title: source.title, excerpt: collection.excerpt, author: source.author, url: source.url || undefined, questionId: source.galaxy?.questionId ?? source.id, answerId: source.galaxy?.answerId, query: source.galaxy?.query ?? source.title.slice(0, 160), savedAt: collection.createdAt } })
  }
  return [...groups.values()].slice(0, 500)
}
export function sharedCollection(): SavedItem[] | undefined {
  if (!usePersonalStore.getState().ready) return
  return collectionGroups().map((group) => group.item)
}
export function saveSharedCollection(items: SavedItem[]) {
  if (!usePersonalStore.getState().ready) return
  const groups = collectionGroups()
  const incoming = new Map(items.map((item) => [`${item.type}:${item.id}`, item]))
  // An unchanged source row retains every excerpt. Only explicit removal deletes that visible source group.
  for (const group of groups) if (!incoming.has(`${group.item.type}:${group.item.id}`)) for (const collection of group.collections) usePersonalStore.getState().uncollect(collection.id)
  const existing = new Set(groups.map((group) => `${group.item.type}:${group.item.id}`))
  for (const [key, item] of incoming) {
    if (existing.has(key)) continue
    const url = safeSourceUrl(item.url ?? '')
    const host = url ? new URL(url).hostname : ''
    const isZhihu = host === 'zhihu.com' || host.endsWith('.zhihu.com')
    const source: ContentSource = { id: `galaxy:${item.type}:${item.id}`, remoteId: item.answerId ?? item.id, title: item.title, summary: item.excerpt, author: item.author ?? '', url, source: isZhihu ? '知乎' : host || '导入内容', kind: isZhihu && item.type === 'question' ? 'question' : 'summary', fetchedAt: item.savedAt, galaxy: { id: item.id, type: item.type, questionId: item.questionId, answerId: item.answerId, query: item.query } }
    const known = usePersonalStore.getState().data.sources[canonicalSource(source).id]
    // A galaxy view does not change a source's publisher, curation status or server identity.
    usePersonalStore.getState().collect(known ? { ...source, ...known, galaxy: known.galaxy ?? source.galaxy } : source, item.excerpt)
  }
}
export function sharedReflections(): Reflection[] | undefined {
  const { ready, data } = usePersonalStore.getState()
  if (!ready) return
  return data.notes.slice(0, 500).map((note) => ({ id: note.id, targetId: note.sourceId ?? note.id, targetTitle: note.title, quote: note.quote, text: note.text, query: '', createdAt: note.createdAt }))
}
export function saveSharedReflections(items: Reflection[]) {
  const state = usePersonalStore.getState()
  if (!state.ready) return
  const visible = new Set(state.data.notes.slice(0, 500).map((note) => note.id))
  const keep = new Set(items.map((note) => note.id))
  usePersonalStore.setState({ data: { ...state.data, notes: state.data.notes.filter((note) => !visible.has(note.id) || keep.has(note.id)) } })
  for (const note of items) {
    const source = Object.values(state.data.sources).find((entry) => entry.id === note.targetId || entry.remoteId === note.targetId || entry.galaxy?.id === note.targetId || entry.galaxy?.answerId === note.targetId)
    usePersonalStore.getState().saveNote({ id: note.id, title: note.targetTitle, text: note.text, quote: note.quote, ...(source ? { sourceId: source.id } : {}), createdAt: note.createdAt })
  }
}
export function sharedGalaxyJourney(): JourneyStop[] | undefined {
  const { ready, data } = usePersonalStore.getState()
  if (!ready) return
  const stops = data.legacy['wanderwise.journey.v1']
  return Array.isArray(stops) ? stops as JourneyStop[] : []
}
export function saveSharedGalaxyJourney(items: JourneyStop[]) {
  const state = usePersonalStore.getState()
  if (state.ready) usePersonalStore.setState({ data: { ...state.data, legacy: { ...state.data.legacy, 'wanderwise.journey.v1': items } } })
}
