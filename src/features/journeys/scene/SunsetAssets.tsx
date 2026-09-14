import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { type MaterialKey } from './geometry'
import { SUNSET_FACADES, SUNSET_PLANTERS, SUNSET_TREES } from './sunsetLayout'
import { staticPlantBatches } from './staticPlantBatches'

const MODEL_URLS = ['/models/sunset-boulevard/bookshop.glb?v=pottery-2','/models/sunset-boulevard/atelier.glb?v=pottery-2','/models/sunset-boulevard/gallery.glb?v=pottery-2']
const decoder=new DRACOLoader().setDecoderPath('/models/garden/draco/').setWorkerLimit(2)
const loader=new GLTFLoader().setDRACOLoader(decoder)
const BOTANY_URLS = ['/models/sunset-boulevard/botany/street-tree.glb?v=static-1', '/models/sunset-boulevard/botany/rooted-shrub.glb?v=static-1', '/models/sunset-boulevard/botany/fern.glb?v=static-1']
const PLANTING_SITES=SUNSET_PLANTERS.flatMap(planter=>planter.plantSites).filter(site=>
  SUNSET_TREES.every(tree=>Math.hypot(site.position[0]-tree.position[0],site.position[2]-tree.position[2])>=.75))

/** The imported kit uses the scene's PBR materials, sun and shadow budget. */
export default function SunsetAssets({materials}:{materials:Record<MaterialKey,THREE.Material>}) {
  const models=useLoader(loader,MODEL_URLS)
  const plants=useLoader(loader,BOTANY_URLS)
  const botany=useMemo(()=>[
    staticPlantBatches(plants[0].scene,SUNSET_TREES.map((tree,i)=>({
      position:[tree.position[0],tree.position[1]-.04,tree.position[2]],
      // Keep the original stone islands and save coordinates; tree height is
      // independent from the old procedural tree's foundation-size parameter.
      height:[7.0,7.2,6.6,7.0,7.1,6.6,6.9][i],yaw:[.14,-.22,.06,.25,Math.PI-.12,.1,Math.PI-.2][i],
    })),'sunset-static-street-trees'),
    staticPlantBatches(plants[1].scene,PLANTING_SITES.map((site,i)=>({...site,height:.58+(i%3)*.065})),
    'sunset-static-rooted-shrubs'),
    staticPlantBatches(plants[2].scene,PLANTING_SITES.map((site,i)=>({...site,height:.27+(i%2)*.025})),
    'sunset-static-fern-underplanting'),
  ],[plants])
  const facades=useMemo(()=>SUNSET_FACADES.map(definition=>{
    const index=definition.kind==='bookshop'?0:definition.kind==='atelier'?1:2
    const object=models[index].scene.clone(true)
    object.traverse(child=>{
      if(!(child instanceof THREE.Mesh))return
      const key=(Array.isArray(child.material)?child.material[0]:child.material).name as MaterialKey
      if(materials[key])child.material=materials[key]
      child.castShadow=key!=='glass'&&key!=='glow';child.receiveShadow=true
    })
    return {definition,object}
  }),[models,materials])
  useEffect(()=>()=>botany.forEach(resource=>resource.dispose()),[botany])
  return <group name="sunset-authored-architecture-and-botany" dispose={null}>
    {facades.map(({definition,object},i)=><group key={i} position={definition.position} rotation={[0,definition.yaw,0]} scale={definition.scale}><primitive object={object}/></group>)}
    {botany.map(resource=><primitive key={resource.root.name} object={resource.root}/>)}
  </group>
}
