import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { emptyPersonalData } from './persistence'
import { usePersonalStore } from './store'
import type { CollectionRecord, ContentSource } from './types'

const at = '2026-09-14T02:15:00.000Z'
const source: ContentSource = { id: 'test-source', title: '原始标题', author: '原作者', summary: '原始摘要', url: '', source: '本地测试', kind: 'summary', fetchedAt: at }
const record = (id: string, overrides: Partial<CollectionRecord> = {}): CollectionRecord => ({ id, sourceId: source.id, excerpt: '同一来源的同一摘录', createdAt: at, ...overrides })

beforeEach(() => {
  // Exercise real synchronous store actions without a browser or persistent writes.
  usePersonalStore.setState({ ready: false, error: '', data: emptyPersonalData() })
})

test('undo restores a duplicate historical collection by its own id and retains independent notes and source metadata', () => {
  const first = record('legacy:first', { legacyId: 'first', createdAt: '2026-09-12T01:00:00.000Z' })
  const second = record('legacy:second', { legacyId: 'second' })
  const data = emptyPersonalData()
  data.sources[source.id] = source
  data.collections = [first, second]
  data.notes = [{ id: 'note-one', sourceId: source.id, title: '独立笔记', text: '摘下叶子也保留', quote: first.excerpt, createdAt: at, updatedAt: at }]
  const original = structuredClone(data)
  usePersonalStore.setState({ data })
  const snapshot = { ...first }
  usePersonalStore.getState().uncollect(first.id)
  assert.deepEqual(usePersonalStore.getState().data.collections, [second])
  usePersonalStore.getState().restoreCollection(snapshot)
  const restored = usePersonalStore.getState().data
  assert.deepEqual(restored, original)
  assert.equal(restored.collections[1], second, 'the other record identity must not be reused or changed')
  assert.equal(restored.notes, data.notes)
  assert.equal(restored.sources, data.sources)
  assert.notEqual(restored.collections[0], snapshot, 'the caller must not be able to mutate the restored record through its snapshot')
  snapshot.excerpt = 'later caller change'
  assert.equal(restored.collections[0].excerpt, first.excerpt)
})

test('restore is idempotent by record id and neither duplicates nor overwrites an existing record', () => {
  const original = record('record-one')
  const store = usePersonalStore.getState()
  let changes = 0
  const stop = usePersonalStore.subscribe(() => changes++)
  try {
    store.restoreCollection(original)
    const restored = usePersonalStore.getState()
    store.restoreCollection({ ...original })
    store.restoreCollection({ ...original, excerpt: 'stale conflicting snapshot', sourceId: 'different-source' })
    assert.equal(changes, 1, 'a repeated restoration must not write or notify subscribers')
    assert.equal(usePersonalStore.getState(), restored)
    assert.deepEqual(restored.data.collections, [original])
    assert.deepEqual(restored.data.sources, {})
  } finally { stop() }
})

test('a just-removed leaf with a missing source can be restored without creating a source or deleting notes', () => {
  const orphan = record('orphan-leaf', { sourceId: 'missing-source', excerpt: '  保留失联来源的摘录\n', legacyId: 'old-orphan' })
  const data = emptyPersonalData()
  data.collections = [orphan]
  data.notes = [{ id: 'orphan-note', sourceId: orphan.sourceId, title: '我的解释', text: '独立存在', createdAt: at, updatedAt: at }]
  usePersonalStore.setState({ data })
  usePersonalStore.getState().uncollect(orphan.id)
  const afterRemoval = usePersonalStore.getState().data
  usePersonalStore.getState().restoreCollection(orphan)
  const restored = usePersonalStore.getState().data
  assert.deepEqual(restored.collections, [orphan])
  assert.equal(restored.notes, afterRemoval.notes)
  assert.equal(restored.sources, afterRemoval.sources)
  assert.deepEqual(restored.sources, {})
  assert.deepEqual(restored.notes, data.notes)
})
