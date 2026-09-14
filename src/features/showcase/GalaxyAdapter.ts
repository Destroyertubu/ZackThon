import { useEffect, useLayoutEffect, useRef } from 'react'
import { isShowcase, registerShowcaseAdapter } from './runtime'
import { createGalaxyShowcaseAdapter } from './GalaxyAdapterCore'
import type { GalaxyShowcasePort } from './GalaxyAdapterCore'

export function useGalaxyShowcaseAdapter(port: GalaxyShowcasePort) {
  const committed = useRef(port)
  useLayoutEffect(() => { committed.current = port })
  useEffect(() => {
    if (!isShowcase()) return
    const adapter = createGalaxyShowcaseAdapter(() => committed.current)
    const unregister = registerShowcaseAdapter('galaxy', adapter)
    return () => { adapter.dispose(); unregister() }
  }, [])
}
