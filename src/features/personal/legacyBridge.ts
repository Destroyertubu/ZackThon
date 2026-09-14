import { z } from 'zod'
import { useGameStore } from '../../state/gameStore'
import type { GameState } from '../../state/gameStore'
import { usePersonalStore } from './store'
import type { ContentSource } from './types'

const KEY = 'wanderwise-game-v1'
const text = z.string().max(60_000)
const number = z.number().finite()
const position = z.tuple([number, number, number])
const trailPoint = z.object({ t: number, pos: position, word: text.optional() })
const fieldSchemas = {
  qualityMode: z.enum(['auto', 'fine', 'smooth']),
  seed: z.object({ rawInput: text, topics: z.array(text).max(1000), createdAt: number }).nullable(),
  nodes: z.array(z.object({ id: text, word: text, position, workIds: z.array(text).max(1000), weight: number, isSeed: z.boolean(), expanded: z.boolean() })).max(10_000),
  visitedWords: z.array(text).max(10_000),
  trail: z.array(trailPoint).max(10_000),
  backpack: z.array(z.object({ id: text, workId: text, kind: z.enum(['story', 'knowledge']), title: text, text, topicWord: text.optional(), collectedAt: number })).max(5000),
  links: z.array(z.object({ id: text, aId: text, bId: text, note: text, createdAt: number })).max(10_000),
  anchors: z.array(z.object({ id: text, topicWord: text.optional(), workId: text.optional(), text, author: text, mine: z.boolean(), likes: number, likedByMe: z.boolean(), comments: z.array(z.object({ id: text, author: text, text, createdAt: number })).max(5000), createdAt: number })).max(10_000),
  journeys: z.array(z.object({ id: text, startedAt: number, endedAt: number, visitedWords: z.array(text).max(10_000), collected: number, anchors: number, trail: z.array(trailPoint).max(10_000) })).max(1000),
}
type LegacyFields = Pick<GameState, keyof typeof fieldSchemas>
const record = (value: unknown): Record<string, unknown> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined

/** Restore only known, shape-checked business fields; executable store actions are never imported. */
export function readLegacyGameState(value: unknown): Partial<LegacyFields> {
  const state = record(record(value)?.state)
  if (!state) return {}
  const result: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(fieldSchemas)) {
    const parsed = schema.safeParse(state[key])
    if (parsed.success) result[key] = parsed.data
  }
  return result as Partial<LegacyFields>
}
function snapshot(state: GameState): LegacyFields {
  const { qualityMode, seed, nodes, visitedWords, trail, backpack, links, anchors, journeys } = state
  return { qualityMode, seed, nodes, visitedWords, trail: trail.slice(-500), backpack, links, anchors, journeys }
}

/** Shared inventory projection plus one-time import restoration; ordinary collection edits never rewind a world. */
export function connectLegacyInventory() {
  let syncing = false
  let observedLegacy: unknown

  function projectInventory() {
    const { data } = usePersonalStore.getState()
    const current = useGameStore.getState()
    const backpack = data.collections.flatMap((collection) => {
      const source = data.sources[collection.sourceId]
      if (!source) return []
      const existing = current.backpack.find((item) => item.id === (collection.legacyId ?? collection.id))
      return [{ id: collection.legacyId ?? collection.id, workId: source.legacyWorkId ?? source.id, kind: existing?.kind ?? 'knowledge' as const, title: source.title, text: collection.excerpt, topicWord: existing?.topicWord ?? source.tags?.[0], collectedAt: Number.isFinite(Date.parse(collection.createdAt)) ? Date.parse(collection.createdAt) : 0 }]
    })
    const ids = new Set(backpack.map((item) => item.id))
    const links = current.links.filter((link) => ids.has(link.aId) && ids.has(link.bId))
    if (JSON.stringify(backpack) !== JSON.stringify(current.backpack) || links.length !== current.links.length) useGameStore.setState({ backpack, links })
  }
  function rememberGame() {
    const state = usePersonalStore.getState()
    if (!state.ready) return
    const next = { version: 0, state: snapshot(useGameStore.getState()) }
    if (JSON.stringify(state.data.legacy[KEY]) === JSON.stringify(next)) { observedLegacy = state.data.legacy[KEY]; return }
    observedLegacy = next
    usePersonalStore.setState({ data: { ...state.data, legacy: { ...state.data.legacy, [KEY]: next } } })
  }
  function fromPersonal(restore: boolean) {
    const personal = usePersonalStore.getState()
    if (!personal.ready || syncing) return
    syncing = true
    try {
      if (restore) {
        observedLegacy = personal.data.legacy[KEY]
        useGameStore.setState(readLegacyGameState(observedLegacy))
      }
      projectInventory()
      rememberGame()
    } finally { syncing = false }
  }

  const personal = usePersonalStore.subscribe((state, previous) => {
    if (!state.ready || syncing) return
    const imported = state.data.legacy[KEY] !== observedLegacy
    if (!previous.ready || imported || state.data.collections !== previous.data.collections || state.data.sources !== previous.data.sources) fromPersonal(!previous.ready || imported)
  })
  const game = useGameStore.subscribe((state, previous) => {
    if (syncing || !usePersonalStore.getState().ready) return
    if (!Object.keys(fieldSchemas).some((key) => state[key as keyof LegacyFields] !== previous[key as keyof LegacyFields])) return
    syncing = true
    try {
      if (state.backpack !== previous.backpack) {
        for (const removed of previous.backpack.filter((old) => !state.backpack.some((item) => item.id === old.id))) usePersonalStore.getState().uncollect(removed.id)
        for (const item of state.backpack) {
          const old = previous.backpack.find((entry) => entry.id === item.id)
          if (old && old.workId === item.workId && old.text === item.text) continue
          if (old) usePersonalStore.getState().uncollect(item.id)
          const work = state.works.find((entry) => entry.workId === item.workId)
          const source: ContentSource = { id: `work:${item.workId}`, legacyWorkId: item.workId, title: item.title, summary: item.text, author: work?.authorName ?? '', url: '', source: '知乎知识内容', kind: 'excerpt', fetchedAt: new Date(item.collectedAt).toISOString(), tags: item.topicWord ? [item.topicWord] : [] }
          usePersonalStore.getState().collect(source, item.text, item.id)
        }
      }
      if (state.anchors !== previous.anchors) for (const anchor of state.anchors) {
        if (anchor.mine && previous.anchors.find((old) => old.id === anchor.id)?.text !== anchor.text) usePersonalStore.getState().saveNote({ id: `anchor:${anchor.id}`, title: anchor.topicWord ?? '我的想法', text: anchor.text, createdAt: new Date(anchor.createdAt).toISOString() })
      }
      if (state.backpack !== previous.backpack) projectInventory()
      rememberGame()
    } finally { syncing = false }
  })
  fromPersonal(true)
  return () => { personal(); game() }
}
