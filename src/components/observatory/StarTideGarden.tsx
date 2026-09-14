import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeMirrorGeometry, mirrorRandom } from '@/features/journeys/scene/MirrorGeometry'
import type { TideSignal } from '@/features/journeys/scene/atmosphereMotion'
import type { ObservatoryMaterials } from './materials'
import { KNOWLEDGE_INGREDIENTS, type KnowledgeId } from './gardenRecipes'
import { arcSlab } from './GardenFixtureGeometry'
import { TIDE_POOL, THOUGHT_SEEDS, ATELIER_RILL_POINTS } from './starTideLayout'
import StarTideBotany from './StarTideBotany'

function poolSurface() {
  const p: number[] = [], uv: number[] = [], indices: number[] = [], segments = 96, rings = 9
  for (let j = 0; j <= rings; j++) for (let i = 0; i <= segments; i++) {
    const a = TIDE_POOL.start + (TIDE_POOL.end - TIDE_POOL.start) * i / segments, r = TIDE_POOL.inner + (TIDE_POOL.outer - TIDE_POOL.inner) * j / rings
    p.push(TIDE_POOL.x + Math.sin(a) * r, .135, TIDE_POOL.z + Math.cos(a) * r); uv.push(i / segments, j / rings)
    if (j < rings && i < segments) { const k = j * (segments + 1) + i, n = k + segments + 1; indices.push(k, n, k + 1, k + 1, n, n + 1) }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g
}

function rim(radius: number, height: number) {
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 72 }, (_, i) => {
    const a = TIDE_POOL.start + (TIDE_POOL.end - TIDE_POOL.start) * i / 71
    return new THREE.Vector3(TIDE_POOL.x + Math.sin(a) * radius, height, TIDE_POOL.z + Math.cos(a) * radius)
  }))
  return new THREE.TubeGeometry(curve, 100, .026, 8, false)
}

function atelierRill(width: number, height: number) {
  const curve=new THREE.CatmullRomCurve3(ATELIER_RILL_POINTS.map(([x,z])=>new THREE.Vector3(x,height,z)))
  const geometry=new THREE.PlaneGeometry(1,1,48,2),p=geometry.attributes.position,uv=geometry.attributes.uv
  for(let i=0;i<p.count;i++){const u=uv.getX(i),offset=(uv.getY(i)-.5)*width,center=curve.getPointAt(u),tangent=curve.getTangentAt(u);p.setXYZ(i,center.x-tangent.z*offset,height,center.z+tangent.x*offset)}
  geometry.computeVertexNormals();return geometry
}

function ThoughtSeed({ index, materials: m, signal, onIngredient }: { index: number; materials: ObservatoryMaterials; signal: TideSignal; onIngredient: (id: KnowledgeId) => void }) {
  const seed = THOUGHT_SEEDS[index], ingredient = KNOWLEDGE_INGREDIENTS.find(i => i.id === seed.id)!
  const ref = useRef<THREE.Group>(null), core = useRef<THREE.Group>(null), [hovered, setHovered] = useState(false)
  const resources = useMemo(() => {
    const glass = new THREE.MeshPhysicalMaterial({ color: '#b7cfc9', transparent: true, opacity: .14, metalness: .1, roughness: .065, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: 1.7, depthWrite: false })
    const glow = new THREE.MeshStandardMaterial({ color: ingredient.color, emissive: ingredient.color, emissiveIntensity: .8, roughness: .18, metalness: .28, toneMapped: false })
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => {
      const t = i / 63, a = t * Math.PI * 3.2
      return new THREE.Vector3(Math.cos(a) * .13, (t - .5) * .26, Math.sin(a) * .13)
    }))
    return { glass, glow, spiral: new THREE.TubeGeometry(curve, 72, .009, 6, false) }
  }, [ingredient.color])
  useEffect(() => () => { resources.glass.dispose(); resources.glow.dispose(); resources.spiral.dispose() }, [resources])
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = Math.sin(signal.time.value * .55 + index * 1.7) * .026
    if (core.current) { core.current.rotation.y = signal.time.value * .18 + index; core.current.scale.setScalar(hovered ? 1.14 : 1 + signal.pulse.value * .14) }
  })
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.delta <= 5) onIngredient(seed.id) }
  return <group ref={ref} position={[seed.x, seed.y + seed.length, seed.z]} name={`thought-seed-${seed.id}`}>
    <mesh position={[0, -seed.length / 2, 0]} material={m.brass}><cylinderGeometry args={[.007, .007, seed.length, 6]}/></mesh>
    <group position={[0, -seed.length, 0]} onClick={click} onPointerOver={e => { e.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <mesh material={resources.glass}><sphereGeometry args={[.245, 32, 24]}/></mesh>
      <mesh rotation={[Math.PI / 2, .24, 0]} material={m.brightBrass}><torusGeometry args={[.244, .012, 6, 64]}/></mesh>
      <mesh position={[0, .248, 0]} material={m.brightBrass}><sphereGeometry args={[.043, 12, 8]}/></mesh>
      <group ref={core}>
        <mesh geometry={resources.spiral} material={resources.glow}/>
        <mesh rotation={[.3, .3, Math.PI / 6]} scale={[.48, 1, .48]} material={resources.glow}><icosahedronGeometry args={[.12, 1]}/></mesh>
      </group>
      {hovered && <Html center position={[0, -.42, 0]} style={{ pointerEvents: 'none' }}><div className="tide-seed-label">{ingredient.name}<small>选入这一杯</small></div></Html>}
    </group>
  </group>
}

export default function StarTideGarden({ materials: m, signal, onResonate, onIngredient }: {
  materials: ObservatoryMaterials; signal: TideSignal; onResonate: (origin?: [number, number]) => void; onIngredient: (id: KnowledgeId) => void
}) {
  const waterLight = useRef<THREE.PointLight>(null)
  const resources = useMemo(() => {
    const water = new THREE.ShaderMaterial({
      uniforms: { time: signal.time, pulse: signal.pulse, age: signal.age, origin: signal.origin, accent: signal.color },
      side: THREE.DoubleSide, transparent: true, depthWrite: false,
      vertexShader: `uniform float time,pulse,age;uniform vec2 origin;varying vec3 vWorld;varying vec2 vUv;
        void main(){vUv=uv;vec3 p=position;float d=distance(p.xz,origin);
        float ring=sin(d*13.-age*7.)*exp(-pow((d-age*1.2)/.55,2.))*pulse;
        p.y+=sin(p.x*7.+p.z*5.+time*.9)*.007+ring*.017;vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float time,pulse,age;uniform vec2 origin;uniform vec3 accent;varying vec3 vWorld;varying vec2 vUv;
        void main(){vec2 p=vWorld.xz;float d=distance(p,origin),a=p.x*6.+p.y*4.+time*.9,b=p.x*3.-p.y*7.-time*.7;
        float ring=exp(-pow((d-age*1.2)/.17,2.))*pulse;
        vec3 n=normalize(vec3(cos(a)*.06+ring*.1,1.,cos(b)*.045));vec3 v=normalize(cameraPosition-vWorld),r=reflect(-v,n);
        float fresnel=pow(1.-max(dot(v,n),0.),3.);vec3 col=mix(vec3(.014,.09,.11),vec3(.14,.23,.34),fresnel);
        float caustic=pow(max(0.,sin(a)*sin(b)),5.);col+=vec3(.09,.32,.30)*caustic*.45;
        float streak=pow(max(0.,dot(r,normalize(vec3(-.36,.62,-.69)))),90.);
        float threads=pow(.5+.5*sin(p.x*39.+sin(p.y*8.+time)*1.2),15.);
        col+=vec3(1.,.61,.23)*(streak*.85+threads*.032);col+=accent*(ring*.75+pulse*.035);
        float edge=min(vUv.y,1.-vUv.y);col+=vec3(.24,.49,.45)*exp(-edge*37.)*.15;
        gl_FragColor=vec4(col,.93);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    })
    const stone = m.slate.clone(); stone.color.set('#bdc5b5'); stone.roughness = .4; stone.envMapIntensity = .9
    const bed = arcSlab(TIDE_POOL.inner - .025, TIDE_POOL.outer + .025, TIDE_POOL.start, TIDE_POOL.end, .035); bed.translate(TIDE_POOL.x, .035, TIDE_POOL.z)
    const walls = [TIDE_POOL.inner, TIDE_POOL.outer].map(r => { const g = arcSlab(r - .025, r + .025, TIDE_POOL.start, TIDE_POOL.end, .16); g.translate(TIDE_POOL.x, .16, TIDE_POOL.z); return g })
    const basin = mergeMirrorGeometry([bed, ...walls])
    const curves: THREE.BufferGeometry[] = [], roofPanels: THREE.BufferGeometry[] = []
    for (let i = 0; i < 5; i++) {
      const z = -.98 + i * 1.2
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-8.7, 3.75, z), new THREE.Vector3(-7.7, 4.5, z), new THREE.Vector3(-5.6, 4.5, z), new THREE.Vector3(-4.6, 3.75, z)])
      curves.push(new THREE.TubeGeometry(curve, 44, .037, 8, false))
      if (i < 4) {
        const panel = new THREE.PlaneGeometry(1, 1, 36, 2), p = panel.attributes.position, uv = panel.attributes.uv
        for (let n = 0; n < p.count; n++) { const point = curve.getPointAt(uv.getX(n)); p.setXYZ(n, point.x, point.y - .025, z + uv.getY(n) * 1.2) }
        panel.computeVertexNormals(); roofPanels.push(panel)
      }
    }
    const roofGlass = new THREE.MeshPhysicalMaterial({ color: '#d3dac9', transparent: true, opacity: .14, roughness: .11, metalness: .3, envMapIntensity: 1.3, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true })
    const random = mirrorRandom(31337), petalPositions: number[] = []
    for (let i = 0; i < 48; i++) petalPositions.push((random() - .5) * 12 - 2, .3 + random() * 6, (random() - .5) * 10)
    const petals = new THREE.BufferGeometry(); petals.setAttribute('position', new THREE.Float32BufferAttribute(petalPositions, 3))
    const petalMaterial = new THREE.ShaderMaterial({ uniforms: { time: signal.time, pulse: signal.pulse }, transparent: true, depthWrite: false,
      vertexShader: `uniform float time,pulse;varying float rotation;varying float fade;void main(){vec3 p=position;float phase=position.x*.7+position.z;
        p.y=.3+mod(position.y-time*.095+sin(phase)*.2,5.8);p.x+=sin(time*.21+phase)*.8;p.z+=cos(time*.17+phase)*.5;
        vec4 mv=modelViewMatrix*vec4(p,1.);rotation=phase+time*.25;fade=smoothstep(.3,.8,p.y)*(1.-smoothstep(5.,6.1,p.y));
        gl_PointSize=clamp(72./-mv.z,1.,8.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying float rotation,fade;void main(){vec2 p=(gl_PointCoord-.5)*2.;p=mat2(cos(rotation),-sin(rotation),sin(rotation),cos(rotation))*p;
        float d=length(p*vec2(.85,1.6));float a=(1.-smoothstep(.45,.9,d))*fade*.62;
        gl_FragColor=vec4(mix(vec3(.49,.36,.61),vec3(.92,.76,.85),1.-d),a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    })
    const rillCurve=new THREE.CatmullRomCurve3(ATELIER_RILL_POINTS.map(([x,z])=>new THREE.Vector3(x,.151,z)))
    const rillEdges=[-1,1].map(side=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:49},(_,i)=>{const p=rillCurve.getPointAt(i/48),t=rillCurve.getTangentAt(i/48);return p.add(new THREE.Vector3(-t.z,0,t.x).multiplyScalar(side*.17))})),56,.036,8,false))
    return { water, stone, basin, surface: poolSurface(), innerRim: rim(TIDE_POOL.inner, .185), outerRim: rim(TIDE_POOL.outer, .185), curves: mergeMirrorGeometry(curves), roof: mergeMirrorGeometry(roofPanels), roofGlass, petals, petalMaterial,
      rillSurface:atelierRill(.27,.135),rillBed:atelierRill(.40,.095),rillEdges:mergeMirrorGeometry(rillEdges) }
  }, [m, signal])
  useEffect(() => () => Object.values(resources).forEach(resource => resource.dispose()), [resources])
  useFrame(() => { if (waterLight.current) waterLight.current.intensity = 3 + signal.pulse.value * 11 })
  const touchWater = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta <= 5) onResonate([e.point.x, e.point.z]) }
  return <group name="star-tide-garden" dispose={null}>
    <group name="crescent-moonwater-rill" onClick={touchWater}>
      <mesh geometry={resources.basin} material={resources.stone} receiveShadow castShadow/>
      <mesh geometry={resources.surface} material={resources.water} renderOrder={9}/>
      <mesh geometry={resources.innerRim} material={m.brightBrass}/><mesh geometry={resources.outerRim} material={m.brightBrass}/>
      <mesh geometry={resources.rillBed} material={resources.stone} receiveShadow/>
      <mesh geometry={resources.rillEdges} material={resources.stone} castShadow receiveShadow/>
      <mesh geometry={resources.rillSurface} material={resources.water} renderOrder={9}/>
    </group>
    <pointLight ref={waterLight} position={[-2.35, .32, 1.0]} color="#87d8d0" intensity={3} distance={4.3} decay={2}/>
    <mesh name="curved-greenhouse-brass-ribs" geometry={resources.curves} material={m.brass} castShadow/>
    <mesh name="curved-greenhouse-glass" geometry={resources.roof} material={resources.roofGlass}/>
    <StarTideBotany signal={signal}/>
    {THOUGHT_SEEDS.map((_, index) => <ThoughtSeed key={index} index={index} materials={m} signal={signal} onIngredient={onIngredient}/>)}
    <points geometry={resources.petals} material={resources.petalMaterial}/>
  </group>
}
