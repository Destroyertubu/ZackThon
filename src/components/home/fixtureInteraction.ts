import type { ThreeEvent } from '@react-three/fiber'
import { useGameStore } from '@/state/gameStore'
import type { PanelId } from '@/types/game'

/** DOM labels and open reading/workspaces must not click through to furniture. */
export function activateHomeFixture(event: ThreeEvent<MouseEvent>, panel: PanelId) {
  if (!(event.nativeEvent.target instanceof HTMLCanvasElement)) return
  event.stopPropagation()
  if (event.delta > 5 || useGameStore.getState().panel !== null) return
  useGameStore.getState().openPanel(panel)
}
