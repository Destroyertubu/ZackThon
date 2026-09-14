import test from 'node:test'
import assert from 'node:assert/strict'
import { collectionTreeReading } from './collectionTreeReading'
import type { CollectionTreeLeaf } from './collectionTree'
import type { ContentSource } from './types'

function source(overrides: Partial<ContentSource> = {}): ContentSource {
  return {
    id: 'source-one', title: '真实来源的标题', author: '原作者', summary: '实际取得的内容片段。',
    url: 'https://example.org/articles/one', source: '公开来源', kind: 'summary',
    fetchedAt: '2026-09-14T00:00:00.000Z', ...overrides,
  }
}

function leaf(overrides: Partial<CollectionTreeLeaf> = {}): CollectionTreeLeaf {
  return {
    id: 'collection-one', sourceId: 'source-one', title: '真实来源的标题',
    excerpt: '实际取得的内容片段。', excerptKind: 'summary', source: source(),
    createdAt: '2026-09-14T00:00:00.000Z', ...overrides,
  }
}

test('search summaries remain explicitly labelled and are not repeated or promoted to full text', () => {
  const result = collectionTreeReading(leaf())
  assert.equal(result.title, '真实来源的标题')
  assert.equal(result.author, '原作者')
  assert.deepEqual(result.paragraphs, ['来源摘要：实际取得的内容片段。'])
  assert.match(result.provenance, /非全文/)
  assert.equal(result.url, 'https://example.org/articles/one')
})

test('an article resource type alone does not certify an acquired article body', () => {
  const result = collectionTreeReading(leaf({ source: source({ kind: 'article', contentType: 'article' }) }))
  assert.deepEqual(result.paragraphs, ['来源摘要：实际取得的内容片段。'])
  assert.match(result.provenance, /非全文/)
  assert.ok(!result.paragraphs.some(paragraph => paragraph.startsWith('正文：')))
})

test('a saved curated introduction is identified as editorial guidance, not a source-authored summary', () => {
  // collect() defaults to source.summary, so the tree view classifies equality as summary.
  const result = collectionTreeReading(leaf({ source: source({ kind: 'curated' }), excerptKind: 'summary' }))
  assert.deepEqual(result.paragraphs, ['精选导读：实际取得的内容片段。'])
  assert.match(result.provenance, /精选导读/)
  assert.match(result.provenance, /非全文/)
})

test('a stored source excerpt keeps its excerpt label when it equals source.summary', () => {
  const result = collectionTreeReading(leaf({ source: source({ kind: 'excerpt' }), excerptKind: 'summary' }))
  assert.deepEqual(result.paragraphs, ['来源节选：实际取得的内容片段。'])
  assert.match(result.provenance, /非全文/)
})

test('personal excerpts, separate source material and reading guidance stay distinguishable', () => {
  const input = leaf({ excerpt: '  自己留下的摘录\n第二行。  ', excerptKind: 'excerpt',
    source: source({ kind: 'excerpt', readingGuide: '比较两种观察的尺度。' }) })
  Object.freeze(input.source)
  Object.freeze(input)
  const before = structuredClone(input)
  const result = collectionTreeReading(input)
  assert.deepEqual(result.paragraphs, [
    '我的摘录：  自己留下的摘录\n第二行。  ',
    '来源节选：实际取得的内容片段。',
    '阅读线索：比较两种观察的尺度。',
  ])
  assert.deepEqual(input, before)
})

test('a missing source keeps the saved excerpt and does not fabricate author or URL', () => {
  const result = collectionTreeReading(leaf({ title: '来源已缺失', source: undefined,
    excerpt: '备份里的摘录仍在。', excerptKind: 'excerpt' }))
  assert.equal(result.title, '来源已缺失')
  assert.equal(result.author, '作者未提供')
  assert.equal(result.url, '')
  assert.match(result.provenance, /来源缺失/)
  assert.equal(result.paragraphs[0], '我的摘录：备份里的摘录仍在。')
  assert.match(result.paragraphs[1], /来源记录暂时缺失/)
})

test('empty material stays empty so the reader can honestly offer the original source', () => {
  const result = collectionTreeReading(leaf({ excerpt: ' \n ', excerptKind: 'none',
    source: source({ summary: '\t', author: '' }) }))
  assert.deepEqual(result.paragraphs, [])
  assert.equal(result.author, '作者未提供')
  assert.equal(result.url, 'https://example.org/articles/one')
})

test('source links reject executable schemes, credentials, malformed URLs and relative guesses', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///tmp/private',
    'https://reader:token@example.org/a', '//example.org/relative', 'not a URL']) {
    assert.equal(collectionTreeReading(leaf({ source: source({ url }) })).url, '', url)
  }
  for (const url of ['https://example.org/a?q=月光#part-2', 'http://example.org/public']) {
    assert.equal(collectionTreeReading(leaf({ source: source({ url }) })).url, new URL(url).href)
  }
})
