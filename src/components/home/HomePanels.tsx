/** 家园面板聚合：读 store.panel，渲染四大玩法面板之一 */
import { useGameStore } from '@/state/gameStore'
import PersonalPanel from '@/features/personal/PersonalPanel'
import PhonePanel from './panels/PhonePanel'

export default function HomePanels() {
  const panel = useGameStore((s) => s.panel)
  switch (panel) {
    case 'cabinet':
      return <PersonalPanel key={panel} initialTab="collections" />
    case 'synth':
      return <PersonalPanel key={panel} initialTab="synthesis" />
    case 'journal':
      return <PersonalPanel key={panel} initialTab="journeys" />
    case 'mascot':
      return <PersonalPanel key={panel} initialTab="search" />
    case 'phone':
      return <PhonePanel />
    default:
      return null
  }
}
