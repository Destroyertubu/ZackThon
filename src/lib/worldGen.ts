import type { TopicNode, WorkItem } from '@/types/game'

/** 简易可复现随机（mulberry32） */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 从用户输入提取话题词：逗号/空格/顿号分隔，或对长句取 2~4 字滑窗中的常见双字词 */
export function extractTopics(raw: string, works: WorkItem[]): string[] {
  const tokens = raw
    .split(/[,，、;；\s\n!?？?。]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 8)
  const topics = [...new Set(tokens)].slice(0, 6)
  if (topics.length > 0) return topics
  // 无有效输入：从内容标签中挑热门
  return pickRandomLabels(works, 5, hashString(raw || String(Date.now())))
}

export function pickRandomLabels(works: WorkItem[], n: number, seedNum: number): string[] {
  const freq = new Map<string, number>()
  for (const w of works) for (const l of w.labels) freq.set(l, (freq.get(l) ?? 0) + 1)
  const labels = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l)
  const rnd = seededRandom(seedNum)
  const pool = labels.slice(0, 30)
  const out: string[] = []
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(rnd() * pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  // 标签不够时用作品标题关键词补齐
  const fallback = ['成长', '选择', '孤独', '勇气', '时间', '命运', '爱', '自由']
  while (out.length < n) out.push(fallback[out.length % fallback.length])
  return out
}

/** 为一个话题词找关联作品：标签命中 > 标题/摘要包含 > 随机补充 */
function worksForWord(word: string, works: WorkItem[], rnd: () => number, max = 4): string[] {
  const exact = works.filter((w) => w.labels.some((l) => l.includes(word) || word.includes(l)))
  const fuzzy = works.filter(
    (w) => !exact.includes(w) && (w.title.includes(word) || w.description.includes(word))
  )
  const picked = [...exact, ...fuzzy].slice(0, max).map((w) => w.workId)
  if (picked.length < 2) {
    const shuffled = [...works].sort(() => rnd() - 0.5)
    for (const w of shuffled) {
      if (picked.length >= 2) break
      if (!picked.includes(w.workId)) picked.push(w.workId)
    }
  }
  return picked
}

/**
 * 生成词云大世界：
 * - 每个种子词一个悬浮岛屿集群，环形分布在主世界
 * - 每个词节点带关联作品
 * - 节点位置确定性生成（同一种子同一世界）
 */
export function generateWorld(seedTopics: string[], works: WorkItem[]): TopicNode[] {
  const seedNum = hashString(seedTopics.join('|'))
  const rnd = seededRandom(seedNum)
  const nodes: TopicNode[] = []
  const n = seedTopics.length
  const R = 46 // 集群环半径
  seedTopics.forEach((word, i) => {
    const angle = (i / n) * Math.PI * 2 + rnd() * 0.5
    const r = R * (0.85 + rnd() * 0.3)
    const workIds = worksForWord(word, works, rnd)
    nodes.push({
      id: `seed-${i}`,
      word,
      position: [Math.cos(angle) * r, 6 + rnd() * 14, Math.sin(angle) * r],
      workIds,
      weight: 0.7 + rnd() * 0.3,
      isSeed: true,
      expanded: false,
    })
  })
  return nodes
}

/** 展开一个话题词：从它的关联作品标签中生成新的关联词节点，散布在该词周围远处 */
export function expandNode(node: TopicNode, works: WorkItem[], existing: TopicNode[]): TopicNode[] {
  const rnd = seededRandom(hashString(node.id + node.word))
  const words = new Set(existing.map((n) => n.word))
  const labelFreq = new Map<string, number>()
  for (const id of node.workIds) {
    const w = works.find((x) => x.workId === id)
    for (const l of w?.labels ?? []) if (!words.has(l)) labelFreq.set(l, (labelFreq.get(l) ?? 0) + 1)
  }
  let related = [...labelFreq.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l).slice(0, 3)
  if (related.length === 0) {
    related = pickRandomLabels(works, 2, hashString(node.word)).filter((w) => !words.has(w))
  }
  return related.map((word, i) => {
    const angle = rnd() * Math.PI * 2
    const dist = 26 + rnd() * 18
    const [x, y, z] = node.position
    return {
      id: `${node.id}-x${i}`,
      word,
      position: [x + Math.cos(angle) * dist, Math.max(3, y + (rnd() - 0.4) * 12), z + Math.sin(angle) * dist],
      workIds: worksForWord(word, works, rnd),
      weight: 0.35 + rnd() * 0.3,
      isSeed: false,
      expanded: false,
    } satisfies TopicNode
  })
}
