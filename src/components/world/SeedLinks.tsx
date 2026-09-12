import { Line } from '@react-three/drei'
import type { TopicNode } from '@/types/game'

const CENTER: [number, number, number] = [0, 7, 0]

/** 种子词 → 世界中心的细光线，中心置一枚发光晶石作为视觉锚点 */
export default function SeedLinks({ nodes }: { nodes: TopicNode[] }) {
  const seeds = nodes.filter((n) => n.isSeed)
  return (
    <group>
      {seeds.map((n) => (
        <Line key={n.id} points={[CENTER, n.position]} color="#c9973f" transparent opacity={0.28} lineWidth={1} />
      ))}
      <mesh position={CENTER}>
        <octahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial color="#c9973f" emissive="#c9973f" emissiveIntensity={1.5} flatShading />
      </mesh>
      <pointLight position={CENTER} color="#c9973f" intensity={50} distance={70} />
    </group>
  )
}
