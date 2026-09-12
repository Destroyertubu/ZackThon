import { useMemo, useState } from 'react'
import { Footprints } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import { formatTime } from './format'

const W = 800
const H = 520
const PAD = 70

interface Star {
  word: string
  x: number
  y: number
  count: number
  firstT: number
}

const starRadius = (count: number) => 4.5 + Math.min(9, Math.sqrt(count) * 2.2)

/** 见自己 · 足迹星图：trail 的 x/z 世界坐标投影为 2D SVG 星图 */
export default function StarMap() {
  const trail = useGameStore((s) => s.trail)
  const [hover, setHover] = useState<Star | null>(null)

  // 背景装饰星尘（确定性伪随机，避免重渲染闪烁）
  const dust = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        x: (i * 197) % W,
        y: (i * 131) % H,
        r: 0.8 + ((i * 7) % 10) / 9,
        o: 0.12 + ((i * 13) % 10) / 38,
      })),
    []
  )

  const { path, stars } = useMemo(() => {
    if (trail.length === 0) return { path: '', stars: [] as Star[] }
    const xs = trail.map((p) => p.pos[0])
    const zs = trail.map((p) => p.pos[2])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minZ = Math.min(...zs)
    const maxZ = Math.max(...zs)
    const spanX = Math.max(maxX - minX, 1e-6)
    const spanZ = Math.max(maxZ - minZ, 1e-6)
    // 等比缩放至视窗内并居中
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanZ)
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const px = (x: number) => W / 2 + (x - cx) * scale
    const py = (z: number) => H / 2 + (z - cz) * scale

    const path = trail
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.pos[0]).toFixed(1)},${py(p.pos[2]).toFixed(1)}`)
      .join(' ')

    const byWord = new Map<string, Star>()
    for (const p of trail) {
      if (!p.word) continue
      const ex = byWord.get(p.word)
      if (ex) ex.count += 1
      else byWord.set(p.word, { word: p.word, x: px(p.pos[0]), y: py(p.pos[2]), count: 1, firstT: p.t })
    }
    return { path, stars: [...byWord.values()] }
  }, [trail])

  const labels = useMemo(() => [...stars].sort((a, b) => b.count - a.count).slice(0, 8), [stars])

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#c9973f]/30 bg-black/60 backdrop-blur-md">
      {/* 呼吸光晕背景 */}
      <div
        className="ww-breathe pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(201,151,63,0.16), transparent 70%)' }}
      />
      {trail.length === 0 ? (
        <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-[#8a8f9c]">
          <Footprints size={22} className="text-[#c9973f]/60" />
          <p className="text-sm">尚无足迹 —— 去大世界留下第一道轨迹</p>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
            <defs>
              <linearGradient id="ww-trail-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a3abc4" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#eab668" />
              </linearGradient>
              <filter id="ww-soft" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            {dust.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#e8dcc0" opacity={d.o} />
            ))}
            {path && (
              <>
                <path
                  d={path}
                  fill="none"
                  stroke="url(#ww-trail-grad)"
                  strokeWidth={8}
                  opacity={0.35}
                  filter="url(#ww-soft)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={path}
                  fill="none"
                  stroke="url(#ww-trail-grad)"
                  strokeWidth={2}
                  opacity={1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
            {stars.map((s, i) => {
              const r = starRadius(s.count)
              const active = hover?.word === s.word
              return (
                <g
                  key={s.word}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(null)}
                >
                  {/* 常驻发光底盘，保证呼吸低谷期节点仍可见 */}
                  <circle cx={s.x} cy={s.y} r={r * 2.2} fill="#d9a94e" opacity={0.4} filter="url(#ww-soft)" />
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={r * 2.8}
                    fill="#e8b56b"
                    className="ww-breathe"
                    style={{ animationDelay: `${(i % 6) * 0.6}s` }}
                  />
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={active ? r * 1.35 : r}
                    fill="#0a0c10"
                    stroke="#e8b56b"
                    strokeWidth={active ? 2.2 : 1.6}
                    opacity={0.95}
                  />
                  <circle cx={s.x} cy={s.y} r={Math.max(1.8, r * 0.38)} fill={active ? '#ffffff' : '#e8dcc0'} />
                  {/* 扩大热区 */}
                  <circle cx={s.x} cy={s.y} r={Math.max(14, r * 2)} fill="transparent" />
                </g>
              )
            })}
            {labels.map((s) => (
              <text
                key={s.word}
                x={s.x}
                y={s.y - starRadius(s.count) - 6}
                textAnchor="middle"
                fontSize={12}
                fill="#b9bfcc"
                className="pointer-events-none select-none"
              >
                {s.word}
              </text>
            ))}
          </svg>
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[135%] whitespace-nowrap rounded-lg border border-[#c9973f]/40 bg-[#0a0c10]/95 px-3 py-2 shadow-lg"
              style={{
                left: `${Math.min(86, Math.max(14, (hover.x / W) * 100))}%`,
                top: `${Math.max(8, (hover.y / H) * 100)}%`,
              }}
            >
              <p className="font-serif text-sm tracking-[0.2em] text-[#c9973f]">{hover.word}</p>
              <p className="mt-0.5 text-xs text-[#8a8f9c]">
                首次经过 {formatTime(hover.firstT)} · 途经 {hover.count} 次
              </p>
            </div>
          )}
        </div>
      )}
      <div className="relative flex items-center justify-between border-t border-[#c9973f]/15 px-5 py-3 text-xs text-[#8a8f9c]">
        <span>足迹星图 · x/z 世界坐标投影</span>
        <span>
          {trail.length} 个足迹点 · {stars.length} 颗词星
        </span>
      </div>
    </div>
  )
}
