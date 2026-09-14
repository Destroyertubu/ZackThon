import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { ContentSource, PersonalData } from './types'
import type { SavedItem } from '../galaxy/types'

// A controlled transaction stub tests sequencing and failure handling, not browser IDB compatibility.
const records = new Map<string, unknown>()
const local = new Map<string, string>()
let failWrite: ((key: string, value: unknown) => boolean) | undefined
let failRead: ((key: string) => boolean) | undefined
const writes: Array<{ key: string; value: unknown; committed: boolean }> = []
function fakeRequest(operation: () => unknown) {
  const request = {} as { result?: unknown; error?: Error; onsuccess?: () => void; onerror?: () => void }
  queueMicrotask(() => { try { request.result = operation(); request.onsuccess?.() } catch (error) { request.error = error as Error; request.onerror?.() } })
  return request
}
const db = {
  transaction: () => {
    const tx = { error: null as Error | null, oncomplete: undefined as (() => void) | undefined, onerror: undefined as (() => void) | undefined, onabort: undefined as (() => void) | undefined,
      objectStore: () => ({
        get: (key: string) => fakeRequest(() => { if (failRead?.(key)) throw new Error('Injected read failure'); return structuredClone(records.get(key)) }),
        put: (value: unknown, key: string) => {
          const snapshot = structuredClone(value)
          queueMicrotask(() => {
            const failed = Boolean(failWrite?.(key, snapshot))
            writes.push({ key, value: snapshot, committed: !failed })
            if (failed) { tx.error = new Error('Injected transaction failure'); tx.onabort?.() }
            else { records.set(key, snapshot); tx.oncomplete?.() }
          })
        },
      }),
    }
    return tx
  },
}
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open: () => fakeRequest(() => db) } })
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => local.get(key) ?? null,
  setItem: (key: string, value: string) => local.set(key, value),
  removeItem: (key: string) => local.delete(key), clear: () => local.clear(),
} })
const { canonicalSource, safeSourceUrl, emptyPersonalData, validatePersonalData } = await import('./persistence')
const { applyCollectionSeed, COLLECTION_SEED_VERSION } = await import('./collectionSeed')
const { usePersonalStore, migrateLegacy, importPersonalSpace, flushPersonalData } = await import('./store')
const { sharedCollection, saveSharedCollection, sharedReflections, saveSharedReflections } = await import('./galaxyBridge')
const { useGameStore } = await import('../../state/gameStore')
const { connectLegacyInventory, readLegacyGameState } = await import('./legacyBridge')
const { mixThoughtRecipe } = await import('../../components/observatory/gardenRecipes')
const at = '2026-09-13T08:00:00.000Z'
const source: ContentSource = { id: 'answer-456', title: '真实来源', author: '作者', summary: '原始摘要', url: 'https://www.zhihu.com/question/123/answer/456', source: '知乎', kind: 'summary', fetchedAt: at }

function legacyFixture(): PersonalData {
  const data = emptyPersonalData()
  data.legacy['wanderwise-game-v1'] = { version: 0, state: {
    qualityMode: 'smooth', seed: { rawInput: '摄影', topics: ['摄影'], createdAt: 1 }, nodes: [{ id: 'node-a', word: '摄影', position: [1, 0, 2], workIds: ['work-one'], weight: 0.8, isSeed: true, expanded: false }], visitedWords: ['摄影', '文学'], trail: [{ t: 1, pos: [1, 0, 2], word: '摄影' }],
    backpack: [
      { id: 'old-a', workId: 'work-one', kind: 'knowledge', title: '同篇作品', text: '第一段摘录', collectedAt: 1, topicWord: '摄影' },
      { id: 'old-b', workId: 'work-one', kind: 'knowledge', title: '同篇作品', text: '第二段摘录', collectedAt: 2, topicWord: '文学' },
    ],
    links: [{ id: 'link-a-b', aId: 'old-a', bId: 'old-b', note: '两个段落之间的联系', createdAt: 3 }],
    anchors: [{ id: 'anchor-a', text: '个人的想法', mine: true, author: '我', likes: 0, likedByMe: false, comments: [], createdAt: 4 }, { id: 'anchor-other', text: '他人的想法', author: '漫行者', mine: false, likes: 1, likedByMe: false, comments: [], createdAt: 4 }],
    journeys: [{ id: 'old-journey', startedAt: 1, endedAt: 4, visitedWords: ['摄影'], collected: 2, anchors: 1, trail: [] }],
  } }
  data.legacy['wanderwise.collection.v1'] = [{ id: 'answer-456', type: 'answer', title: source.title, excerpt: '星系摘要', author: source.author, url: source.url, questionId: 'question-123', answerId: 'answer-456', query: '摄影', savedAt: at }]
  data.legacy['wanderwise.reflections.v1'] = [{ id: 'reflection-one', targetId: 'answer-456', targetTitle: source.title, text: '星系手记', quote: '星系摘要', query: '摄影', createdAt: at }]
  data.legacy['wanderwise.journey.v1'] = [{ id: 'stop-one', title: '抵达问题', type: 'question', questionId: 'question-123', query: '摄影', visitedAt: at }]
  data.legacy['wanderwise-garden-recipes-v1'] = [{ first: 'literature', second: 'photography', firstPercent: 60 }, { first: 'photography', second: 'literature', firstPercent: 40 }]
  return data
}

beforeEach(async () => {
  await flushPersonalData()
  usePersonalStore.setState({ ready: false, data: emptyPersonalData(), error: '' })
  useGameStore.setState({ backpack: [], links: [], anchors: [] })
  records.clear(); local.clear(); writes.length = 0; failWrite = undefined; failRead = undefined
})

test('canonical URL identity deduplicates tracking links and rejects executable URLs and credentials', () => {
  const decorated = canonicalSource({ ...source, url: `${source.url}?utm_source=share&source=widget#quote` })
  assert.equal(decorated.id, canonicalSource(source).id)
  assert.equal(decorated.remoteId, 'answer-456')
  assert.equal(safeSourceUrl('javascript:alert(1)'), '')
  assert.equal(safeSourceUrl('data:text/html,<script>alert(1)</script>'), '')
  assert.equal(safeSourceUrl('https://user:pass@example.com/article'), '')
  assert.equal(canonicalSource({ ...source, url: 'javascript:alert(1)' }).url, '')
})

test('legacy migration is idempotent, preserves eight business fields, links and multiple excerpts', () => {
  const before = legacyFixture()
  const original = structuredClone(before)
  const migrated = migrateLegacy(before)
  const repeated = migrateLegacy(migrated)
  assert.deepEqual(before, original, 'migration must not modify its caller input')
  assert.deepEqual(repeated, migrated)
  assert.deepEqual(migrated.legacy['wanderwise-game-v1'], original.legacy['wanderwise-game-v1'])
  assert.deepEqual(migrated.legacy['wanderwise.journey.v1'], original.legacy['wanderwise.journey.v1'])
  const excerpts = migrated.collections.filter((item) => item.sourceId === 'work:work-one')
  assert.deepEqual(excerpts.map((item) => item.legacyId), ['old-a', 'old-b'])
  assert.deepEqual(excerpts.map((item) => item.excerpt), ['第一段摘录', '第二段摘录'])
  assert.ok(migrated.notes.some((item) => item.id === 'anchor:anchor-a'))
  assert.ok(!migrated.notes.some((item) => item.id === 'anchor:anchor-other'))
  assert.deepEqual(validatePersonalData(migrated), migrated)
})

test('legacy ingredient-only recipes migrate to the current catalog and reversed equivalent pairs deduplicate', () => {
  const migrated = migrateLegacy(legacyFixture())
  assert.equal(migrated.recipes.length, 1)
  assert.equal(migrated.recipes[0].id, mixThoughtRecipe('literature', 'photography', 60).id)
  assert.equal(migrated.recipes[0].name, '落日大道')
  assert.ok(migrated.recipes[0].prompt.length > 20)
})

test('malformed legacy rows cannot prevent migration of the remaining valid user content', () => {
  const fixture = legacyFixture()
  const game = fixture.legacy['wanderwise-game-v1'] as { state: { backpack: unknown[]; anchors: unknown[] } }
  game.state.backpack.push({ id: 'bad-date', workId: 'broken', title: '坏日期记录', text: '保留其他记录', collectedAt: 'not-a-date' })
  game.state.anchors.push({ id: 'bad-anchor', text: '坏时间的笔记', mine: true, createdAt: { unexpected: true } })
  ;(fixture.legacy['wanderwise.collection.v1'] as unknown[]).push({ id: 'malformed-galaxy', title: '缺少类型与归属', type: 'unknown', url: 'javascript:alert(1)' })
  ;(fixture.legacy['wanderwise.reflections.v1'] as unknown[]).push({ text: '缺少身份的手记' })
  const migrated = migrateLegacy(fixture)
  assert.ok(migrated.collections.some((item) => item.legacyId === 'old-a'))
  assert.ok(migrated.notes.some((item) => item.id === 'reflection-one'))
  assert.doesNotThrow(() => validatePersonalData(migrated))
})

test('explicit distinct excerpts survive while duplicate saves are idempotent, and uncollect never removes notes', () => {
  const store = usePersonalStore.getState()
  const first = store.collect(source, '第一段')
  const second = store.collect(source, '第二段')
  assert.notEqual(first, second)
  assert.equal(store.collect(source, '第一段'), first)
  const sourceId = canonicalSource(source).id
  store.saveNote({ id: 'note-a', sourceId, title: '自己的理解', text: '我的独立思考' })
  store.uncollect(first)
  assert.equal(usePersonalStore.getState().data.collections.length, 1)
  assert.equal(usePersonalStore.getState().data.notes[0].sourceId, sourceId)
  assert.ok(usePersonalStore.getState().data.sources[sourceId])
})

test('galaxy adapter saves once, displays shared data, and removes a visible collection without deleting notes', () => {
  usePersonalStore.setState({ ready: true })
  const item: SavedItem = { id: 'answer-456', type: 'answer', title: source.title, excerpt: source.summary, author: source.author, url: source.url, questionId: 'question-123', answerId: 'answer-456', query: '摄影', savedAt: at }
  saveSharedCollection([item, { ...item }]); saveSharedCollection([item])
  assert.equal(usePersonalStore.getState().data.collections.length, 1)
  assert.equal(sharedCollection()?.length, 1)
  usePersonalStore.getState().saveNote({ id: 'independent-note', title: '我的想法', text: '不依赖收藏继续存在' })
  saveSharedCollection([])
  assert.deepEqual(sharedCollection(), [])
  assert.equal(usePersonalStore.getState().data.notes.length, 1)
})

test('galaxy reflection edits preserve their source reference, and deletion persists to the shared view', () => {
  usePersonalStore.setState({ ready: true })
  const sourceId = usePersonalStore.getState().putSource(source)
  usePersonalStore.getState().saveNote({ id: 'linked-note', sourceId, title: '来源对应笔记', text: '旧文字' })
  const notes = sharedReflections()!
  saveSharedReflections([{ ...notes[0], text: '编辑后的文字' }])
  assert.equal(usePersonalStore.getState().data.notes[0].sourceId, sourceId)
  saveSharedReflections([])
  assert.deepEqual(sharedReflections(), [])
})

test('legacy inventory projection preserves old item IDs and links, then cleans links when an item is removed', () => {
  const fixture = legacyFixture()
  const original = fixture.legacy['wanderwise-game-v1'] as { state: { links: Array<{ id: string; aId: string; bId: string; note: string; createdAt: number }> } }
  useGameStore.setState({ links: original.state.links })
  usePersonalStore.setState({ ready: true, data: migrateLegacy(fixture) })
  const disconnect = connectLegacyInventory()
  try {
    assert.ok(useGameStore.getState().backpack.some((item) => item.id === 'old-a'))
    assert.ok(useGameStore.getState().backpack.some((item) => item.id === 'old-b'))
    assert.deepEqual(useGameStore.getState().links, original.state.links)
    usePersonalStore.getState().uncollect('old-a')
    assert.ok(!useGameStore.getState().backpack.some((item) => item.id === 'old-a'))
    assert.ok(!useGameStore.getState().links.some((link) => link.aId === 'old-a' || link.bId === 'old-a'))
  } finally { disconnect() }
})

test('JSON export/import round trip keeps sources, notes, work references and repeated import identity', async () => {
  const store = usePersonalStore.getState()
  const id = store.collect(source)
  const sourceId = canonicalSource(source).id
  store.saveNote({ id: 'note-a', title: '观察', text: '个人笔记', sourceId })
  store.saveWork({ id: 'work-a', title: '作品', text: '我的新观点', sourceIds: [sourceId], kind: 'idea' })
  const snapshot = structuredClone(usePersonalStore.getState().data)
  usePersonalStore.setState({ data: emptyPersonalData() })
  await importPersonalSpace(JSON.stringify(snapshot))
  await importPersonalSpace(JSON.stringify(snapshot))
  const imported = usePersonalStore.getState().data
  assert.deepEqual(imported.sources, snapshot.sources)
  assert.deepEqual(imported.notes, snapshot.notes)
  assert.deepEqual(imported.works, snapshot.works)
  assert.equal(imported.collections.length, 1)
  assert.equal(imported.collections[0].id, id)
})

test('import rejects dangling source references before any backup or profile write', async () => {
  const broken = emptyPersonalData()
  broken.works.push({ id: 'work-a', title: '缺失来源', text: '不能假装来源仍在', sourceIds: ['missing'], createdAt: at, kind: 'idea' })
  await assert.rejects(importPersonalSpace(JSON.stringify(broken)), /来源/)
  assert.equal(writes.length, 0)
})

test('failed import transaction does not update the active profile', async () => {
  usePersonalStore.getState().saveNote({ id: 'keep-note', title: '已存在', text: '必须保留' })
  const previous = structuredClone(usePersonalStore.getState().data)
  const incoming = emptyPersonalData()
  incoming.notes.push({ id: 'incoming', title: '新笔记', text: '尚未提交', createdAt: at, updatedAt: at })
  failWrite = (key) => key === 'profile'
  await assert.rejects(importPersonalSpace(JSON.stringify(incoming)), /failure/)
  assert.deepEqual(usePersonalStore.getState().data, previous)
  assert.equal((records.get([...records.keys()].find((key) => key.startsWith('backup-before-import:'))!) as PersonalData).notes[0].id, 'keep-note')
})

test('failed initial migration preserves an already-read profile and does not persist a successful migration marker', async () => {
  const saved = emptyPersonalData()
  saved.notes.push({ id: 'valuable-note', title: '之前保存的手记', text: '不能因迁移备份失败而消失', createdAt: at, updatedAt: at })
  records.set('profile', saved)
  failWrite = (key) => key === 'legacy-backup-v1'
  const { initializePersonalSpace } = await import('./store')
  await initializePersonalSpace(); await flushPersonalData()
  assert.ok(usePersonalStore.getState().data.notes.some((note) => note.id === 'valuable-note'))
  assert.equal(usePersonalStore.getState().data.migrated, false)
  assert.ok(!writes.some((write) => write.committed && write.key === 'profile' && (write.value as PersonalData).migrated))
  assert.ok((records.get('profile') as PersonalData).notes.some((note) => note.id === 'valuable-note'))
})

test('galaxy source grouping has unique identities, round trips retain every excerpt and explicit removal removes the group', () => {
  usePersonalStore.setState({ ready: true })
  const value: ContentSource = { ...source, galaxy: { id: 'answer-456', type: 'answer', questionId: 'question-123', answerId: 'answer-456', query: '摄影' } }
  usePersonalStore.getState().collect(value, '第一段摘录')
  usePersonalStore.getState().collect(value, '第二段摘录')
  const shown = sharedCollection()!
  assert.equal(shown.length, 1)
  saveSharedCollection(shown)
  assert.equal(usePersonalStore.getState().data.collections.length, 2)
  saveSharedCollection([])
  assert.equal(usePersonalStore.getState().data.collections.length, 0)
})

test('galaxy collection preserves the real remote source ID needed by the synthesis API', () => {
  usePersonalStore.setState({ ready: true })
  saveSharedCollection([{ id: 'answer-456', type: 'answer', title: source.title, excerpt: source.summary, url: source.url, questionId: 'question-123', answerId: 'answer-456', query: '摄影', savedAt: at }])
  assert.equal(Object.values(usePersonalStore.getState().data.sources)[0].remoteId, 'answer-456')
  const migrated = migrateLegacy(legacyFixture())
  assert.equal(migrated.sources[canonicalSource(source).id].remoteId, 'answer-456')
})

test('galaxy collection preserves curated publisher metadata and labels new external sources by their actual host', () => {
  usePersonalStore.setState({ ready: true })
  const curated: ContentSource = { ...source, id: 'curated-walden', remoteId: 'curated-walden', title: 'Walden', url: 'https://www.gutenberg.org/ebooks/205', source: 'Project Gutenberg', kind: 'curated' }
  const id = usePersonalStore.getState().putSource(curated)
  saveSharedCollection([{ id: 'galaxy-walden', type: 'answer', title: 'Imported title', excerpt: '新摘录', url: curated.url, questionId: 'external-topic', query: '文学', savedAt: at }])
  const stored = usePersonalStore.getState().data.sources[id]
  assert.equal(stored.source, 'Project Gutenberg')
  assert.equal(stored.kind, 'curated')
  assert.equal(stored.remoteId, 'curated-walden')
  assert.equal(stored.title, 'Walden')
  saveSharedCollection([...(sharedCollection() ?? []), { id: 'external-new', type: 'answer', title: 'Public page', excerpt: '摘要', url: 'https://www.nasa.gov/example', questionId: 'external-topic', query: '自然', savedAt: at }])
  assert.equal(usePersonalStore.getState().data.sources['url:https://www.nasa.gov/example'].source, 'www.nasa.gov')
})

test('deleting the visible 500 reflections preserves notes that were never projected', () => {
  const data = emptyPersonalData()
  data.notes = Array.from({ length: 510 }, (_, index) => ({ id: `note-${index}`, title: '笔记', text: '内容', createdAt: at, updatedAt: at }))
  usePersonalStore.setState({ ready: true, data })
  assert.equal(sharedReflections()?.length, 500)
  saveSharedReflections([])
  assert.deepEqual(usePersonalStore.getState().data.notes.map((note) => note.id), Array.from({ length: 10 }, (_, index) => `note-${500 + index}`))
})

test('a fresh browser restores legacy business state and subsequent edits update the export without rewinding', () => {
  const data = migrateLegacy(legacyFixture())
  const original = readLegacyGameState(data.legacy['wanderwise-game-v1'])
  useGameStore.setState({ seed: null, nodes: [], visitedWords: [], trail: [], backpack: [], links: [], anchors: [], journeys: [], qualityMode: 'auto' })
  usePersonalStore.setState({ ready: true, data })
  const disconnect = connectLegacyInventory()
  try {
    const restored = useGameStore.getState()
    for (const key of ['seed', 'nodes', 'visitedWords', 'trail', 'links', 'anchors', 'journeys', 'qualityMode'] as const) assert.deepEqual(restored[key], original[key], `restore ${key}`)
    assert.deepEqual(restored.backpack.filter((item) => item.id.startsWith('old-')), original.backpack)
    useGameStore.setState({ visitedWords: ['新的探索'], seed: { rawInput: '新的世界', topics: ['自然'], createdAt: 9 } })
    usePersonalStore.getState().collect(source)
    assert.deepEqual(useGameStore.getState().visitedWords, ['新的探索'])
    assert.equal(useGameStore.getState().seed?.rawInput, '新的世界')
    const exported = readLegacyGameState(usePersonalStore.getState().data.legacy['wanderwise-game-v1'])
    assert.deepEqual(exported.visitedWords, ['新的探索'])
    assert.equal(exported.seed?.rawInput, '新的世界')
  } finally { disconnect() }
})

test('a newly imported legacy snapshot restores its world once, while invalid fields cannot replace store actions', async () => {
  usePersonalStore.setState({ ready: true })
  const disconnect = connectLegacyInventory()
  try {
    const incoming = migrateLegacy(legacyFixture())
    await importPersonalSpace(JSON.stringify(incoming))
    assert.equal(useGameStore.getState().seed?.rawInput, '摄影')
    useGameStore.setState({ visitedWords: ['导入后继续探索'] })
    usePersonalStore.getState().saveNote({ title: '新笔记', text: '保持当前位置' })
    assert.deepEqual(useGameStore.getState().visitedWords, ['导入后继续探索'])
    const parsed = readLegacyGameState({ state: { startWorld: 'not a function', nodes: [{ id: 'bad', position: ['broken'] }], visitedWords: ['合法字段'], seed: { rawInput: 'x', topics: 'invalid', createdAt: 1 } } })
    assert.deepEqual(parsed, { visitedWords: ['合法字段'] })
    assert.equal('startWorld' in useGameStore.getState(), false)
    assert.equal(typeof useGameStore.getState().collect, 'function')
  } finally { disconnect() }
})

for (const stage of ['profile-write', 'readback', 'completion-marker'] as const) {
  test(`migration failure at ${stage} keeps recovered content and cannot mark success`, async () => {
    const saved = emptyPersonalData()
    saved.notes.push({ id: 'recovered-note', title: '之前的收获', text: '事务失败也必须保留', createdAt: at, updatedAt: at })
    records.set('profile', saved)
    let profileReads = 0
    if (stage === 'readback') failRead = (key) => key === 'profile' && ++profileReads > 1
    else failWrite = (key, value) => key === 'profile' && (stage === 'profile-write' || (value as PersonalData).migrated)
    const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-migration=${stage}`) as typeof import('./store')
    await fresh.initializePersonalSpace(); await fresh.flushPersonalData()
    assert.ok(fresh.usePersonalStore.getState().data.notes.some((note) => note.id === 'recovered-note'))
    assert.equal(fresh.usePersonalStore.getState().data.migrated, false)
    assert.ok(!writes.some((write) => write.committed && write.key === 'profile' && (write.value as PersonalData).migrated))
    assert.equal((records.get('profile') as PersonalData).migrated, false)
  })
}

test('successful initialization backs up raw legacy values and marks migration only after its profile can be read', async () => {
  const fixture = legacyFixture()
  for (const [key, value] of Object.entries(fixture.legacy)) local.set(key, JSON.stringify(value))
  local.set('wanderwise.reflections.v1', '{ unreadable legacy JSON')
  const before = new Map(local)
  let profileRead = 0
  failRead = (key) => { if (key === 'profile') profileRead++; return false }
  failWrite = (key, value) => {
    if (key === 'profile' && (value as PersonalData).migrated) assert.ok(profileRead >= 2, 'completion must follow profile readback')
    return false
  }
  const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-migration=success`) as typeof import('./store')
  const first = fresh.initializePersonalSpace()
  const repeated = fresh.initializePersonalSpace()
  assert.equal(first, repeated)
  await first; await fresh.flushPersonalData()
  assert.equal(fresh.usePersonalStore.getState().data.migrated, true)
  assert.equal((records.get('profile') as PersonalData).migrated, true)
  assert.equal((records.get('legacy-backup-v1') as Record<string, string>)['wanderwise.reflections.v1'], '{ unreadable legacy JSON')
  assert.deepEqual(local, before, 'the old localStorage inputs remain unchanged')
  assert.equal(writes.filter((write) => write.key === 'profile' && write.committed).length, 3)
  assert.deepEqual((records.get('profile') as PersonalData).collectionSeedVersions, [COLLECTION_SEED_VERSION])
  const beforeSeed = records.get('backup-before-collection-seed-v1') as PersonalData
  assert.equal(beforeSeed.migrated, true)
  assert.equal(beforeSeed.collectionSeedVersions, undefined)
  assert.deepEqual(fresh.usePersonalStore.getState().data.collections.slice(0, beforeSeed.collections.length), beforeSeed.collections)
  assert.equal(fresh.usePersonalStore.getState().data.collections.length, beforeSeed.collections.length + 30)
})

test('a failed initial profile read cannot overwrite an unreadable existing vault', async () => {
  const previous = emptyPersonalData()
  previous.notes.push({ id: 'still-on-disk', title: '不可读时保留', text: '不要覆盖数据库', createdAt: at, updatedAt: at })
  records.set('profile', previous)
  failRead = (key) => key === 'profile'
  const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-migration=initial-read`) as typeof import('./store')
  await fresh.initializePersonalSpace(); await fresh.flushPersonalData()
  assert.equal(fresh.usePersonalStore.getState().data.migrated, false)
  assert.deepEqual(records.get('profile'), previous)
  assert.equal(writes.length, 0)
})

function aliasFixture(): PersonalData {
  const data = emptyPersonalData()
  data.migrated = true
  const longId = 'url:https://www.zhihu.com/question/123/answer/456'
  const shortId = 'url:https://www.zhihu.com/answer/456?view=reader'
  data.sources[longId] = { ...source, id: longId, remoteId: 'galaxy:answer:answer-456', url: `${source.url}?utm_source=old-client#quote`, summary: '较完整的摘要内容', galaxy: { id: 'answer-456', type: 'answer', questionId: 'question-123', answerId: 'answer-456', query: '摄影' } }
  data.sources[shortId] = { ...source, id: shortId, remoteId: 'answer-456', url: 'https://www.zhihu.com/answer/456?view=reader', author: '作者未提供', summary: '短摘要', fetchedAt: '2026-09-13T09:00:00.000Z' }
  data.collections = [
    { id: 'quote-one', sourceId: longId, excerpt: '第一段独立摘录', legacyId: 'old-quote-one', createdAt: at },
    { id: 'quote-two', sourceId: shortId, excerpt: '第二段独立摘录', legacyId: 'old-quote-two', createdAt: at },
  ]
  data.notes = [{ id: 'note-one', sourceId: longId, title: '第一份理解', text: '独立笔记一', quote: '第一段独立摘录', createdAt: at, updatedAt: at }, { id: 'note-two', sourceId: shortId, title: '第二份理解', text: '独立笔记二', createdAt: at, updatedAt: at }]
  data.works = [{ id: 'idea-one', title: '一个想法', text: '自己的文字', sourceIds: [longId, shortId], createdAt: at, kind: 'idea' }]
  data.journeys = [{ id: 'trip-one', realmId: 'sunset-boulevard', title: '落日大道', recipe: mixThoughtRecipe('literature', 'photography', 50), personalText: '个人材料', contentVersion: 1, sourceIds: [shortId, longId], createdAt: at, progress: { visited: ['station-three'], drafts: { notes: '进行中的草稿' }, completed: false } }]
  data.returnAnchor = { route: '/journey/sunset-boulevard', label: '落日大道', journeyId: 'trip-one', stationId: 'station-three', sourceId: longId, pose: { position: [1, 2, 3], yaw: 0.5, pitch: 0.1 } }
  return data
}

test('only confirmed Zhihu answer URLs share identities, while article URLs and lookalike hosts remain separate', () => {
  const id = canonicalSource(source).id
  for (const url of ['https://www.zhihu.com/answer/456', 'https://zhihu.com/question/999/answer/456/', 'http://www.zhihu.com/answer/456?view=reader']) {
    const normalized = canonicalSource({ ...source, url })
    assert.equal(normalized.id, id)
    assert.equal(normalized.url, url)
    assert.equal(normalized.remoteId, 'answer-456')
  }
  for (const url of ['https://zhuanlan.zhihu.com/p/456', 'https://www.zhihu.com/question/456', 'https://www.zhihu.com.evil.example/answer/456', 'https://zhihu.com:444/answer/456', 'https://zhuanlan.zhihu.com/answer/456']) assert.notEqual(canonicalSource({ ...source, url }).id, id)
  assert.equal(canonicalSource({ ...source, url: 'https://www.zhihu.com/answer/12345678901234567890' }).remoteId, 'answer-12345678901234567890')
})

test('old v1 aliases remap every source reference without losing excerpts, notes or the return pose', () => {
  const original = aliasFixture()
  const untouched = structuredClone(original)
  const normalized = validatePersonalData(original)
  const id = canonicalSource(source).id
  assert.deepEqual(original, untouched, 'normalization must not mutate the old backup input')
  assert.deepEqual(Object.keys(normalized.sources), [id])
  assert.equal(normalized.sources[id].remoteId, 'answer-456')
  assert.equal(normalized.sources[id].author, '作者')
  assert.equal(normalized.sources[id].summary, '较完整的摘要内容')
  assert.ok(Object.values(original.sources).some((item) => item.url === normalized.sources[id].url), 'retain an actual source URL, not a synthesized opening URL')
  assert.deepEqual(normalized.collections.map((item) => [item.id, item.legacyId, item.sourceId, item.excerpt]), [['quote-one', 'old-quote-one', id, '第一段独立摘录'], ['quote-two', 'old-quote-two', id, '第二段独立摘录']])
  assert.deepEqual(normalized.notes.map((item) => [item.id, item.sourceId, item.text]), [['note-one', id, '独立笔记一'], ['note-two', id, '独立笔记二']])
  assert.deepEqual(normalized.works[0].sourceIds, [id])
  assert.deepEqual(normalized.journeys[0].sourceIds, [id])
  assert.equal(normalized.returnAnchor?.sourceId, id)
  assert.deepEqual(normalized.returnAnchor?.pose, original.returnAnchor?.pose)
  assert.deepEqual(normalized.journeys[0].progress, original.journeys[0].progress)
  assert.deepEqual(validatePersonalData(normalized), normalized, 'compatibility normalization is idempotent')
})

test('v1 alias compatibility does not accept a source dictionary key that belongs to another URL', () => {
  const data = emptyPersonalData()
  const wrong = 'url:https://www.zhihu.com/question/999/answer/888'
  data.sources[wrong] = { ...source, id: wrong }
  assert.throws(() => validatePersonalData(data), /身份/)
})

test('importing old alias exports preserves all personal records, and repeated imports do not multiply them', async () => {
  const old = aliasFixture()
  await importPersonalSpace(JSON.stringify(old))
  await importPersonalSpace(JSON.stringify(old))
  const data = usePersonalStore.getState().data
  assert.equal(Object.keys(data.sources).length, 1)
  assert.equal(data.collections.length, 2)
  assert.equal(data.notes.length, 2)
  assert.equal(data.works.length, 1)
  assert.equal(data.journeys.length, 1)
  assert.equal(data.returnAnchor?.sourceId, canonicalSource(source).id)
  assert.doesNotThrow(() => validatePersonalData(data))
})

test('automatic v1 alias normalization backs up the original profile before rewriting and is stable after reload', async () => {
  const old = aliasFixture()
  records.set('profile', old)
  const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-migration=old-aliases`) as typeof import('./store')
  await fresh.initializePersonalSpace(); await fresh.flushPersonalData()
  const backup = writes.find((write) => write.key.startsWith('backup-before-source-normalization:'))
  assert.ok(backup?.committed)
  assert.deepEqual(backup.value, old)
  assert.equal(writes[0], backup)
  assert.equal(Object.keys((records.get('profile') as PersonalData).sources).length, 31)
  const count = writes.length
  const reloaded = await import(`${new URL('./store.ts', import.meta.url).href}?test-migration=normalized-reload`) as typeof import('./store')
  await reloaded.initializePersonalSpace(); await reloaded.flushPersonalData()
  assert.equal(writes.length, count, 'an already normalized profile needs no second migration')
  assert.equal(reloaded.usePersonalStore.getState().data.collections.length, 32)
  const originalNormalized = validatePersonalData(old)
  const current = reloaded.usePersonalStore.getState().data
  assert.deepEqual(current.collections.slice(0, 2), originalNormalized.collections)
  assert.deepEqual(current.sources[canonicalSource(source).id], originalNormalized.sources[canonicalSource(source).id])
  for (const key of ['notes', 'works', 'journeys', 'returnAnchor'] as const) assert.deepEqual(current[key], originalNormalized[key])
})

test('first-run seeding becomes ready only after data and marker commit together and pass readback, then reload writes nothing', async () => {
  let profileReads = 0
  failRead = key => { if (key === 'profile') profileReads++; return false }
  const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=first-run`) as typeof import('./store')
  const readySnapshots: PersonalData[] = []
  const unsubscribe = fresh.usePersonalStore.subscribe(state => {
    if (!state.ready) return
    assert.equal(profileReads, 3, 'read the initial profile, migrated profile and seeded profile before exposing it')
    readySnapshots.push(structuredClone(state.data))
  })
  try { await fresh.initializePersonalSpace(); await fresh.flushPersonalData() } finally { unsubscribe() }
  assert.equal(readySnapshots.length, 1)
  assert.equal(readySnapshots[0].collections.length, 30)
  assert.deepEqual(readySnapshots[0].collectionSeedVersions, [COLLECTION_SEED_VERSION])
  const seedWrites = writes.filter(write => write.key === 'profile' && (write.value as PersonalData).collectionSeedVersions?.includes(COLLECTION_SEED_VERSION))
  assert.equal(seedWrites.length, 1)
  assert.ok(seedWrites[0].committed)
  assert.equal((seedWrites[0].value as PersonalData).collections.length, 30)
  assert.deepEqual(records.get('profile'), readySnapshots[0])
  const previousWrites = writes.length
  const reloaded = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=first-run-reload`) as typeof import('./store')
  await reloaded.initializePersonalSpace(); await reloaded.flushPersonalData()
  assert.equal(writes.length, previousWrites, 'refresh must not rewrite or append the starter batch')
  assert.deepEqual(reloaded.usePersonalStore.getState().data, readySnapshots[0])
})

test('deleting every seeded leaf persists through reload while linked notes and source snapshots survive', async () => {
  const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=delete-all`) as typeof import('./store')
  await fresh.initializePersonalSpace()
  const initial = fresh.usePersonalStore.getState().data
  fresh.usePersonalStore.getState().saveNote({ id: 'keep-seeded-note', sourceId: initial.collections[0].sourceId, title: '自己的理解', text: '删除枝叶不会删除我的手记' })
  for (const collection of initial.collections) fresh.usePersonalStore.getState().uncollect(collection.id)
  await fresh.flushPersonalData()
  const disk = records.get('profile') as PersonalData
  assert.equal(disk.collections.length, 0)
  assert.equal(disk.notes.length, 1)
  assert.equal(Object.keys(disk.sources).length, 30)
  assert.deepEqual(disk.collectionSeedVersions, [COLLECTION_SEED_VERSION])
  const previousWrites = writes.length
  const reloaded = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=delete-all-reload`) as typeof import('./store')
  await reloaded.initializePersonalSpace(); await reloaded.flushPersonalData()
  assert.deepEqual(reloaded.usePersonalStore.getState().data, disk)
  assert.equal(writes.length, previousWrites)
})

for (const stage of ['backup', 'profile-write', 'readback'] as const) {
  test(`seed failure at ${stage} preserves private data, exposes a storage error and can recover on a later initialization`, async () => {
    const previous = validatePersonalData(aliasFixture())
    records.set('profile', structuredClone(previous))
    let profileReads = 0
    if (stage === 'readback') failRead = key => key === 'profile' && ++profileReads > 1
    else failWrite = (key, value) => stage === 'backup'
      ? key === 'backup-before-collection-seed-v1'
      : key === 'profile' && Boolean((value as PersonalData).collectionSeedVersions?.includes(COLLECTION_SEED_VERSION))
    const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=failure-${stage}`) as typeof import('./store')
    await fresh.initializePersonalSpace(); await fresh.flushPersonalData()
    const state = fresh.usePersonalStore.getState()
    assert.equal(state.ready, true)
    assert.match(state.error, /存储.*导出/)
    assert.equal(state.data.collections.length, 32, 'the page can show its public starter in memory when IDB is unavailable')
    assert.deepEqual(state.data.collections.slice(0, 2), previous.collections)
    for (const key of ['notes', 'works', 'journeys', 'returnAnchor', 'settings'] as const) assert.deepEqual(state.data[key], previous[key])
    const committedSeedWrites = writes.filter(write => write.committed && write.key === 'profile' && (write.value as PersonalData).collectionSeedVersions?.includes(COLLECTION_SEED_VERSION))
    if (stage === 'readback') {
      assert.equal(committedSeedWrites.length, 1)
      assert.equal((records.get('profile') as PersonalData).collections.length, 32)
    } else {
      assert.equal(committedSeedWrites.length, 0, 'a failed transaction cannot persist a success marker')
      assert.deepEqual(records.get('profile'), previous)
    }
    if (stage !== 'backup') assert.deepEqual(records.get('backup-before-collection-seed-v1'), previous)
    failRead = undefined; failWrite = undefined
    const retried = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=recovery-${stage}`) as typeof import('./store')
    await retried.initializePersonalSpace(); await retried.flushPersonalData()
    assert.equal(retried.usePersonalStore.getState().error, '')
    assert.equal(retried.usePersonalStore.getState().data.collections.length, 32)
    assert.deepEqual(retried.usePersonalStore.getState().data.notes, previous.notes)
    assert.deepEqual((records.get('profile') as PersonalData).collectionSeedVersions, [COLLECTION_SEED_VERSION])
  })
}

test('an unavailable initial read serves only in-memory starter data without changing the unreadable profile', async () => {
  const previous = validatePersonalData(aliasFixture())
  records.set('profile', previous)
  failRead = key => key === 'profile'
  const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=unreadable-profile`) as typeof import('./store')
  await fresh.initializePersonalSpace(); await fresh.flushPersonalData()
  assert.equal(fresh.usePersonalStore.getState().data.collections.length, 30)
  assert.match(fresh.usePersonalStore.getState().error, /存储.*导出/)
  assert.deepEqual(records.get('profile'), previous)
  assert.equal(writes.length, 0)
})

test('JSON import unions starter markers from both profiles and preserves deliberate empty collections through reload', async () => {
  const seeded = { ...applyCollectionSeed(emptyPersonalData()), migrated: true, collections: [] }
  seeded.collectionSeedVersions = ['older-local-batch', COLLECTION_SEED_VERSION]
  seeded.notes = [{ id: 'local-note', title: '本机笔记', text: '不被导入覆盖', createdAt: at, updatedAt: at }]
  usePersonalStore.setState({ data: seeded })
  const incoming = emptyPersonalData()
  incoming.collectionSeedVersions = ['imported-batch', COLLECTION_SEED_VERSION]
  incoming.notes = [{ id: 'import-note', title: '导入笔记', text: '独立保留', createdAt: at, updatedAt: at }]
  await importPersonalSpace(JSON.stringify(incoming))
  await importPersonalSpace(JSON.stringify(incoming))
  const imported = usePersonalStore.getState().data
  assert.deepEqual(imported.collectionSeedVersions, ['older-local-batch', COLLECTION_SEED_VERSION, 'imported-batch'])
  assert.equal(imported.collections.length, 0)
  assert.deepEqual(imported.notes.map(note => note.id), ['local-note', 'import-note'])
  const markerless = emptyPersonalData()
  await importPersonalSpace(JSON.stringify(markerless))
  assert.deepEqual(usePersonalStore.getState().data.collectionSeedVersions, imported.collectionSeedVersions)
  const reloaded = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=import-markers-reload`) as typeof import('./store')
  await reloaded.initializePersonalSpace(); await reloaded.flushPersonalData()
  assert.deepEqual(reloaded.usePersonalStore.getState().data, imported)
  assert.equal(reloaded.usePersonalStore.getState().data.collections.length, 0)
})

test('an imported marker also protects deliberate deletions when the receiving profile had no starter marker', async () => {
  const incoming = { ...applyCollectionSeed(emptyPersonalData()), migrated: true, collections: [] }
  usePersonalStore.setState({ data: { ...emptyPersonalData(), migrated: true } })
  await importPersonalSpace(JSON.stringify(incoming))
  const reloaded = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=import-only-marker`) as typeof import('./store')
  await reloaded.initializePersonalSpace(); await reloaded.flushPersonalData()
  assert.equal(reloaded.usePersonalStore.getState().data.collections.length, 0)
  assert.deepEqual(reloaded.usePersonalStore.getState().data.collectionSeedVersions, [COLLECTION_SEED_VERSION])
})

test('galaxy sharing cannot write an empty pre-initialization snapshot, then retains seeded sources and explicit deletions', async () => {
  const fresh = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=galaxy`) as typeof import('./store')
  await fresh.initializePersonalSpace(); await fresh.flushPersonalData()
  const seeded = fresh.usePersonalStore.getState().data
  usePersonalStore.setState({ ready: false, data: seeded })
  assert.equal(sharedCollection(), undefined)
  saveSharedCollection([])
  assert.equal(usePersonalStore.getState().data.collections.length, 30)
  usePersonalStore.setState({ ready: true })
  const visible = sharedCollection()!
  assert.equal(visible.length, 30)
  saveSharedCollection(visible)
  assert.deepEqual(usePersonalStore.getState().data, seeded, 'opening the galaxy must not rewrite source type, author or ancestry')
  const removedSourceId = seeded.collections[0].sourceId
  usePersonalStore.getState().saveNote({ id: 'galaxy-note', sourceId: removedSourceId, title: '继续保留的手记', text: '收藏与笔记各自保存' })
  saveSharedCollection(visible.slice(1))
  await flushPersonalData()
  assert.equal(sharedCollection()?.length, 29)
  assert.deepEqual(usePersonalStore.getState().data.sources, seeded.sources)
  assert.equal(usePersonalStore.getState().data.notes[0].sourceId, removedSourceId)
  assert.deepEqual(usePersonalStore.getState().data.collectionSeedVersions, [COLLECTION_SEED_VERSION])
  const reloaded = await import(`${new URL('./store.ts', import.meta.url).href}?test-seed=galaxy-reload`) as typeof import('./store')
  await reloaded.initializePersonalSpace(); await reloaded.flushPersonalData()
  assert.equal(reloaded.usePersonalStore.getState().data.collections.length, 29)
  assert.ok(!reloaded.usePersonalStore.getState().data.collections.some(record => record.sourceId === removedSourceId))
  assert.equal(reloaded.usePersonalStore.getState().data.notes[0].id, 'galaxy-note')
})

test('ordinary persistence failure keeps the in-memory work, exposes an honest error and clears only after a later successful save', async () => {
  const previous = emptyPersonalData()
  records.set('profile', previous)
  usePersonalStore.setState({ ready: true, data: previous })
  failWrite = (key) => key === 'profile'
  usePersonalStore.getState().saveNote({ id: 'unsaved-note', title: '刚写下的想法', text: '仍留在页面中' })
  await flushPersonalData()
  assert.match(usePersonalStore.getState().error, /存储.*导出/)
  assert.equal(usePersonalStore.getState().data.notes[0].text, '仍留在页面中')
  assert.deepEqual(records.get('profile'), previous)
  failWrite = undefined
  usePersonalStore.getState().saveNote({ id: 'unsaved-note', title: '刚写下的想法', text: '现在成功保存' })
  await flushPersonalData()
  assert.equal(usePersonalStore.getState().error, '')
  assert.equal((records.get('profile') as PersonalData).notes[0].text, '现在成功保存')
})
