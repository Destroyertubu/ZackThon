import { useMemo } from 'react'
import { Anchor, Backpack, Clock } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import { formatDuration, formatTime } from './format'

/** 见天地 · 旅程存档时间线（新→旧） */
export default function JourneyTimeline() {
  const journeys = useGameStore((s) => s.journeys)
  const items = useMemo(() => [...journeys].sort((a, b) => b.endedAt - a.endedAt), [journeys])

  return (
    <div className="rounded-xl border border-[#c9973f]/30 bg-black/60 p-5 backdrop-blur-md">
      <p className="mb-4 text-xs tracking-[0.3em] text-[#8a8f9c]">旅程存档 · 时间线</p>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm leading-relaxed text-[#8a8f9c]">
          还没有旅程存档 ——
          <br />
          在大世界里结束一次漫游时，把它留下来。
        </p>
      ) : (
        <ol className="relative ml-1 space-y-6 border-l border-[#c9973f]/20 pl-5">
          {items.map((j) => (
            <li key={j.id} className="relative">
              <span className="absolute -left-[26.5px] top-1.5 h-2.5 w-2.5 rounded-full border border-[#c9973f] bg-[#0a0c10]" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-serif text-sm tracking-[0.1em] text-[#e8dcc0]">{formatTime(j.startedAt)}</span>
                <span className="flex items-center gap-1 text-[11px] text-[#8a8f9c]">
                  <Clock size={11} />
                  {formatDuration(j.endedAt - j.startedAt)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {j.visitedWords.slice(0, 6).map((w) => (
                  <span
                    key={w}
                    className="rounded-full border border-[#c9973f]/25 px-2 py-0.5 text-[11px] text-[#e8dcc0]/80"
                  >
                    {w}
                  </span>
                ))}
                {j.visitedWords.length > 6 && (
                  <span className="px-1 text-[11px] text-[#8a8f9c]">等 {j.visitedWords.length} 词</span>
                )}
                {j.visitedWords.length === 0 && (
                  <span className="text-[11px] text-[#8a8f9c]/70">未途经话题词</span>
                )}
              </div>
              <p className="mt-2 flex items-center gap-4 text-[11px] text-[#8a8f9c]">
                <span className="flex items-center gap-1">
                  <Backpack size={11} className="text-[#c9973f]/80" />
                  收获 {j.collected}
                </span>
                <span className="flex items-center gap-1">
                  <Anchor size={11} className="text-[#c9973f]/80" />
                  锚点 {j.anchors}
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
