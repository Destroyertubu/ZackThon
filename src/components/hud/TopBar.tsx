/** 左上品牌卡 + 右上导航 */
import { Link } from 'react-router'
import { CircleHelp, Settings } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'

export type HudArea = 'world' | 'home' | 'canvas' | 'onboarding'

const AREA_SUBTITLE: Record<HudArea, string> = {
  world: '词云大世界',
  home: '家园 · 山间书房',
  canvas: '个人画布',
  onboarding: '启程',
}

const NAV_ITEMS: Array<{ area: HudArea; label: string; to: string }> = [
  { area: 'onboarding', label: '启程', to: '/' },
  { area: 'world', label: '世界', to: '/world' },
  { area: 'home', label: '家园', to: '/home' },
  { area: 'canvas', label: '画布', to: '/canvas' },
]

export function BrandCard({ area }: { area: HudArea }) {
  return (
    <div className="rounded-xl border border-[#c9973f]/30 bg-black/60 px-4 py-2.5 backdrop-blur-md">
      <div className="font-serif text-base tracking-[0.25em] text-[#e8dcc0]">
        漫思 <span className="text-[#c9973f]">Wanderwise</span>
      </div>
      <div className="mt-0.5 text-xs tracking-[0.3em] text-[#8a8f9c]">{AREA_SUBTITLE[area]}</div>
    </div>
  )
}

export function TopNav({ area }: { area: HudArea }) {
  const openPanel = useGameStore((s) => s.openPanel)

  return (
    <nav className="flex items-center gap-1 rounded-xl border border-[#c9973f]/30 bg-black/60 px-2 py-1.5 backdrop-blur-md">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`rounded-md px-2.5 py-1 text-sm tracking-widest transition-colors ${
            area === item.area
              ? 'bg-[#c9973f]/15 text-[#c9973f]'
              : 'text-[#8a8f9c] hover:text-[#e8dcc0]'
          }`}
        >
          {item.label}
        </Link>
      ))}
      <span className="mx-1 h-4 w-px bg-[#c9973f]/20" aria-hidden />
      <button
        type="button"
        aria-label="设置"
        title="设置"
        onClick={() => openPanel('settings')}
        className="rounded-md p-1.5 text-[#8a8f9c] transition-colors hover:bg-white/5 hover:text-[#c9973f]"
      >
        <Settings className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="帮助"
        title="帮助"
        onClick={() => openPanel('help')}
        className="rounded-md p-1.5 text-[#8a8f9c] transition-colors hover:bg-white/5 hover:text-[#c9973f]"
      >
        <CircleHelp className="h-4 w-4" />
      </button>
    </nav>
  )
}
