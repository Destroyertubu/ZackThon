/** 原文阅读器面板：标题/作者/labels/导语/正文 + 金句侧栏，可收入行囊、进入场域 */
import { useEffect } from 'react'
import { BookOpen, Check, Orbit, Plus, Quote } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import { getWorks } from '@/lib/zhihu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import PanelShell from './PanelShell'

export default function ReaderPanel() {
  const readerWorkId = useGameStore((s) => s.readerWorkId)
  const works = useGameStore((s) => s.works)
  const setWorks = useGameStore((s) => s.setWorks)
  const backpack = useGameStore((s) => s.backpack)
  const collect = useGameStore((s) => s.collect)
  const enterRealm = useGameStore((s) => s.enterRealm)
  const closePanel = useGameStore((s) => s.closePanel)

  const work = readerWorkId ? works.find((w) => w.workId === readerWorkId) : undefined

  // 兜底：若打开面板时作品尚未载入（如从持久化的行囊直接「读原文」），自行拉取
  useEffect(() => {
    if (!readerWorkId || works.length > 0) return
    let alive = true
    getWorks()
      .then((list) => {
        if (alive && list.length > 0) setWorks(list)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [readerWorkId, works.length, setWorks])

  const collectedTexts = new Set(
    backpack.filter((b) => b.workId === readerWorkId).map((b) => b.text)
  )

  const paragraphs = (work?.content || work?.description || '')
    .replace(/<[^>]+>/g, '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  const kindLabel = work?.kind === 'story' ? '知乎故事' : '知乎知识'

  return (
    <PanelShell
      title="原文阅读"
      icon={BookOpen}
      subtitle={
        work ? `作者：${work.authorName || '佚名'} · 来自${kindLabel}` : '正在寻回这部作品……'
      }
      className="max-w-5xl"
      headerExtra={
        work ? (
          <Button
            size="sm"
            className="bg-[#c9973f] text-[#0a0c10] hover:bg-[#e8dcc0]"
            onClick={() => {
              enterRealm(work.workId)
              closePanel()
            }}
          >
            <Orbit className="size-4" />
            进入场域
          </Button>
        ) : null
      }
    >
      {!work ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <BookOpen className="size-8 text-[#c9973f]/50" />
          <p className="text-sm text-[#8a8f9c]">
            {readerWorkId ? '正在寻回这部作品……' : '尚未指定要阅读的作品'}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-6 py-5">
              <h3 className="font-serif text-xl leading-snug tracking-wide text-[#e8dcc0]">
                {work.title}
              </h3>
              <p className="mt-2 text-xs text-[#8a8f9c]">
                作者：{work.authorName || '佚名'} · 来自{kindLabel}
              </p>
              {work.labels.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {work.labels.map((l) => (
                    <Badge key={l} variant="outline" className="border-[#c9973f]/30 text-[#c9973f]">
                      {l}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {work.introduction ? (
                <p className="mt-4 rounded-lg border border-[#c9973f]/20 bg-[#c9973f]/5 px-4 py-3 text-sm leading-relaxed text-[#e8dcc0]/80">
                  {work.introduction}
                </p>
              ) : null}
              <div className="mt-5 space-y-4">
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-[15px] leading-loose text-[#e8dcc0]/90">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </ScrollArea>
          <aside className="flex max-h-64 w-full flex-col border-t border-[#c9973f]/20 md:max-h-none md:w-72 md:border-t-0 md:border-l">
            <div className="flex items-center gap-2 border-b border-[#c9973f]/10 px-4 py-3 text-xs tracking-widest text-[#c9973f]">
              <Quote className="size-3.5" />
              文中金句
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {work.quotes.length === 0 ? (
                <p className="px-4 py-6 text-xs text-[#8a8f9c]">这部作品暂未提炼出金句。</p>
              ) : (
                <ul className="space-y-3 p-4">
                  {work.quotes.map((q, i) => {
                    const has = collectedTexts.has(q)
                    return (
                      <li
                        key={i}
                        className="rounded-lg border border-[#c9973f]/15 bg-[#0a0c10]/60 p-3"
                      >
                        <p className="font-serif text-[13px] leading-relaxed text-[#e8dcc0]/90">
                          「{q}」
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={has}
                          className="mt-2 h-7 px-2 text-xs text-[#c9973f] hover:bg-[#c9973f]/10 hover:text-[#e8dcc0] disabled:opacity-60"
                          onClick={() =>
                            collect({
                              workId: work.workId,
                              kind: work.kind,
                              title: work.title,
                              text: q,
                            })
                          }
                        >
                          {has ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                          {has ? '已在行囊' : '收入行囊'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </aside>
        </div>
      )}
    </PanelShell>
  )
}
