/** 漫行者日志：旅程统计、存档、历史旅程与我的想法锚点 */
import { useNavigate } from 'react-router'
import {
  Anchor, Backpack, Compass, Footprints, MessageCircle, Palette, Save, ScrollText, ThumbsUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useGameStore } from '@/state/gameStore'
import PanelShell, { fmtClock, fmtDateTime } from './PanelShell'

export default function JournalPanel() {
  const navigate = useNavigate()
  const visitedWords = useGameStore((s) => s.visitedWords)
  const trail = useGameStore((s) => s.trail)
  const backpack = useGameStore((s) => s.backpack)
  const anchors = useGameStore((s) => s.anchors)
  const journeys = useGameStore((s) => s.journeys)
  const saveJourney = useGameStore((s) => s.saveJourney)
  const showToast = useGameStore((s) => s.showToast)
  const closePanel = useGameStore((s) => s.closePanel)

  const myAnchors = anchors.filter((a) => a.mine)
  const stats = [
    { icon: Compass, label: '途经话题词', value: visitedWords.length },
    { icon: Footprints, label: '轨迹点', value: trail.length },
    { icon: Backpack, label: '行囊收获', value: backpack.length },
    { icon: Anchor, label: '我的锚点', value: myAnchors.length },
  ]

  const handleSave = () => {
    if (trail.length < 2) {
      showToast('旅程太短，先去世界里走一走吧')
      return
    }
    saveJourney()
  }

  return (
    <PanelShell icon={ScrollText} title="漫行者日志" subtitle="记录这一程路过的词、拾得的光与立下的锚">
      <div className="flex flex-col gap-5">
        {/* 当前旅程统计 */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/60 px-2 py-3"
            >
              <Icon className="size-4 text-[#c9973f]" />
              <span className="font-serif text-xl text-[#e8dcc0]">{value}</span>
              <span className="text-xs text-[#8a8f9c]">{label}</span>
            </div>
          ))}
        </div>

        <Button
          onClick={handleSave}
          variant="outline"
          className="w-full border-[#c9973f]/50 bg-[#c9973f]/15 font-serif tracking-[0.3em] text-[#c9973f] hover:bg-[#c9973f]/25 hover:text-[#e8dcc0]"
        >
          <Save className="size-4" />
          存档本次旅程
        </Button>

        <Separator className="bg-[#c9973f]/15" />

        {/* 历史旅程 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-sm tracking-[0.25em] text-[#c9973f]">历史旅程</h3>
            <Badge variant="outline" className="border-[#c9973f]/40 text-[#c9973f]">{journeys.length}</Badge>
          </div>
          {journeys.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8a8f9c]">尚无存档，第一段旅程等你落笔</p>
          ) : (
            [...journeys].reverse().map((j, idx) => (
              <article
                key={j.id}
                className="flex flex-col gap-2 rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/60 p-3"
              >
                <div className="flex items-center gap-2 text-xs text-[#8a8f9c]">
                  <span className="font-serif text-[#c9973f]">第 {journeys.length - idx} 程</span>
                  <span className="flex-1">
                    {fmtDateTime(j.startedAt)} — {fmtClock(j.endedAt)}
                  </span>
                  <span>收获 {j.collected} · 锚点 {j.anchors}</span>
                </div>
                {j.visitedWords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {j.visitedWords.slice(0, 6).map((w) => (
                      <Badge
                        key={w}
                        variant="outline"
                        className="border-[#c9973f]/30 font-normal text-[#e8dcc0]/80"
                      >
                        {w}
                      </Badge>
                    ))}
                    {j.visitedWords.length > 6 && (
                      <Badge variant="outline" className="border-[#c9973f]/30 font-normal text-[#8a8f9c]">
                        +{j.visitedWords.length - 6}
                      </Badge>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </section>

        <Separator className="bg-[#c9973f]/15" />

        {/* 我的想法锚点 */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-sm tracking-[0.25em] text-[#c9973f]">我的想法锚点</h3>
            <Badge variant="outline" className="border-[#c9973f]/40 text-[#c9973f]">{myAnchors.length}</Badge>
          </div>
          {myAnchors.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#8a8f9c]">还没有立下锚点，在世界里按 T 留下此刻的想法</p>
          ) : (
            [...myAnchors].reverse().map((a) => (
              <article
                key={a.id}
                className="flex flex-col gap-2 rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/60 p-3"
              >
                <p className="text-sm leading-relaxed text-[#e8dcc0]">{a.text}</p>
                <div className="flex items-center gap-3 text-xs text-[#8a8f9c]">
                  {a.topicWord && (
                    <Badge className="border-transparent bg-[#c9973f]/15 font-normal text-[#c9973f]">
                      {a.topicWord}
                    </Badge>
                  )}
                  <span className="flex-1" />
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="size-3" />
                    {a.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="size-3" />
                    {a.comments.length}
                  </span>
                </div>
              </article>
            ))
          )}
        </section>

        <Button
          variant="outline"
          className="w-full border-[#c9973f]/30 bg-transparent text-[#e8dcc0] hover:bg-[#c9973f]/10 hover:text-[#c9973f]"
          onClick={() => {
            closePanel()
            navigate('/canvas')
          }}
        >
          <Palette className="size-4" />
          查看个人画布
        </Button>
      </div>
    </PanelShell>
  )
}
