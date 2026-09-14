import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react'

export default function DirectionIcon({ code }: { code: 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD' }) {
  const Icon = { KeyW: ArrowUp, KeyA: ArrowLeft, KeyS: ArrowDown, KeyD: ArrowRight }[code]
  return <Icon size={21} aria-hidden="true"/>
}
