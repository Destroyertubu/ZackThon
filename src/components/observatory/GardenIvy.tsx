import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { RETURN_GATE_POSITION } from './layout'
import { makeGardenIvy, makeIvyLeaf } from './gardenIvyGeometry'

const BASE = '/models/garden/details/ivy/'

/** Curved physical leaves use ambientCG's photographed CC0 ivy, not silhouettes. */
export function GardenIvy() {
  const textures = useTexture([BASE + 'ivy-color.jpg', BASE + 'ivy-opacity.jpg', BASE + 'ivy-normal.jpg'])
  const batch = useRef<THREE.Group>(null)
  const resources = useMemo(() => {
    const [map, alphaMap, normalMap] = textures.map(texture => texture.clone())
    map.colorSpace = THREE.SRGBColorSpace
    for (const texture of [map, alphaMap, normalMap]) { texture.anisotropy = 8; texture.needsUpdate = true }
    const leaf = new THREE.MeshStandardMaterial({ map, alphaMap, normalMap, color: '#59734f',
      alphaTest: .48, side: THREE.DoubleSide, roughness: .95, metalness: 0,
      normalScale: new THREE.Vector2(.42, .42), envMapIntensity: .28 })
    const wood = new THREE.MeshStandardMaterial({ color: '#3f4126', roughness: .96, envMapIntensity: .3 })
    return { ...makeGardenIvy(RETURN_GATE_POSITION), cards: Array.from({ length: 6 }, (_, index) => makeIvyLeaf(index)),
      leaf, wood, textures: [map, alphaMap, normalMap] }
  }, [textures])
  useLayoutEffect(() => {
    const transform = new THREE.Object3D()
    batch.current?.children.forEach((child, variant) => {
      if (!(child instanceof THREE.InstancedMesh)) return
      resources.leaves[variant].forEach((leaf, index) => {
        transform.position.copy(leaf.position); transform.rotation.copy(leaf.rotation)
        transform.scale.setScalar(leaf.size); transform.updateMatrix()
        child.setMatrixAt(index, transform.matrix); child.setColorAt(index, leaf.color)
      })
      child.instanceMatrix.needsUpdate = true
      if (child.instanceColor) child.instanceColor.needsUpdate = true
      child.computeBoundingSphere()
    })
  }, [resources])
  useEffect(() => () => {
    resources.branches.dispose(); resources.cards.forEach(card => card.dispose())
    resources.leaf.dispose(); resources.wood.dispose(); resources.textures.forEach(texture => texture.dispose())
  }, [resources])
  return <group name="photographed-ivy-on-timber" userData={{ leafCount: resources.leafCount, triangles: resources.triangles }}>
    <mesh geometry={resources.branches} material={resources.wood} receiveShadow />
    <group ref={batch}>
      {resources.cards.map((card, variant) => <instancedMesh key={variant} args={[card, resources.leaf, resources.leaves[variant].length]} receiveShadow />)}
    </group>
  </group>
}
