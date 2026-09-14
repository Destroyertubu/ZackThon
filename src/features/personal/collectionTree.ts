import type { ContentSource, PersonalData } from './types'
import { KNOWLEDGE_INGREDIENTS } from '../../components/observatory/gardenRecipes'

export interface CollectionTreeLeaf {
  /** The collection record identity, not the shared source identity. */
  id: string
  sourceId: string
  title: string
  excerpt: string
  /** "excerpt" names a stored excerpt; it does not certify a verbatim source quote. */
  excerptKind: 'summary' | 'excerpt' | 'none'
  source: ContentSource | undefined
  createdAt: string
}

export interface CollectionTreeTopic {
  id: string
  label: string
  leaves: CollectionTreeLeaf[]
}

function nonemptyLabel(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Deterministic, collision-free code-point encoding; independent of order/count. */
function topicId(label: string): string {
  return `collection-topic:${Array.from(label, character => character.codePointAt(0)!.toString(16)).join('-')}`
}

/** A read-only view of existing collections, in first-seen topic/record order. */
export function buildCollectionTree(data: PersonalData): CollectionTreeTopic[] {
  const topics = new Map<string, CollectionTreeTopic>()
  for (const collection of data.collections) {
    // Missing keys must not accidentally resolve Object.prototype properties.
    const source = Object.hasOwn(data.sources, collection.sourceId) ? data.sources[collection.sourceId] : undefined
    const rawLabel = source?.tags?.map(nonemptyLabel).find(tag => tag !== undefined)
      ?? nonemptyLabel(source?.galaxy?.query)
      ?? '未归枝'
    // Existing journey sources store ingredient IDs; show the same names as the bar.
    const label = KNOWLEDGE_INGREDIENTS.find(ingredient => ingredient.id === rawLabel)?.name ?? rawLabel
    let topic = topics.get(label)
    if (!topic) {
      topic = { id: topicId(label), label, leaves: [] }
      topics.set(label, topic)
    }
    const excerptText = collection.excerpt.trim()
    topic.leaves.push({
      id: collection.id,
      sourceId: collection.sourceId,
      title: source ? source.title : '来源已缺失',
      excerpt: collection.excerpt,
      excerptKind: !excerptText ? 'none' : source && excerptText === source.summary.trim() ? 'summary' : 'excerpt',
      source,
      createdAt: collection.createdAt,
    })
  }
  return [...topics.values()]
}
