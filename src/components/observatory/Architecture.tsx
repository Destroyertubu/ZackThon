import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ObservatoryMaterials } from './materials'
import { BoxInstances, Rod, type Instance } from './Primitives'
import { AssetBookStack, AssetLantern, AssetModel } from '../scene/Assets'
import { DESK_POSITION } from './layout'
import { BeamIvy } from '../scene/Plants'
import { GARDEN_DECK_BOARD_WIDTH } from './gardenDeckLayout'

export function Deck({ materials: m }: { materials: ObservatoryMaterials }) {
  const { boards, posts, rails, balusters, caps } = useMemo(() => {
    const boards: Instance[] = [], posts: Instance[] = [], rails: Instance[] = [], balusters: Instance[] = [], caps: Instance[] = []
    for (let i = -48; i <= 48; i++) {
      const x = i * GARDEN_DECK_BOARD_WIDTH
      const halfLength = Math.sqrt(Math.max(0, 11.85 ** 2 - (Math.abs(x) + GARDEN_DECK_BOARD_WIDTH / 2) ** 2))
      const offset = ((i % 3 + 3) % 3) * .8
      for (let segment = -6; segment <= 5; segment++) {
        const start = Math.max(-halfLength, segment * 2.4 + offset)
        const end = Math.min(halfLength, (segment + 1) * 2.4 + offset)
        if (end - start > .015) boards.push({ position: [x, -.08, (start + end) / 2],
          scale: [GARDEN_DECK_BOARD_WIDTH - .006, .16, end - start - .006] })
      }
    }
    const radius = 11.95, count = 24
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2, b = (i + 1) / count * Math.PI * 2, mid = (a + b) / 2
      const x = Math.sin(a) * radius, z = Math.cos(a) * radius
      posts.push({ position: [x, 0.62, z], scale: [0.2, 1.35, 0.2], rotation: [0, a, 0] })
      caps.push({ position: [x, 1.31, z], scale: [0.28, 0.06, 0.28], rotation: [0, a, 0] })
      const length = 2 * radius * Math.sin(Math.PI / count)
      for (const y of [0.26, 1.19]) rails.push({ position: [Math.sin(mid) * radius * Math.cos(Math.PI / count), y, Math.cos(mid) * radius * Math.cos(Math.PI / count)], scale: [length, 0.1, 0.13], rotation: [0, mid, 0] })
      for (let j = 1; j < 7; j++) {
        const t = j / 7
        balusters.push({ position: [(Math.sin(a) * (1 - t) + Math.sin(b) * t) * radius, 0.71, (Math.cos(a) * (1 - t) + Math.cos(b) * t) * radius], scale: [0.038, 0.89, 0.038] })
      }
    }
    return { boards, posts, rails, balusters, caps }
  }, [])
  return <group name="timber-rooftop-deck" rotation={[0, -Math.PI / 4, 0]}>
    <mesh position={[0, -0.41, 0]} material={m.stone} receiveShadow><cylinderGeometry args={[12.1, 12.3, 0.65, 96]} /></mesh>
    <mesh position={[0, -0.76, 0]} material={m.slate} receiveShadow><cylinderGeometry args={[12.3, 13.2, 0.42, 24]} /></mesh>
    <mesh position={[0, -1.65, 0]} material={m.wood}><cylinderGeometry args={[10.7, 9.6, 1.5, 24]} /></mesh>
    <BoxInstances items={boards} material={m.deck} />
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.wood} receiveShadow><ringGeometry args={[11.7, 12.15, 96]} /></mesh>
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.brass}><ringGeometry args={[11.69, 11.72, 96]} /></mesh>
    <BoxInstances items={posts} material={m.wood} />
    <BoxInstances items={rails} material={m.wood} />
    <BoxInstances items={balusters} material={m.iron} />
    <BoxInstances items={caps} material={m.brass} shadows={false} />
    {[-2.8, -1.55, -0.3, 0.85, 2.1].map(a => <group key={a} position={[Math.sin(a) * 11.88, 1.33, Math.cos(a) * 11.88]}>
      <AssetLantern height={0.4} rotation={a} />
    </group>)}
  </group>
}

export function GardenPergola({ materials: m }: { materials: ObservatoryMaterials }) {
  const beams = useMemo(() => {
    const items: Instance[] = []
    for (const x of [-8.7, -4.6]) for (const z of [-1.1, 3.9]) items.push({ position: [x, 1.85, z], scale: [0.18, 3.7, 0.18] })
    for (const x of [-8.7, -4.6]) items.push({ position: [x, 3.65, 1.4], scale: [0.22, 0.28, 5.55] })

    return items
  }, [])
  const arches = useMemo(() => {
    const parts = [-1.1, 1.4, 3.9].map(z => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.7, 3.55, z), new THREE.Vector3(-8.3, 4.12, z),
      new THREE.Vector3(-6.65, 4.65, z), new THREE.Vector3(-5., 4.12, z), new THREE.Vector3(-4.6, 3.55, z)
    ]), 72, .068, 12, false))
    const result = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return result
  }, [])
  useEffect(() => () => arches.dispose(), [arches])
  return <group name="thought-bar-timber-pergola">
    <BoxInstances items={beams} material={m.wood} />
    <mesh geometry={arches} material={m.walnut} castShadow receiveShadow/>
    <BeamIvy position={[-6.65, 3.82, 3.9]} length={4.3} seed={207} drops={5} />
    <BeamIvy position={[-4.6, 3.78, 1.4]} rotation={[0, Math.PI / 2, 0]} length={5.1} seed={176} drops={4} />
    {[-8.7, -4.6].map(x => <group key={x}>
      <Rod from={[x, 2.8, -1.1]} to={[x, 3.6, -0.3]} radius={0.065} material={m.wood} />
      <Rod from={[x, 2.8, 3.9]} to={[x, 3.6, 3.1]} radius={0.065} material={m.wood} />
    </group>)}
    <Rod from={[-6.65, 3.6, 1.4]} to={[-6.65, 3.1, 1.4]} radius={.009} material={m.brass} />
    <AssetModel asset="chandelier" height={.6} position={[-6.65, 3.1, 1.4]} hangTop castShadow={false} />
    <pointLight position={[-6.65, 2.6, 1.4]} color="#ffbc66" intensity={11} distance={6} decay={2} />
  </group>
}

export function ObservationDesk({ materials: m }: { materials: ObservatoryMaterials }) {
  return <group name="astronomers-writing-desk" position={DESK_POSITION} rotation={[0, 0.26, 0]}>
    <mesh position={[0, 0.96, 0]} material={m.walnut} castShadow receiveShadow><boxGeometry args={[2.25, 0.12, 1.12]} /></mesh>
    {[-0.93, 0.93].flatMap(x => [-0.4, 0.4].map(z => <mesh key={`${x}:${z}`} position={[x, 0.46, z]} material={m.wood} castShadow><boxGeometry args={[0.1, 0.92, 0.1]} /></mesh>))}
    <mesh position={[0, 0.35, 0]} material={m.wood} castShadow><boxGeometry args={[1.95, 0.07, 0.08]} /></mesh>
    <AssetModel asset="notebook" maxDim={0.52} position={[-0.12, 1.025, 0.14]} rotation={[0, -0.2, 0]} />
    <AssetModel asset="compass" maxDim={0.32} position={[0.68, 1.025, 0.21]} rotation={[0, 0.15, 0]} />
    <AssetModel asset="binocular" maxDim={0.4} position={[0.1, 1.025, -0.28]} rotation={[0, 0.2, 0]} />
    <AssetBookStack count={3} seed={4} position={[-0.77, 1.025, 0.18]} scale={1.25} />
    <AssetLantern height={0.48} position={[-0.85, 1.025, -0.24]} />
    <pointLight position={[-0.85, 1.48, -0.24]} color="#ffc782" intensity={5} distance={5} decay={2} />
  </group>
}
