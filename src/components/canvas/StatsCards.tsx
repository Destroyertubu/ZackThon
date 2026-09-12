import { Anchor, Backpack, Compass, ScrollText } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'

/** 见自己 · 统计卡 */
export default function StatsCards() {
  const visitedWords = useGameStore((s) => s.visitedWords)
  const backpack = useGameStore((s) => s.backpack)
  const anchors = useGameStore((s) => s.anchors)
  const journeys = useGameStore((s) => s.journeys)

  const stats = [
    { icon: Compass, label: '探索词数', value: visitedWords.length },
    { icon: Backpack, label: '行囊收获', value: backpack.length },
    { icon: Anchor, label: '我的锚点', value: anchors.filter((a) => a.mine).length },
    { icon: ScrollText, label: '旅程存档', value: journeys.length },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
      {stats.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex flex-col justify-center rounded-xl border border-[#c9973f]/30 bg-black/60 p-4 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 text-xs text-[#8a8f9c]">
            <Icon size={14} className="text-[#c9973f]" />
            {label}
          </div>
          <p className="mt-2 font-serif text-3xl text-[#e8dcc0]">{value}</p>
        </div>
      ))}
    </div>
  )
}
