/** 世界面板通用外壳：暗夜暖金风格，Esc / 遮罩点击 / 关闭按钮统一走 closePanel() */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import { cn } from '@/lib/utils'

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface PanelShellProps {
  title: string
  icon?: LucideIcon
  subtitle?: ReactNode
  /** 头部右侧、关闭按钮之前的扩展区（如「进入场域」按钮） */
  headerExtra?: ReactNode
  children: ReactNode
  className?: string
}

export default function PanelShell({
  title,
  icon: Icon,
  subtitle,
  headerExtra,
  children,
  className,
}: PanelShellProps) {
  const closePanel = useGameStore((s) => s.closePanel)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closePanel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div
        aria-hidden
        className="absolute inset-0 bg-[#0a0c10]/70 backdrop-blur-sm"
        onClick={closePanel}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#c9973f]/30 bg-black/60 shadow-[0_0_80px_rgba(201,151,63,0.12)] backdrop-blur-md',
          className
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9973f]/60 to-transparent" />
        <header className="flex items-center gap-3 border-b border-[#c9973f]/20 px-5 py-4">
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#c9973f]/30 bg-[#c9973f]/10">
              <Icon className="size-4 text-[#c9973f]" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg tracking-[0.25em] text-[#e8dcc0]">{title}</h2>
            {subtitle ? <div className="mt-0.5 truncate text-xs text-[#8a8f9c]">{subtitle}</div> : null}
          </div>
          {headerExtra}
          <button
            type="button"
            onClick={closePanel}
            aria-label="关闭面板"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#8a8f9c] transition-colors hover:border-[#c9973f]/30 hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
          >
            <X className="size-4" />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}
