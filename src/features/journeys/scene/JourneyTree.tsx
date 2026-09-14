import { useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { advanceWorldUniform } from './worldAnimation'

const TREE_URL = '/models/garden/jacaranda-journey.glb'
// A dedicated loader prevents other useGLTF calls from resetting a shared decoder to a CDN.
const treeDecoder = new DRACOLoader().setDecoderPath('/models/garden/draco/').setWorkerLimit(2)
const treeLoader = new GLTFLoader().setDRACOLoader(treeDecoder)

/** Dedicated 6.63 MB journey variant: identical 438,168 triangles and lossless leaf alpha. */
export default function JourneyTree({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useLoader(treeLoader, TREE_URL)
  const time = useMemo(() => ({ value: 0 }), [])
  const tree = useMemo(() => {
    // Geometry and textures belong to the loader cache; only these cloned materials are ours.
    const object = scene.clone(true), materials: THREE.Material[] = []
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      const leaf = /leave/i.test(child.name)
      const patch = (original: THREE.Material) => {
        const material = original.clone() as THREE.MeshStandardMaterial
        material.metalness = 0
        material.envMapIntensity = leaf ? .18 : .45
        material.roughness = leaf ? .95 : .9
        if (leaf) {
          material.side = THREE.DoubleSide; material.alphaTest = .3; material.transparent = false
          material.normalScale.set(.38, .38)
          material.color.multiply(new THREE.Color('#c9cfaa'))
        }
        material.onBeforeCompile = shader => {
          if (leaf) {
            shader.uniforms.gardenTime = time
            shader.vertexShader = 'uniform float gardenTime;\n' + shader.vertexShader
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
              #include <begin_vertex>
              float sway = sin(gardenTime * .48 + position.x * 1.4 + position.z) * .023;
              transformed.x += sway * smoothstep(2.0, 7.3, position.y);
            `)
          }
          // Enforce the final roughness after the real PBR map multiplies the material factor.
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
            #include <roughnessmap_fragment>
            roughnessFactor = max(roughnessFactor, ${leaf ? '.82' : '.72'});
          `)
        }
        material.customProgramCacheKey = () => `jacaranda-mature-matte-v1-${leaf ? 'leaf' : 'bark'}`
        materials.push(material)
        return material
      }
      child.material = Array.isArray(child.material) ? child.material.map(patch) : patch(child.material)
      child.castShadow = true; child.receiveShadow = true
    })
    return { object, materials }
  }, [scene, time])
  useEffect(() => () => tree.materials.forEach(material => material.dispose()), [tree])
  useFrame((_, delta) => { if (!reducedMotion) advanceWorldUniform(time, delta) })
  return <group name="journey-ancient-jacaranda">
    <primitive object={tree.object} dispose={null} />
  </group>
}
