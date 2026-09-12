/** 想法收纳柜：行囊收获品按 故事/知识 × 话题词 分格陈列 */
import { useMemo } from 'react'
import { Archive, BookOpen, Quote, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useGameStore } from '@/state/gameStore'
import type { BackpackItem, WorkKind } from '@/types/game'
import PanelShell, { fmtDateTime, kindLabel } from './PanelShell'

const KIND_ORDER: WorkKind[] = ['story', 'knowledge']

export default function CabinetPanel() {
  const backpack = useGameStore((s) => s.backpack)
  const removeFromBackpack = useGameStore((s) => s.removeFromBackpack)
  const openPanel = useGameStore((s) => s.openPanel)

  /** kind → topicWord → items（同组内新的在前） */
  const drawers = useMemo(() => {
    const byKind = new Map<WorkKind, Map<string, BackpackItem[]>>()
    for (const item of backpack) {
      if (!byKind.has(item.kind)) byKind.set(item.kind, new Map())
      const byTopic = byKind.get(item.kind)!
      const key = item.topicWord?.trim() || '未归类'
      if (!byTopic.has(key)) byTopic.set(key, [])
      byTopic.get(key)!.push(item)
    }
    for (const byTopic of byKind.values()) {
      for (const list of byTopic.values()) list.sort((a, b) => b.collectedAt - a.collectedAt)
    }
    return byKind
  }, [backpack])

  return (
    <PanelShell icon={Archive} title="想法收纳柜" subtitle="拾得的星光，按故事与知识分格安放">
      {backpack.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex size-14 items-center justify-center rounded-full border border-[#c9973f]/30 bg-[#c9973f]/5">
            <Archive className="size-6 text-[#c9973f]/70" />
          </span>
          <p className="font-serif tracking-[0.15em] text-[#e8dcc0]">行囊空空，去世界里拾些星光吧</p>
          <p className="text-xs text-[#8a8f9c]">在大世界中靠近话题词，拾取金句后会自动归入此处</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {KIND_ORDER.map((kind) => {
            const byTopic = drawers.get(kind)
            if (!byTopic || byTopic.size === 0) return null
            const total = [...byTopic.values()].reduce((n, l) => n + l.length, 0)
            return (
              <section key={kind} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-sm tracking-[0.25em] text-[#c9973f]">{kindLabel(kind)}</h3>
                  <Badge variant="outline" className="border-[#c9973f]/40 text-[#c9973f]">
                    {total}
                  </Badge>
                  <Separator className="flex-1 bg-[#c9973f]/15" />
                </div>
                {[...byTopic.entries()].map(([topic, items]) => (
                  <div
                    key={topic}
                    className="rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/60 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className="border-transparent bg-[#c9973f]/15 font-normal text-[#c9973f]">
                        {topic}
                      </Badge>
                      <span className="text-xs text-[#8a8f9c]">{items.length} 件</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {items.map((item) => (
                        <article
                          key={item.id}
                          className="group flex flex-col gap-2 rounded-md border border-[#c9973f]/15 bg-black/40 p-3 transition-colors hover:border-[#c9973f]/40"
                        >
                          <p className="line-clamp-3 text-sm leading-relaxed text-[#e8dcc0]">
                            <Quote className="mr-1 inline size-3 align-[-1px] text-[#c9973f]/60" />
                            {item.text}
                          </p>
                          <div className="mt-auto flex items-center gap-2 text-xs text-[#8a8f9c]">
                            <span className="min-w-0 flex-1 truncate" title={item.title}>
                              《{item.title}》
                            </span>
                            <span className="shrink-0">{fmtDateTime(item.collectedAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 border-[#c9973f]/30 bg-transparent px-2 text-xs text-[#c9973f] hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
                              onClick={() => openPanel('reader', item.workId)}
                            >
                              <BookOpen className="size-3" />
                              看来源
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-[#8a8f9c] hover:bg-red-950/40 hover:text-red-300"
                              onClick={() => removeFromBackpack(item.id)}
                            >
                              <Trash2 className="size-3" />
                              移除
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      )}
    </PanelShell>
  )
}
