import RealmInGlass from './RealmInGlass'
import { advanceShader, setUniform } from './vfxAnimation'
import { LightVapor } from './LightVfx'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getKnowledgeIngredient, type ThoughtRecipe } from '@/components/observatory/gardenRecipes'
import { useReducedMotion } from './useReducedMotion'
import SpatialWords from './SpatialWords'

export interface CocktailPreview { recipe: ThoughtRecipe; mixing: boolean }
export default function CocktailVision({ recipe, mixing }: CocktailPreview) {
  const group = useRef<THREE.Group>(null)
  const { size } = useThree()
  const reduced = useReducedMotion()
  const a = getKnowledgeIngredient(recipe.first), b = getKnowledgeIngredient(recipe.second)
  const resources = useMemo(() => {
    const glass = new THREE.LatheGeometry([[0,0],[.035,.02],[.10,.09],[.23,.16],[.36,.27],[.43,.39],[.44,.43],[.427,.43],[.416,.39],[.35,.275],[.22,.17],[.09,.105],[0,.08]].map(p=>new THREE.Vector2(...p as [number,number])),64)
    const liquid = new THREE.ShaderMaterial({
      uniforms:{time:{value:0},a:{value:new THREE.Color(a.color)},b:{value:new THREE.Color(b.color)},ratio:{value:recipe.firstPercent/100},mixing:{value:0}},
      vertexShader:`varying vec2 vUv;uniform float time;uniform float mixing;void main(){vUv=uv;vec3 p=position;p.z+=sin(length(uv-.5)*40.-time*2.)*.005*(1.+mixing);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec2 vUv;uniform float time;uniform vec3 a;uniform vec3 b;uniform float ratio;uniform float mixing;void main(){vec2 p=vUv-.5;float r=length(p);float wave=sin(r*85.-time*(2.+mixing*3.));float swirl=sin(atan(p.y,p.x)*3.+r*16.-time*.5)*.5+.5;vec3 c=mix(a,b,smoothstep(ratio-.3,ratio+.3,swirl));c+=vec3(.55,.38,.13)*pow(max(0.,wave),16.)*.55;float edge=smoothstep(.37,.5,r);gl_FragColor=vec4(c*(.8+mixing*.4)+edge*vec3(.4,.28,.1),.94);}`,
      transparent:true,side:THREE.DoubleSide,depthWrite:false,
    })
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.72,.7,-.06),new THREE.Vector3(-.52,.54,.02),new THREE.Vector3(-.30,.65,.04),new THREE.Vector3(0,.37,0)])
    const stream = new THREE.TubeGeometry(curve,48,.006,5,false)
    return {glass,liquid,stream}
  },[a.color,b.color,recipe.firstPercent])
  useEffect(()=>()=>{resources.glass.dispose();resources.liquid.dispose();resources.stream.dispose()},[resources])
  useFrame(({camera},delta)=>{
    if(!group.current)return
    group.current.position.copy(camera.position);group.current.quaternion.copy(camera.quaternion)
    group.current.translateX(size.width<700?0:.62);group.current.translateY(size.width<700?.3:-.33);group.current.translateZ(-2.7)
    if(!reduced)advanceShader(resources.liquid,delta)
    setUniform(resources.liquid,'mixing',THREE.MathUtils.damp(resources.liquid.uniforms.mixing.value,mixing?1:0,3,Math.min(delta,.05)))
  })
  return <group ref={group} name="living-cocktail-preview" scale={size.width<700?.7:1}>
    <group rotation={[.28,0,0]}>
    <mesh geometry={resources.glass}><meshPhysicalMaterial color="#e4f4ff" transparent opacity={.08} metalness={0} roughness={.035} clearcoat={1} side={THREE.DoubleSide} depthWrite={false}/></mesh>
    <mesh position={[0,.375,0]} rotation={[-Math.PI/2,0,0]} material={resources.liquid}><circleGeometry args={[.412,80]}/></mesh>
    <mesh position={[0,-.24,0]}><cylinderGeometry args={[.014,.022,.49,20]}/><meshStandardMaterial color="#c9a976" roughness={.24} metalness={.8}/></mesh>
    <mesh position={[0,-.497,0]}><cylinderGeometry args={[.21,.23,.018,40]}/><meshStandardMaterial color="#c9a976" roughness={.22} metalness={.8}/></mesh>
    <mesh position={[0,.426,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.434,.006,8,80]}/><meshBasicMaterial color="#e9cf97" toneMapped={false}/></mesh>
    <mesh geometry={resources.stream}><meshBasicMaterial color={a.color} transparent opacity={mixing?.85:.3}/></mesh>
    <mesh geometry={resources.stream} scale={[-1,1,1]}><meshBasicMaterial color={b.color} transparent opacity={mixing?.85:.3}/></mesh>
    </group>
    <SpatialWords text={a.name} position={[-.6,.88,0]} width={.4} color={a.color}/>
    <SpatialWords text={b.name} position={[.6,.88,0]} width={.4} color={b.color}/>
    {mixing&&<SpatialWords key={recipe.name} text={recipe.name} position={[0,1.15,0]} width={1.8} color="#ffdbab"/>}
    {mixing && <RealmInGlass recipe={recipe}/>}
    <LightVapor color={a.color} active={mixing}/>
    <pointLight position={[0,.6,.5]} intensity={.7} distance={2} color={a.color}/>
  </group>
}
