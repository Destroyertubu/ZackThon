import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface SectionProps {
  kicker: string
  title: string
  desc?: string
  icon: LucideIcon
  children: ReactNode
}

/** 「人生三见」分节标题与装饰线 */
export default function Section({ kicker, title, desc, icon: Icon, children }: SectionProps) {
  return (
    <section>
      <header className="mb-6 flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c9973f]/40 bg-[#c9973f]/10">
          <Icon size={18} className="text-[#c9973f]" />
        </div>
        <div className="shrink-0">
          <p className="text-[11px] tracking-[0.5em] text-[#c9973f]/70">{kicker}</p>
          <h2 className="mt-0.5 font-serif text-2xl tracking-[0.3em] text-[#e8dcc0]">{title}</h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-[#c9973f]/40 via-[#c9973f]/10 to-transparent" />
        {desc && <p className="hidden shrink-0 text-sm text-[#8a8f9c] md:block">{desc}</p>}
      </header>
      {children}
    </section>
  )
}
