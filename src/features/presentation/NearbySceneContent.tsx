import { useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Vector3 } from 'three'

type Point = [number, number, number]

/** Only mount world-space text in reach. An invisible distant label must not
 * leave an HTML button, raycast surface, or glyph animation over the scenery. */
export default function NearbySceneContent({ children, position, rotation, distance = 2.6, enabled = true }: {
  children: ReactNode; position?: Point; rotation?: Point; distance?: number; enabled?: boolean
}) {
  const group = useRef<Group>(null), point = useRef(new Vector3())
  const visible = useRef(false)
  const [near, setNear] = useState(false)
  useFrame(({ camera }) => {
    if (!group.current) return
    group.current.getWorldPosition(point.current)
    const next = enabled && Math.abs(camera.position.y - point.current.y) < 4
      && Math.hypot(camera.position.x - point.current.x, camera.position.z - point.current.z) <= distance
    if (next !== visible.current) { visible.current = next; setNear(next) }
  })
  return <group ref={group} position={position} rotation={rotation} name="nearby-scene-content">
    {enabled && near ? children : null}
  </group>
}
