import test from 'node:test'
import assert from 'node:assert/strict'
import bundle from './data/zhihu-starter-v1.json'
import { applyCollectionSeed, COLLECTION_SEED_VERSION } from './collectionSeed'
import { buildCollectionTree } from './collectionTree'
import { canonicalSource, emptyPersonalData, validatePersonalData } from './persistence'
import type { PersonalData } from './types'

const at = '2026-09-14T08:00:00.000Z'
function manualImport(): PersonalData {
  return validatePersonalData({ ...emptyPersonalData(), ...bundle, migrated: true })
}

test('a new personal space receives thirty public leaves in five six-item branches without modifying its input', () => {
  const original = emptyPersonalData()
  const before = structuredClone(original)
  const seeded = applyCollectionSeed(original)
  assert.deepEqual(original, before)
  assert.equal(seeded.collections.length, 30)
  assert.equal(Object.keys(seeded.sources).length, 30)
  assert.deepEqual(buildCollectionTree(seeded).map(topic => [topic.label, topic.leaves.length]), [
    ['文学', 6], ['摄影', 6], ['哲思', 6], ['自然', 6], ['音乐', 6],
  ])
  assert.deepEqual(seeded.collectionSeedVersions, [COLLECTION_SEED_VERSION])
  assert.deepEqual(validatePersonalData(seeded), seeded)
  assert.equal(applyCollectionSeed(seeded), seeded, 'an applied batch must be a no-op')
})

test('deleting one or all seeded leaves is preserved across JSON round trips and repeat application', () => {
  const seeded = applyCollectionSeed(emptyPersonalData())
  const sourceId = seeded.collections[0].sourceId
  seeded.notes = [{ id: 'my-note', sourceId, title: '个人理解', text: '删掉收藏仍保留', createdAt: at, updatedAt: at }]
  for (const collections of [seeded.collections.slice(1), []]) {
    const after = validatePersonalData(JSON.parse(JSON.stringify({ ...seeded, collections })))
    const repeated = applyCollectionSeed(after)
    assert.equal(repeated, after)
    assert.equal(repeated.collections.length, collections.length)
    assert.deepEqual(repeated.notes, seeded.notes)
    assert.deepEqual(repeated.sources, seeded.sources)
  }
})

test('earlier manual imports are recognized after no, partial or total collection deletion', () => {
  const imported = manualImport()
  for (const collections of [imported.collections, imported.collections.slice(1), []]) {
    const current = { ...imported, collections }
    const result = applyCollectionSeed(current)
    assert.deepEqual(result.collections, collections)
    assert.deepEqual(result.sources, imported.sources)
    assert.deepEqual(result.collectionSeedVersions, [COLLECTION_SEED_VERSION])
    assert.equal(applyCollectionSeed(result), result)
    assert.equal(current.collectionSeedVersions, undefined)
  }
})

test('recognizing an old seed record does not replenish other deliberately absent records', () => {
  const imported = manualImport()
  const survivor = imported.collections[7]
  const current = { ...emptyPersonalData(), sources: { [survivor.sourceId]: imported.sources[survivor.sourceId] }, collections: [survivor] }
  assert.deepEqual(applyCollectionSeed(current).collections, [survivor])
})

test('personal excerpts and linked private fields survive additive seeding without a duplicate source leaf', () => {
  const current = emptyPersonalData()
  const snapshot = manualImport()
  const source = snapshot.sources[snapshot.collections[0].sourceId]
  current.sources[source.id] = { ...source, summary: '已有私人选择的来源快照', tags: ['我的分类'] }
  current.collections = ['first', 'second'].map(id => ({ id, sourceId: source.id, excerpt: `独立摘录 ${id}`, createdAt: at }))
  current.notes = [{ id: 'note', sourceId: source.id, title: '观察', text: '私人笔记', createdAt: at, updatedAt: at }]
  current.works = [{ id: 'work', title: '作品', text: '私人作品', sourceIds: [source.id], kind: 'idea', createdAt: at }]
  current.interests = ['个人兴趣']
  current.poses = { home: { position: [1, 2, 3], yaw: 0.7, pitch: -0.2 } }
  current.returnAnchor = { route: '/observatory', label: '回程', sourceId: source.id, pose: current.poses.home }
  current.settings = { mascotAnimated: false, mascotHints: false, muted: false }
  current.legacy = { 'private-backup': { text: '自己的旧记录' } }
  current.collectionSeedVersions = ['older-public-batch']
  const before = structuredClone(current)
  const seeded = applyCollectionSeed(current)
  assert.deepEqual(current, before)
  assert.equal(seeded.collections.length, 31)
  assert.deepEqual(seeded.collections.slice(0, 2), before.collections)
  assert.deepEqual(seeded.sources[source.id], before.sources[source.id])
  for (const key of ['notes', 'works', 'journeys', 'recipes', 'interests', 'poses', 'returnAnchor', 'settings', 'legacy'] as const) {
    assert.deepEqual(seeded[key], before[key], `${key} is not public seed data`)
  }
  assert.deepEqual(seeded.collectionSeedVersions, ['older-public-batch', COLLECTION_SEED_VERSION])
  assert.deepEqual(validatePersonalData(seeded), seeded)
})

test('a source already read but not collected can become a leaf while its richer metadata remains intact', () => {
  const current = emptyPersonalData()
  const first = manualImport().collections[0]
  const publicSource = manualImport().sources[first.sourceId]
  current.sources[first.sourceId] = { ...publicSource, author: '已取得的原作者信息', summary: '已有的较完整来源摘要'.repeat(100), fetchedAt: '2026-09-15T00:00:00.000Z' }
  const result = applyCollectionSeed(current)
  assert.equal(result.collections.length, 30)
  assert.equal(result.sources[first.sourceId].author, current.sources[first.sourceId].author)
  assert.equal(result.sources[first.sourceId].summary, current.sources[first.sourceId].summary)
})

test('the collection limit is respected without truncating existing excerpts or repeatedly topping up', () => {
  for (const count of [4995, 5000]) {
    const current = emptyPersonalData()
    const source = canonicalSource({ id: 'private', title: '原有内容', author: '我', summary: '已有内容', url: 'https://example.org/private', source: '公开来源', kind: 'summary', fetchedAt: at })
    current.sources[source.id] = source
    current.collections = Array.from({ length: count }, (_, i) => ({ id: `existing-${i}`, sourceId: source.id, excerpt: `摘录 ${i}`, createdAt: at }))
    const result = applyCollectionSeed(current)
    assert.equal(result.collections.length, 5000)
    assert.deepEqual(result.collections.slice(0, count), current.collections)
    assert.equal(Object.keys(result.sources).length, 1 + 5000 - count)
    assert.doesNotThrow(() => validatePersonalData(result))
    const deleted = { ...result, collections: result.collections.slice(1) }
    assert.equal(applyCollectionSeed(deleted), deleted)
  }
})

test('the shipped batch contains only the thirty selected API summaries and never private vault fields or invented answer ancestry', () => {
  assert.deepEqual(Object.keys(bundle).sort(), ['collections', 'sources'])
  const data = manualImport()
  const expectedRemoteIds = [
    'article-2077909290472555430', 'answer-2034860315033212858', 'answer-2077054928485466415', 'answer-2079704216646465294', 'answer-2047270566932042031', 'article-1929116251386545009',
    'article-2040489925951365649', 'article-1991057344185013486', 'article-2074451028704080051', 'answer-3617669093', 'answer-3323860417', 'answer-2048515839717021094',
    'answer-1907802919669076143', 'article-139508691', 'answer-1923361117704525513', 'article-672133410', 'article-550095817', 'article-2043086019327681374',
    'article-731410837', 'article-142723019', 'article-354237016', 'article-121782148', 'answer-2434145766', 'answer-2179832881',
    'answer-821415889', 'article-20837657', 'article-2035512701011675064', 'article-662337088', 'answer-110342576323', 'answer-115908408897',
  ]
  assert.deepEqual(Object.values(data.sources).map(source => source.remoteId), expectedRemoteIds)
  assert.equal(new Set(data.collections.map(record => record.id)).size, 30)
  assert.equal(new Set(data.collections.map(record => record.sourceId)).size, 30)
  for (const record of data.collections) {
    const source = data.sources[record.sourceId]
    assert.match(record.id, /^zhihu-seed:v1:[a-f0-9]{24}$/)
    assert.equal(source.id, canonicalSource(source).id)
    assert.equal(source.source, '知乎')
    assert.equal(source.kind, 'summary', 'the API returned summaries, not authenticated full text')
    assert.equal(record.excerpt, source.summary)
    assert.ok(source.summary.length > 40)
    assert.match(source.fetchedAt, /^2026-09-14T/)
    assert.ok(Number.isFinite(Date.parse(source.fetchedAt)))
    const url = new URL(source.url)
    assert.equal(url.protocol, 'https:')
    if (source.contentType === 'article') {
      assert.equal(url.hostname, 'zhuanlan.zhihu.com')
      assert.equal(source.remoteId, `article-${url.pathname.split('/').at(-1)}`)
      assert.equal(source.galaxy, undefined, 'an article must not acquire a made-up question/answer parent')
    } else {
      assert.equal(source.contentType, 'answer')
      const match = url.pathname.match(/^\/question\/(\d+)\/answer\/(\d+)$/)
      assert.ok(match)
      assert.equal(source.galaxy?.questionId, `question-${match[1]}`)
      assert.equal(source.galaxy?.answerId, `answer-${match[2]}`)
    }
  }
  const photography = Object.values(data.sources).filter(source => source.tags?.includes('摄影'))
  assert.equal(photography.length, 6)
  assert.ok(photography.every(source => source.author === '作者未提供'))
  const forest = Object.values(data.sources).find(source => source.remoteId === 'answer-2434145766')!
  assert.equal(forest.author, 'Joe Chen')
  assert.equal(forest.url, 'https://www.zhihu.com/question/297299084/answer/2434145766')
})
