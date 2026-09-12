import { useGameStore } from '@/state/gameStore'
import type { HomeInput } from './HomePlayer'
import type { HomeInteraction } from './navigation'

export default function HomeControls({ input, nearby, interact }: {
  input: HomeInput
  nearby: HomeInteraction | null
  interact: (spot: HomeInteraction) => void
}) {
  const panel = useGameStore((s) => s.panel)
  if (panel) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-5 text-[#e8dcc0]">
      {nearby && (
        <button type="button" onClick={() => interact(nearby)} className="pointer-events-auto rounded-full border border-[#c9973f]/60 bg-black/75 px-5 py-3 text-sm shadow-lg backdrop-blur-md">
          <kbd className="mr-3 rounded border border-[#c9973f]/50 px-2 py-1 text-[#e4bd71]">E</kbd>
          {nearby.label}
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 self-stretch">
        <div className="pointer-events-auto grid grid-cols-3 gap-1 rounded-xl bg-black/55 p-2 [@media(hover:hover)]:hidden">
          {(['', 'KeyW', '', 'KeyA', 'KeyS', 'KeyD'] as const).map((key, i) => key ? (
            <button key={key} type="button" aria-label={{ KeyW: '向前走', KeyA: '向左走', KeyS: '向后走', KeyD: '向右走' }[key]}
              className="h-11 w-11 touch-none rounded-lg border border-[#c9973f]/40 bg-black/40 text-lg active:bg-[#c9973f]/30"
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.keys.add(key) }}
              onPointerUp={() => input.keys.delete(key)} onPointerCancel={() => input.keys.delete(key)} onLostPointerCapture={() => input.keys.delete(key)}>
              {{ KeyW: '↑', KeyA: '←', KeyS: '↓', KeyD: '→' }[key]}
            </button>
          ) : <span key={i} />)}
        </div>
        <div className="order-first w-full rounded-xl border border-white/10 bg-black/65 px-4 py-3 text-xs leading-6 text-[#c9c3b5] backdrop-blur-md sm:order-none sm:w-auto">
          <p className="font-serif tracking-widest text-[#e4bd71]">家园漫步 · 第三人称</p>
          <p className="text-[#c9c3b5]">沿窗边的阳光，走上山景阳台</p>
          <p className="hidden sm:block">WASD 移动 · Shift 快走 · 拖动视角 · 滚轮远近 · E 交互 · C 镜头归正</p>
          <p className="sm:hidden">方向键行走 · 拖动环顾 · 点击提示交互</p>
        </div>
        <button type="button" onClick={() => { input.keys.add('KeyC') }} className="pointer-events-auto shrink-0 rounded-full border border-[#c9973f]/40 bg-black/65 px-3 py-2 text-xs text-[#e4bd71]">镜头归正</button>
      </div>
    </div>
  )
}
