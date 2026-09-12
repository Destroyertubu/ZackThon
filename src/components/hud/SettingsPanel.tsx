/** 设置面板：知乎开放平台 Access Secret 与额度查询 */
import { useState } from 'react'
import { Settings } from 'lucide-react'
import PanelShell from './PanelShell'
import { getAccessSecret, getQuota, setAccessSecret } from '@/lib/zhihu'
import type { QuotaItem } from '@/lib/zhihu'
import { getQualityProfile, useGameStore, type QualityMode } from '@/state/gameStore'

export default function SettingsPanel() {
  const qualityMode = useGameStore((s) => s.qualityMode)
  const setQualityMode = useGameStore((s) => s.setQualityMode)
  const [secret, setSecret] = useState(() => getAccessSecret())
  const [saved, setSaved] = useState(() => getAccessSecret() !== '')
  const [quota, setQuota] = useState<QuotaItem[] | null>(null)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSave = () => {
    const trimmed = secret.trim()
    setAccessSecret(trimmed)
    setSecret(trimmed)
    setSaved(trimmed !== '')
    setQuota(null)
    setQuotaError(null)
  }

  const onQueryQuota = async () => {
    setLoading(true)
    setQuota(null)
    setQuotaError(null)
    try {
      setQuota(await getQuota(getAccessSecret()))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setQuotaError(
        msg.includes('HTTP 401') || msg.includes('HTTP 403')
          ? `鉴权失败，请检查 Access Secret 是否正确（${msg}）`
          : `网络异常或接口暂不可用（${msg}）`
      )
    } finally {
      setLoading(false)
    }
  }

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
                className={`h-9 rounded-md border px-2 text-sm tracking-widest transition-colors ${
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
          当前渲染：{(() => {
            const profile = getQualityProfile(qualityMode)
            return `${profile.dprMax === 1 ? 'DPR 1' : 'DPR ≤ 1.5'} · ${profile.shadowMapSize}px 阴影${profile.postprocessing ? ' · 后处理开启' : ' · 后处理关闭'}`
          })()}
        </p>
      </fieldset>

      <label htmlFor="access-secret" className="mb-1.5 block text-sm tracking-widest text-[#e8dcc0]">
        Access Secret
      </label>
      <div className="flex gap-2">
        <input
          id="access-secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="粘贴你的知乎开放平台密钥"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 rounded-md border border-[#c9973f]/30 bg-black/40 px-3 text-sm text-[#e8dcc0] outline-none transition-colors placeholder:text-[#8a8f9c]/60 focus:border-[#c9973f]/70"
        />
        <button
          type="button"
          onClick={onSave}
          className="h-9 shrink-0 rounded-md border border-[#c9973f]/40 bg-[#c9973f]/15 px-4 text-sm tracking-widest text-[#c9973f] transition-colors hover:bg-[#c9973f]/25"
        >
          保存
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#8a8f9c]">
        仅存于本地浏览器，用于知乎热榜 / 搜索 / 直答等开放平台能力；不填也能畅玩。
      </p>

      {saved && (
        <div className="mt-4 border-t border-[#c9973f]/20 pt-4">
          <button
            type="button"
            onClick={onQueryQuota}
            disabled={loading}
            className="rounded-md border border-[#c9973f]/30 px-3 py-1.5 text-sm tracking-widest text-[#e8dcc0] transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            {loading ? '查询中…' : '查询今日额度'}
          </button>

          {quotaError && <p className="mt-3 text-xs leading-relaxed text-red-400/90">{quotaError}</p>}

          {quota && (
            <ul className="mt-3 space-y-1.5">
              {quota.map((q) => (
                <li
                  key={q.APIID}
                  className="flex items-center justify-between rounded-md border border-[#c9973f]/15 bg-white/[0.03] px-3 py-1.5 text-xs"
                >
                  <span className="text-[#e8dcc0]">{q.APIName || q.APIID}</span>
                  <span className="text-[#8a8f9c]">
                    剩余 <span className="text-[#c9973f]">{q.RemainingQuota}</span> / {q.TotalQuota}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PanelShell>
  )
}
