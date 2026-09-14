import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import MirrorSky from './MirrorSky'
import MirrorWater from './MirrorWater'
import CloudfallArchipelago from './CloudfallArchipelago'
import WaterfallLandings from './WaterfallSpray'
import { waterfallReach } from './waterfallLandings'
import { advanceAtmosphere, createTideSignal, type TideSignal } from './atmosphereMotion'
import type { QualityProfile } from '../../../state/gameStore'
import type { WaterShore } from './waterSurface'
import { MIRROR_ISLANDS, advanceMirrorTime, mergeMirrorGeometry, mirrorBoulderGeometry, mirrorBranchGeometry,
  mirrorCrownGeometry, mirrorIslandGeometry, mirrorMountainGeometry, mirrorRandom, type MirrorIsland, type MirrorMode } from './MirrorGeometry'

export type MirrorSeaBackdropProps = {
  mode: MirrorMode
  reducedMotion?: boolean
  compactTextures?: boolean
  waterLevel?: number
  skyTop?: string
  skyBottom?: string
  waterColor?: string
  sunColor?: string
  /** Only the cabin needs its own non-walkable shore below the balcony. */
  cabinShore?: boolean
  signal?: TideSignal
  quality?: QualityProfile
  sunPosition?: [number, number, number]
  shores?: readonly WaterShore[]
  character?: 'pool' | 'bay' | 'ocean'
}

const DEFAULT_SHORES: readonly WaterShore[] = MIRROR_ISLANDS.map(island => ({ center: [island.x, island.z], radii: [island.width, island.depth] }))

const MAPS = ['/textures/rock_face_diff_1k.jpg', '/textures/rock_face_nor_gl_1k.jpg', '/textures/rock_face_rough_1k.jpg',
  '/models/garden/details/ivy/ivy-color.jpg', '/models/garden/details/ivy/ivy-opacity.jpg']
// Corresponds, in the same semantic order, to journey-textures/url-mapping.json.
const COMPACT_MAPS = ['/models/garden/journey-textures/rock_face_diff_1k.webp', '/models/garden/journey-textures/rock_face_nor_gl_1k.webp',
  '/models/garden/journey-textures/rock_face_rough_1k.webp', '/models/garden/journey-textures/ivy-color.webp', '/models/garden/journey-textures/ivy-opacity.webp']

function setAtmosphere(material: THREE.MeshStandardMaterial, mode: MirrorMode, stone = false) {
  material.fog = false
  material.onBeforeCompile = (shader) => {
    shader.uniforms.mirrorHaze = { value: new THREE.Color(mode === 'night' ? '#526886' : '#8c94b3') }
    shader.vertexShader = 'varying float mirrorDistance;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nmirrorDistance=length(mvPosition.xyz);')
    shader.fragmentShader = 'uniform vec3 mirrorHaze;varying float mirrorDistance;\n' + shader.fragmentShader
    if (stone) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 mineral=texture2D(map,vMapUv);
        float mineralValue=dot(mineral.rgb,vec3(.2126,.7152,.0722));
        float pearl=.22+pow(max(mineralValue,0.),.7)*.75;
        diffuseColor*=vec4(mix(vec3(pearl),mineral.rgb,.055),mineral.a);
      #endif`)
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight=mix(outgoingLight,mirrorHaze,smoothstep(60.,200.,mirrorDistance)*.68);\n#include <opaque_fragment>')
  }
  material.customProgramCacheKey = () => `mirror-atmosphere-${mode}-${stone ? 'mineral' : 'plant'}-1`
}

function makeInstances(geometry: THREE.BufferGeometry, material: THREE.Material, count: number) {
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.castShadow = false; mesh.receiveShadow = false
  return mesh
}
function finishInstances(mesh: THREE.InstancedMesh) {
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}

function waterfallGeometry(islands: readonly MirrorIsland[], waterLevel: number) {
  const parts: THREE.BufferGeometry[] = []
  for (const island of islands.filter((_, i) => i % 2 === 0)) {
    const toward = Math.atan2(-island.z, -island.x)
    for (let channel = 0; channel < 2; channel++) {
      const a = toward + (channel - .5) * .17
      const reach = waterfallReach(island, a)
      const h = island.height * .64, topX = island.x + Math.cos(a) * island.width * .67, topZ = island.z + Math.sin(a) * island.depth * .67
      const g = new THREE.PlaneGeometry(channel ? .8 : 1.55, h, 3, 14)
      const position = g.attributes.position
      for (let i = 0; i < position.count; i++) {
        const t = (position.getY(i) + h / 2) / h
        const widening = 1.35 - t * .35
        position.setX(i, position.getX(i) * widening)
        position.setZ(i, Math.sin((1 - t) * Math.PI / 2) * reach)
      }
      g.rotateY(Math.PI / 2 - a); g.translate(topX, waterLevel + h / 2 + .075, topZ)
      parts.push(g)
    }
  }
  return mergeMirrorGeometry(parts)
}

function useMirrorLandscape(mode: MirrorMode, waterLevel: number, cabinShore: boolean, compactTextures: boolean) {
  const urls = compactTextures ? COMPACT_MAPS : MAPS
  const sources = useTexture(urls)
  return useMemo(() => {
    const textures = sources.map((source, index) => {
      const texture = source.clone(); texture.colorSpace = index === 0 || index === 3 ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.anisotropy = 4
      if (index < 3) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.needsUpdate = true; return texture
    })
    const [stoneMap, stoneNormal, stoneRoughness, leafMap, leafAlpha] = textures
    const rock = new THREE.MeshStandardMaterial({ map: stoneMap, normalMap: stoneNormal, roughnessMap: stoneRoughness,
      color: mode === 'night' ? '#a5b7c2' : '#e8e9dd', vertexColors: true, normalScale: new THREE.Vector2(.65, .65), roughness: .88, envMapIntensity: .5, emissive: mode === 'night' ? '#7d879b' : '#000000', emissiveIntensity: mode === 'night' ? .09 : 0 })
    setAtmosphere(rock, mode, true)
    const boulder = rock.clone(); boulder.vertexColors = false; setAtmosphere(boulder, mode, true)
    const bark = new THREE.MeshStandardMaterial({ map: stoneMap, color: '#554b44', roughness: .94, envMapIntensity: .2 }); setAtmosphere(bark, mode)
    const foliage = new THREE.MeshStandardMaterial({ map: leafMap, alphaMap: leafAlpha, color: '#c5ccbb', roughness: .9,
      alphaTest: .44, side: THREE.DoubleSide, envMapIntensity: .3 }); setAtmosphere(foliage, mode)
    const flower = new THREE.MeshStandardMaterial({ map: leafMap, alphaMap: leafAlpha, color: '#ecc7f3', roughness: .78,
      alphaTest: .44, side: THREE.DoubleSide, envMapIntensity: .4, emissive: '#9275aa', emissiveIntensity: .035 }); setAtmosphere(flower, mode, true)
    const mountainIslands: MirrorIsland[] = Array.from({ length: 16 }, (_, i) => {
      const a = i * Math.PI * 2 / 16 + .17, r = 158 + Math.sin(i * 7) * 12
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, width: 31 + i % 3 * 4, depth: 23 + i % 2 * 4, height: 13 + (i * 7 % 12), seed: i * 11 + 90 }
    })
    const islands = mergeMirrorGeometry(MIRROR_ISLANDS.map((island) => mirrorIslandGeometry(island, waterLevel)))
    const mountains = mergeMirrorGeometry(mountainIslands.map((island) => mirrorMountainGeometry(island, waterLevel)))
    const stoneGeometry = mirrorBoulderGeometry(), branchGeometry = mirrorBranchGeometry(), crownGeometry = mirrorCrownGeometry()
    const stoneCount = MIRROR_ISLANDS.length * 24 + (cabinShore ? 44 : 0)
    const stones = makeInstances(stoneGeometry, boulder, stoneCount)
    const trees = makeInstances(branchGeometry, bark, MIRROR_ISLANDS.length * 7)
    const crowns = makeInstances(crownGeometry, foliage, MIRROR_ISLANDS.length * 7 * 4)
    const blossoms = makeInstances(crownGeometry, flower, MIRROR_ISLANDS.length * 7 * 4)
    const random = mirrorRandom(98127), transform = new THREE.Object3D(), tint = new THREE.Color()
    let rockIndex = 0, treeIndex = 0, crownIndex = 0, flowerIndex = 0
    for (const island of MIRROR_ISLANDS) {
      for (let j = 0; j < 24; j++) {
        const a = j / 24 * Math.PI * 2 + random() * .09, r = .79 + random() * .25
        const size = .8 + random() * 2
        transform.position.set(island.x + Math.cos(a) * island.width * r, waterLevel + .35 + random() * .45, island.z + Math.sin(a) * island.depth * r)
        transform.rotation.set(random() * .5, a, random() * .4); transform.scale.set(size * 1.6, size, size); transform.updateMatrix()
        stones.setMatrixAt(rockIndex++, transform.matrix)
      }
      for (let tree = 0; tree < 7; tree++) {
        const a = random() * Math.PI * 2, r = .15 + random() * .3, scale = .88 + random() * .55
        const x = island.x + Math.cos(a) * island.width * r, z = island.z + Math.sin(a) * island.depth * r
        const y = waterLevel + .18 + island.height * (.99 - r * .25)
        transform.position.set(x, y, z); transform.rotation.set(0, a, 0); transform.scale.setScalar(scale); transform.updateMatrix(); trees.setMatrixAt(treeIndex++, transform.matrix)
        for (let branch = 0; branch < 8; branch++) {
          const angle = branch * 2.39996 + a, radius = branch ? 1.4 : .15
          transform.position.set(x + Math.cos(angle) * radius * scale, y + (3 + branch % 3 * .32) * scale, z + Math.sin(angle) * radius * scale)
          transform.rotation.set(0, angle, (random() - .5) * .2); transform.scale.set(1.2 * scale, .9 * scale, 1.15 * scale); transform.updateMatrix()
          if (branch < 4) {
            crowns.setMatrixAt(crownIndex, transform.matrix); tint.set(branch % 2 ? '#617b61' : '#758866'); crowns.setColorAt(crownIndex++, tint)
          } else {
            blossoms.setMatrixAt(flowerIndex, transform.matrix); tint.set(tree % 3 ? '#c796db' : '#e2b2e9'); blossoms.setColorAt(flowerIndex++, tint)
          }
        }
      }
    }
    // Pearl shelves support the cabin without changing any walkable or collision surface.
    let shore: THREE.BufferGeometry | undefined
    if (cabinShore) {
      const ledge: MirrorIsland = { x: 0, z: -1, width: 13.2, depth: 13.8, height: 1.1, seed: 132 }
      shore = mirrorIslandGeometry(ledge, waterLevel - .1)
      for (let j = 0; j < 44; j++) {
        const a = j / 44 * Math.PI * 2, r = .91 + random() * .15, size = .4 + random() * .62
        transform.position.set(Math.cos(a) * 13.2 * r, waterLevel + .05, -1 + Math.sin(a) * 13.8 * r)
        transform.rotation.set(random() * .3, a, random() * .25); transform.scale.set(size * 1.8, size, size); transform.updateMatrix(); stones.setMatrixAt(rockIndex++, transform.matrix)
      }
    }
    for (const mesh of [stones, trees, crowns, blossoms]) finishInstances(mesh)
    const falls = waterfallGeometry(MIRROR_ISLANDS, waterLevel)
    const waterfall = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(mode === 'night' ? '#80a3b7' : '#cbe6df') } },
      transparent: true, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false, fog: false,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time;uniform vec3 tint;varying vec2 vUv;
        void main(){float edge=smoothstep(0.,.18,vUv.x)*(1.-smoothstep(.82,1.,vUv.x));
          float strand=.5+.5*sin(vUv.x*39.+sin(vUv.y*6.-time*.5)*.6);
          float falling=.5+.5*sin(vUv.y*29.+time*1.1+vUv.x*12.);
          gl_FragColor=vec4(tint,edge*(.28+strand*.25+falling*.09));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    return { textures, bark, foliage, flower, materials: [rock, boulder, bark, foliage, flower, waterfall],
      geometries: [islands, mountains, stoneGeometry, branchGeometry, crownGeometry, falls, ...(shore ? [shore] : [])],
      instances: [stones, trees, crowns, blossoms], rock, islands, mountains, shore, stones, trees, crowns, blossoms, falls, waterfall }
  }, [sources, mode, waterLevel, cabinShore])
}

/** Canvas-free shared world scenery. No lights, navigation or global environment mutation. */
export default function MirrorSeaBackdrop({ mode, reducedMotion = false, compactTextures = false, waterLevel = -1.1, skyTop, skyBottom, waterColor, sunColor, cabinShore = false, signal: externalSignal, quality, sunPosition, shores, character }: MirrorSeaBackdropProps) {
  const localSignal = useMemo(() => createTideSignal(), [])
  const signal = externalSignal ?? localSignal
  const resources = useMirrorLandscape(mode, waterLevel, cabinShore, compactTextures)
  const coastlines = useMemo<readonly WaterShore[]>(() => [...DEFAULT_SHORES, ...(cabinShore ? [{ center: [0, -1] as const, radii: [13.2, 13.8] as const }] : []), ...(shores ?? [])], [cabinShore, shores])
  useEffect(() => () => {
    resources.instances.forEach((mesh) => mesh.dispose()); resources.geometries.forEach((geometry) => geometry.dispose())
    resources.materials.forEach((material) => material.dispose()); resources.textures.forEach((texture) => texture.dispose())
  }, [resources])
  useFrame((_, delta) => { advanceAtmosphere(signal, delta, reducedMotion); if (!reducedMotion) advanceMirrorTime(resources.waterfall.uniforms.time, delta) })
  return <group name={`mirror-sea-world-${mode}`}>
    <MirrorSky signal={signal} mode={mode} compactTextures={compactTextures} skyTop={skyTop} skyBottom={skyBottom} sunColor={sunColor} sunPosition={sunPosition} />
    <group name="mirror-sea-distant-landscape" dispose={null}>
      <mesh name="pearl-island-shores" geometry={resources.islands} material={resources.rock} />
      <mesh name="violet-mountain-islands" geometry={resources.mountains} material={resources.rock} />
      {resources.shore && <mesh name="cabin-pearl-rock-foundation" geometry={resources.shore} material={resources.rock} receiveShadow />}
      <primitive object={resources.stones} /><primitive object={resources.trees} /><primitive object={resources.crowns} /><primitive object={resources.blossoms} />
      <mesh name="island-cascades" geometry={resources.falls} material={resources.waterfall} renderOrder={6} />
    </group>
    <CloudfallArchipelago signal={signal} rock={resources.rock} bark={resources.bark} foliage={resources.foliage} flower={resources.flower} night={mode === 'night'}/>
    <WaterfallLandings signal={signal} waterLevel={waterLevel} night={mode === 'night'} />
    <MirrorWater signal={signal} mode={mode} reducedMotion={reducedMotion} waterLevel={waterLevel} skyTop={skyTop} skyBottom={skyBottom} waterColor={waterColor} sunColor={sunColor} quality={quality} sunPosition={sunPosition} shores={coastlines} character={character} />
  </group>
}
