/** 思维合成台：两件收获品 + 一句批注，合成一条洞察并织入洞察网络 */
import { useMemo, useState } from 'react'
import { FlaskConical, Link2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useGameStore } from '@/state/gameStore'
import type { BackpackItem } from '@/types/game'
import PanelShell, { fmtDateTime, kindLabel } from './PanelShell'

/* ---------- 本地规则洞察生成 ---------- */

const STOP_BIGRAMS = new Set([
  '我们', '你们', '他们', '自己', '一个', '什么', '怎么', '为什么', '时候', '没有',
  '就是', '只是', '因为', '所以', '如果', '但是', '已经', '知道', '觉得', '可以',
  '不是', '都是', '这样', '那样', '这个', '那个', '这些', '那些', '现在', '后来',
])

function bigrams(text: string): string[] {
  const clean = text.replace(/[^一-龥a-zA-Z0-9]/g, '')
  const out = new Set<string>()
  for (let i = 0; i + 2 <= clean.length; i++) out.add(clean.slice(i, i + 2))
  return [...out]
}

/** 取一条文本的代表词：优先话题词，否则第一个有意义的二字词 */
function keywordOf(item: BackpackItem): string {
  if (item.topicWord?.trim()) return item.topicWord.trim()
  const hit = bigrams(item.text).find((w) => !STOP_BIGRAMS.has(w))
  return hit ?? '星光'
}

function makeInsight(a: BackpackItem, b: BackpackItem): string {
  const x = keywordOf(a)
  const y = keywordOf(b)
  const bSet = new Set(bigrams(b.text))
  const common = bigrams(a.text).filter((w) => bSet.has(w) && !STOP_BIGRAMS.has(w))
  if (common.length > 0) {
    return `当『${x}』遇见『${y}』：『${common[0]}』在两条星光之间来回出现——它们说的，也许是同一件事的不同侧面。`
  }
  return `当『${x}』遇见『${y}』：一条负责追问，一条负责回答；合在一起，刚好是一次完整的思考。`
}

/* ---------- 组件 ---------- */

export default function SynthPanel() {
  const backpack = useGameStore((s) => s.backpack)
  const links = useGameStore((s) => s.links)
  const linkItems = useGameStore((s) => s.linkItems)
  const removeLink = useGameStore((s) => s.removeLink)

  const [slotA, setSlotA] = useState<string | null>(null)
  const [slotB, setSlotB] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [insight, setInsight] = useState<string | null>(null)

  const itemA = useMemo(() => backpack.find((b) => b.id === slotA) ?? null, [backpack, slotA])
  const itemB = useMemo(() => backpack.find((b) => b.id === slotB) ?? null, [backpack, slotB])
  const itemById = useMemo(() => new Map(backpack.map((b) => [b.id, b])), [backpack])
  const ready = itemA !== null && itemB !== null && itemA.id !== itemB.id

  const synthesize = () => {
    if (!itemA || !itemB) return
    linkItems(itemA.id, itemB.id, note.trim())
    setInsight(makeInsight(itemA, itemB))
    setSlotA(null)
    setSlotB(null)
    setNote('')
  }

  const renderSlot = (label: string, item: BackpackItem | null, otherId: string | null, set: (id: string | null) => void) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-xs tracking-[0.2em] text-[#8a8f9c]">{label}</p>
      {item ? (
        <div className="relative flex flex-col gap-1 rounded-lg border border-[#c9973f]/50 bg-[#c9973f]/10 p-3">
          <button
            type="button"
            aria-label="清空槽位"
            onClick={() => set(null)}
            className="absolute right-2 top-2 text-[#8a8f9c] transition-colors hover:text-[#e8dcc0]"
          >
            <X className="size-3.5" />
          </button>
          <Badge variant="outline" className="w-fit border-[#c9973f]/40 text-[#c9973f]">
            {kindLabel(item.kind)}{item.topicWord ? ` · ${item.topicWord}` : ''}
          </Badge>
          <p className="line-clamp-3 text-sm leading-relaxed text-[#e8dcc0]">{item.text}</p>
          <p className="truncate text-xs text-[#8a8f9c]">《{item.title}》</p>
        </div>
      ) : (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-dashed border-[#c9973f]/30 bg-black/30 p-2">
          {backpack.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-[#8a8f9c]">行囊空空，无料可合</p>
          ) : (
            backpack.map((b) => {
              const disabled = b.id === otherId
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => set(b.id)}
                  className="flex items-start gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-[#e8dcc0]/90 transition-colors hover:bg-[#c9973f]/10 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Plus className="mt-0.5 size-3 shrink-0 text-[#c9973f]" />
                  <span className="line-clamp-2">{b.text}</span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )

  return (
    <PanelShell
      icon={FlaskConical}
      title="思维合成台"
      subtitle="取两件收获，加一句批注，炼成一条新的洞察"
      widthClass="sm:max-w-3xl"
    >
      <style>{`@keyframes wwInsightGlow{0%,100%{box-shadow:0 0 12px rgba(201,151,63,.22)}50%{box-shadow:0 0 32px rgba(201,151,63,.55)}}`}</style>
      <div className="flex flex-col gap-5">
        {/* 合成槽 */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {renderSlot('合成槽 · 壹', itemA, slotB, setSlotA)}
          <div className="flex items-center justify-center sm:flex-col">
            <Link2 className="size-5 rotate-90 text-[#c9973f]/70 sm:rotate-0" />
          </div>
          {renderSlot('合成槽 · 贰', itemB, slotA, setSlotB)}
        </div>

        {/* 批注 + 触发 */}
        <div className="flex flex-col gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="写一句链接批注：这两条星光为何放在一起？"
            rows={2}
            className="resize-none border-[#c9973f]/30 bg-black/40 text-sm text-[#e8dcc0] placeholder:text-[#8a8f9c]/60 focus-visible:border-[#c9973f]/60 focus-visible:ring-[#c9973f]/20"
          />
          <Button
            disabled={!ready}
            onClick={synthesize}
            className="w-full border border-[#c9973f]/50 bg-[#c9973f]/15 font-serif tracking-[0.3em] text-[#c9973f] hover:bg-[#c9973f]/25 hover:text-[#e8dcc0]"
            variant="outline"
          >
            <Sparkles className="size-4" />
            合成洞察
          </Button>
          {backpack.length < 2 && (
            <p className="text-center text-xs text-[#8a8f9c]">至少需要两件收获品才能合成，先去世界里多拾几件吧</p>
          )}
        </div>

        {/* 合成结果：发光卡片 */}
        {insight && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div
              className="rounded-xl border border-[#c9973f]/60 bg-[#c9973f]/10 p-4"
              style={{ animation: 'wwInsightGlow 2.4s ease-in-out infinite' }}
            >
              <p className="mb-1 flex items-center gap-1.5 text-xs tracking-[0.25em] text-[#c9973f]">
                <Sparkles className="size-3" />
                新的洞察诞生了
              </p>
              <p className="font-serif text-sm leading-relaxed text-[#e8dcc0]">{insight}</p>
            </div>
          </div>
        )}

        <Separator className="bg-[#c9973f]/15" />

        {/* 洞察网络 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-sm tracking-[0.25em] text-[#c9973f]">洞察网络</h3>
            <Badge variant="outline" className="border-[#c9973f]/40 text-[#c9973f]">{links.length}</Badge>
          </div>
          {links.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#8a8f9c]">尚无链接，第一条洞察会从这里生长</p>
          ) : (
            [...links].reverse().map((link) => {
              const a = itemById.get(link.aId)
              const b = itemById.get(link.bId)
              if (!a || !b) return null
              return (
                <article
                  key={link.id}
                  className="flex flex-col gap-2 rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/60 p-3"
                >
                  <div className="flex items-start gap-2 text-xs leading-relaxed text-[#e8dcc0]/90">
                    <span className="line-clamp-2 flex-1 rounded border border-[#c9973f]/15 bg-black/40 px-2 py-1">{a.text}</span>
                    <Link2 className="mt-1 size-3.5 shrink-0 text-[#c9973f]" />
                    <span className="line-clamp-2 flex-1 rounded border border-[#c9973f]/15 bg-black/40 px-2 py-1">{b.text}</span>
                  </div>
                  {link.note && (
                    <p className="text-sm text-[#e8dcc0]">批注：{link.note}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-[#8a8f9c]">
                    <span className="flex-1">{fmtDateTime(link.createdAt)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-[#8a8f9c] hover:bg-red-950/40 hover:text-red-300"
                      onClick={() => removeLink(link.id)}
                    >
                      <Trash2 className="size-3" />
                      拆除链接
                    </Button>
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>
    </PanelShell>
  )
}
