/** 知识行囊面板（B 打开）：网格展示已收集的金句，支持读原文与移除 */
import { Backpack, BookOpen, Trash2 } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import PanelShell, { formatTime } from './PanelShell'

export default function BackpackPanel() {
  const backpack = useGameStore((s) => s.backpack)
  const openPanel = useGameStore((s) => s.openPanel)
  const removeFromBackpack = useGameStore((s) => s.removeFromBackpack)

  const items = [...backpack].sort((a, b) => b.collectedAt - a.collectedAt)

  return (
    <PanelShell
      title="知识行囊"
      icon={Backpack}
      subtitle={`共 ${items.length} 件收获`}
      className="max-w-4xl"
    >
      <div className="flex items-center gap-2 border-b border-[#c9973f]/10 px-5 py-2.5 text-xs text-[#8a8f9c]">
        <span>按</span>
        <Kbd className="border border-[#c9973f]/30 bg-[#c9973f]/10 text-[#c9973f]">B</Kbd>
        <span>或</span>
        <Kbd className="border border-[#c9973f]/30 bg-[#c9973f]/10 text-[#c9973f]">Esc</Kbd>
        <span>收起行囊</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Backpack className="size-8 text-[#c9973f]/50" />
            <p className="text-sm text-[#8a8f9c]">行囊中还没有收获，去词云间拾取金句吧（E 收纳）</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/70 p-4 transition-colors hover:border-[#c9973f]/40"
              >
                <blockquote className="font-serif text-sm leading-relaxed text-[#e8dcc0]">
                  「{item.text}」
                </blockquote>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#8a8f9c]">
                  <span className="truncate">《{item.title}》</span>
                  <Badge variant="outline" className="border-[#c9973f]/30 text-[#c9973f]">
                    {item.kind === 'story' ? '知乎故事' : '知乎知识'}
                  </Badge>
                  {item.topicWord ? (
                    <Badge variant="outline" className="border-[#8a8f9c]/30 text-[#8a8f9c]">
                      {item.topicWord}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  <time className="text-[11px] text-[#8a8f9c]/70">{formatTime(item.collectedAt)}</time>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-[#c9973f] hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
                      onClick={() => openPanel('reader', item.workId)}
                    >
                      <BookOpen className="size-3.5" />
                      读原文
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-[#8a8f9c] hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => removeFromBackpack(item.id)}
                    >
                      <Trash2 className="size-3.5" />
                      移除
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </ScrollArea>
    </PanelShell>
  )
}
