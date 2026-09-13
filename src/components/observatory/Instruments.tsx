import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ObservatoryMaterials } from './materials'
import { BoxInstances, Rod } from './Primitives'
import { ATLAS_POSITION, TELESCOPE_POSITION } from './layout'

export function Armillary({ materials: m, reducedMotion }: { materials: ObservatoryMaterials; reducedMotion: boolean }) {
  const celestial = useRef<THREE.Group>(null)
  const ticks = useMemo(() => Array.from({ length: 96 }, (_, i) => {
    const a = i / 96 * Math.PI * 2
    return { position: [Math.sin(a) * 1.41, Math.cos(a) * 1.41, 0] as [number, number, number],
      scale: [0.018, i % 8 === 0 ? 0.12 : 0.05, 0.035] as [number, number, number], rotation: [0, 0, -a] as [number, number, number] }
  }), [])
  useFrame(({ clock }) => {
    if (celestial.current && !reducedMotion) celestial.current.rotation.y = clock.elapsedTime * 0.025
  })
  return <group name="brass-armillary-atlas" position={ATLAS_POSITION}>
    <mesh position={[0, 0.12, 0]} material={m.stone} receiveShadow><cylinderGeometry args={[1.94, 2, 0.24, 64]} /></mesh>
    <mesh position={[0, 0.3, 0]} material={m.iron} castShadow receiveShadow><cylinderGeometry args={[1.5, 1.7, 0.15, 48]} /></mesh>
    <mesh position={[0, 0.64, 0]} material={m.walnut} castShadow receiveShadow><cylinderGeometry args={[1.25, 1.46, 0.65, 48]} /></mesh>
    {[0.37, 0.91].map(y => <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.brass}><torusGeometry args={[y < 0.5 ? 1.44 : 1.29, 0.035, 8, 64]} /></mesh>)}
    <mesh position={[0, 1.04, 0]} material={m.walnut} castShadow receiveShadow><cylinderGeometry args={[1.84, 1.75, 0.18, 96]} /></mesh>
    <mesh position={[0, 1.136, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.atlas} receiveShadow><circleGeometry args={[1.75, 96]} /></mesh>
    <mesh position={[0, 1.14, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.brightBrass}><torusGeometry args={[1.8, 0.036, 10, 96]} /></mesh>
    {Array.from({ length: 12 }, (_, i) => {
      const a = i / 12 * Math.PI * 2
      return <mesh key={i} position={[Math.sin(a) * 1.31, 0.65, Math.cos(a) * 1.31]} rotation={[0, a, 0]} material={m.brass} castShadow><boxGeometry args={[0.045, 0.49, 0.03]} /></mesh>
    })}
    <mesh position={[0, 1.25, 0]} material={m.brass} castShadow><cylinderGeometry args={[0.4, 0.56, 0.23, 48]} /></mesh>
    <mesh position={[0, 1.55, 0]} material={m.iron} castShadow><cylinderGeometry args={[0.14, 0.26, 0.45, 32]} /></mesh>
    <group position={[0, 2.85, 0]} rotation={[0, 0, -0.32]}>
      <mesh material={m.brass} castShadow><torusGeometry args={[1.43, 0.065, 12, 128]} /></mesh>
      <BoxInstances items={ticks} material={m.brightBrass} shadows={false} />
      <Rod from={[0, -1.57, 0]} to={[0, 1.6, 0]} radius={0.034} material={m.brightBrass} />
      {[-1, 1].map(sign => <mesh key={sign} position={[0, sign * 1.57, 0]} material={m.brightBrass}><sphereGeometry args={[0.075, 16, 12]} /></mesh>)}
      <group ref={celestial}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.brass} castShadow><torusGeometry args={[1.26, 0.028, 10, 96]} /></mesh>
        <mesh rotation={[Math.PI / 2 - 0.41, 0.2, 0]} material={m.brightBrass} castShadow><torusGeometry args={[1.3, 0.046, 10, 96]} /></mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} material={m.brass} castShadow><torusGeometry args={[1.16, 0.025, 10, 96]} /></mesh>
        {[-0.58, 0.58].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}><torusGeometry args={[1.0, 0.017, 8, 72]} /></mesh>)}
        <mesh material={m.glass} castShadow><sphereGeometry args={[0.36, 48, 32]} /></mesh>
        <mesh rotation={[0.25, 0.2, 0]} material={m.brightBrass}><torusGeometry args={[0.367, 0.008, 6, 64]} /></mesh>
        <Rod from={[-0.92, 0, 0]} to={[0.92, 0, 0]} radius={0.015} material={m.brass} />
        <mesh position={[0.92, 0, 0]} material={m.brightBrass}><sphereGeometry args={[0.12, 24, 16]} /></mesh>
      </group>
    </group>
  </group>
}

export function Telescope({ materials: m }: { materials: ObservatoryMaterials }) {
  return <group name="brass-refracting-telescope" position={TELESCOPE_POSITION} rotation={[0, -2.0, 0]}>
    {[0, 1, 2].map(i => {
      const a = i * Math.PI * 2 / 3
      const bottom: [number, number, number] = [Math.sin(a) * 0.88, 0.08, Math.cos(a) * 0.88]
      const top: [number, number, number] = [Math.sin(a) * 0.2, 1.55, Math.cos(a) * 0.2]
      return <group key={i}>
        <Rod from={bottom} to={top} radius={0.073} material={m.walnut} />
        <Rod from={[bottom[0] * 0.55, 0.73, bottom[2] * 0.55]} to={[0, 0.66, 0]} radius={0.019} material={m.brass} />
        <mesh position={bottom} material={m.brass}><sphereGeometry args={[0.095, 16, 12]} /></mesh>
      </group>
    })}
    <mesh position={[0, 1.57, 0]} material={m.brass} castShadow><cylinderGeometry args={[0.23, 0.32, 0.18, 32]} /></mesh>
    <mesh position={[0, 1.84, 0]} material={m.iron} castShadow><cylinderGeometry args={[0.12, 0.16, 0.42, 24]} /></mesh>
    <mesh position={[0.25, 1.99, 0]} rotation={[0, Math.PI / 2, 0]} material={m.brass} castShadow><torusGeometry args={[0.24, 0.055, 12, 48]} /></mesh>
    <Rod from={[-0.3, 2.02, 0]} to={[0.4, 2.02, 0]} radius={0.06} material={m.brass} />
    <group position={[0, 2.16, 0]} rotation={[Math.PI / 2 - 0.46, 0, 0]}>
      <mesh material={m.brass} castShadow><cylinderGeometry args={[0.2, 0.155, 1.95, 48]} /></mesh>
      <mesh position={[0, 0.72, 0]} material={m.iron} castShadow><cylinderGeometry args={[0.225, 0.225, 0.38, 48]} /></mesh>
      <mesh position={[0, 1.0, 0]} material={m.brass} castShadow><cylinderGeometry args={[0.24, 0.22, 0.19, 48, 1, true]} /></mesh>
      <mesh position={[0, 1.01, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glass}><circleGeometry args={[0.208, 48]} /></mesh>
      {[-0.88, -0.28, 0.26, 0.93, 1.095].map((y, i) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.brightBrass}><torusGeometry args={[i > 2 ? 0.237 : 0.182, 0.024, 10, 48]} /></mesh>)}
      <mesh position={[0, -1.13, 0]} material={m.iron} castShadow><cylinderGeometry args={[0.09, 0.055, 0.38, 24]} /></mesh>
      <mesh position={[0, -1.34, 0]} material={m.brass}><cylinderGeometry args={[0.067, 0.067, 0.08, 24]} /></mesh>
      <Rod from={[0.27, 0.08, 0]} to={[0.27, 0.68, 0]} radius={0.05} material={m.brass} />
      {[0.14, 0.55].map(y => <Rod key={y} from={[0.12, y, 0]} to={[0.27, y, 0]} radius={0.021} material={m.iron} />)}
    </group>
  </group>
}
