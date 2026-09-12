import { BookOpen, Quote } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import type { BackpackItem } from '@/types/game'

function QuoteCard({ item }: { item: BackpackItem }) {
  return (
    <figure className="rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/80 p-4">
      <Quote size={13} className="text-[#c9973f]/70" />
      <blockquote className="mt-2 line-clamp-4 text-sm leading-relaxed text-[#e8dcc0]/90">{item.text}</blockquote>
      <figcaption className="mt-3 flex items-center gap-2 text-[11px] text-[#8a8f9c]">
        <BookOpen size={11} className="shrink-0 text-[#c9973f]/70" />
        <span className="truncate">《{item.title}》</span>
        {item.topicWord && (
          <span className="shrink-0 rounded-full bg-[#c9973f]/15 px-2 py-0.5 text-[#c9973f]">{item.topicWord}</span>
        )}
      </figcaption>
    </figure>
  )
}

/** 见天地 · 行囊金句缓流（自动慢滚，悬停暂停） */
export default function QuoteFlow() {
  const backpack = useGameStore((s) => s.backpack)

  // 约 130px/条：≥4 条才超过视窗高度，启用无缝滚动
  const scrolling = backpack.length >= 4
  const items = scrolling ? [...backpack, ...backpack] : backpack

  return (
    <div className="rounded-xl border border-[#c9973f]/30 bg-black/60 p-5 backdrop-blur-md">
      <p className="mb-4 text-xs tracking-[0.3em] text-[#8a8f9c]">行囊金句 · 缓流</p>
      {backpack.length === 0 ? (
        <p className="py-10 text-center text-sm leading-relaxed text-[#8a8f9c]">
          行囊中尚无金句 ——
          <br />
          靠近世界里发光的句子，把它收进来。
        </p>
      ) : (
        <div className="relative h-[430px] overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-[#0a0c10] to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-[#0a0c10] to-transparent" />
          <div
            className={scrolling ? 'ww-quote-scroll flex flex-col gap-3' : 'flex flex-col gap-3'}
            style={scrolling ? { animationDuration: `${Math.max(24, backpack.length * 8)}s` } : undefined}
          >
            {items.map((b, i) => (
              <QuoteCard key={`${b.id}-${i}`} item={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
