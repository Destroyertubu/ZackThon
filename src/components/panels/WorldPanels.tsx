/** 世界面板聚合：按 store.panel 渲染世界组面板（backpack / reader / anchors），其余返回 null */
import { useGameStore } from '@/state/gameStore'
import BackpackPanel from './BackpackPanel'
import ReaderPanel from './ReaderPanel'
import AnchorsPanel from './AnchorsPanel'

export default function WorldPanels() {
  const panel = useGameStore((s) => s.panel)
  switch (panel) {
    case 'backpack':
      return <BackpackPanel />
    case 'reader':
      return <ReaderPanel />
    case 'anchors':
      return <AnchorsPanel />
    default:
      return null
  }
}
