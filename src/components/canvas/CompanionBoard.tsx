import { useMemo } from 'react'
import { ChevronDown, Heart } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import { formatTime } from './format'

/** 见众生 · 同频人横条列表，点击展开其想法锚点 */
export default function CompanionBoard() {
  const companions = useGameStore((s) => s.companions)
  const visitedWords = useGameStore((s) => s.visitedWords)
  const focusCompanionId = useGameStore((s) => s.focusCompanionId)
  const setFocusCompanion = useGameStore((s) => s.setFocusCompanion)

  const sorted = useMemo(() => [...companions].sort((a, b) => b.resonance - a.resonance), [companions])

  return (
    <div className="space-y-3">
      {sorted.map((c) => {
        const common = c.visitedWords.filter((w) => visitedWords.includes(w))
        const open = focusCompanionId === c.id
        return (
          <div
            key={c.id}
            className={`overflow-hidden rounded-xl border backdrop-blur-md transition-colors ${
              open ? 'border-[#c9973f]/60 bg-black/70' : 'border-[#c9973f]/30 bg-black/60'
            }`}
          >
            <button
              type="button"
              onClick={() => setFocusCompanion(open ? null : c.id)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4 text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c9973f]/40 bg-[#c9973f]/10 text-xl">
                {c.avatar}
              </div>
              <div className="min-w-[140px] shrink-0">
                <p className="font-serif tracking-[0.15em] text-[#e8dcc0]">{c.name}</p>
                <p className="mt-0.5 max-w-[220px] truncate text-xs text-[#8a8f9c]">{c.motto}</p>
              </div>
              <div className="flex min-w-[160px] flex-1 items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8a8f9c]/70 to-[#c9973f]"
                    style={{ width: `${c.resonance}%` }}
                  />
                </div>
                <span className="w-11 shrink-0 text-right font-serif text-sm text-[#c9973f]">{c.resonance}%</span>
              </div>
              <div className="hidden flex-wrap items-center gap-1.5 md:flex md:max-w-[240px]">
                {common.length > 0 ? (
                  common.map((w) => (
                    <span
                      key={w}
                      className="rounded-full border border-[#c9973f]/30 px-2 py-0.5 text-[11px] text-[#c9973f]/90"
                    >
                      {w}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[#8a8f9c]/70">暂无共同词</span>
                )}
              </div>
              <ChevronDown
                size={16}
                className={`shrink-0 text-[#c9973f]/70 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
            {open && (
              <div className="border-t border-[#c9973f]/15 px-5 py-4">
                <p className="mb-3 text-xs tracking-[0.3em] text-[#8a8f9c]">TA 留下的想法锚点</p>
                {c.anchors.length === 0 ? (
                  <p className="text-sm text-[#8a8f9c]">尚未留下锚点。</p>
                ) : (
                  <ul className="space-y-3">
                    {c.anchors.map((a) => (
                      <li key={a.id} className="rounded-lg border border-[#c9973f]/15 bg-[#0a0c10]/70 p-4">
                        <div className="flex items-center gap-2">
                          {a.topicWord && (
                            <span className="rounded-full bg-[#c9973f]/15 px-2 py-0.5 text-[11px] text-[#c9973f]">
                              {a.topicWord}
                            </span>
                          )}
                          <span className="text-[11px] text-[#8a8f9c]">{formatTime(a.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[#e8dcc0]/90">{a.text}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-[#8a8f9c]">
                          <Heart size={12} className="text-[#c9973f]/80" />
                          {a.likes}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
