import { useGameStore } from '@/state/gameStore'
import { Hand, RotateCcw } from 'lucide-react'
import DirectionIcon from '@/features/presentation/DirectionIcon'
import JumpButton from '@/features/presentation/JumpButton'
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
    <div className="ww-home-controls pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-5 text-[#e8dcc0]">
      <JumpButton onJump={() => input.keys.add('Space')}/>
      {nearby && (
        <button type="button" aria-label={nearby.label} aria-keyshortcuts="E" onClick={() => interact(nearby)} className="ww-interaction-action pointer-events-auto rounded-full border border-[#c9973f]/60 bg-black/75 px-5 py-3 text-sm shadow-lg backdrop-blur-md">
          <Hand size={22}/>
          <span className="ww-keyboard-action"><kbd>E</kbd> · {nearby.label}</span>
          <span className="ww-touch-action">点击 · {nearby.label}</span>
        </button>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3 self-stretch">
        <div className="pointer-events-auto grid grid-cols-3 gap-1 rounded-xl bg-black/55 p-2 [@media(hover:hover)]:hidden">
          {(['', 'KeyW', '', 'KeyA', 'KeyS', 'KeyD'] as const).map((key, i) => key ? (
            <button key={key} type="button" aria-label={{ KeyW: '向前走', KeyA: '向左走', KeyS: '向后走', KeyD: '向右走' }[key]}
              className="h-11 w-11 touch-none rounded-lg border border-[#c9973f]/40 bg-black/40 text-lg active:bg-[#c9973f]/30"
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.keys.add(key) }}
              onPointerUp={() => input.keys.delete(key)} onPointerCancel={() => input.keys.delete(key)} onLostPointerCapture={() => input.keys.delete(key)}>
              <DirectionIcon code={key}/>
            </button>
          ) : <span key={i} />)}
        </div>
        <div className="ww-home-instructions order-first w-full rounded-xl border border-white/10 bg-black/65 px-4 py-3 text-xs leading-6 text-[#c9c3b5] backdrop-blur-md sm:order-none sm:w-auto">
          <p className="font-serif tracking-widest text-[#e4bd71]">家园漫步 · 第一人称</p>
          <p className="text-[#c9c3b5]">出门走进镜海，或沿阳台前往观星台</p>
          <p className="hidden sm:block">WASD 移动 · 空格跳跃 · 鼠标环顾 · Esc 释放 / F 恢复 · E 交互 · C 归正</p>
          <p className="sm:hidden">方向键行走 · 拖动环顾 · 点击提示交互</p>
        </div>
        <button type="button" aria-label="镜头归正" onClick={() => { input.keys.add('KeyC') }} className="pointer-events-auto shrink-0 rounded-full border border-[#c9973f]/40 bg-black/65 px-3 py-2 text-xs text-[#e4bd71]"><RotateCcw size={20}/></button>
      </div>
    </div>
  )
}
