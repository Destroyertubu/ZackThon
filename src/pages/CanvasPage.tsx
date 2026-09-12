import { useNavigate } from 'react-router'
import { Fingerprint, Globe, Home, Mountain, Sparkles, Users } from 'lucide-react'
import GameHUD from '@/components/hud/GameHUD'
import { useGameStore } from '@/state/gameStore'
import Section from '@/components/canvas/Section'
import StarMap from '@/components/canvas/StarMap'
import StatsCards from '@/components/canvas/StatsCards'
import CompanionBoard from '@/components/canvas/CompanionBoard'
import JourneyTimeline from '@/components/canvas/JourneyTimeline'
import QuoteFlow from '@/components/canvas/QuoteFlow'

const navBtn =
  'flex items-center gap-2 rounded-full border border-[#c9973f]/40 px-4 py-2 text-sm text-[#c9973f] transition-colors hover:bg-[#c9973f]/10'

/** 个人画布 —— 人生三见：见自己 · 见众生 · 见天地 */
export default function CanvasPage() {
  const navigate = useNavigate()
  const trail = useGameStore((s) => s.trail)
  const visitedWords = useGameStore((s) => s.visitedWords)
  const backpack = useGameStore((s) => s.backpack)
  const journeys = useGameStore((s) => s.journeys)
  const anchors = useGameStore((s) => s.anchors)

  const hasData =
    trail.length > 0 ||
    visitedWords.length > 0 ||
    backpack.length > 0 ||
    journeys.length > 0 ||
    anchors.some((a) => a.mine)

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#e8dcc0]">
      <style>{`
        @keyframes ww-breathe { 0%, 100% { opacity: 0.25 } 50% { opacity: 0.85 } }
        .ww-breathe { animation: ww-breathe 4.5s ease-in-out infinite }
        @keyframes ww-quote-scroll { from { transform: translateY(0) } to { transform: translateY(-50%) } }
        .ww-quote-scroll { animation-name: ww-quote-scroll; animation-timing-function: linear; animation-iteration-count: infinite }
        .ww-quote-scroll:hover { animation-play-state: paused }
      `}</style>
      <GameHUD area="canvas" />

      <header className="border-b border-[#c9973f]/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pb-5 pt-24">
          <div>
            <p className="text-[11px] tracking-[0.5em] text-[#c9973f]/70">漫思 WANDERWISE · 个人画布</p>
            <h1 className="mt-1 font-serif text-2xl tracking-[0.35em] text-[#e8dcc0]">人生三见</h1>
            <p className="mt-1 text-xs text-[#8a8f9c]">见自己 · 见众生 · 见天地 —— 画布替你记得。</p>
          </div>
          <nav className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/world')} className={navBtn}>
              <Globe size={14} />
              词云世界
            </button>
            <button type="button" onClick={() => navigate('/home')} className={navBtn}>
              <Home size={14} />
              家园
            </button>
          </nav>
        </div>
      </header>

      {hasData ? (
        <main className="mx-auto max-w-6xl space-y-20 px-6 pb-24 pt-12">
          <Section kicker="其一" title="见自己" desc="足迹所至，皆成星图" icon={Fingerprint}>
            <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
              <StarMap />
              <StatsCards />
            </div>
          </Section>

          <Section kicker="其二" title="见众生" desc="同频的人，总会在词与词之间相遇" icon={Users}>
            <CompanionBoard />
          </Section>

          <Section kicker="其三" title="见天地" desc="走过的旅程，与拾得的句子" icon={Mountain}>
            <div className="grid gap-6 lg:grid-cols-2">
              <JourneyTimeline />
              <QuoteFlow />
            </div>
          </Section>
        </main>
      ) : (
        <main className="flex min-h-[calc(100vh-140px)] items-center justify-center px-6 py-16">
          <div className="w-full max-w-md rounded-xl border border-[#c9973f]/30 bg-black/60 p-12 text-center backdrop-blur-md">
            <div className="ww-breathe mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#c9973f]/40 bg-[#c9973f]/10">
              <Sparkles size={22} className="text-[#c9973f]" />
            </div>
            <h2 className="mt-6 whitespace-nowrap font-serif text-3xl tracking-[0.25em] text-[#e8dcc0]">山河未行，画布待启</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#8a8f9c]">
              你在大世界里的每一次驻足、每一句收藏，
              <br />
              都会在这里落笔成画。
            </p>
            <button
              type="button"
              onClick={() => navigate('/world')}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#c9973f] px-8 py-3 font-serif tracking-[0.2em] text-[#0a0c10] transition-colors hover:bg-[#e0b25a]"
            >
              启程探索
            </button>
          </div>
        </main>
      )}
    </div>
  )
}
