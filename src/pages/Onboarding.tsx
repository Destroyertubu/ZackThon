import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Dices, History, Home, Loader2, Palette, Sparkles } from 'lucide-react'
import GameHUD from '@/components/hud/GameHUD'
import { Textarea } from '@/components/ui/textarea'
import { getWorks } from '@/lib/zhihu'
import { extractTopics, pickRandomLabels, seededRandom } from '@/lib/worldGen'
import { useGameStore } from '@/state/gameStore'

const KEYFRAMES = `
@keyframes ww-twinkle { 0%, 100% { opacity: 0.12; } 50% { opacity: 0.85; } }
@keyframes ww-drift { from { transform: translate3d(-3%, -2%, 0) scale(1); } to { transform: translate3d(3%, 2%, 0) scale(1.1); } }
@keyframes ww-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ww-glow { 0%, 100% { text-shadow: 0 0 18px rgba(201, 151, 63, 0.25); } 50% { text-shadow: 0 0 34px rgba(201, 151, 63, 0.45); } }
`

const fadeUp = (delay: number) => ({
  animation: `ww-fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
})

type Pending = 'main' | 'random' | null

export default function Onboarding() {
  const navigate = useNavigate()
  const seed = useGameStore((s) => s.seed)
  const setWorks = useGameStore((s) => s.setWorks)
  const startWorld = useGameStore((s) => s.startWorld)
  const showToast = useGameStore((s) => s.showToast)

  const [raw, setRaw] = useState('')
  const [pending, setPending] = useState<Pending>(null)

  // 稳定的星空（同一种子，每次造访都是同一片夜）
  const stars = useMemo(() => {
    const rnd = seededRandom(20260911)
    return Array.from({ length: 110 }, (_, i) => ({
      id: i,
      left: rnd() * 100,
      top: rnd() * 100,
      size: rnd() < 0.85 ? 1 : 2,
      delay: rnd() * 6,
      dur: 3 + rnd() * 5,
      opacity: 0.3 + rnd() * 0.6,
    }))
  }, [])

  const handleGenerate = async () => {
    if (pending) return
    setPending('main')
    try {
      const works = await getWorks()
      setWorks(works)
      const topics = extractTopics(raw, works)
      startWorld(raw.trim(), topics)
      navigate('/world')
    } catch {
      showToast('内容加载失败，请稍后再试')
    } finally {
      setPending(null)
    }
  }

  const handleRandom = async () => {
    if (pending) return
    setPending('random')
    try {
      const works = await getWorks()
      setWorks(works)
      const topics = pickRandomLabels(works, 5, Date.now())
      startWorld('', topics)
      navigate('/world')
    } catch {
      showToast('内容加载失败，请稍后再试')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="relative min-h-screen bg-[#0a0c10] font-sans text-[#e8dcc0]">
      <style>{KEYFRAMES}</style>

      {/* 夜空背景：渐变、雾气与星 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#07090d_0%,#0a0c10_45%,#101018_100%)]" />
        <div
          className="absolute -top-32 left-[-10%] h-[36rem] w-[36rem] rounded-full bg-[#c9973f]/[0.07] blur-[120px]"
          style={{ animation: 'ww-drift 26s ease-in-out infinite alternate' }}
        />
        <div
          className="absolute bottom-[-20%] right-[-12%] h-[40rem] w-[40rem] rounded-full bg-[#3a4a63]/[0.16] blur-[130px]"
          style={{ animation: 'ww-drift 32s ease-in-out infinite alternate-reverse' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(ellipse_at_bottom,rgba(201,151,63,0.10),transparent_65%)]" />
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full bg-[#e8dcc0]"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              animation: `ww-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-5 py-16">
        {/* 标题 */}
        <header className="text-center" style={fadeUp(0.05)}>
          <p className="text-xs tracking-[0.4em] text-[#8a8f9c]">内容来自知乎故事与知乎知识</p>
          <h1
            className="mt-4 font-serif text-5xl tracking-[0.18em] text-[#e8dcc0] sm:text-6xl"
            style={{ animation: 'ww-glow 5s ease-in-out infinite' }}
          >
            漫思
            <span className="ml-3 align-middle font-serif text-3xl tracking-[0.12em] text-[#c9973f] sm:text-4xl">
              Wanderwise
            </span>
          </h1>
          <p className="mt-4 text-sm tracking-[0.3em] text-[#8a8f9c]">在词云山河间，找一条自己的路</p>
        </header>

        {/* 回访用户：继续上次旅程 */}
        {seed && seed.topics.length > 0 && (
          <button
            onClick={() => navigate('/world')}
            className="group w-full rounded-xl border border-[#c9973f]/30 bg-black/60 p-4 text-left backdrop-blur-md transition hover:border-[#c9973f]/60 hover:bg-[#c9973f]/[0.06]"
            style={fadeUp(0.15)}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-serif tracking-[0.2em] text-[#c9973f]">
                <History className="h-4 w-4" />
                继续上次旅程
              </span>
              <span className="flex items-center gap-2 text-xs text-[#8a8f9c]">
                {new Date(seed.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}启程
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1 group-hover:text-[#c9973f]" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {seed.topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[#c9973f]/25 bg-[#c9973f]/10 px-2.5 py-0.5 text-xs text-[#e8dcc0]/90"
                >
                  {t}
                </span>
              ))}
            </div>
          </button>
        )}

        {/* 输入与启程 */}
        <section
          className="w-full rounded-xl border border-[#c9973f]/30 bg-black/60 p-5 shadow-[0_0_60px_rgba(201,151,63,0.08)] backdrop-blur-md sm:p-6"
          style={fadeUp(0.25)}
        >
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleGenerate()
            }}
            rows={3}
            placeholder="输入你最近的问题、困惑，或几个感兴趣的话题词……（逗号或空格分隔）"
            className="min-h-24 resize-none border-[#c9973f]/20 bg-black/30 text-[#e8dcc0] placeholder:text-[#8a8f9c]/70 focus-visible:border-[#c9973f]/50 focus-visible:ring-[#c9973f]/20"
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleGenerate}
              disabled={pending !== null}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-[#d9a94e] to-[#b5822f] px-5 py-3 font-medium tracking-[0.2em] text-[#1a1206] shadow-[0_0_24px_rgba(201,151,63,0.35)] transition hover:shadow-[0_0_36px_rgba(201,151,63,0.55)] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'main' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在为你铺展山河…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  生成我的世界
                </>
              )}
            </button>
            <button
              onClick={handleRandom}
              disabled={pending !== null}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#c9973f]/40 px-5 py-3 tracking-[0.2em] text-[#c9973f] transition hover:border-[#c9973f]/70 hover:bg-[#c9973f]/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending === 'random' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Dices className="h-4 w-4" />
              )}
              任凭天马行空
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-[#8a8f9c]/80">
            留空也行，山河自有安排 · Ctrl / Cmd + Enter 直接启程
          </p>
        </section>

        {/* 其他入口 */}
        <nav className="grid w-full grid-cols-2 gap-3" style={fadeUp(0.35)}>
          <button
            onClick={() => navigate('/home')}
            className="group rounded-xl border border-[#c9973f]/20 bg-black/40 p-4 text-left backdrop-blur-md transition hover:border-[#c9973f]/50 hover:bg-[#c9973f]/[0.05]"
          >
            <Home className="h-5 w-5 text-[#c9973f]" />
            <p className="mt-2 font-serif tracking-[0.2em] text-[#e8dcc0]">先去家园看看</p>
            <p className="mt-1 text-xs text-[#8a8f9c]">回到那间温暖的木屋书房</p>
          </button>
          <button
            onClick={() => navigate('/canvas')}
            className="group rounded-xl border border-[#c9973f]/20 bg-black/40 p-4 text-left backdrop-blur-md transition hover:border-[#c9973f]/50 hover:bg-[#c9973f]/[0.05]"
          >
            <Palette className="h-5 w-5 text-[#c9973f]" />
            <p className="mt-2 font-serif tracking-[0.2em] text-[#e8dcc0]">个人画布</p>
            <p className="mt-1 text-xs text-[#8a8f9c]">回看一路拾起的星光</p>
          </button>
        </nav>
      </main>

      <GameHUD area="onboarding" />
    </div>
  )
}
