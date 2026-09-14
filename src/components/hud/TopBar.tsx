/** 左上品牌卡 + 右上导航 */
import { Link } from 'react-router'
import { CircleHelp, Settings, Compass, Waves, House, Palette } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'

export type HudArea = 'world' | 'home' | 'canvas' | 'onboarding' | 'observatory'

const AREA_SUBTITLE: Record<HudArea, string> = {
  world: '词云大世界',
  home: '家园 · 镜海书房',
  canvas: '个人画布',
  onboarding: '启程',
  observatory: '屋顶观测台',
}

const NAV_ITEMS = [
  { area: 'onboarding', label: '启程', to: '/', icon: Compass },
  { area: 'world', label: '镜海', to: '/land', icon: Waves },
  { area: 'home', label: '家园', to: '/home', icon: House },
  { area: 'canvas', label: '画布', to: '/canvas', icon: Palette },
]

export function BrandCard({ area }: { area: HudArea }) {
  if (area === 'home') return null
  return (
    <div className="ww-hud-label rounded-xl border border-[#c9973f]/30 bg-black/60 px-4 py-2.5 backdrop-blur-md">
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
    <nav className="ww-hud-label flex items-center gap-1 rounded-xl border border-[#c9973f]/30 bg-black/60 px-2 py-1.5 backdrop-blur-md">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-label={item.label}
          aria-current={area === item.area ? 'page' : undefined}
          className={`rounded-md px-2.5 py-1 text-sm tracking-widest transition-colors ${
            area === item.area
              ? 'bg-[#c9973f]/15 text-[#c9973f]'
              : 'text-[#8a8f9c] hover:text-[#e8dcc0]'
          }`}
        >
          <item.icon size={19}/>
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
