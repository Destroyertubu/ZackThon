/**
 * 知乎数据层
 * - 黑客松故事/知识内容 API：免鉴权、CORS 开放，前端直连；失败时回退到内置快照 src/data/works.json
 * - 开放平台 API（热榜/搜索/直答/额度）：需要 Access Secret，由用户在设置中自行填入（仅存 localStorage）
 */
import type { WorkItem, WorkKind } from '@/types/game'
import snapshot from '@/data/works.json'

const CONTENT_BASE = 'https://api.zhihu.com/km-indep-home/hackathon/v2'
const OPEN_BASE = 'https://developer.zhihu.com'
const CACHE_KEY = 'wanderwise.works.cache.v1'
const CACHE_TTL = 1000 * 60 * 30 // 30min

interface ListItem {
  work_id: string
  title: string
  artwork?: string
  description?: string
  labels?: string[]
}

function normalizeListItem(kind: WorkKind, it: ListItem): WorkItem {
  return {
    workId: it.work_id,
    kind,
    title: it.title ?? '',
    authorName: '',
    authorAvatar: '',
    artwork: it.artwork ?? '',
    description: it.description ?? '',
    introduction: '',
    labels: it.labels ?? [],
    content: '',
    quotes: [],
  }
}

function mergeDetail(base: WorkItem, det: Record<string, unknown>): WorkItem {
  const content = typeof det.content === 'string' ? det.content : base.content
  return {
    ...base,
    title: (det.chapter_name as string) || base.title,
    authorName: (det.author_name as string) || base.authorName,
    authorAvatar: (det.author_avatar as string) || base.authorAvatar,
    introduction: (det.introduction as string) || base.introduction,
    labels: Array.isArray(det.labels) ? (det.labels as string[]) : base.labels,
    content,
    quotes: base.quotes.length > 0 ? base.quotes : extractQuotes(content || base.description),
  }
}

export function extractQuotes(text: string, limit = 12): string[] {
  if (!text) return []
  const clean = text.replace(/<[^>]+>/g, ' ')
  const parts = clean.split(/(?<=[。！？…!?])/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of parts) {
    const p = raw.replace(/\s+/g, '')
    if (p.length >= 12 && p.length <= 46 && !seen.has(p)) {
      seen.add(p)
      out.push(p)
      if (out.length >= limit) break
    }
  }
  return out
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, ...init })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

let worksPromise: Promise<WorkItem[]> | null = null

/** 获取全部作品（列表 + 详情），带 localStorage 缓存与快照回退 */
export function getWorks(): Promise<WorkItem[]> {
  if (worksPromise) return worksPromise
  worksPromise = (async () => {
    const bundled = snapshot as unknown as WorkItem[]
    try {
      const cachedRaw = localStorage.getItem(CACHE_KEY)
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { at: number; works: WorkItem[] }
        if (Date.now() - cached.at < CACHE_TTL && cached.works.length > 0) return cached.works
      }
      const [stories, knowledge] = await Promise.all([
        fetchJson<ListItem[]>(`${CONTENT_BASE}/story/list`),
        fetchJson<ListItem[]>(`${CONTENT_BASE}/knowledge/list`),
      ])
      const byId = new Map(bundled.map((w) => [w.workId, w]))
      const list = [
        ...stories.map((it) => normalizeListItem('story', it)),
        ...knowledge.map((it) => normalizeListItem('knowledge', it)),
      ]
      const works = await Promise.all(
        list.map(async (item) => {
          const cached = byId.get(item.workId)
          if (cached && cached.content) return { ...cached, ...item, quotes: cached.quotes }
          try {
            const det = await fetchJson<Record<string, unknown>>(`${CONTENT_BASE}/${item.kind}/${item.workId}`)
            return mergeDetail(item, det)
          } catch {
            return cached ?? item
          }
        })
      )
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), works }))
      return works
    } catch (e) {
      console.warn('[zhihu] 内容接口不可用，使用内置快照', e)
      return bundled
    }
  })()
  return worksPromise
}

/* ---------- 开放平台（需要 Access Secret，仅存本地） ---------- */

const SECRET_KEY = 'wanderwise.accessSecret'
export const getAccessSecret = () => localStorage.getItem(SECRET_KEY) ?? ''
export const setAccessSecret = (s: string) =>
  s ? localStorage.setItem(SECRET_KEY, s) : localStorage.removeItem(SECRET_KEY)

function openHeaders(secret: string) {
  return {
    Authorization: `Bearer ${secret}`,
    'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
    'Content-Type': 'application/json',
  }
}

export interface HotItem { Title: string; Url: string; ThumbnailUrl: string; Summary: string }
export interface SearchItem {
  Title: string; ContentType: string; ContentID: string; ContentText: string
  Url: string; CommentCount: number; VoteUpCount: number; AuthorName: string
  AuthorityLevel: string; RankingScore?: number
}

export async function getHotList(secret: string, limit = 20): Promise<HotItem[]> {
  const d = await fetchJson<{ Code: number; Data: { Items: HotItem[] }; Message: string }>(
    `${OPEN_BASE}/api/v1/content/hot_list?Limit=${limit}`,
    { headers: openHeaders(secret) }
  )
  if (d.Code !== 0) throw new Error(d.Message || `Code ${d.Code}`)
  return d.Data.Items
}

export async function searchZhihu(secret: string, query: string, count = 10): Promise<SearchItem[]> {
  const url = `${OPEN_BASE}/api/v1/content/zhihu_search?Query=${encodeURIComponent(query)}&Count=${count}`
  const d = await fetchJson<{ Code: number; Data: { Items: SearchItem[] }; Message: string }>(url, {
    headers: openHeaders(secret),
  })
  if (d.Code !== 0) throw new Error(d.Message || `Code ${d.Code}`)
  return d.Data.Items
}

export async function zhidaAnswer(secret: string, query: string): Promise<string> {
  const res = await fetch(`${OPEN_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: openHeaders(secret),
    body: JSON.stringify({
      model: 'zhida-fast-1p5',
      messages: [{ role: 'user', content: query }],
      stream: false,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const d = await res.json()
  const msg = d?.choices?.[0]?.message?.content
  if (!msg) throw new Error(d?.error?.message || '直答返回为空')
  return msg as string
}

export interface QuotaItem { APIID: string; APIName: string; TotalQuota: number; TotalUsed: number; RemainingQuota: number }
export async function getQuota(secret: string): Promise<QuotaItem[]> {
  const d = await fetchJson<{ Code: number; Data: QuotaItem[]; Message: string }>(
    `${OPEN_BASE}/api/v1/quota`,
    { headers: openHeaders(secret) }
  )
  if (d.Code !== 0) throw new Error(d.Message || `Code ${d.Code}`)
  return d.Data
}
