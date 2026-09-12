/**
 * 全局游戏状态（zustand + localStorage 持久化）
 * 所有面板、场景、页面通过此 store 通信 —— 这是模块间唯一契约。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  BackpackItem, Companion, IdeaAnchor, ItemLink, JourneyRecord,
  PanelId, TopicNode, TrailPoint, WorkItem, WorldSeed,
} from '@/types/game'
import { expandNode, generateWorld, hashString, seededRandom } from '@/lib/worldGen'

export const uid = () => Math.random().toString(36).slice(2, 10)

export type QualityMode = 'auto' | 'fine' | 'smooth'

export interface QualityProfile {
  dprMax: number
  shadowMapSize: 1024 | 2048
  postprocessing: boolean
}

/** Resolve the user-facing quality mode to renderer settings once per render. */
export function getQualityProfile(mode: QualityMode): QualityProfile {
  if (mode === 'fine') return { dprMax: 1.5, shadowMapSize: 2048, postprocessing: true }
  if (mode === 'smooth') return { dprMax: 1, shadowMapSize: 1024, postprocessing: false }
  // Auto keeps desktop detail while avoiding high DPR/post effects on touch devices.
  const isTouch = typeof navigator !== 'undefined'
    && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))
  return isTouch
    ? { dprMax: 1, shadowMapSize: 1024, postprocessing: false }
    : { dprMax: 1.5, shadowMapSize: 2048, postprocessing: true }
}

/* ---------- 内置同频人（漫行者） ---------- */
const COMPANION_SEED: Array<Omit<Companion, 'resonance' | 'anchors'>> = [
  { id: 'c1', name: '看山的猫', avatar: '🦊', motto: '长路本身，已是圆满。', visitedWords: ['成长', '孤独', '时间', '脑洞', '职场'] },
  { id: 'c2', name: '漫行者阿远', avatar: '🦌', motto: '见自己，见众生，见天地。', visitedWords: ['命运', '选择', '自由', '悬疑', '历史'] },
  { id: 'c3', name: '拾光小筑', avatar: '🦉', motto: '我将自己摊成稿纸，让岁月前来点苔。', visitedWords: ['爱', '勇气', '成长', '甜宠', '心理'] },
  { id: 'c4', name: '北岛不北', avatar: '🐋', motto: '在山河间找路。', visitedWords: ['职场', '穷人思维', '升职', '选择', '时间'] },
]

const COMPANION_THOUGHTS = [
  '这个词我在三个世界里都遇见过，每次都停下来很久。',
  '原来不止我一个人在这里迷路。',
  '这句话救过我一次，留一盏灯给后来的人。',
  '质疑一下：真的是这样吗？我在别处读到过相反的观点。',
  '路过，被这句击中了。',
  '如果你也在这里停留，我们可能走在同一条路上。',
]

function buildCompanions(myWords: string[]): Companion[] {
  return COMPANION_SEED.map((c) => {
    const rnd = seededRandom(hashString(c.id))
    const overlap = c.visitedWords.filter((w) => myWords.includes(w)).length
    const base = Math.min(60, overlap * 18)
    const resonance = Math.min(98, Math.round(base + 20 + rnd() * 25))
    const anchors: IdeaAnchor[] = c.visitedWords.slice(0, 3).map((w, i) => ({
      id: `${c.id}-a${i}`,
      topicWord: w,
      text: COMPANION_THOUGHTS[Math.floor(rnd() * COMPANION_THOUGHTS.length)],
      author: c.name,
      mine: false,
      likes: Math.floor(rnd() * 40) + 1,
      likedByMe: false,
      comments: [],
      createdAt: Date.now() - Math.floor(rnd() * 30) * 86400000,
    }))
    return { ...c, resonance, anchors }
  })
}

/* ---------- Store ---------- */

export interface GameState {
  qualityMode: QualityMode
  setQualityMode: (mode: QualityMode) => void

  works: WorkItem[]
  setWorks: (w: WorkItem[]) => void

  seed: WorldSeed | null
  nodes: TopicNode[]
  /** 生成新世界（清空旧的扩展） */
  startWorld: (rawInput: string, topics: string[]) => void
  /** 展开某话题词的关联词 */
  expandTopic: (nodeId: string) => void
  getWork: (workId: string) => WorkItem | undefined

  visitedWords: string[]
  markVisited: (word: string) => void
  trail: TrailPoint[]
  addTrailPoint: (pos: [number, number, number], word?: string) => void

  realmWorkId: string | null
  enterRealm: (workId: string) => void
  exitRealm: () => void

  backpack: BackpackItem[]
  collect: (item: Omit<BackpackItem, 'id' | 'collectedAt'>) => void
  removeFromBackpack: (id: string) => void
  links: ItemLink[]
  linkItems: (aId: string, bId: string, note: string) => void
  removeLink: (id: string) => void

  anchors: IdeaAnchor[]
  addAnchor: (a: { topicWord?: string; workId?: string; text: string }) => void
  likeAnchor: (id: string) => void
  commentAnchor: (id: string, text: string) => void

  journeys: JourneyRecord[]
  saveJourney: () => void

  companions: Companion[]
  refreshCompanions: () => void

  panel: PanelId
  readerWorkId: string | null
  openPanel: (p: PanelId, workId?: string) => void
  closePanel: () => void

  /** 当前准星/附近聚焦的交互对象（世界场景写入，HUD/面板读取） */
  focusTarget: { kind: 'node' | 'quote' | 'anchor'; label: string; workId?: string } | null
  setFocusTarget: (t: GameState['focusTarget']) => void
  /** 当前语境话题词（R/T 锚点面板的目标词，由世界场景按最近节点写入） */
  contextWord: string | null
  setContextWord: (w: string | null) => void

  /** 轻提示（HUD toast） */
  toast: { id: string; text: string } | null
  showToast: (text: string) => void

  /** 画布查看的同频人 */
  focusCompanionId: string | null
  setFocusCompanion: (id: string | null) => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      qualityMode: 'auto',
      setQualityMode: (qualityMode) => set({ qualityMode }),

      works: [],
      setWorks: (works) => set({ works }),

      seed: null,
      nodes: [],
      startWorld: (rawInput, topics) => {
        const works = get().works
        set({
          seed: { rawInput, topics, createdAt: Date.now() },
          nodes: generateWorld(topics, works),
          visitedWords: [],
          trail: [],
          realmWorkId: null,
        })
        get().refreshCompanions()
      },
      expandTopic: (nodeId) => {
        const { nodes, works } = get()
        const node = nodes.find((n) => n.id === nodeId)
        if (!node || node.expanded) return
        const fresh = expandNode(node, works, nodes)
        set({
          nodes: [...nodes.map((n) => (n.id === nodeId ? { ...n, expanded: true } : n)), ...fresh],
        })
      },
      getWork: (workId) => get().works.find((w) => w.workId === workId),

      visitedWords: [],
      markVisited: (word) =>
        set((s) => (s.visitedWords.includes(word) ? s : { visitedWords: [...s.visitedWords, word] })),
      trail: [],
      addTrailPoint: (pos, word) =>
        set((s) => ({ trail: [...s.trail.slice(-2000), { t: Date.now(), pos, word }] })),

      realmWorkId: null,
      enterRealm: (workId) => set({ realmWorkId: workId }),
      exitRealm: () => set({ realmWorkId: null }),

      backpack: [],
      collect: (item) => {
        const s = get()
        if (s.backpack.some((b) => b.workId === item.workId && b.text === item.text)) {
          s.showToast('已在行囊中')
          return
        }
        set((st) => ({ backpack: [...st.backpack, { ...item, id: uid(), collectedAt: Date.now() }] }))
        s.showToast('已收入知识行囊')
      },
      removeFromBackpack: (id) =>
        set((s) => ({
          backpack: s.backpack.filter((b) => b.id !== id),
          links: s.links.filter((l) => l.aId !== id && l.bId !== id),
        })),
      links: [],
      linkItems: (aId, bId, note) =>
        set((s) => ({ links: [...s.links, { id: uid(), aId, bId, note, createdAt: Date.now() }] })),
      removeLink: (id) => set((s) => ({ links: s.links.filter((l) => l.id !== id) })),

      anchors: [],
      addAnchor: ({ topicWord, workId, text }) => {
        set((s) => ({
          anchors: [
            ...s.anchors,
            {
              id: uid(), topicWord, workId, text, author: '我', mine: true,
              likes: 0, likedByMe: false, comments: [], createdAt: Date.now(),
            },
          ],
        }))
        get().showToast('想法锚点已设立')
      },
      likeAnchor: (id) =>
        set((s) => ({
          anchors: s.anchors.map((a) =>
            a.id === id
              ? { ...a, likedByMe: !a.likedByMe, likes: a.likes + (a.likedByMe ? -1 : 1) }
              : a
          ),
        })),
      commentAnchor: (id, text) =>
        set((s) => ({
          anchors: s.anchors.map((a) =>
            a.id === id
              ? { ...a, comments: [...a.comments, { id: uid(), author: '我', text, createdAt: Date.now() }] }
              : a
          ),
        })),

      journeys: [],
      saveJourney: () => {
        const s = get()
        if (s.trail.length < 2) return
        const rec: JourneyRecord = {
          id: uid(),
          startedAt: s.trail[0].t,
          endedAt: Date.now(),
          visitedWords: [...s.visitedWords],
          collected: s.backpack.length,
          anchors: s.anchors.filter((a) => a.mine).length,
          trail: s.trail,
        }
        set((st) => ({ journeys: [...st.journeys.slice(-9), rec] }))
        s.showToast('旅程已存档')
      },

      companions: buildCompanions([]),
      refreshCompanions: () => set((s) => ({ companions: buildCompanions(s.visitedWords) })),

      panel: null,
      readerWorkId: null,
      openPanel: (p, workId) => set({ panel: p, readerWorkId: workId ?? null }),
      closePanel: () => set({ panel: null, readerWorkId: null }),

      focusTarget: null,
      setFocusTarget: (t) => set({ focusTarget: t }),
      contextWord: null,
      setContextWord: (w) => set({ contextWord: w }),

      toast: null,
      showToast: (text) => {
        const id = uid()
        set({ toast: { id, text } })
        setTimeout(() => {
          if (get().toast?.id === id) set({ toast: null })
        }, 2200)
      },

      focusCompanionId: null,
      setFocusCompanion: (id) => set({ focusCompanionId: id }),
    }),
    {
      name: 'wanderwise-game-v1',
      partialize: (s) => ({
        qualityMode: s.qualityMode,
        seed: s.seed,
        nodes: s.nodes,
        visitedWords: s.visitedWords,
        trail: s.trail.slice(-500),
        backpack: s.backpack,
        links: s.links,
        anchors: s.anchors,
        journeys: s.journeys,
      }),
    }
  )
)
