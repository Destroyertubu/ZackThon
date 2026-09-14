import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { TideSignal } from '@/features/journeys/scene/atmosphereMotion'
import type { ObservatoryMaterials } from './materials'
import { createGardenPerimeter, perimeterLeafGeometry, type PerimeterPlant } from './gardenPerimeterGeometry'
import { makeIvyLeaf } from './gardenIvyGeometry'

type Props = { materials: ObservatoryMaterials; signal: TideSignal; reducedMotion: boolean; detail?: 'fine' | 'smooth' }

function instancePlants(geometry: THREE.BufferGeometry, material: THREE.Material, plants: PerimeterPlant[]) {
  const mesh = new THREE.InstancedMesh(geometry, material, plants.length)
  plants.forEach((plant, i) => { mesh.setMatrixAt(i, plant.matrix); mesh.setColorAt(i, plant.color) })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere(); mesh.receiveShadow = true
  return mesh
}

/** Small motion in world metres, irrespective of the leaf's instance scale. */
function bindBotanicalWind(material: THREE.MeshStandardMaterial, signal: TideSignal, still: boolean, amplitude: number) {
  material.onBeforeCompile = shader => {
    shader.uniforms.gardenTime = signal.time
    shader.vertexShader = 'uniform float gardenTime;\n' + shader.vertexShader.replace('#include <project_vertex>', `
      vec4 gardenWindPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        gardenWindPosition = instanceMatrix * gardenWindPosition;
      #endif
      gardenWindPosition = modelMatrix * gardenWindPosition;
      float gardenWindWeight = smoothstep(.53, 1.4, gardenWindPosition.y);
      float gardenBreeze = sin(gardenTime*.72 + gardenWindPosition.z*.9 + gardenWindPosition.y*1.1);
      gardenWindPosition.x += gardenBreeze * ${still ? '0.0' : amplitude.toFixed(4)} * gardenWindWeight;
      gardenWindPosition.z += cos(gardenTime*.51 + gardenWindPosition.x) * ${still ? '0.0' : (amplitude * .61).toFixed(4)} * gardenWindWeight;
      vec4 mvPosition = viewMatrix * gardenWindPosition;
      gl_Position = projectionMatrix * mvPosition;
    `)
    // A small backlighting term reveals leaf thickness at the moon-facing edge.
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      reflectedLight.indirectDiffuse += diffuseColor.rgb * .045 * pow(1.0 - abs(normal.z), 2.0);
    `)
  }
  material.customProgramCacheKey = () => `courtyard-botany-v1-${still}-${amplitude}`
}

function lanternBody() {
  const pieces: THREE.BufferGeometry[] = []
  const top = new THREE.ConeGeometry(.14, .09, 12); top.translate(0, -.04, 0); pieces.push(top)
  const base = new THREE.CylinderGeometry(.12, .095, .035, 12); base.translate(0, -.40, 0); pieces.push(base)
  for (const y of [-.09, -.37]) { const rim = new THREE.TorusGeometry(.105, .009, 4, 16); rim.rotateX(Math.PI / 2); rim.translate(0, y, 0); pieces.push(rim) }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, bar = new THREE.CylinderGeometry(.007, .007, .3, 5); bar.translate(Math.sin(a) * .1, -.235, Math.cos(a) * .1); pieces.push(bar) }
  const hook = new THREE.TorusGeometry(.035, .007, 4, 12); hook.translate(0, .025, 0); pieces.push(hook)
  const geometry = mergeGeometries(pieces, false)!; pieces.forEach(p => p.dispose()); return geometry
}

/** Adds coherent perimeter depth in twelve draw calls; shared scene materials are never disposed here. */
export default function GardenPerimeter({ materials: m, signal, reducedMotion, detail = 'fine' }: Props) {
  const sources = useTexture(['/models/garden/details/ivy/ivy-color.jpg', '/models/garden/details/ivy/ivy-opacity.jpg'])
  const resources = useMemo(() => {
    const model = createGardenPerimeter(detail)
    const soil = new THREE.MeshStandardMaterial({ color: '#34372b', roughness: 1, envMapIntensity: .2 })
    const contact = new THREE.MeshBasicMaterial({ color: '#070d10', transparent: true, opacity: .25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })
    const stem = new THREE.MeshStandardMaterial({ color: '#667049', roughness: .94 })
    const textures = sources.map(source => source.clone())
    textures[0].colorSpace = THREE.SRGBColorSpace
    textures.forEach(texture => { texture.anisotropy = 4; texture.needsUpdate = true })
    const leaf = new THREE.MeshStandardMaterial({ map: textures[0], alphaMap: textures[1], alphaTest: .45, color: '#c3c9b2', roughness: .82, side: THREE.DoubleSide, envMapIntensity: .52 })
    const fern = new THREE.MeshStandardMaterial({ color: '#b8c2a7', roughness: .78, side: THREE.DoubleSide, envMapIntensity: .42 })
    const bloom = new THREE.MeshStandardMaterial({ color: '#f2e9f7', roughness: .62, side: THREE.DoubleSide, envMapIntensity: .65, emissive: '#5b377c', emissiveIntensity: .025 })
    for (const mat of [leaf, fern, bloom, stem]) bindBotanicalWind(mat, signal, reducedMotion, mat === stem ? .024 : .038)
    const leafGeometry = makeIvyLeaf(2), fernGeometry = perimeterLeafGeometry(), petalGeometry = perimeterLeafGeometry(true)
    leafGeometry.scale(.68, 1, 1); leafGeometry.translate(0, .19, 0)
    const foliage = instancePlants(leafGeometry, leaf, model.leaves)
    const ferns = instancePlants(fernGeometry, fern, model.fernLeaves)
    const flowers = instancePlants(petalGeometry, bloom, model.petals)
    const lampMetal = m.brass.clone(), lampGlow = new THREE.MeshBasicMaterial({ color: '#ffd594', toneMapped: false })
    const lampGeometry = lanternBody(), flameGeometry = new THREE.SphereGeometry(.052, 8, 6)
    flameGeometry.scale(1, 2.3, 1); flameGeometry.translate(0, -.25, 0)
    const cages = new THREE.InstancedMesh(lampGeometry, lampMetal, model.lamps.length)
    const flames = new THREE.InstancedMesh(flameGeometry, lampGlow, model.lamps.length)
    const transform = new THREE.Object3D(), strings: THREE.BufferGeometry[] = []
    const lampMotion = (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.gardenTime = signal.time; shader.uniforms.gardenPulse = signal.pulse
      shader.vertexShader = 'uniform float gardenTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          float swing = ${reducedMotion ? '0.0' : '.025'} * sin(gardenTime*.72 + instanceMatrix[3].z*.9 + 3.82*1.1);
          float weight = step(2.0, instanceMatrix[3].y);
          transformed.x += swing * (0.6 - position.y) * weight;
        #endif
      `)
    }
    lampMetal.onBeforeCompile = lampMotion; lampMetal.customProgramCacheKey = () => `courtyard-lantern-${reducedMotion}`
    lampGlow.onBeforeCompile = shader => {
      lampMotion(shader)
      shader.uniforms.gardenOrigin = signal.origin
      shader.vertexShader = 'uniform vec2 gardenOrigin; varying float gardenLampResponse;\n' + shader.vertexShader.replace('#include <project_vertex>', `
        #include <project_vertex>
        gardenLampResponse = exp(-distance(instanceMatrix[3].xz, gardenOrigin) * .23);
      `)
      shader.fragmentShader = 'uniform float gardenPulse; varying float gardenLampResponse;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
        outgoingLight *= 1.0 + gardenPulse * gardenLampResponse * .65;
        #include <opaque_fragment>
      `)
    }
    lampGlow.customProgramCacheKey = () => `courtyard-lantern-flame-${reducedMotion}`
    model.lamps.forEach((lamp, i) => {
      transform.position.set(...lamp.position); transform.updateMatrix()
      cages.setMatrixAt(i, transform.matrix); flames.setMatrixAt(i, transform.matrix)
      if (lamp.hanging) {
        const string = new THREE.CylinderGeometry(.005, .005, 3.82 - lamp.position[1], 4)
        string.translate(lamp.position[0], (lamp.position[1] + 3.82) / 2, lamp.position[2]); strings.push(string)
      }
    })
    for (const mesh of [cages, flames]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere() }
    const stringGeometry = mergeGeometries(strings, false)!; strings.forEach(g => g.dispose())
    return { model, textures, soil, contact, stem, leaf, fern, bloom, leafGeometry, fernGeometry, petalGeometry, foliage, ferns, flowers,
      lampMetal, lampGlow, lampGeometry, flameGeometry, cages, flames, stringGeometry }
  }, [detail, m.brass, reducedMotion, signal, sources])
  useEffect(() => () => {
    Object.values(resources.model.geometry).forEach(g => g.dispose())
    resources.textures.forEach(texture => texture.dispose())
    for (const mat of [resources.soil, resources.contact, resources.stem, resources.leaf, resources.fern, resources.bloom, resources.lampMetal, resources.lampGlow]) mat.dispose()
    for (const g of [resources.leafGeometry, resources.fernGeometry, resources.petalGeometry, resources.lampGeometry, resources.flameGeometry, resources.stringGeometry]) g.dispose()
    for (const mesh of [resources.foliage, resources.ferns, resources.flowers, resources.cages, resources.flames]) mesh.dispose()
  }, [resources])
  return <group name="star-tide-courtyard-perimeter" dispose={null}>
    {(['walnut', 'stone', 'brass'] as const).map(key => <mesh key={key} geometry={resources.model.geometry[key]} material={m[key]} castShadow={key !== 'brass'} receiveShadow />)}
    <mesh geometry={resources.model.geometry.soil} material={resources.soil} receiveShadow />
    <mesh geometry={resources.model.geometry.contact} material={resources.contact} />
    <mesh geometry={resources.model.geometry.stem} material={resources.stem} receiveShadow />
    <primitive object={resources.foliage} /><primitive object={resources.ferns} /><primitive object={resources.flowers} />
    <mesh geometry={resources.stringGeometry} material={m.brass} />
    <primitive object={resources.cages} /><primitive object={resources.flames} />
  </group>
}
