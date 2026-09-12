/** 世界专属：十字准星 + 交互提示条 + 键位速览 */
import { useGameStore } from '@/state/gameStore'

const HINT_KEYS: Record<'quote' | 'node', string> = {
  quote: 'E 收纳 · F 场域 · 左键 阅读',
  node: 'E 收纳摘要 · V 追踪 · R 锚点 · T 共鸣',
}

export function Crosshair() {
  const focusTarget = useGameStore((s) => s.focusTarget)
  const active = focusTarget != null
  const color = active ? 'bg-[#c9973f]' : 'bg-[#e8dcc0]/70'
  const shadow = active ? 'shadow-[0_0_6px_rgba(201,151,63,0.9)]' : ''

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-150 ${
          active ? `h-1.5 w-1.5 ${color} ${shadow}` : 'h-1 w-1 bg-[#e8dcc0]/60'
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 w-px -translate-y-1/2 transition-all duration-200 ${color} ${shadow} ${
          active ? 'h-7' : 'h-4'
        }`}
      />
      <div
        className={`absolute left-1/2 top-1/2 h-px -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${color} ${shadow} ${
          active ? 'w-7' : 'w-4'
        }`}
      />
    </div>
  )
}

export function InteractHint() {
  const focusTarget = useGameStore((s) => s.focusTarget)
  const keys =
    focusTarget?.kind === 'quote' || focusTarget?.kind === 'node' ? HINT_KEYS[focusTarget.kind] : null

  return (
    <div className="absolute left-1/2 top-[calc(50%+2.75rem)] -translate-x-1/2">
      <div
        className={`flex items-baseline gap-2.5 whitespace-nowrap rounded-xl border px-4 py-2 backdrop-blur-md transition-all duration-200 ${
          focusTarget && keys
            ? 'border-[#c9973f]/30 bg-black/60 opacity-100'
            : 'pointer-events-none border-transparent bg-transparent opacity-0'
        }`}
      >
        <span className="font-serif text-sm tracking-widest text-[#e8dcc0]">{focusTarget?.label}</span>
        {keys && <span className="text-xs tracking-wider text-[#c9973f]">{keys}</span>}
      </div>
    </div>
  )
}

export function KeyCheatSheet() {
  return (
    <div className="absolute bottom-3 left-3 text-[11px] tracking-wider text-[#8a8f9c]/80">
      WASD 移动 · Shift 上升 · Ctrl 下降 · 滚轮 速度 · E 收纳 · F 场域 · R 锚点 · T 共鸣 · B 行囊 · V 追踪
      · Esc 释放鼠标
    </div>
  )
}
