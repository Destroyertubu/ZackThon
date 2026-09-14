import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getKnowledgeIngredient, KNOWLEDGE_INGREDIENTS, type ThoughtRecipe } from '@/components/observatory/gardenRecipes'
import { CraftedCocktail, IngredientDecanter, DRINK_CRAFT, VESSELS } from '@/components/observatory/CocktailCraft'
import { useReducedMotion } from './useReducedMotion'
import RealmInGlass from './RealmInGlass'

export interface CocktailPreview { recipe: ThoughtRecipe; mixing: boolean }
export default function CocktailVision({ recipe, mixing }: CocktailPreview) {
  const group=useRef<THREE.Group>(null), pouring=useRef<THREE.Group>(null), miniature=useRef<THREE.Group>(null)
  const elapsed=useRef(0), wasMixing=useRef(false)
  const {size}=useThree(), reduced=useReducedMotion()
  const a=getKnowledgeIngredient(recipe.first),b=getKnowledgeIngredient(recipe.second)
  const def=VESSELS[DRINK_CRAFT[recipe.name].vessel]
  const resources=useMemo(()=>({stream:new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.43,.99,0),new THREE.Vector3(-.30,.71,0),new THREE.Vector3(-.08,.42,0)]),36,.006,6,false)}),[])
  useEffect(()=>()=>resources.stream.dispose(),[resources])
  useFrame(({camera},delta)=>{
    if(!group.current)return
    if(mixing&&!wasMixing.current)elapsed.current=0
    wasMixing.current=mixing
    if(mixing)elapsed.current+=Math.min(delta,.08)
    group.current.position.copy(camera.position);group.current.quaternion.copy(camera.quaternion)
    group.current.translateX(size.width<700?0:.62);group.current.translateY(size.width<700?.09:-.66);group.current.translateZ(-2.5)
    if(pouring.current){pouring.current.visible=mixing&&!reduced&&elapsed.current<2.4;pouring.current.scale.y=.92+Math.sin(elapsed.current*2)*.04}
    if(miniature.current)miniature.current.visible=mixing&&(reduced||elapsed.current>2.8)
  })
  const indices=[recipe.first,recipe.second].map(id=>KNOWLEDGE_INGREDIENTS.findIndex(i=>i.id===id))
  return <group ref={group} name="living-cocktail-preview" scale={size.width<700?.7:1}>
    <group scale={3.0} rotation={[.34,0,0]}><CraftedCocktail detailed name={recipe.name} reducedMotion={reduced} mixing={mixing}/></group>
    <mesh position={[0,-.022,0]} rotation={[.34,0,0]}><cylinderGeometry args={[.39,.37,.024,80]}/><meshStandardMaterial color="#7e897b" roughness={.48} metalness={.08}/></mesh>
    <group ref={pouring} position={[0,def.lip*3-.49,0]} visible={false}>
      {indices.map((index,i)=><group key={i}>
        <group position={[i?.74:-.74,1.18,-.01]} rotation={[0,0,i?2.12:-2.12]} scale={.64}><IngredientDecanter detailed index={index}/></group>
        <mesh geometry={resources.stream} scale={[i?-1:1,1,1]}><meshPhysicalMaterial color={i?b.color:a.color} transparent opacity={.55} roughness={.06} clearcoat={1} depthWrite={false}/></mesh>
      </group>)}
    </group>
    <group ref={miniature} position={[0,def.lip*3-.40,-.10]} scale={.53} visible={false}><RealmInGlass key={recipe.name} recipe={recipe}/></group>
    <pointLight position={[-.5,1.4,1]} intensity={1.9} distance={3} color="#e7ddc8"/>
    <pointLight position={[.7,.7,.2]} intensity={.55} distance={2.5} color="#86bace"/>
  </group>
}
