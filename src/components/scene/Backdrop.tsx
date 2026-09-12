import { useEffect, useMemo } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

const PANORAMA = '/scenery/kiara-valley-4k.jpg'
const FOLIAGE = '/models/potted_plant_02/potted_plant_02_1k.gltf'
const ROCK_MAPS = [
  '/textures/rock_face_diff_1k.jpg',
  '/textures/rock_face_nor_gl_1k.jpg',
  '/textures/rock_face_rough_1k.jpg',
]

/** A deterministic landscape: re-entering the room never moves a rock or plant. */
function random(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 4294967296
  }
}

function landHeight(x: number, z: number) {
  const distance = Math.hypot(x, z)
  const relief = THREE.MathUtils.smoothstep(distance, 7, 21)
  // The cabin is built on a small ledge. The land falls away below the balcony;
  // everything directly in front of its railing stays below floor level.
  return -1.32
    - Math.max(0, distance - 7) * 0.16
    - Math.max(0, -z - 10) * 0.1
    + relief * (Math.sin(x * 0.31 + z * 0.17) * 0.74
      + Math.cos(z * 0.39 - x * 0.12) * 0.46
      + Math.sin(x * 0.94 + z * 0.73) * 0.13)
}

function terrainGeometry() {
  // Extends beyond the enclosing panorama in every horizontal direction, so
  // looking down over the rail cannot reveal a cut-off ground plane.
  const geometry = new THREE.PlaneGeometry(188, 188, 112, 112)
  geometry.rotateX(-Math.PI / 2)
  const positions = geometry.attributes.position
  const colors = new Float32Array(positions.count * 3)
  const stone = new THREE.Color('#9b9c86')
  const moss = new THREE.Color('#55603f')
  const color = new THREE.Color()
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    positions.setY(i, landHeight(x, z))
    const patch = Math.sin(x * 0.22 + z * 0.19) * Math.cos(z * 0.26 - x * 0.1)
    color.copy(stone).lerp(moss, THREE.MathUtils.smoothstep(patch, -0.12, 0.85) * 0.78)
    colors.set([color.r, color.g, color.b], i * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  // World-scale UVs keep the scanned surface at approximately 2.8 m per tile.
  const uvs = geometry.attributes.uv
  for (let i = 0; i < uvs.count; i++) {
    uvs.setXY(i, positions.getX(i) / 2.8, positions.getZ(i) / 2.8)
  }
  geometry.computeVertexNormals()
  return geometry
}

function boulderGeometry() {
  const geometry = new THREE.IcosahedronGeometry(1, 3)
  const positions = geometry.attributes.position
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const rough = 1 + Math.sin(x * 7.7 + z * 5.3) * 0.11
      + Math.cos(y * 8.1 - x * 2.8) * 0.075
    positions.setXYZ(i, x * rough, y * rough * 0.74, z * rough)
  }
  geometry.computeVertexNormals()
  return geometry
}

/** Small bent blades, batched as clumps; no per-frame foliage work. */
function grassGeometry() {
  const rng = random(9186)
  const vertices: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const root = new THREE.Color('#465438')
  const tip = new THREE.Color('#a69e62')
  for (let blade = 0; blade < 8; blade++) {
    const angle = rng() * Math.PI * 2
    const height = 0.22 + rng() * 0.38
    const width = 0.015 + rng() * 0.014
    const x = (rng() - 0.5) * 0.26
    const z = (rng() - 0.5) * 0.26
    const bend = 0.06 + rng() * 0.13
    const base = vertices.length / 3
    for (let level = 0; level <= 3; level++) {
      const t = level / 3
      const w = width * (1 - t * 0.96)
      const color = root.clone().lerp(tip, t * 0.8)
      for (const side of [-1, 1]) {
        vertices.push(
          x + Math.cos(angle) * w * side + Math.sin(angle) * bend * t * t,
          height * t,
          z + Math.sin(angle) * w * side + Math.cos(angle) * bend * t * t,
        )
        colors.push(color.r, color.g, color.b)
      }
      if (level < 3) {
        const start = base + level * 2
        indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function groundInstances(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
  kind: 'rock' | 'grass' | 'leaves',
) {
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  const rng = random(kind === 'rock' ? 3308 : kind === 'grass' ? 5169 : 214)
  const transform = new THREE.Object3D()
  const tint = new THREE.Color()
  for (let i = 0; i < count; i++) {
    let x: number
    let z: number
    if (kind === 'leaves') {
      // Detailed foliage stays beside the ledge, below the central sightline.
      x = (i % 2 === 0 ? -1 : 1) * (4.5 + rng() * 5)
      z = -7.5 - rng() * 10
    } else {
      const angle = rng() * Math.PI * 2
      const radius = 8.8 + rng() * (kind === 'grass' ? 28 : 33)
      x = Math.sin(angle) * radius
      z = Math.cos(angle) * radius
      // Keep the complete building footprint and balcony clear.
      if (Math.abs(x) < 6.8 && z > -9.4 && z < 6) {
        x = Math.sign(x || 1) * (7.2 + rng() * 4)
      }
    }
    const scale = kind === 'rock' ? 0.45 + rng() * 1.3
      : kind === 'grass' ? 0.75 + rng() * 1.15 : 0.9 + rng() * 0.9
    transform.position.set(x, landHeight(x, z) - (kind === 'rock' ? scale * 0.3 : 0.02), z)
    transform.rotation.set(kind === 'rock' ? rng() * 0.6 : 0, rng() * Math.PI * 2, kind === 'rock' ? rng() * 0.4 : 0)
    transform.scale.set(scale * (kind === 'rock' ? 1.2 : 1), scale, scale)
    transform.updateMatrix()
    mesh.setMatrixAt(i, transform.matrix)
    const lightness = 0.78 + rng() * 0.2
    tint.setRGB(lightness, lightness, lightness * (kind === 'grass' ? 0.92 : 1))
    mesh.setColorAt(i, tint)
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.receiveShadow = true
  // These objects are outside the main room's shadow frustum. Keeping them
  // out of the shadow pass also keeps the 4K interior shadow map affordable.
  mesh.castShadow = false
  return mesh
}

/**
 * A photographed 360° mountain valley with a real foreground ledge.
 * The panorama is CC0, locally served, and never relies on a remote image URL.
 * Source and transformation details: public/scenery/README.md.
 */
export default function Backdrop() {
  const [panoramaSource, rockColorSource, rockNormalSource, rockRoughnessSource] = useTexture([PANORAMA, ...ROCK_MAPS])
  const { nodes } = useGLTF(FOLIAGE)
  const leafSource = nodes.potted_plant_02_leaves as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

  const resources = useMemo(() => {
    const panorama = panoramaSource.clone()
    panorama.colorSpace = THREE.SRGBColorSpace
    panorama.wrapS = THREE.RepeatWrapping
    panorama.anisotropy = 4
    panorama.needsUpdate = true
    const skyGeometry = new THREE.SphereGeometry(84, 72, 36)
    const skyMaterial = new THREE.MeshBasicMaterial({
      map: panorama, side: THREE.BackSide, toneMapped: false, fog: false,
    })
    const rockColor = rockColorSource.clone()
    const rockNormal = rockNormalSource.clone()
    const rockRoughness = rockRoughnessSource.clone()
    rockColor.colorSpace = THREE.SRGBColorSpace
    rockNormal.colorSpace = rockRoughness.colorSpace = THREE.NoColorSpace
    for (const texture of [rockColor, rockNormal, rockRoughness]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 4
      texture.needsUpdate = true
    }

    const rockMaterial = new THREE.MeshStandardMaterial({
      map: rockColor, normalMap: rockNormal, roughnessMap: rockRoughness,
      color: '#aa9b7b', roughness: 1, normalScale: new THREE.Vector2(0.65, 0.65),
      envMapIntensity: 0.6,
    })
    const groundMaterial = rockMaterial.clone()
    groundMaterial.vertexColors = true
    groundMaterial.color.set('#b9ad8e')
    const grassMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0.35,
    })
    const leafMaterial = leafSource.material.clone()
    leafMaterial.color.set('#8c9c69')
    leafMaterial.roughness = 1
    leafMaterial.envMapIntensity = 0.4
    // Poly Haven foliage uses an RGBA cutout map. Alpha testing preserves
    // crisp leaf silhouettes without transparent sorting artefacts.
    leafMaterial.transparent = false
    leafMaterial.alphaTest = 0.35
    leafMaterial.depthWrite = true
    leafMaterial.side = THREE.DoubleSide
    const leafGeometry = leafSource.geometry.clone()
    // Only the real leaf mesh is reused, without its indoor pot or soil.
    leafGeometry.translate(0, 0.1, 0)
    const land = terrainGeometry()
    const boulder = boulderGeometry()
    const grass = grassGeometry()
    return {
      panorama,
      textures: [panorama, rockColor, rockNormal, rockRoughness],
      materials: [skyMaterial, rockMaterial, groundMaterial, grassMaterial, leafMaterial],
      geometries: [skyGeometry, land, boulder, grass, leafGeometry],
      skyGeometry,
      skyMaterial,
      land,
      groundMaterial,
      rocks: groundInstances(boulder, rockMaterial, 38, 'rock'),
      grasses: groundInstances(grass, grassMaterial, 850, 'grass'),
      leaves: groundInstances(leafGeometry, leafMaterial, 18, 'leaves'),
    }
  }, [panoramaSource, rockColorSource, rockNormalSource, rockRoughnessSource, leafSource])

  useEffect(() => () => {
    resources.rocks.dispose()
    resources.grasses.dispose()
    resources.leaves.dispose()
    resources.geometries.forEach((geometry) => geometry.dispose())
    resources.materials.forEach((material) => material.dispose())
    resources.textures.forEach((texture) => texture.dispose())
  }, [resources])

  return (
    <group name="mountain-valley" dispose={null}>
      {/* Align the photographed sun with the golden window light's azimuth.
          A complete sphere gives a view at every balcony edge and camera angle. */}
      <mesh
        position={[0, 1.1, -2]}
        rotation={[0, 0.53, 0]}
        geometry={resources.skyGeometry}
        material={resources.skyMaterial}
        renderOrder={-10}
      />
      <mesh name="hillside" geometry={resources.land} material={resources.groundMaterial} receiveShadow />
      <primitive object={resources.rocks} />
      <primitive object={resources.grasses} />
      <primitive object={resources.leaves} />
    </group>
  )
}
