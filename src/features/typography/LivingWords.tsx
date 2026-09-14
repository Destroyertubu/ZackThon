import StellarText from '@/features/galaxy/components/StellarText'
import { useReducedMotion } from './useReducedMotion'

/** Reuse the galaxy's sampled glyph transition; accessible text stays in the DOM. */
export default function LivingWords({ text, className = '' }: { text: string; className?: string }) {
  const reduced = useReducedMotion()
  return <span className={`ww-living-words ${className}`}><StellarText key={text} text={text} phase="enter" reducedMotion={reduced}/></span>
}
