/** 家园面板聚合：读 store.panel，渲染四大玩法面板之一 */
import { useGameStore } from '@/state/gameStore'
import CabinetPanel from './panels/CabinetPanel'
import SynthPanel from './panels/SynthPanel'
import JournalPanel from './panels/JournalPanel'
import PhonePanel from './panels/PhonePanel'

export default function HomePanels() {
  const panel = useGameStore((s) => s.panel)
  switch (panel) {
    case 'cabinet':
      return <CabinetPanel />
    case 'synth':
      return <SynthPanel />
    case 'journal':
      return <JournalPanel />
    case 'phone':
      return <PhonePanel />
    default:
      return null
  }
}
