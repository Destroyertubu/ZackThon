import { useEffect, useMemo, useRef, useState } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { getQualityProfile, useGameStore } from '@/state/gameStore'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { AssetBookRow, AssetLantern, AssetModel } from '../scene/Assets'
import SpatialWords from '@/features/typography/SpatialWords'
import { CraftedCocktail, IngredientDecanter, craftLathe } from './CocktailCraft'
import type { ObservatoryMaterials } from './materials'
import { THOUGHT_BAR_POSITION } from './layout'
import { KNOWLEDGE_INGREDIENTS, type KnowledgeId } from './gardenRecipes'
import { BoxInstances, type Instance } from './Primitives'

function curveTube(points: THREE.Vector3[], radius: number) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,radius,8,false)
}
/** Local Z faces the player. Both ends turn towards the garden around one worktop. */
function crescent(depth: number, bevel: number) {
  const shape = new THREE.Shape()
  shape.moveTo(-1.76,-.55);shape.quadraticCurveTo(0,-.17,1.76,-.55)
  shape.quadraticCurveTo(1.91,-.15,1.72,.40);shape.quadraticCurveTo(.96,.83,0,.85)
  shape.quadraticCurveTo(-.96,.83,-1.72,.40);shape.quadraticCurveTo(-1.91,-.15,-1.76,-.55)
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:48})
  geometry.rotateX(Math.PI/2);return geometry
}
export default function AtelierBar({materials:m,reducedMotion,onActivate,onIngredient,showLabel=true}: {materials:ObservatoryMaterials;reducedMotion:boolean;onActivate:()=>void;onIngredient?:(id:KnowledgeId)=>void;showLabel?:boolean}) {
  const [near,setNear]=useState(false), nearRef=useRef(false)
  const qualityMode=useGameStore(s=>s.qualityMode)
  const detailed=near&&getQualityProfile(qualityMode).postprocessing
  useFrame(({camera})=>{const next=Math.hypot(camera.position.x-THOUGHT_BAR_POSITION[0],camera.position.z-THOUGHT_BAR_POSITION[2])<(nearRef.current?5.2:4.5);if(next!==nearRef.current){nearRef.current=next;setNear(next)}})
  const resources=useMemo(()=>{
    const stone=new THREE.MeshPhysicalMaterial({normalMap:m.stone.normalMap,normalScale:new THREE.Vector2(.035,.035),color:'#c9c6b9',roughness:.3,metalness:.02,clearcoat:.34,clearcoatRoughness:.2,envMapIntensity:.75})
    const rails:THREE.BufferGeometry[]=[], arches:THREE.BufferGeometry[]=[], slats:Instance[]=[]
    for (const y of [.09,.97]) rails.push(curveTube(Array.from({length:60},(_,i)=>{const x=-1.71+i/59*3.42;return new THREE.Vector3(x,y,.845-.153*x*x)}),.012))
    for(let i=0;i<61;i++){const x=-1.69+i/60*3.38;slats.push({position:[x,.51,.889-.152*x*x],scale:[.034,.86,.044],rotation:[0,Math.atan(.304*x),0]})}
    for(const x of [-1.09,0,1.09]) {
      const pts=[new THREE.Vector3(x-.49,1.20,-.54),new THREE.Vector3(x-.49,2.19,-.54),new THREE.Vector3(x-.35,2.49,-.54),new THREE.Vector3(x,2.69,-.54),new THREE.Vector3(x+.35,2.49,-.54),new THREE.Vector3(x+.49,2.19,-.54),new THREE.Vector3(x+.49,1.20,-.54)]
      arches.push(curveTube(pts,.017))
    }
    const join=(parts:THREE.BufferGeometry[])=>{const result=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return result}
    return {stone,slats,top:crescent(.063,.014),body:crescent(.90,.008),rails:join(rails),arches:join(arches),
      jigger:craftLathe([[.05,0],[.046,.006],[.022,.072],[.020,.084],[.055,.163],[.058,.169],[.054,.169],[.017,.084],[.018,.074],[.044,.006],[.05,0]],48),
      shaker:craftLathe([[0,0],[.065,0],[.069,.012],[.088,.218],[.087,.232],[.075,.252],[.046,.282],[.042,.302],[0,.302]],64),
      spoon:curveTube([new THREE.Vector3(.56,1.075,.38),new THREE.Vector3(.75,1.09,.25),new THREE.Vector3(.88,1.11,.15)],.003),
    }
  },[m])
  useEffect(()=>()=>Object.entries(resources).forEach(([key,r])=>{if(key!=='slats' && 'dispose' in r)r.dispose()}),[resources])
  const activate=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.delta<=5)onActivate()}
  return <group name="secret-botanical-cocktail-atelier" position={THOUGHT_BAR_POSITION} rotation={[0,Math.PI/2,0]} onClick={activate}>
    <mesh geometry={resources.body} position={[0,.97,0]} material={m.walnut} castShadow receiveShadow/>
    <BoxInstances items={resources.slats} material={m.wood}/>
    <mesh geometry={resources.top} position={[0,1.065,0]} material={resources.stone} castShadow receiveShadow/>
    <mesh geometry={resources.rails} material={m.brightBrass}/>
    <mesh geometry={resources.arches} material={m.brightBrass} castShadow/>
    {[-1.66,1.66].map(x=><group key={x} position={[x,0,-.54]}>
      <RoundedBox args={[.08,2.13,.17]} radius={.012} position={[0,1.24,0]} material={m.walnut} castShadow/>
      <mesh position={[0,2.34,0]}><sphereGeometry args={[.065,20,12]}/><meshStandardMaterial color="#b5a174" metalness={.8} roughness={.32}/></mesh>
    </group>)}
    {[1.39,2.14].map(y=><group key={y}>
      <RoundedBox args={[3.25,.057,.36]} radius={.013} position={[0,y,-.54]} material={m.walnut} castShadow/>
      <mesh position={[0,y+.028,-.348]} material={m.brightBrass}><boxGeometry args={[3.24,.012,.012]}/></mesh>
      <mesh position={[0,y-.025,-.37]}><boxGeometry args={[2.96,.008,.014]}/><meshBasicMaterial color="#e7c692" toneMapped={false}/></mesh>
    </group>)}
    {KNOWLEDGE_INGREDIENTS.map((ingredient,i)=><group key={ingredient.id} position={[(i-2)*.56,1.424,-.50]} onClick={e=>{e.stopPropagation();if(e.delta<=5){if(onIngredient)onIngredient(ingredient.id);else onActivate()}}}>
      <IngredientDecanter index={i} detailed={detailed}/>
    </group>)}
    <AssetBookRow width={.54} bookHeight={.26} seed={19} position={[-1.03,2.176,-.53]}/>
    <AssetModel asset="plantSmall" height={.43} position={[1.06,2.176,-.55]} castShadow={false}/>
    {[-.4,-.16,.08,.32].map((x,i)=><group key={x} position={[x,2.176,-.5]} scale={.66}><CraftedCocktail name={['月光行板','未寄出的答案','镜外之问','林间慢拍'][i]} reducedMotion/></group>)}
    {['落日大道','露光标本','回声悖论'].map((name,i)=><group key={name} position={[-.67+i*.45,1.09,.55-Math.abs(i-1)*.035]}>
      <mesh material={m.brass}><cylinderGeometry args={[.172,.172,.008,64]}/></mesh>
      <group position={[0,.008,0]} scale={1.2}><CraftedCocktail name={name} reducedMotion={reducedMotion} detailed={detailed}/></group>
    </group>)}
    <mesh geometry={resources.jigger} material={m.brightBrass} position={[.94,1.072,.26]}/>
    <mesh geometry={resources.shaker} material={m.brass} position={[1.34,1.073,-.06]} castShadow/>
    <mesh geometry={resources.spoon} material={m.brightBrass}/>
    <mesh position={[.54,1.076,.396]} scale={[1,.17,.6]} material={m.brightBrass}><sphereGeometry args={[.025,20,12]}/></mesh>
    <RoundedBox args={[.39,.012,.25]} radius={.008} position={[-1.27,1.076,.22]} rotation={[0,-.23,0]}><meshStandardMaterial color="#c1b9a5" roughness={1}/></RoundedBox>
    <mesh position={[-1.36,1.09,.23]} material={resources.stone}><cylinderGeometry args={[.12,.106,.026,48]}/></mesh>
    {[0,1,2].map(i=><mesh key={i} position={[-1.41+i*.041,1.109,.23]} rotation={[Math.PI/2,.1,i*.4]}><torusGeometry args={[.034,.006,6,28]}/><meshStandardMaterial color="#d5ac40" roughness={.7}/></mesh>)}
    <AssetLantern height={.38} position={[-1.57,1.075,-.23]}/>
    {showLabel && <SpatialWords text="调一杯思想" position={[0,2.88,-.40]} width={2} onActivate={onActivate}/>}
    <pointLight position={[0,2.18,-.12]} color="#fce4b9" intensity={2.4} distance={3.7} decay={2}/>
    <pointLight position={[1.5,1.7,.68]} color="#a3c6df" intensity={.9} distance={2.5} decay={2}/>
  </group>
}
