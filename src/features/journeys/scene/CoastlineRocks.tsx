import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import type { WaterShore } from './waterSurface'

const decoder=new DRACOLoader().setDecoderPath('/models/garden/draco/').setWorkerLimit(1)
const loader=new GLTFLoader().setDRACOLoader(decoder)
const PATCHES=[{x:8.9,z:10.4,scale:.26,yaw:.18},{x:8.4,z:-8.5,scale:.21,yaw:-.22}] as const
export const COAST_PATCH_SHORES:readonly WaterShore[]=PATCHES.map(p=>({center:[p.x,p.z],radii:[19*.5*p.scale,42*.5*p.scale]}))

/** A cropped, decimated CC0 scan, with a damp tide margin evaluated in world metres. */
export default function CoastlineRocks({waterLevel=-1.1}:{waterLevel?:number}) {
  const model=useLoader(loader,'/models/star-tide/coast-cropped.glb')
  const resource=useMemo(()=>{
    const materials:THREE.MeshStandardMaterial[]=[]
    const copies=PATCHES.map(p=>{
      const object=model.scene.clone(true)
      object.traverse(child=>{
        if(!(child instanceof THREE.Mesh))return
        const original=(Array.isArray(child.material)?child.material[0]:child.material) as THREE.MeshStandardMaterial
        const material=original.clone();material.color.set('#c0c6ba');material.roughness=.84;material.envMapIntensity=.4
        material.onBeforeCompile=shader=>{
          shader.uniforms.coastWater={value:waterLevel}
          shader.vertexShader='varying float coastHeight;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\ncoastHeight=(modelMatrix*vec4(transformed,1.)).y;')
          shader.fragmentShader='varying float coastHeight;uniform float coastWater;\n'+shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nfloat damp=1.-smoothstep(coastWater+.02,coastWater+.48,coastHeight);roughnessFactor=mix(roughnessFactor,.22,damp*.85);diffuseColor.rgb*=1.-damp*.27;')
        }
        material.customProgramCacheKey=()=>`coast-wet-margin-${waterLevel}`
        materials.push(material);child.material=material;child.castShadow=true;child.receiveShadow=true
      })
      object.position.set(p.x,waterLevel+.22,p.z);object.scale.setScalar(p.scale);object.rotation.y=p.yaw;return object
    })
    return {copies,materials}
  },[model,waterLevel])
  useEffect(()=>()=>resource.materials.forEach(m=>m.dispose()),[resource])
  return <group name="poly-haven-coast-rocks" dispose={null}>{resource.copies.map((object,i)=><primitive key={i} object={object}/>)}</group>
}
