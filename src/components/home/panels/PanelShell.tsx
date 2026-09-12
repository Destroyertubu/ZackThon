/** 家园面板通用外壳：统一暗夜暖金美学、右上 X / Esc / 遮罩关闭 */
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGameStore } from '@/state/gameStore'
import { cn } from '@/lib/utils'
import type { WorkKind } from '@/types/game'

export const kindLabel = (kind: WorkKind) => (kind === 'story' ? '故事' : '知识')

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtDateTime(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtClock(ts: number) {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface PanelShellProps {
  icon: LucideIcon
  title: string
  subtitle: string
  children: ReactNode
  /** 内容区宽度，默认 sm:max-w-2xl */
  widthClass?: string
}

export default function PanelShell({ icon: Icon, title, subtitle, children, widthClass }: PanelShellProps) {
  const closePanel = useGameStore((s) => s.closePanel)
  return (
    <Dialog open onOpenChange={(o) => { if (!o) closePanel() }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex max-h-[86vh] flex-col gap-0 overflow-hidden rounded-xl border-[#c9973f]/30 bg-black/60 p-0 text-[#e8dcc0] shadow-[0_0_60px_rgba(201,151,63,0.12)] backdrop-blur-md',
          widthClass ?? 'sm:max-w-2xl'
        )}
      >
        <DialogHeader className="flex-row items-center gap-3 border-b border-[#c9973f]/20 px-5 py-4 text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#c9973f]/40 bg-[#c9973f]/10">
            <Icon className="size-4 text-[#c9973f]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <DialogTitle className="font-serif text-base tracking-[0.2em] text-[#c9973f]">
              {title}
            </DialogTitle>
            <DialogDescription className="truncate text-xs text-[#8a8f9c]">
              {subtitle}
            </DialogDescription>
          </span>
          <button
            type="button"
            onClick={closePanel}
            aria-label="关闭"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-[#8a8f9c] transition-colors hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
          >
            <X className="size-4" />
          </button>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-5 py-4">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
