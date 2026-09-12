/** 底部中央轻提示：浮现-停留-淡出 */
import { useGameStore } from '@/state/gameStore'

export function Toast() {
  const toast = useGameStore((s) => s.toast)
  if (!toast) return null

  return (
    <div
      key={toast.id}
      className="hud-toast absolute bottom-16 left-1/2 rounded-xl border border-[#c9973f]/30 bg-black/60 px-5 py-2 backdrop-blur-md"
    >
      <span className="text-sm tracking-widest text-[#e8dcc0]">{toast.text}</span>
    </div>
  )
}
