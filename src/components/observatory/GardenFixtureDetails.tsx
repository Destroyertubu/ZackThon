import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Point } from './Primitives'

/** The original CC0 scans are normalized once, without changing the cached GLTF. */
export function FixtureScan({ asset, height, position = [0, 0, 0], rotation = 0 }: {
  asset: 'bar-stool' | 'brass-goblet'; height: number; position?: Point; rotation?: number
}) {
  const { scene } = useGLTF(`/models/garden-fixtures/${asset}.glb`)
  const owned = useMemo(() => {
    const object = scene.clone(true), materials: THREE.Material[] = []
    object.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return
      const copy = (material: THREE.Material) => {
        const result = material.clone() as THREE.MeshStandardMaterial
        result.envMapIntensity = asset === 'bar-stool' ? 0.45 : 0.65
        if (asset === 'bar-stool') result.color.multiply(new THREE.Color('#b99b78'))
        materials.push(result); return result
      }
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material)
      node.castShadow = asset === 'bar-stool'; node.receiveShadow = true
    })
    const box = new THREE.Box3().setFromObject(object), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
    object.position.set(-center.x, -box.min.y, -center.z)
    return { object, materials, scale: height / size.y }
  }, [scene, asset, height])
  useEffect(() => () => owned.materials.forEach(material => material.dispose()), [owned])
  return <group position={position} rotation={[0, rotation, 0]} scale={owned.scale}><primitive object={owned.object} dispose={null} /></group>
}

useGLTF.preload('/models/garden-fixtures/bar-stool.glb')
useGLTF.preload('/models/garden-fixtures/brass-goblet.glb')
