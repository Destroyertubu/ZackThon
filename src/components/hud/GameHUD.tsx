/**
 * 全局 HUD：品牌卡 / 导航 / 准星 / 交互提示 / 键位速览 / toast / 设置与帮助面板
 * 容器本身 pointer-events-none，内部可交互元素各自 pointer-events-auto
 */
import { useGameStore } from '@/state/gameStore'
import { BrandCard, TopNav } from './TopBar'
import type { HudArea } from './TopBar'
import { Crosshair, InteractHint, KeyCheatSheet } from './Crosshair'
import { Toast } from './Toast'
import SettingsPanel from './SettingsPanel'
import HelpPanel from './HelpPanel'
import './hud.css'

export default function GameHUD({ area }: { area: HudArea }) {
  const panel = useGameStore((s) => s.panel)

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none">
      <div className="pointer-events-auto absolute left-4 top-4">
        <BrandCard area={area} />
      </div>
      <div className={`pointer-events-auto absolute right-4 ${area === 'home' ? 'top-[88px] sm:top-4' : 'top-4'}`}>
        <TopNav area={area} />
      </div>

      {area === 'world' && (
        <>
          <Crosshair />
          <InteractHint />
          <KeyCheatSheet />
        </>
      )}

      <Toast />

      {panel === 'settings' && <SettingsPanel />}
      {panel === 'help' && <HelpPanel />}
    </div>
  )
}
