import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import DirectionIcon from '@/features/presentation/DirectionIcon'
import JumpButton from '@/features/presentation/JumpButton'

type MoveCode = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD'
const DIRECTIONS: readonly { code: MoveCode; label: string; arrow: string; column: number; row: number }[] = [
  { code: 'KeyW', label: '前进', arrow: '↑', column: 2, row: 1 },
  { code: 'KeyA', label: '向左移动', arrow: '←', column: 1, row: 2 },
  { code: 'KeyS', label: '后退', arrow: '↓', column: 2, row: 2 },
  { code: 'KeyD', label: '向右移动', arrow: '→', column: 3, row: 2 },
]
function emit(code: MoveCode | 'Space', active: boolean) { window.dispatchEvent(new CustomEvent('wanderwise:world-move', { detail: { code, active } })) }

/** DOM sibling of Canvas. Only sends movement state; it never invokes a scene action. */
export default function WorldTouchControls({ disabled = false }: { disabled?: boolean }) {
  const pointers = useRef(new Map<number, { code: MoveCode; button: HTMLButtonElement }>())
  const releasePointer = useCallback((pointerId: number) => {
    const active = pointers.current.get(pointerId)
    if (!active) return
    pointers.current.delete(pointerId)
    if (![...pointers.current.values()].some((held) => held.code === active.code)) {
      active.button.removeAttribute('data-held'); emit(active.code, false)
    }
    if (active.button.hasPointerCapture(pointerId)) active.button.releasePointerCapture(pointerId)
  }, [])
  const releaseAll = useCallback(() => { for (const id of [...pointers.current.keys()]) releasePointer(id) }, [releasePointer])
  useEffect(() => {
    if (disabled) releaseAll()
    const end = (event: PointerEvent) => releasePointer(event.pointerId)
    const visibility = () => { if (document.hidden) releaseAll() }
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('blur', releaseAll)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      releaseAll(); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', releaseAll); document.removeEventListener('visibilitychange', visibility)
    }
  }, [disabled, releaseAll, releasePointer])
  const press = (event: ReactPointerEvent<HTMLButtonElement>, code: MoveCode) => {
    if (disabled || event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    const button = event.currentTarget
    if (pointers.current.has(event.pointerId)) return
    const alreadyHeld = [...pointers.current.values()].some((held) => held.code === code)
    pointers.current.set(event.pointerId, { code, button })
    try { button.setPointerCapture(event.pointerId) } catch { /* Global up/cancel still releases browsers without capture. */ }
    button.setAttribute('data-held', 'true')
    if (!alreadyHeld) emit(code, true)
  }
  const release = (event: ReactPointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.stopPropagation(); releasePointer(event.pointerId) }
  return <><JumpButton disabled={disabled} onJump={() => emit('Space', true)}/><div className="world-touch-controls" role="group" aria-label="行走方向" style={{
    position: 'absolute', left: 'max(18px, env(safe-area-inset-left))', bottom: 'max(20px, env(safe-area-inset-bottom))',
    display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gridTemplateRows: 'repeat(2, 48px)', gap: 6,
    zIndex: 20, touchAction: 'none', userSelect: 'none', opacity: disabled ? .35 : 1,
  }}>
    <style>{`.world-touch-controls button[data-held="true"]{background:rgba(195,154,91,.8)!important;color:#fff!important} @media (hover:hover) and (pointer:fine){.world-touch-controls{display:none!important}}`}</style>
    {DIRECTIONS.map(({ code, label, column, row }) => <button key={code} type="button" disabled={disabled} aria-label={label}
      onPointerDown={(event) => press(event, code)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()} style={{
        gridColumn: column, gridRow: row, border: '1px solid rgba(238,207,160,.45)', borderRadius: 15,
        background: 'rgba(30,42,47,.65)', color: '#f1dfc4', fontSize: 24, lineHeight: 1,
        boxShadow: '0 3px 12px rgba(0,0,0,.17)', backdropFilter: 'blur(8px)', touchAction: 'none', WebkitTapHighlightColor: 'transparent',
      }}><DirectionIcon code={code}/></button>)}
  </div></>
}
