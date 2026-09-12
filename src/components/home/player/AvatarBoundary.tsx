import { Component, useRef } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Group, MeshStandardMaterial } from 'three'

export function FallbackAvatar({ opacity }: { opacity: MutableRefObject<number> }) {
  const group = useRef<Group>(null)
  const body = useRef<MeshStandardMaterial>(null)
  const head = useRef<MeshStandardMaterial>(null)
  const message = useRef<HTMLSpanElement>(null)
  useFrame(() => {
    const alpha = opacity.current
    if (group.current) group.current.visible = alpha > 0.01
    if (body.current) body.current.opacity = alpha
    if (head.current) head.current.opacity = alpha
    if (message.current) message.current.style.opacity = String(alpha)
  })
  return (
    <group ref={group}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.65, 4, 12]} />
        <meshStandardMaterial ref={body} color="#866149" roughness={0.8} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.3, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial ref={head} color="#d9b588" transparent depthWrite={false} />
      </mesh>
      <Html center position={[0, 1.9, 0]} style={{ pointerEvents: 'none' }}>
        <span ref={message} className="whitespace-nowrap rounded bg-black/80 px-3 py-1 text-xs text-[#e8dcc0]">角色加载失败，刷新可重试</span>
      </Html>
    </group>
  )
}

/** A failed avatar download must not take down the cabin or its controls. */
export default class AvatarBoundary extends Component<{ children: ReactNode; opacity: MutableRefObject<number> }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <FallbackAvatar opacity={this.props.opacity} />
  }
}
