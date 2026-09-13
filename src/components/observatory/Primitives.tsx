import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'

export type Point = [number, number, number]
export interface Instance { position: Point; scale: Point; rotation?: Point }

/** Repeated planks, balusters and graduations share one draw call each. */
export function BoxInstances({ items, material, shadows = true }: {
  items: Instance[]; material: THREE.Material; shadows?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current!
    const transform = new THREE.Object3D()
    items.forEach((item, i) => {
      transform.position.set(...item.position)
      transform.scale.set(...item.scale)
      transform.rotation.set(...(item.rotation ?? [0, 0, 0]))
      transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[undefined, material, items.length]} castShadow={shadows} receiveShadow>
    <boxGeometry args={[1, 1, 1]} />
  </instancedMesh>
}

export function Rod({ from, to, radius, material }: { from: Point; to: Point; radius: number; material: THREE.Material }) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to)
  const direction = b.clone().sub(a)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={quaternion} material={material} castShadow>
    <cylinderGeometry args={[radius, radius, direction.length(), 12]} />
  </mesh>
}
