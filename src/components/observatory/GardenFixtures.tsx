import { useEffect, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { AssetLantern } from '../scene/Assets'
import { BoxInstances, type Instance, type Point } from './Primitives'
import type { ObservatoryMaterials } from './materials'
import { TREE_POSITION } from './layout'
import { arcSlab, createFixtureFabric, createThrowGeometry, disposeFixtureFabric } from './GardenFixtureGeometry'

type FixturesProps = { materials: ObservatoryMaterials; reducedMotion: boolean }

function tube(points: Point[], radius: number, segments = 24) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 7, false)
}

/** Joining the separate strands keeps the woven chair and mouldings inexpensive. */
function join(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts, false)!
  parts.forEach(part => part.dispose())
  return result
}

export { default as ThoughtBar } from "./AtelierBar"

function benchResources() {
  const slats: Instance[] = [], legs: Instance[] = []
  const start = -0.85, end = 0.68, radius = 2.55
  for (let i = 0; i < 32; i++) {
    const angle = start + (end - start) * i / 31
    slats.push({ position: [Math.sin(angle) * radius, 0.48, Math.cos(angle) * radius], scale: [0.105, 0.07, 0.51], rotation: [0, angle, 0] })
    // Back on the tree side: the sitter faces the open garden, away from the trunk.
    slats.push({ position: [Math.sin(angle) * 2.31, 0.8, Math.cos(angle) * 2.31], scale: [0.105, 0.51, 0.045], rotation: [-0.16 * Math.cos(angle), angle, 0.16 * Math.sin(angle)] })
    slats.push({ position: [Math.sin(angle) * 2.775, 0.285, Math.cos(angle) * 2.775], scale: [0.117, 0.385, 0.04], rotation: [0, angle, 0] })
  }
  for (const angle of [-0.8, -0.3, 0.22, 0.63]) for (const r of [2.37, 2.72]) {
    legs.push({ position: [Math.sin(angle) * r, 0.22, Math.cos(angle) * r], scale: [0.09, 0.45, 0.09], rotation: [0, angle, 0] })
  }
  const curves: THREE.BufferGeometry[] = []
  for (const [r, y, thickness] of [[2.35, 0.39, 0.035], [2.75, 0.39, 0.035], [2.28, 1.06, 0.028]]) {
    const points: Point[] = Array.from({ length: 32 }, (_, i) => {
      const a = start + (end - start) * i / 31
      return [Math.sin(a) * r, y, Math.cos(a) * r]
    })
    curves.push(tube(points, thickness, 48))
  }
  for (const a of [start, end]) {
    curves.push(tube([[Math.sin(a) * 2.29, 0.96, Math.cos(a) * 2.29], [Math.sin(a) * 2.41, 0.78, Math.cos(a) * 2.41], [Math.sin(a) * 2.69, 0.76, Math.cos(a) * 2.69], [Math.sin(a) * 2.76, 0.48, Math.cos(a) * 2.76]], 0.035))
  }
  return {
    slats, legs, rails: join(curves),
    seat: arcSlab(2.27, 2.84, start - 0.018, end + 0.018, 0.09),
    cap: arcSlab(2.19, 2.39, start - 0.018, end + 0.018, 0.065),
    skirt: new THREE.CylinderGeometry(2.767, 2.767, 0.39, 64, 1, true, start, end - start),
    back: new THREE.CylinderGeometry(2.283, 2.283, 0.57, 64, 1, true, start, end - start),
    glowRail: tube(Array.from({ length: 40 }, (_, i) => {
      const a = start + (end - start) * i / 39
      return [Math.sin(a) * 2.785, 0.088, Math.cos(a) * 2.785] as Point
    }), 0.007, 48),
  }
}

function wovenChair() {
  const strands: THREE.BufferGeometry[] = [], rims: THREE.BufferGeometry[] = []
  // An open-front ovoid basket. Each real strand leaves sky visible between weaves.
  const surface = (u: number, v: number, offset = 0): Point => {
    const width = 0.57 * Math.sin(v)
    return [width * Math.sin(u), 1.04 + 0.82 * Math.cos(v), -0.09 - (0.45 + offset) * Math.sin(v) * Math.cos(u)]
  }
  for (let i = 0; i <= 24; i++) {
    const u = -1.77 + i / 24 * 3.54
    strands.push(tube(Array.from({ length: 24 }, (_, j) => surface(u, 0.16 + j / 23 * 2.47)), 0.009, 28))
  }
  for (let j = 0; j <= 23; j++) {
    const v = 0.21 + j / 23 * 2.4
    strands.push(tube(Array.from({ length: 29 }, (_, i) => surface(-1.77 + i / 28 * 3.54, v, 0.012)), 0.008, 32))
  }
  for (const u of [-1.77, 1.77]) rims.push(tube(Array.from({ length: 32 }, (_, j) => surface(u, 0.14 + j / 31 * 2.55)), 0.029, 36))
  rims.push(tube(Array.from({ length: 24 }, (_, i) => surface(-1.77 + i / 23 * 3.54, 2.63)), 0.024, 28))
  return { weave: join(strands), rim: join(rims) }
}

/** Curved root-side seating plus one independently supported woven swing. */
export function TreeSeating({ materials: m, reducedMotion }: FixturesProps) {
  const swing = useRef<THREE.Group>(null)
  const resources = useMemo(() => {
    const bench = benchResources(), chair = wovenChair(), blanket = createThrowGeometry()
    const support = join([
      tube([[-0.92, 0.04, -0.25], [-0.88, 1.05, -0.28], [-0.69, 2.35, -0.25], [-0.26, 3.18, -0.18], [0.1, 3.29, -0.15]], 0.074, 32),
      tube([[0.91, 0.04, -0.38], [0.82, 1.09, -0.34], [0.65, 2.45, -0.27], [0.25, 3.21, -0.17], [-0.04, 3.31, -0.15]], 0.068, 32),
      tube([[-1.14, 0.07, 0.48], [-0.97, 0.12, 0.04], [-0.87, 0.64, -0.26]], 0.055),
      tube([[1.15, 0.07, 0.39], [0.93, 0.15, -0.08], [0.84, 0.7, -0.34]], 0.051),
      tube([[-0.98, 0.07, -0.92], [-0.94, 0.16, -0.6], [-0.86, 0.65, -0.29]], 0.054),
      tube([[1.03, 0.07, -0.97], [0.91, 0.18, -0.63], [0.83, 0.62, -0.33]], 0.054),
    ])
    const ropes = join([
      tube([[-0.08, 3.13, -0.15], [-0.12, 2.56, -0.15], [-0.2, 1.8, -0.14]], 0.018),
      tube([[0.08, 3.13, -0.15], [0.12, 2.56, -0.15], [0.2, 1.8, -0.14]], 0.018),
    ])
    return {
      ...bench, ...chair, ...blanket, support, ropes,
      rattan: new THREE.MeshStandardMaterial({ color: '#dbc092', roughness: 0.83, envMapIntensity: 0.55 }),
      cord: new THREE.MeshStandardMaterial({ color: '#c6b797', roughness: 1 }),
      cream: createFixtureFabric('#e0cab0'),
      sage: createFixtureFabric('#638175'),
      throwMaterial: createFixtureFabric('#c5b4a7', [2.5, 4.5]),
      warmEdge: new THREE.MeshBasicMaterial({ color: '#9f662d', toneMapped: false }),
    }
  }, [])
  useEffect(() => () => {
    resources.rails.dispose(); resources.weave.dispose(); resources.rim.dispose(); resources.support.dispose(); resources.ropes.dispose()
    resources.seat.dispose(); resources.cap.dispose(); resources.skirt.dispose(); resources.back.dispose(); resources.glowRail.dispose()
    resources.cloth.dispose(); resources.fringe.dispose(); resources.warmEdge.dispose()
    resources.rattan.dispose(); resources.cord.dispose()
    disposeFixtureFabric(resources.cream); disposeFixtureFabric(resources.sage); disposeFixtureFabric(resources.throwMaterial)
  }, [resources])
  useFrame(({ clock }) => {
    if (swing.current) swing.current.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.43) * 0.018
  })
  return <group name="star-tree-garden-seating">
    <group position={TREE_POSITION}>
      <BoxInstances items={resources.slats} material={m.walnut} />
      <BoxInstances items={resources.legs} material={m.iron} />
      <mesh geometry={resources.rails} material={m.wood} castShadow />
      <mesh geometry={resources.seat} position={[0, 0.565, 0]} material={m.walnut} castShadow receiveShadow />
      <mesh geometry={resources.cap} position={[0, 1.108, 0]} material={m.walnut} castShadow receiveShadow />
      <mesh geometry={resources.skirt} position={[0, 0.285, 0]} material={m.walnut} receiveShadow />
      <mesh geometry={resources.back} position={[0, 0.795, 0]} material={m.walnut} receiveShadow />
      <mesh geometry={resources.glowRail} material={resources.warmEdge} />
      <group position={[Math.sin(-0.12) * 2.54, 0, Math.cos(-0.12) * 2.54]} rotation={[0, -0.12, 0]}>
        <mesh geometry={resources.cloth} material={resources.throwMaterial} castShadow receiveShadow />
        <mesh geometry={resources.fringe} material={resources.cord} />
      </group>
      {[-0.14, 0.13].map((angle, index) => <group key={angle} position={[Math.sin(angle) * 2.57, 0.615, Math.cos(angle) * 2.57]} rotation={[0, angle, 0]}>
        <RoundedBox args={[0.66, 0.075, 0.43]} radius={0.032} smoothness={3} material={index ? resources.sage : resources.cream} castShadow receiveShadow />
        <RoundedBox args={[0.49, index ? 0.38 : 0.42, 0.15]} radius={0.065} smoothness={4} position={[index ? -0.03 : 0.045, index ? 0.245 : 0.265, -0.18]} rotation={[index ? -0.14 : -0.22, index ? -0.08 : 0.06, index ? -0.12 : 0.22]} material={index ? resources.cream : resources.sage} castShadow />
      </group>)}
      <AssetLantern height={0.38} position={[Math.sin(-0.8) * 2.88, 0, Math.cos(-0.8) * 2.88]} rotation={0.2} />
      <AssetLantern height={0.42} position={[Math.sin(0.59) * 2.92, 0, Math.cos(0.59) * 2.92]} rotation={-0.2} />
      <pointLight position={[Math.sin(0.59) * 2.92, 0.27, Math.cos(0.59) * 2.92]} color="#ffb45f" intensity={1.8} distance={2.8} decay={2} />
    </group>
    <group name="woven-star-swing" position={[-5.2, 0, -4.8]} rotation={[0, 0.3, 0]}>
      <mesh geometry={resources.support} material={m.wood} castShadow receiveShadow />
      <mesh position={[0, 3.16, -0.15]} material={m.brass}><torusGeometry args={[0.075, 0.016, 8, 20]} /></mesh>
      <group ref={swing} position={[0, 3.13, -0.15]}>
        <group position={[0, -3.13, 0.15]}>
          <mesh geometry={resources.ropes} material={resources.cord} castShadow />
          <mesh geometry={resources.weave} material={resources.rattan} receiveShadow />
          <mesh geometry={resources.rim} material={resources.rattan} castShadow />
          <RoundedBox args={[0.88, 0.15, 0.61]} radius={0.073} smoothness={4} position={[0, 0.5, -0.05]} material={resources.cream} castShadow receiveShadow />
          <RoundedBox args={[0.49, 0.44, 0.15]} radius={0.07} smoothness={3} position={[-0.05, 0.8, -0.35]} rotation={[-0.3, 0, 0.15]} material={resources.sage} castShadow />
        </group>
      </group>
      <AssetLantern height={0.36} position={[0.59, 0, 0.21]} rotation={0.2} />
      <pointLight position={[0.52, 0.32, 0.18]} color="#ffc47a" intensity={1.25} distance={2.4} decay={2} />
    </group>
  </group>
}
