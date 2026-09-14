import { useSyncExternalStore } from 'react'
import MirrorSeaBackdrop from '../../features/journeys/scene/MirrorSeaBackdrop'

function subscribeMotionPreference(onChange: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  preference.addEventListener('change', onChange)
  return () => preference.removeEventListener('change', onChange)
}
function motionPreference() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }

/** The cabin's pearl-rock shore overlooks the same islands as the roof garden. */
export default function Backdrop() {
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, motionPreference, () => true)
  return <MirrorSeaBackdrop mode="dusk" waterLevel={-1.5} cabinShore reducedMotion={reducedMotion} />
}
