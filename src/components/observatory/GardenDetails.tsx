import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { AssetModel } from '../scene/Assets'
import { pbrMaps, SETS } from '../scene/pbr'
import type { Point } from './Primitives'
import { TREE_POSITION } from './layout'
import { GardenIvy } from './GardenIvy'
import { READING_CHAIR_ROTATION, READING_CORNER_POSITION } from './gardenDetailLayout'

const ROCK_URL = '/models/garden/details/moss-rocks.glb'
const PLANT_URL = '/models/garden/details/periwinkle.glb'
const LANTERN_URL = '/models/garden/details/brass-lantern.glb'

type DetailInstance = { position: Point; size: number; rotation?: Point; stretch?: Point }
type DetailPart = { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }

function tintPlant(material: THREE.Material): THREE.Material {
  const clone = material.clone() as THREE.MeshStandardMaterial
  clone.side = THREE.DoubleSide; clone.transparent = false; clone.alphaTest = .3
  clone.metalness = 0; clone.roughness = .94; clone.roughnessMap = null
  clone.envMapIntensity = .32; clone.normalScale.set(.35, .35)
  // Preserve the photographed veins and pale flower centres. Only the pink
  // petal pixels shift towards blue-violet; foliage retains its botanical green.
  clone.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float petalMask = smoothstep(.035, .13, diffuseColor.r - diffuseColor.g)
        * smoothstep(.01, .09, diffuseColor.b - diffuseColor.g);
      vec3 bluePetal = diffuseColor.rgb * vec3(.58, .84, 1.38);
      vec3 shadedLeaf = diffuseColor.rgb * vec3(.80, .91, .85);
      diffuseColor.rgb = mix(shadedLeaf, bluePetal, petalMask);
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(.10, .20, .62) * petalMask;
    `)
  }
  clone.customProgramCacheKey = () => 'garden-cc0-periwinkle-blue-v2'
  return clone
}

/** Each variation is one instance batch, with geometry and textures shared. */
function DetailInstances({ url, node, instances, plant = false, measure = 'height' }: {
  url: string; node: string; instances: DetailInstance[]; plant?: boolean; measure?: 'height' | 'width'
}) {
  const { nodes } = useGLTF(url)
  const ref = useRef<THREE.Group>(null)
  const parts = useMemo(() => {
    const source = nodes[node]
    source.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(source)
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3())
    const unit = measure === 'height' ? size.y : Math.max(size.x, size.z)
    const offset = new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z)
    const output: DetailPart[] = []
    source.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld).applyMatrix4(offset)
      geometry.scale(1 / unit, 1 / unit, 1 / unit)
      const patch = (material: THREE.Material) => {
        if (plant) return tintPlant(material)
        const clone = material.clone() as THREE.MeshStandardMaterial
        clone.roughness = .93; clone.envMapIntensity = .4
        return clone
      }
      output.push({ geometry, material: Array.isArray(child.material) ? child.material.map(patch) : patch(child.material) })
    })
    return output
  }, [nodes, node, plant, measure])
  useLayoutEffect(() => {
    const transform = new THREE.Object3D()
    ref.current?.traverse(child => {
      if (!(child instanceof THREE.InstancedMesh)) return
      instances.forEach((item, index) => {
        transform.position.set(...item.position)
        transform.rotation.set(...(item.rotation ?? [0, 0, 0]))
        transform.scale.set(...(item.stretch ?? [1, 1, 1])).multiplyScalar(item.size)
        transform.updateMatrix(); child.setMatrixAt(index, transform.matrix)
      })
      child.instanceMatrix.needsUpdate = true; child.computeBoundingSphere()
    })
  }, [instances, parts])
  useEffect(() => () => parts.forEach(part => {
    part.geometry.dispose()
    ;(Array.isArray(part.material) ? part.material : [part.material]).forEach(material => material.dispose())
  }), [parts])
  return <group ref={ref} name={node}>
    {parts.map((part, index) => <instancedMesh key={index} args={[part.geometry, part.material, instances.length]} castShadow={!plant} receiveShadow />)}
  </group>
}

function makeRockBeds(): DetailInstance[][] {
  const groups: DetailInstance[][] = [[], [], []]
  // Uneven shelves of scanned moss stone expose roots and leave planting gaps.
  for (let index = 0; index < 9; index++) {
    const angle = index * 2.399963
    const radius = index < 3 ? .89 : 1.59
    groups[index % 3].push({
      position: [TREE_POSITION[0] + Math.cos(angle) * radius, .32 + (index < 3 ? .035 : 0), TREE_POSITION[2] + Math.sin(angle) * radius],
      size: index < 3 ? .92 : .62 + (index % 3) * .11,
      rotation: [0, angle + .47, 0], stretch: [1, .8 + (index % 2) * .12, 1],
    })
  }
  groups[0].push({ position: [-5.15, .30, 5.45], size: .7, rotation: [0, .65, 0] })
  groups[1].push({ position: [-.25, .30, 5.3], size: .54, rotation: [0, 1.1, 0] })
  groups[2].push({ position: [8.65, .30, 4.55], size: .48, rotation: [0, -1.2, 0] })
  return groups
}

function makeFlowers(): DetailInstance[] {
  const flowers: DetailInstance[] = []
  for (let index = 0; index < 10; index++) {
    const angle = index * 2.399963 + .32, radius = 1.40 + (index % 3) * .09
    flowers.push({ position: [TREE_POSITION[0] + Math.cos(angle) * radius, .36, TREE_POSITION[2] + Math.sin(angle) * radius],
      size: .85 + (index % 4) * .05, rotation: [0, index * 1.17, (index % 2 ? 1 : -1) * .09] })
  }
  for (const [index, position] of ([[-5.28, .35, 5.88], [-4.53, .36, 5.74], [-4.7, .35, 5.12],
    [.26, .35, 5.65], [-.35, .35, 5.75], [8.95, .35, 4.61]] as Point[]).entries()) {
    flowers.push({ position, size: .62 + (index % 3) * .07, rotation: [0, index * 1.43, .1] })
  }
  return flowers
}

function makeRugBraids() {
  const geometries: THREE.BufferGeometry[] = []
  for (let index = 0; index < 9; index++) {
    const ring = new THREE.TorusGeometry(.35 + index * .083, .0105, 4, 96)
    ring.rotateX(-Math.PI / 2); ring.scale(1.13, 1, .89); ring.translate(0, .012, 0)
    geometries.push(ring)
  }
  for (let index = 0; index < 72; index++) {
    const angle = index / 72 * Math.PI * 2
    const fringe = new THREE.PlaneGeometry(.012, .10)
    fringe.rotateX(-Math.PI / 2); fringe.rotateY(-angle)
    fringe.translate(Math.sin(angle) * 1.15, .002, Math.cos(angle) * .91)
    geometries.push(fringe)
  }
  const merged = mergeGeometries(geometries, false)!
  geometries.forEach(geometry => geometry.dispose())
  return merged
}

function ReadingRug() {
  const resources = useMemo(() => {
    const maps = pbrMaps(SETS.fabric, 10, 10)
    const fabric = new THREE.MeshStandardMaterial({ ...maps, color: '#8b7860', roughness: 1,
      normalScale: new THREE.Vector2(.35, .35), side: THREE.DoubleSide, envMapIntensity: .25 })
    const braid = fabric.clone(); braid.color.set('#b39a70')
    return { maps, fabric, braid, geometry: makeRugBraids() }
  }, [])
  useEffect(() => () => {
    resources.geometry.dispose(); resources.fabric.dispose(); resources.braid.dispose()
    Object.values(resources.maps).forEach(texture => texture.dispose())
  }, [resources])
  return <group name="garden-reading-corner" position={READING_CORNER_POSITION}>
    <group position={[.17, .022, .1]} rotation={[0, -.4, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.13, .89, 1]} material={resources.fabric} receiveShadow>
        <circleGeometry args={[1.03, 96]} />
      </mesh>
      <mesh geometry={resources.geometry} material={resources.braid} receiveShadow />
    </group>
    <AssetModel asset="armchair" height={1.10} position={[0, .025, 0]} rotation={[0, READING_CHAIR_ROTATION, 0]} />
  </group>
}

/** CC0 stone shelves, blue flowers, hanging foliage, and one quiet reading seat. */
export function GardenDetails() {
  const rocks = useMemo(() => makeRockBeds(), [])
  const flowers = useMemo(() => makeFlowers(), [])
  return <group name="garden-reference-details">
    {rocks.map((instances, index) => <DetailInstances key={index} url={ROCK_URL} node={`moss_rock_${index + 1}`} instances={instances} measure="width" />)}
    <DetailInstances url={PLANT_URL} node="periwinkle_flower_clump" instances={flowers} plant />
    <GardenIvy />
    <ReadingRug />
  </group>
}

/** Optional replacement for old small lanterns. Height includes its carrying loop;
 * chain suspension is deliberately omitted, so it also rests naturally on stone.
 * At most 8 instances fit the documented <200k additional scene budget.
 */
export function DetailedGardenLantern({ position = [0, 0, 0], rotation = 0, height = .47, lightIntensity = .65 }: {
  position?: Point; rotation?: number; height?: number; lightIntensity?: number
}) {
  const { scene } = useGLTF(LANTERN_URL)
  const asset = useMemo(() => {
    const object = scene.clone(true), materials: THREE.Material[] = []
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true; child.receiveShadow = true
      const patch = (source: THREE.Material) => {
        const material = source.clone() as THREE.MeshStandardMaterial
        material.envMapIntensity = .6; material.roughness = .58
        if (/glass/i.test(material.name)) {
          material.transparent = true; material.opacity = .3; material.depthWrite = false
          material.metalness = 0; material.roughness = .16; material.envMapIntensity = .3
        } else if (/flame/i.test(material.name)) {
          material.transparent = true; material.alphaTest = .08; material.depthWrite = false
          material.emissive.set('#ffb45c'); material.emissiveIntensity = 1.5
          material.emissiveMap = material.map; material.toneMapped = true
        }
        materials.push(material); return material
      }
      child.material = Array.isArray(child.material) ? child.material.map(patch) : patch(child.material)
    })
    const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3())
    return { object, materials, scale: 1 / size.y }
  }, [scene])
  useEffect(() => () => asset.materials.forEach(material => material.dispose()), [asset])
  return <group name="cc0-star-vent-brass-lantern" position={position} rotation={[0, rotation, 0]}>
    <primitive object={asset.object} scale={height * asset.scale} dispose={null} />
    {lightIntensity > 0 && <pointLight position={[0, height * .42, 0]} color="#ffd095" intensity={lightIntensity} distance={2.25} decay={2} />}
  </group>
}

useGLTF.preload(ROCK_URL)
useGLTF.preload(PLANT_URL)
useGLTF.preload(LANTERN_URL)
