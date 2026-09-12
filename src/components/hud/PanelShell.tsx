/** HUD 面板通用外壳：遮罩点击 / Esc 关闭、统一暗夜暖金风格 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'

export default function PanelShell({
  title,
  icon,
  children,
  maxWidth = 'max-w-md',
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  maxWidth?: string
}) {
  const closePanel = useGameStore((s) => s.closePanel)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closePanel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [closePanel])

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={closePanel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`hud-panel-enter w-full ${maxWidth} max-h-[82vh] overflow-y-auto rounded-xl border border-[#c9973f]/30 bg-[#0a0c10]/90 p-5 shadow-2xl shadow-black/60 backdrop-blur-md`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b border-[#c9973f]/20 pb-3">
          <h2 className="flex items-center gap-2 font-serif text-lg tracking-[0.2em] text-[#c9973f]">
            {icon}
            {title}
          </h2>
          <button
            type="button"
            onClick={closePanel}
            aria-label="关闭"
            className="rounded-md p-1 text-[#8a8f9c] transition-colors hover:bg-white/5 hover:text-[#e8dcc0]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
