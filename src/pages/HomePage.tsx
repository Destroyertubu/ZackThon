import { isShowcase } from '@/features/showcase/runtime'
import showcaseWorks from '@/data/works.json'
import type { WorkItem } from '@/types/game'
import { useEffect } from 'react'
import Experience from '@/components/scene/Experience'
import HomePanels from '@/components/home/HomePanels'
import GameHUD from '@/components/hud/GameHUD'
import { getWorks } from '@/lib/zhihu'
import { useGameStore } from '@/state/gameStore'

export default function HomePage() {
  const works = useGameStore((s) => s.works)
  const setWorks = useGameStore((s) => s.setWorks)

  useEffect(() => {
    if (works.length > 0) return
    // getWorks 内部自带缓存与快照回退，永不 reject
    if (isShowcase()) setWorks(showcaseWorks as WorkItem[])
    else getWorks().then(setWorks)
  }, [works.length, setWorks])

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#0a0c10]">
      <Experience />
      <HomePanels />
      <GameHUD area="home" />
    </div>
  )
}
