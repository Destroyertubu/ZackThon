import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { TideSignal } from '@/features/journeys/scene/atmosphereMotion'
import { mergeMirrorGeometry, mirrorRandom } from '@/features/journeys/scene/MirrorGeometry'
import { makeIvyLeaf } from './gardenIvyGeometry'

export default function StarTideBotany({ signal }: { signal: TideSignal }) {
  const sources = useTexture(['/models/garden/details/ivy/ivy-color.jpg', '/models/garden/details/ivy/ivy-opacity.jpg'])
  const resources = useMemo(() => {
    const random = mirrorRandom(735117), transform = new THREE.Object3D()
    const textures = sources.map(s => s.clone()); textures[0].colorSpace = THREE.SRGBColorSpace
    textures.forEach(t => { t.anisotropy = 4; t.needsUpdate = true })
    const leaf = new THREE.MeshStandardMaterial({ map: textures[0], alphaMap: textures[1], color: '#6c8059', alphaTest: .45, roughness: .85, side: THREE.DoubleSide, envMapIntensity: .4 })
    const petal = new THREE.MeshStandardMaterial({ color: '#e3d8e6', roughness: .7, metalness: 0, envMapIntensity: .5, emissive: '#786298', emissiveIntensity: .012 })
    const stemsMaterial = new THREE.MeshStandardMaterial({ color: '#746846', roughness: .94 })
    for (const mat of [leaf, petal]) {
      mat.onBeforeCompile = shader => {
        shader.uniforms.tideTime = signal.time
        shader.vertexShader = 'uniform float tideTime;\n' + shader.vertexShader.replace('#include <project_vertex>', `
          vec4 botanicalWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.);
          float sway = sin(tideTime*.72 + botanicalWorld.z*.9 + botanicalWorld.y*1.1);
          botanicalWorld.x += sway * .038; botanicalWorld.z += cos(tideTime*.51 + botanicalWorld.x) * .023;
          vec4 mvPosition = viewMatrix * botanicalWorld;
          gl_Position = projectionMatrix * mvPosition;`)
      }
      mat.customProgramCacheKey = () => 'star-tide-botanical-sway-v1'
    }
    const leafGeometry = makeIvyLeaf(2)
    // Each 6 cm petal keeps its rounded silhouette; 24 triangles replace 64.
    // The 1,872 instanced petals and raceme density stay unchanged.
    const bloomGeometry = new THREE.SphereGeometry(1, 6, 3)
    const positions = bloomGeometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
      positions.setXYZ(i, x * .032 * (1 + y * .24), y * .057, z * .025 + x * x * .016)
    }
    bloomGeometry.computeVertexNormals()
    const drops: THREE.Vector3[] = []
    for (let i = 0; i < 23; i++) drops.push(new THREE.Vector3(-4.6 + Math.sin(i * .9) * .11, 3.8, -1 + i * .216))
    for (let i = 0; i < 16; i++) drops.push(new THREE.Vector3(-8.55 + i * .256, 3.91 + Math.sin(i / 15 * Math.PI) * .42, 3.94))
    const stemParts: THREE.BufferGeometry[] = [], leafMatrices: THREE.Matrix4[] = [], bloomMatrices: THREE.Matrix4[] = [], bloomColors: THREE.Color[] = []
    for (const [index, top] of drops.entries()) {
      const length = .45 + random() * .75
      const curve = new THREE.CatmullRomCurve3([top, top.clone().add(new THREE.Vector3(.07, -length * .5, .05)), top.clone().add(new THREE.Vector3(-.05, -length, .09))])
      stemParts.push(new THREE.TubeGeometry(curve, 12, .009, 4, false))
      for (let level = 0; level < 12; level++) {
        const u = level / 12, centre = curve.getPointAt(u), radius = (.14 + (1 - u) * .04) * (1 - u * .65)
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + level * 1.4
          transform.position.copy(centre).add(new THREE.Vector3(Math.cos(a) * radius, (random() - .5) * .06, Math.sin(a) * radius))
          transform.rotation.set(.5 + random() * .7, a, (random() - .5) * .5); transform.scale.setScalar(.75 + random() * .45); transform.updateMatrix()
          bloomMatrices.push(transform.matrix.clone()); bloomColors.push(new THREE.Color(index % 4 ? '#b5a2c3' : '#e9dfe7').multiplyScalar(.75 + random() * .3))
        }
      }
      for (let k = 0; k < 4; k++) {
        transform.position.copy(top).add(new THREE.Vector3((random() - .5) * .5, random() * .09, (random() - .5) * .4))
        transform.rotation.set(-Math.PI / 3 + random(), random() * 6, random()); transform.scale.setScalar(.24 + random() * .2); transform.updateMatrix(); leafMatrices.push(transform.matrix.clone())
      }
    }
    const blooms = new THREE.InstancedMesh(bloomGeometry, petal, bloomMatrices.length)
    bloomMatrices.forEach((matrix, i) => { blooms.setMatrixAt(i, matrix); blooms.setColorAt(i, bloomColors[i]) })
    const leaves = new THREE.InstancedMesh(leafGeometry, leaf, leafMatrices.length)
    leafMatrices.forEach((matrix, i) => leaves.setMatrixAt(i, matrix))
    for (const mesh of [blooms, leaves]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); mesh.receiveShadow = true }
    return { textures, leaf, petal, stemsMaterial, stems: mergeMirrorGeometry(stemParts), leafGeometry, bloomGeometry, blooms, leaves }
  }, [sources, signal])
  useEffect(() => () => {
    resources.textures.forEach(t => t.dispose()); resources.leaf.dispose(); resources.petal.dispose(); resources.stemsMaterial.dispose()
    resources.stems.dispose(); resources.leafGeometry.dispose(); resources.bloomGeometry.dispose(); resources.blooms.dispose(); resources.leaves.dispose()
  }, [resources])
  return <group name="hanging-wisteria-botanical-canopy" dispose={null}>
    <mesh geometry={resources.stems} material={resources.stemsMaterial}/>
    <primitive object={resources.leaves}/><primitive object={resources.blooms}/>
  </group>
}
