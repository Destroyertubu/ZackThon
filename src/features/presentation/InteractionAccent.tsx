import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, MeshStandardMaterial, Vector3, MathUtils, DoubleSide } from 'three'
import { useReducedMotion } from '@/features/typography/useReducedMotion'

type Point = [number, number, number]

/** Amber enamel inlay: stable at rest, brighter near the player or under the cursor.
 * Real geometry participates in depth testing; no overlay, light or shadow pass. */
export default function InteractionAccent({ position, rotation, size = .65, onActivate, disabled = false, quiet = false }: {
  position: Point; rotation?: Point; size?: number; onActivate: () => void; disabled?: boolean; quiet?: boolean
}) {
  const group = useRef<Group>(null), material = useRef<MeshStandardMaterial>(null)
  const hover = useRef(false), response = useRef(0), time = useRef(0)
  const point = useMemo(() => new Vector3(), [])
  const reduced = useReducedMotion()
  useFrame(({ camera }, delta) => {
    if (!group.current || !material.current || disabled) return
    group.current.getWorldPosition(point)
    const distance = camera.position.distanceTo(point)
    const target = hover.current ? 1 : 1 - MathUtils.smoothstep(distance, 1.6, 4.5)
    response.current = MathUtils.damp(response.current, target, 7, Math.min(delta, .05))
    if (!quiet && !reduced) time.current += Math.min(delta, .05)
    const pulse = quiet || reduced ? 0 : Math.sin(time.current * 2.4) * .16 * response.current
    material.current.emissiveIntensity = .75 + response.current * 1.45 + pulse
    group.current.userData.response = response.current
  })
  return <group ref={group} name="amber-interaction-inlay" position={position} rotation={rotation} scale={size} visible={!disabled}
    onPointerOver={event => { if (!disabled) { event.stopPropagation(); hover.current = true } }}
    onPointerOut={() => { hover.current = false }}
    onClick={event => { if (!disabled && event.delta <= 5) { event.stopPropagation(); onActivate() } }}>
    <mesh>
      <ringGeometry args={[.125, .145, 32]}/>
      <meshStandardMaterial ref={material} color="#ffe18a" emissive="#ffbf36" emissiveIntensity={.75}
        roughness={.3} metalness={.3} side={DoubleSide} toneMapped={false}/>
    </mesh>
    <mesh rotation={[0, 0, Math.PI / 4]}>
      <boxGeometry args={[.064, .064, .018]}/>
      <meshBasicMaterial color="#ffe6a1" toneMapped={false}/>
    </mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * .225, 0, 0]}>
      <boxGeometry args={[.07, .022, .012]}/>
      <meshStandardMaterial color="#ffd261" emissive="#ffbf36" emissiveIntensity={.65} roughness={.36} metalness={.25}/>
    </mesh>)}
  </group>
}
