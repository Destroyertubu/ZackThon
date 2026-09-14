import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { canonicalSource, emptyPersonalData, validatePersonalData } from '../src/features/personal/persistence'
import { buildCollectionTree } from '../src/features/personal/collectionTree'
import type { ContentSource } from '../src/features/personal/types'
import type { ContentResponse } from '../server/content/types'

// Uses already retrieved public search snapshots. No new API requests or private data.
const directory = resolve(process.argv[2] ?? 'artifacts/zhihu-collection-20260914')
const selections = JSON.parse(readFileSync(resolve(directory, 'selection.json'), 'utf8')) as {
  topic: string; query: string; selectedIds: string[]
}[]
const labels: Record<string, string> = { literature: '文学', photography: '摄影', philosophy: '哲思', nature: '自然', music: '音乐' }
const data = emptyPersonalData()
const cache: { query: string; response: ContentResponse }[] = []
const seen = new Set<string>()
const importedAt = new Date().toISOString()
for (const selection of selections) {
  if (!Object.hasOwn(labels, selection.topic)) throw new Error('Unknown topic')
  const raw = JSON.parse(readFileSync(resolve(directory, `${selection.topic}.raw.json`), 'utf8')) as { query: string; response: ContentResponse }
  if (raw.query !== selection.query || !Array.isArray(raw.response.items)) throw new Error('Selection does not match the retrieved query')
  cache.push(raw)
  for (const id of selection.selectedIds) {
    const item = raw.response.items.find(source => source.id === id)
    if (!item || seen.has(id) || !item.summary.trim()) throw new Error(`Missing/duplicate content: ${id}`)
    seen.add(id)
    const url = new URL(item.url)
    if (!['www.zhihu.com', 'zhihu.com', 'zhuanlan.zhihu.com'].includes(url.hostname)) throw new Error('Unexpected source domain')
    const questionId = item.questionId ?? url.pathname.match(/^\/question\/(\d+)/)?.[1]
    const answerId = url.pathname.match(/\/answer\/(\d+)/)?.[1]
    const characters = Array.from(item.summary)
    const summary = characters.length > 600 ? `${characters.slice(0, 600).join('')}…（搜索摘要节选，完整内容见原文）` : item.summary
    const source: ContentSource = canonicalSource({
      id: item.id, remoteId: item.id, title: item.title, author: item.author,
      summary, url: item.url, source: '知乎', kind: item.contentType === 'question' ? 'question' : 'summary',
      contentType: item.contentType, fetchedAt: item.fetchedAt, tags: [labels[selection.topic]],
      ...(questionId && item.contentType === 'question' ? { galaxy: { id: `question-${questionId}`, type: 'question', questionId: `question-${questionId}`, query: selection.query } as const }
        : questionId && answerId && item.contentType === 'answer' ? { galaxy: { id: `answer-${answerId}`, type: 'answer', questionId: `question-${questionId}`, answerId: `answer-${answerId}`, query: selection.query } as const } : {}),
    })
    if (data.sources[source.id]) throw new Error('Duplicate canonical source')
    data.sources[source.id] = source
    data.collections.push({ id: `zhihu-seed:v1:${createHash('sha256').update(source.id).digest('hex').slice(0, 24)}`, sourceId: source.id, excerpt: summary, createdAt: importedAt })
  }
}
const validated = validatePersonalData(data)
const branches = buildCollectionTree(validated).map(topic => ({ topic: topic.label, count: topic.leaves.length }))
if (branches.length !== 5 || branches.some(branch => branch.count !== 6)) throw new Error('Expected five branches of six leaves')
writeFileSync(resolve(directory, 'zhihu-collection.personal.json'), JSON.stringify(validated, null, 2))
writeFileSync(resolve(directory, 'public-search-cache.json'), JSON.stringify(cache, null, 2))
writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify({ importedAt, branches, selected: seen.size, retrieved: cache.reduce((count, row) => count + row.response.items.length, 0), entries: Object.values(validated.sources).map(({ id, title, author, url, tags, fetchedAt }) => ({ id, title, author, url, tags, fetchedAt })) }, null, 2))
console.log(JSON.stringify({ selected: seen.size, branches, sourceKinds: [...new Set(Object.values(validated.sources).map(source => source.kind))] }))
