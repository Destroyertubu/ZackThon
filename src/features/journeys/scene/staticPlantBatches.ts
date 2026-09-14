import * as THREE from 'three'
import type { WorldPoint } from '../realmDefinitions'

export interface StaticPlantPlacement {
  position: WorldPoint
  yaw: number
  height: number
  maxRadius?: number
}

/** Instance complete plants: every branch and leaf receives the SAME root transform. */
export function staticPlantBatches(source: THREE.Group, placements: readonly StaticPlantPlacement[], name: string) {
  source.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(source, true)
  const nativeHeight = bounds.max.y - bounds.min.y
  if (!(nativeHeight > 0)) throw new Error(`Plant ${name} has no physical height`)
  const nativeRadius = Math.max(...[bounds.min.x, bounds.max.x].flatMap(x =>
    [bounds.min.z, bounds.max.z].map(z => Math.hypot(x, z))))
  const root = new THREE.Group()
  root.name = name
  const batches: THREE.InstancedMesh[] = []
  const materials = new Map<THREE.Material, THREE.Material>()
  const rootTransform = new THREE.Object3D(), matrix = new THREE.Matrix4()
  function materialFor(original: THREE.Material) {
    const known = materials.get(original)
    if (known) return known
    const material = original.clone()
    if (material instanceof THREE.MeshStandardMaterial) {
      material.envMapIntensity = .55
      if (material.alphaTest > 0) {
        material.transparent = false
        material.depthWrite = true
        material.alphaToCoverage = true
      }
      for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
        if (texture) texture.anisotropy = 8
      }
    }
    materials.set(original, material)
    return material
  }
  source.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return
    const material = Array.isArray(node.material) ? node.material.map(materialFor) : materialFor(node.material)
    const batch = new THREE.InstancedMesh(node.geometry, material, placements.length)
    batch.name = `${name}-${node.name}`
    placements.forEach((placement, i) => {
      const scale = Math.min(placement.height / nativeHeight,
        placement.maxRadius === undefined ? Infinity : placement.maxRadius / nativeRadius)
      rootTransform.position.set(...placement.position)
      rootTransform.rotation.set(0, placement.yaw, 0)
      rootTransform.scale.setScalar(scale)
      rootTransform.updateMatrix()
      // Preserve imported hierarchy transforms. Applying only root placement to
      // mesh vertices would separate source leaves from their supporting branches.
      matrix.multiplyMatrices(rootTransform.matrix, node.matrixWorld)
      batch.setMatrixAt(i, matrix)
    })
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    batch.instanceMatrix.needsUpdate = true
    batch.castShadow = batch.receiveShadow = true
    batch.computeBoundingBox()
    batch.computeBoundingSphere()
    batches.push(batch)
    root.add(batch)
  })
  return { root, dispose() {
    batches.forEach(batch => batch.dispose())
    materials.forEach(material => material.dispose())
    // Geometry and textures belong to the loader cache and are shared on revisits.
  } }
}
