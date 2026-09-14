import { ArrowUpFromLine } from 'lucide-react'

/** One touch press emits one jump, while assistive keyboard activation still works. */
export default function JumpButton({ onJump, disabled = false }: { onJump: () => void; disabled?: boolean }) {
  return <button type="button" className="ww-jump-control" aria-label="跳跃" title="跳跃" disabled={disabled}
    onPointerDown={event => {
      if (event.button !== 0 || disabled) return
      event.preventDefault(); event.stopPropagation(); onJump()
    }}
    onClick={event => { event.stopPropagation(); if (event.detail === 0 && !disabled) onJump() }}>
    <ArrowUpFromLine size={23} aria-hidden="true"/>
  </button>
}
