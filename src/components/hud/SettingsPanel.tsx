/** 设置面板：画质与公共内容服务状态。 */
import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'
import PanelShell from './PanelShell'
import { api } from '@/features/personal/api'
import { getQualityProfile, useGameStore, type QualityMode } from '@/state/gameStore'

interface ServiceHealth {
  ok: boolean
  content?: { configured: boolean }
  synthesis?: { configured: boolean }
}

export default function SettingsPanel() {
  const qualityMode = useGameStore((s) => s.qualityMode)
  const setQualityMode = useGameStore((s) => s.setQualityMode)
  const [health, setHealth] = useState<ServiceHealth | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [check, setCheck] = useState(0)
  const profile = getQualityProfile(qualityMode)

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    const timeout = window.setTimeout(() => controller.abort(), 10000)
    api<ServiceHealth>('/api/health', { signal: controller.signal })
      .then((result) => {
        if (!disposed) setHealth(result)
      })
      .catch((reason: unknown) => {
        if (!disposed) setError(controller.signal.aborted
          ? '服务连接超时，请稍后重试。'
          : reason instanceof Error ? reason.message : '暂时无法连接内容服务，请稍后重试。')
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [check])

  return (
    <PanelShell title="设置" icon={<Settings className="h-4 w-4" />}>
      <fieldset className="mb-5 border-b border-[#c9973f]/20 pb-5">
        <legend className="mb-2 text-sm tracking-widest text-[#e8dcc0]">画质</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="画质模式">
          {(['auto', 'fine', 'smooth'] as const).map((mode: QualityMode) => {
            const active = qualityMode === mode
            const label = mode === 'auto' ? '自动' : mode === 'fine' ? '精细' : '流畅'
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setQualityMode(mode)}
                className={`h-11 rounded-md border px-2 text-sm tracking-widest transition-colors ${
                  active
                    ? 'border-[#c9973f]/80 bg-[#c9973f]/20 text-[#c9973f]'
                    : 'border-[#c9973f]/25 text-[#8a8f9c] hover:border-[#c9973f]/50 hover:bg-white/5 hover:text-[#e8dcc0]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#8a8f9c]">
          当前渲染：{profile.dprMax === 1 ? 'DPR 1' : 'DPR ≤ 1.5'} · 后处理{profile.postprocessing ? '开启' : '关闭'}。
          流畅模式下，镜海群岛与酒境关闭实时阴影；小屋与观星台使用较低分辨率阴影。
        </p>
      </fieldset>

      <section aria-label="内容服务" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm tracking-widest text-[#e8dcc0]">内容服务</h3>
          <button
            type="button"
            disabled={loading}
            onClick={() => { setHealth(null); setError(''); setLoading(true); setCheck((value) => value + 1) }}
            className="min-h-11 rounded-md border border-[#c9973f]/30 px-3 py-1.5 text-sm text-[#e8dcc0] transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            {loading ? '检查中…' : '重新检查'}
          </button>
        </div>
        <div role="status" aria-live="polite" className="text-xs leading-relaxed text-[#8a8f9c]">
          {loading ? '正在连接内容服务…' : health?.ok ? (
            <>
              <p className="text-[#c9973f]">内容服务已连接</p>
              <p>实时检索{health.content?.configured ? '已配置' : '暂未配置'} · AI 合成{health.synthesis?.configured ? '已配置' : '暂未配置'}</p>
            </>
          ) : !error && <p>内容服务暂未就绪，请稍后重试。</p>}
        </div>
        {error && <p role="alert" className="text-xs leading-relaxed text-red-400/90">{error}</p>}
        <p className="rounded-md border border-[#c9973f]/20 bg-[#c9973f]/5 p-3 text-sm leading-relaxed text-[#e8dcc0]">
          AI 可在小屋合成台直接使用。
          <span className="mt-1 block text-xs text-[#8a8f9c]">精选旅程和手工创作可直接使用。</span>
        </p>
      </section>
    </PanelShell>
  )
}
