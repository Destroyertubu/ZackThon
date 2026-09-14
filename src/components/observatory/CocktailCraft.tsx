import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { KNOWLEDGE_INGREDIENTS, type ThoughtRecipe } from './gardenRecipes'

type Profile = [number, number][]
type Vessel = 'coupe' | 'tulip' | 'balloon' | 'flute' | 'rocks' | 'highball'
export const DRINK_CRAFT: Record<string, { vessel: Vessel; color: string; accent: string; garnish: 'twist' | 'flower' | 'herb'; ice: 'lens' | 'prism' | 'sphere' | 'none' }> = {
  '落日大道': { vessel: 'coupe', color: '#da6b24', accent: '#733957', garnish: 'twist', ice: 'lens' },
  '未寄出的答案': { vessel: 'tulip', color: '#d99488', accent: '#d1b26d', garnish: 'twist', ice: 'none' },
  '苔藓来信': { vessel: 'balloon', color: '#648345', accent: '#d1b670', garnish: 'herb', ice: 'none' },
  '月光行板': { vessel: 'flute', color: '#bddcde', accent: '#527cbb', garnish: 'flower', ice: 'none' },
  '镜外之问': { vessel: 'rocks', color: '#c1b4c7', accent: '#9979af', garnish: 'twist', ice: 'prism' },
  '露光标本': { vessel: 'tulip', color: '#a6c29a', accent: '#629c93', garnish: 'flower', ice: 'prism' },
  '蓝调快门': { vessel: 'highball', color: '#416e9c', accent: '#bc736c', garnish: 'twist', ice: 'prism' },
  '树的时间': { vessel: 'rocks', color: '#b18a44', accent: '#587257', garnish: 'herb', ice: 'prism' },
  '回声悖论': { vessel: 'rocks', color: '#88688e', accent: '#584962', garnish: 'twist', ice: 'sphere' },
  '林间慢拍': { vessel: 'balloon', color: '#9cbca6', accent: '#477e65', garnish: 'herb', ice: 'none' },
}
export const VESSELS: Record<Vessel, { profile: Profile; fill: number; radius: number; bottom: number; lip: number }> = {
  coupe: { profile: [[0,0],[.092,0],[.101,.005],[.092,.011],[.025,.015],[.008,.032],[.007,.167],[.015,.182],[.047,.188],[.086,.202],[.124,.228],[.147,.254],[.151,.267]], fill: .246, radius: .138, bottom: .19, lip: .267 },
  tulip: { profile: [[0,0],[.079,0],[.085,.005],[.08,.011],[.017,.016],[.007,.035],[.007,.142],[.021,.156],[.064,.176],[.084,.209],[.087,.241],[.078,.284],[.073,.307]], fill: .274, radius: .079, bottom: .166, lip: .307 },
  balloon: { profile: [[0,0],[.075,0],[.081,.005],[.072,.012],[.014,.021],[.012,.087],[.029,.101],[.079,.131],[.107,.179],[.106,.213],[.089,.253]], fill: .225, radius: .099, bottom: .116, lip: .253 },
  flute: { profile: [[0,0],[.07,0],[.077,.005],[.07,.012],[.011,.02],[.006,.032],[.006,.155],[.016,.166],[.036,.199],[.045,.259],[.045,.332],[.039,.395]], fill: .35, radius: .042, bottom: .18, lip: .395 },
  rocks: { profile: [[0,0],[.092,0],[.098,.006],[.101,.022],[.105,.163],[.108,.208]], fill: .151, radius: .099, bottom: .023, lip: .208 },
  highball: { profile: [[0,0],[.066,0],[.073,.006],[.075,.023],[.08,.326]], fill: .285, radius: .073, bottom: .024, lip: .326 },
}
export function craftLathe(profile: Profile, segments = 80) {
  return new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), segments)
}
/** The return wall closes the lip; the stem/base stay solid, the bowl is hollow. */
export function vesselGeometry(vessel: Vessel) {
  const def = VESSELS[vessel], wall = .0022
  const inside: Profile = def.profile.filter(p => p[1] >= def.bottom).reverse().map(([r,y]) => [Math.max(0,r-wall),y])
  return craftLathe([...def.profile, ...inside, [0,def.bottom]])
}
export function filledProfile(profile: Profile, bottom: number, fill: number, inset = .004): Profile {
  const result: Profile = [[0,bottom]]
  for (let i=0;i<profile.length;i++) {
    const [r,y] = profile[i]
    if (y < bottom) continue
    if (y >= fill) {
      const [pr,py] = profile[Math.max(0,i-1)]
      const rr = THREE.MathUtils.lerp(pr,r,(fill-py)/(y-py || 1))-inset
      result.push([rr,fill],[Math.max(0,rr-.003),fill-.0015],[0,fill-.0015]); break
    }
    result.push([Math.max(0,r-inset),y])
  }
  return result
}
const GLASS = { color: '#edf4ee', transparent: true, opacity: 1, transmission: .97, thickness: .007, ior: 1.5, roughness: .065, metalness: 0, clearcoat: .22, clearcoatRoughness: .10, envMapIntensity: 1.1, depthWrite: false }
const DISTANT_GLASS = {...GLASS,color:'#30484a',transmission:0,opacity:.24,clearcoat:.6}

function CitrusTwist({ radius, height }: { radius: number; height: number }) {
  const geometry = useMemo(() => {
    const path = new THREE.CatmullRomCurve3(Array.from({length:33},(_,i)=>{const t=i/32,a=t*Math.PI*2.1; return new THREE.Vector3(radius*.78+Math.cos(a)*.016,height+.025-t*.054,Math.sin(a)*.025)}))
    const g = new THREE.TubeGeometry(path,48,.006,6,false); g.scale(1,1,.55); return g
  },[radius,height])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} castShadow><meshStandardMaterial color="#e4a136" roughness={.63} side={THREE.DoubleSide}/></mesh>
}

/** Human-scale glassware shared by the counter and the camera's close inspection. */
export function CraftedCocktail({ name, reducedMotion = false, fill = 1, mixing = false, detailed = false }: { name: string; reducedMotion?: boolean; fill?: number; mixing?: boolean; detailed?:boolean }) {
  const glass = detailed ? GLASS : DISTANT_GLASS
  const craft = DRINK_CRAFT[name] ?? DRINK_CRAFT['落日大道'], def = VESSELS[craft.vessel]
  const surface = useRef<THREE.Mesh>(null)
  const volume=useRef<THREE.Group>(null), elapsed=useRef(0),previousMixing=useRef(false)
  const resources = useMemo(() => ({
    glass: vesselGeometry(craft.vessel),
    liquid: craftLathe(filledProfile(def.profile,def.bottom,def.fill)),
    surface: new THREE.ShaderMaterial({ transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{time:{value:0},a:{value:new THREE.Color(craft.color)},b:{value:new THREE.Color(craft.accent)},sunset:{value:name==='落日大道'?1:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform float time,sunset;uniform vec3 a,b;void main(){vec2 p=(vUv-.5)*2.;
        float rip=pow(max(0.,cos(length(p)*29.-time*.65)),18.);float sun=1.-smoothstep(.105,.12,length(p-vec2(0.,.27)));
        float coast=smoothstep(-.13,-.1,p.y+.045*sin(p.x*7.)+.016*cos(p.x*13.));
        vec3 c=mix(b,a,smoothstep(-.6,.5,p.y))*.53;c+=mix(vec3(.34,.49,.48)*rip*.12,vec3(1.,.64,.24)*(sun*.64+pow(max(0.,1.-abs(p.x)*6.),4.)*rip*.22),sunset);
        c*=mix(1.,mix(.66,1.,coast),sunset);gl_FragColor=vec4(c,.8);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  }),[craft,def,name])
  useEffect(()=>()=>Object.values(resources).forEach(r=>r.dispose()),[resources])
  useFrame((_,delta)=>{
    if(!reducedMotion)resources.surface.uniforms.time.value+=Math.min(delta,.05)
    if(mixing&&!previousMixing.current)elapsed.current=0
    previousMixing.current=mixing
    elapsed.current+=Math.min(delta,.08)
    const level=mixing&&!reducedMotion?Math.min(1,.08+elapsed.current/2.3):fill
    if(volume.current){volume.current.scale.y=Math.max(.015,level);volume.current.position.y=def.bottom*(1-level)}
    if(surface.current){surface.current.position.y=def.bottom+(def.fill-def.bottom)*level-.001;surface.current.visible=level>.8}
  })
  const liquidY = def.bottom+(def.fill-def.bottom)*fill
  return <group name={`crafted-cocktail-${name}`}>
    <group ref={volume} position={[0,def.bottom*(1-fill),0]} scale={[1,Math.max(.015,fill),1]}>
      <mesh geometry={resources.liquid} renderOrder={2}><meshPhysicalMaterial color={craft.color} transparent opacity={.55} roughness={.13} metalness={0} clearcoat={.8} envMapIntensity={.6} depthWrite={false}/></mesh>
    </group>
    <mesh ref={surface} position={[0,liquidY-.001,0]} rotation={[-Math.PI/2,0,0]} material={resources.surface} visible={fill>.6} renderOrder={3}><circleGeometry args={[def.radius-.004,80]}/></mesh>
    <mesh geometry={resources.glass} renderOrder={1}><meshPhysicalMaterial {...glass}/></mesh>
    <mesh position={[0,def.lip,0]} rotation={[Math.PI/2,0,0]} renderOrder={6}><torusGeometry args={[def.profile.at(-1)![0]-.001,.0015,6,80]}/><meshPhysicalMaterial {...glass} opacity={.55}/></mesh>
    {craft.ice !== 'none' && <group position={[craft.ice==='lens'?-.045:0,craft.ice==='sphere'?.108:craft.ice==='lens'?.237:def.fill-.026,0]} rotation={[.08,.3,.11]}>
      {craft.ice==='sphere'||craft.ice==='lens'?<mesh scale={craft.ice==='lens'?[1,.24,1]:1} renderOrder={4}><sphereGeometry args={[craft.ice==='lens'?.044:.073,40,24]}/><meshPhysicalMaterial {...glass} color={detailed?"#def1eb":"#476568"} opacity={detailed?1:.28} transmission={detailed?.93:0} thickness={.08} ior={1.31} roughness={.06}/></mesh>:<RoundedBox args={[def.radius*1.0,.093,def.radius*.78]} radius={.008} smoothness={3} renderOrder={4}><meshPhysicalMaterial {...glass} color={detailed?"#def1eb":"#476568"} opacity={detailed?1:.28} transmission={detailed?.93:0} thickness={.06} ior={1.31} roughness={.07}/></RoundedBox>}
      <mesh position={[.016,.014,.028]} rotation={[.4,.2,.6]}><sphereGeometry args={[.011,10,8]}/><meshBasicMaterial color="#d4e7df" transparent opacity={.12} depthWrite={false}/></mesh>
    </group>}
    {craft.garnish==='twist' && <CitrusTwist radius={def.radius} height={def.lip}/>}
    {craft.garnish==='flower' && <group position={[def.radius*.77,def.lip+.003,.024]} rotation={[.1,.2,.3]}>
      {Array.from({length:5},(_,i)=><mesh key={i} position={[Math.cos(i*1.257)*.013,.004,Math.sin(i*1.257)*.013]} rotation={[0,-i*1.257,0]} scale={[.85,.21,1.5]}><sphereGeometry args={[.012,12,8]}/><meshStandardMaterial color="#f1e8ce" roughness={.65}/></mesh>)}
      <mesh position={[0,.007,0]}><sphereGeometry args={[.004,10,8]}/><meshStandardMaterial color="#d4ab48"/></mesh>
    </group>}
    {craft.garnish==='herb' && <group position={[def.radius*.66,def.lip-.025,0]} rotation={[0,0,-.36]}>
      <mesh position={[0,.039,0]}><cylinderGeometry args={[.001,.0015,.11,6]}/><meshStandardMaterial color="#667644"/></mesh>
      {[0,1,2,3,4].map(i=><mesh key={i} position={[(i%2?1:-1)*.009,.01+i*.016,0]} rotation={[0,.25,(i%2?1:-1)*-.8]} scale={[.35,1,.12]}><sphereGeometry args={[.021,12,8]}/><meshStandardMaterial color={i%2?'#78935c':'#526d45'} roughness={.8}/></mesh>)}
    </group>}
    {[0,1,2,3,4,5,6,7].map(i=><mesh key={i} position={[Math.sin(i*2.4)*def.radius*.97,def.fill-.014-(i%3)*.009,Math.cos(i*2.4)*def.radius*.97]} scale={[1,1.4,1]} renderOrder={6}><sphereGeometry args={[.0018+(i%3)*.0006,6,5]}/><meshPhysicalMaterial {...glass} opacity={.46}/></mesh>)}
  </group>
}

const BOTTLE_PROFILES: Profile[] = [
  [[0,0],[.116,0],[.139,.018],[.145,.06],[.143,.29],[.129,.38],[.078,.435],[.037,.458],[.036,.559],[.044,.57]],
  [[0,0],[.119,0],[.145,.025],[.149,.28],[.12,.345],[.054,.397],[.035,.42],[.035,.525],[.045,.533]],
  [[0,0],[.127,0],[.142,.027],[.131,.114],[.09,.224],[.107,.316],[.139,.372],[.132,.408],[.066,.455],[.034,.473],[.034,.568],[.043,.578]],
  [[0,0],[.10,0],[.134,.024],[.164,.14],[.16,.271],[.127,.351],[.07,.406],[.032,.438],[.032,.553],[.041,.56]],
  [[0,0],[.109,0],[.122,.02],[.113,.22],[.102,.37],[.072,.452],[.031,.477],[.031,.613],[.04,.622]],
]
export function IngredientDecanter({ index, detailed=false }: { index: number; detailed?:boolean }) {
  const glass = detailed ? GLASS : DISTANT_GLASS
  const item=KNOWLEDGE_INGREDIENTS[index], profile=BOTTLE_PROFILES[index], lip=profile.at(-1)![1]
  const resources=useMemo(()=>{
    const points: Profile=[...profile,...profile.slice(1).reverse().map(([r,y])=>[Math.max(0,r-.005),Math.max(.018,y)] as [number,number]),[0,.018]]
    return {shell:craftLathe(points,index===1?12:index===4?32:72),fill:craftLathe(filledProfile(profile,.022,lip*.66,.009),index===1?12:72)}
  },[index,profile,lip])
  useEffect(()=>()=>Object.values(resources).forEach(r=>r.dispose()),[resources])
  return <group name={`knowledge-bottle-${item.id}`}>
    <mesh geometry={resources.fill} renderOrder={2}><meshPhysicalMaterial color={['#bd792c','#5197b5','#8d5f9d','#6f9470','#bb7d73'][index]} transparent opacity={.52} roughness={.15} clearcoat={.75} envMapIntensity={.55} depthWrite={false}/></mesh>
    <mesh geometry={resources.shell} renderOrder={1}><meshPhysicalMaterial {...glass} thickness={.012} flatShading={index===1}/></mesh>
    {[.025,lip-.012].map(y=><mesh key={y} position={[0,y,0]}><cylinderGeometry args={[y<.1?profile[2][0]+.003:.044,y<.1?profile[2][0]+.003:.044,.013,48,1,true]}/><meshStandardMaterial color="#b8975e" metalness={.88} roughness={.3}/></mesh>)}
    <mesh position={[0,lip+.033,0]} scale={[1,index===2?1.3:1,1]}><sphereGeometry args={[.047,16,12]}/><meshPhysicalMaterial {...glass} opacity={.45} flatShading/></mesh>
    <mesh position={[0,lip+.065,0]}><sphereGeometry args={[.009,12,8]}/><meshStandardMaterial color="#c5a56c" roughness={.26} metalness={.9}/></mesh>
    <group position={[0,.25,profile[3][0]+.001]}>
      <mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[.045,.0014,5,40]}/><meshStandardMaterial color="#cfb681" metalness={.85} roughness={.32}/></mesh>
      <mesh rotation={[0,0,index*.37]} scale={index===3?[.4,1,.15]:[1,1,.15]}><torusGeometry args={[.028,.002,5,index===1?6:32,index===2?Math.PI*1.6:Math.PI*2]}/><meshStandardMaterial color="#d0b683" metalness={.8} roughness={.3}/></mesh>
    </group>
  </group>
}

export function craftForRecipe(recipe: ThoughtRecipe) { return DRINK_CRAFT[recipe.name] }
