/**
 * 叙事场域布局：把一篇作品的正文段落沿一条柔和上升的三维曲线排布成文字碑，
 * 金句化为路径两侧的悬浮宝珠。布局由 workId 确定性生成（同一作品，同一座场域）。
 */
import * as THREE from 'three'
import type { WorkItem } from '@/types/game'
import { hashString, seededRandom } from '@/lib/worldGen'
import { extractQuotes } from '@/lib/zhihu'

export interface SteleSpot {
  pos: THREE.Vector3
  quat: THREE.Quaternion
}

export interface OrbSpot {
  pos: THREE.Vector3
  phase: number
  scale: number
}

export interface RealmLayout {
  /** 主题色相：hashString(labels[0]) % 360 */
  hue: number
  /** 主题强调色（hsl 字符串，可直接给 three 材质或 css） */
  accent: string
  paragraphs: string[]
  quotes: string[]
  curve: THREE.CatmullRomCurve3
  steles: SteleSpot[]
  orbs: OrbSpot[]
  /** 入口牌坊位置（y=0 为其浮岛基面） */
  archPos: THREE.Vector3
  /** 归途之门位置 */
  gatePos: THREE.Vector3
  /** 曲线中点（星尘分布中心） */
  center: THREE.Vector3
  /** 建议入场点与朝向（世界侧传送玩家时参考） */
  spawn: { pos: [number, number, number]; lookAt: [number, number, number] }
}

/** 正文整理为 6~12 个阅读段落：优先按空行分段，不足时按句子归并 */
export function buildParagraphs(content: string): string[] {
  const clean = content.replace(/<[^>]+>/g, '')
  const byLine = clean.split(/\n+/).map((s) => s.trim()).filter(Boolean)
  if (byLine.length >= 6) return byLine.slice(0, 12)
  const sentences = clean
    .split(/(?<=[。！？；!?;…])/)
    .map((s) => s.trim())
    .filter(Boolean)
  const src = sentences.length > 0 ? sentences : byLine
  if (src.length === 0) return ['（此作正文暂未展开）']
  const target = Math.min(8, Math.max(6, Math.ceil(src.length / 3)))
  const per = Math.ceil(src.length / target)
  const out: string[] = []
  for (let i = 0; i < src.length; i += per) out.push(src.slice(i, i + per).join(''))
  return out.slice(0, 12)
}

export function buildRealmLayout(work: WorkItem): RealmLayout {
  const rnd = seededRandom(hashString(work.workId))
  const hue = hashString(work.labels[0] ?? work.title) % 360
  const accent = `hsl(${hue}, 72%, 62%)`

  const paragraphs = buildParagraphs(work.content)
  const quotes = (work.quotes.length > 0 ? work.quotes : extractQuotes(work.content, 10)).slice(0, 10)
  const n = Math.max(paragraphs.length, 1)

  // 柔和上升的 S 形曲线，整体向 -Z 延伸，入口在 +Z 一侧
  const lift = 3.5 + n * 0.5
  const length = 16 + n * 7
  const segs = n + 2
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    pts.push(
      new THREE.Vector3(
        Math.sin(t * Math.PI * 1.7) * (5 + rnd() * 2.5) + (rnd() - 0.5) * 2,
        2.2 + t * lift + Math.sin(t * Math.PI) * 1.4,
        4 - t * length,
      ),
    )
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')

  const tmp = new THREE.Object3D()
  const perp = new THREE.Vector3()
  // 路径的水平法向（文字碑 / 宝珠据此排在路径两侧）
  const sideDir = (t: number) => {
    const tan = curve.getTangentAt(t)
    return perp.set(-tan.z, 0, tan.x).normalize()
  }

  const steles: SteleSpot[] = paragraphs.map((_, i) => {
    const t = n === 1 ? 0.5 : 0.08 + (i / (n - 1)) * 0.86
    const p = curve.getPointAt(t)
    const center = p.clone().addScaledVector(sideDir(t), (i % 2 === 0 ? 1 : -1) * 3.8)
    center.y += 0.5
    tmp.position.copy(center)
    tmp.lookAt(p) // 碑面正对路径
    return { pos: center, quat: tmp.quaternion.clone() }
  })

  const m = quotes.length
  const orbs: OrbSpot[] = quotes.map((_, i) => {
    const t = m === 1 ? 0.5 : 0.14 + (i / (m - 1)) * 0.76
    const p = curve.getPointAt(t)
    const pos = p.clone().addScaledVector(sideDir(t), (i % 2 === 0 ? -1 : 1) * (2.1 + rnd() * 1.6))
    pos.y += 1 + rnd() * 1.8
    return { pos, phase: rnd() * Math.PI * 2, scale: 0.85 + rnd() * 0.45 }
  })

  const start = curve.getPointAt(0)
  const archPos = new THREE.Vector3(start.x * 0.4, 0, 6.5)
  const gatePos = new THREE.Vector3(archPos.x + 5.4, 2.7, 6.5)

  return {
    hue,
    accent,
    paragraphs,
    quotes,
    curve,
    steles,
    orbs,
    archPos,
    gatePos,
    center: curve.getPointAt(0.5),
    spawn: { pos: [archPos.x, 3, 13], lookAt: [archPos.x, 3, 0] },
  }
}
