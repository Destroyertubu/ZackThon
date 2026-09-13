import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GARDEN_TREE_VINE_PATHS } from './gardenTreeShape'
import type { ObservatoryMaterials } from './materials'
import type { Point } from './Primitives'
import GardenHalos, { type HaloPoint } from './GardenHalos'

/** Two fine gold shoots follow connected bark routes on the mature tree's separate forks. */
export default function TreeJewelry({ materials, reducedMotion }: { materials: ObservatoryMaterials; reducedMotion: boolean }) {
  const resources = useMemo(() => {
    const branches: THREE.BufferGeometry[] = [], leafParts: THREE.BufferGeometry[] = [], halos: HaloPoint[] = []
    GARDEN_TREE_VINE_PATHS.forEach((route, strand) => {
      const points = route.map(p => new THREE.Vector3(...p))
      const path = new THREE.CurvePath<THREE.Vector3>()
      for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]))
      // Straight edge segments preserve the measured bark route through the fork;
      // a loose Catmull-Rom curve can overshoot into the gap between the trunks.
      branches.push(new THREE.TubeGeometry(path, Math.min(800, Math.max(200, points.length * 2)), .012, 6, false))
      for (let i = 1; i <= 9; i++) {
        const t = i / 11, point = path.getPointAt(t), tangent = path.getTangentAt(t)
        const leaf = new THREE.SphereGeometry(1, 10, 6)
        leaf.scale(.031, .11, .009)
        leaf.rotateZ(strand ? .6 : -.6)
        leaf.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize()))
        leaf.translate(point.x, point.y, point.z)
        leafParts.push(leaf)
        if (i % 2 === 1) halos.push({ position: point.toArray() as Point, radius: .27, color: '#ffc46f', star: true })
      }
    })
    const wire = mergeGeometries(branches)!, leaves = mergeGeometries(leafParts)!
    ;[...branches, ...leafParts].forEach(geometry => geometry.dispose())
    const gold = materials.brightBrass.clone(); gold.emissive.set('#ffb951'); gold.emissiveIntensity = .6
    return { wire, leaves, gold, halos }
  }, [materials.brightBrass])
  useEffect(() => () => { resources.wire.dispose(); resources.leaves.dispose(); resources.gold.dispose() }, [resources])
  return <group name="living-tree-golden-vines">
    <mesh geometry={resources.wire} material={resources.gold} />
    <mesh geometry={resources.leaves} material={resources.gold} />
    <GardenHalos points={resources.halos} reducedMotion={reducedMotion} />
  </group>
}
