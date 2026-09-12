/** 全局共享类型 —— 所有模块的契约层，改动需同步所有使用方 */

export type WorkKind = 'story' | 'knowledge'

/** 知乎内容条目（黑客松故事/知识内容 API） */
export interface WorkItem {
  workId: string
  kind: WorkKind
  title: string
  authorName: string
  authorAvatar: string
  artwork: string
  description: string
  introduction: string
  labels: string[]
  content: string
  quotes: string[]
}

/** 词云大世界中的话题词节点 */
export interface TopicNode {
  id: string
  word: string
  /** 世界坐标 */
  position: [number, number, number]
  /** 关联作品 */
  workIds: string[]
  /** 视觉权重 0~1（关联作品数归一化） */
  weight: number
  /** 是否为核心种子词（用户输入/随机种子），否则为扩展词 */
  isSeed: boolean
  /** 是否已展开过关联词 */
  expanded: boolean
}

/** 世界种子 */
export interface WorldSeed {
  rawInput: string
  topics: string[]
  createdAt: number
}

/** 知识行囊收获品 */
export interface BackpackItem {
  id: string
  workId: string
  kind: WorkKind
  title: string
  /** 金句原文或作品摘要 */
  text: string
  topicWord?: string
  collectedAt: number
}

/** 收获品之间的链接（思维合成台产物） */
export interface ItemLink {
  id: string
  aId: string
  bId: string
  note: string
  createdAt: number
}

export interface AnchorComment {
  id: string
  author: string
  text: string
  createdAt: number
}

/** 想法锚点（自己或同频人的） */
export interface IdeaAnchor {
  id: string
  topicWord?: string
  workId?: string
  text: string
  author: string
  mine: boolean
  likes: number
  likedByMe: boolean
  comments: AnchorComment[]
  createdAt: number
}

/** 探索轨迹点 */
export interface TrailPoint {
  t: number
  pos: [number, number, number]
  /** 经过的话题词（如有） */
  word?: string
}

/** 一次旅程存档 */
export interface JourneyRecord {
  id: string
  startedAt: number
  endedAt: number
  visitedWords: string[]
  collected: number
  anchors: number
  trail: TrailPoint[]
}

/** 同频人（漫行者）画像 */
export interface Companion {
  id: string
  name: string
  avatar: string
  motto: string
  visitedWords: string[]
  /** 与当前用户的同频度 0~100 */
  resonance: number
  anchors: IdeaAnchor[]
}

export type PanelId =
  | 'backpack' // B 知识行囊
  | 'reader' // 阅读原文
  | 'anchors' // T 他人想法锚点
  | 'cabinet' // 想法收纳柜（家园）
  | 'synth' // 思维合成台（家园）
  | 'journal' // 漫行者日志（家园）
  | 'phone' // 同频电话亭（家园）
  | 'settings'
  | 'help'
  | null
