import type { CollectionTreeLeaf } from './collectionTree'
import { safeSourceUrl } from './persistence'

/** A saved leaf may contain a search summary, not an acquired article body. */
export function collectionTreeReading(leaf: CollectionTreeLeaf) {
  const source = leaf.source
  const paragraphs: string[] = []
  const sourceLabel = source?.kind === 'curated' ? '精选导读' : source?.kind === 'excerpt' ? '来源节选' : '来源摘要'
  if (leaf.excerpt.trim()) paragraphs.push(`${leaf.excerptKind === 'summary' ? sourceLabel : '我的摘录'}：${leaf.excerpt}`)
  if (source?.summary.trim() && source.summary.trim() !== leaf.excerpt.trim()) {
    paragraphs.push(`${sourceLabel}：${source.summary}`)
  }
  if (source?.readingGuide) paragraphs.push(`阅读线索：${source.readingGuide}`)
  if (!source) paragraphs.push('这片叶子的来源记录暂时缺失，已保存的摘录仍然保留。可从个人空间的备份恢复来源。')
  return {
    title: leaf.title,
    author: source?.author || '作者未提供',
    provenance: source ? `${source.source} · ${source.kind === 'curated' ? '精选导读' : '收藏摘录与摘要'}，非全文` : '来源缺失 · 本机保存的摘录',
    paragraphs,
    url: source ? safeSourceUrl(source.url) : '',
  }
}
