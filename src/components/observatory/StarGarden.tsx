import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ObservatoryMaterials } from './materials'
import { BoxInstances, Rod, type Instance, type Point } from './Primitives'
import { advanceUniform } from './animation'
import { TREE_POSITION } from './layout'
import { AssetLantern, AssetModel } from '../scene/Assets'
import GardenHalos, { type HaloPoint } from './GardenHalos'
import { GARDEN_LANTERNS } from './gardenLightLayout'
import LivingStarTree from './LivingStarTree'
import { GARDEN_TREE_ANCHORS } from './gardenTreeShape'
import { DetailedGardenLantern } from './GardenDetails'
import TreeJewelry from './TreeJewelry'

const FERN_URL = '/models/garden/fern-02.glb'
const FLOWER_URL = '/models/garden/flowers.glb'
function seeded(seed: number) {
  let value = seed
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296 }
}

type PlantInstance = { position: Point; height: number; rotation: number }
function PlantInstances({ url, instances }: { url: string; instances: PlantInstance[] }) {
  const { scene } = useGLTF(url)
  const ref = useRef<THREE.Group>(null)
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(scene), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3())
    const normalize = new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z)
    const meshes: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = []
    scene.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld).applyMatrix4(normalize)
      geometry.scale(1 / size.y, 1 / size.y, 1 / size.y)
      const patch = (mat: THREE.Material) => {
        const m = mat.clone() as THREE.MeshStandardMaterial
        m.side = THREE.DoubleSide; m.alphaTest = .45; m.transparent = false; m.envMapIntensity = .45
        return m
      }
      meshes.push({ geometry, material: Array.isArray(child.material) ? child.material.map(patch) : patch(child.material) })
    })
    return meshes
  }, [scene])
  useLayoutEffect(() => {
    const transform = new THREE.Object3D()
    ref.current?.traverse(mesh => {
      if (!(mesh instanceof THREE.InstancedMesh)) return
      instances.forEach((plant, i) => {
        transform.position.set(...plant.position); transform.scale.setScalar(plant.height)
        transform.rotation.set(0, plant.rotation, 0); transform.updateMatrix()
        mesh.setMatrixAt(i, transform.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere()
    })
  }, [parts, instances])
  useEffect(() => () => parts.forEach(p => {
    p.geometry.dispose(); (Array.isArray(p.material) ? p.material : [p.material]).forEach(m => m.dispose())
  }), [parts])
  return <group ref={ref} name={url.includes('fern') ? 'garden-ferns' : 'garden-white-flowers'}>
    {parts.map((p, i) => <instancedMesh key={i} args={[p.geometry, p.material, instances.length]} receiveShadow />)}
  </group>
}

const BEDS: { position: Point; radius: number }[] = [
  { position: TREE_POSITION, radius: 2.12 },
  { position: [8.8, 0, 4.5], radius: .6 },
  { position: [8.8, 0, -5.5], radius: .6 },
  { position: [-8.5, 0, -5.7], radius: .57 },
  { position: [-4.9, 0, 5.6], radius: 1.05 },
  { position: [0, 0, 5.4], radius: .8 },
]

export function GardenBeds({ materials: m }: { materials: ObservatoryMaterials }) {
  const plants = useMemo(() => {
    const random = seeded(701), ferns: PlantInstance[] = [], flowers: PlantInstance[] = [], planks: Instance[] = []
    BEDS.forEach((bed, bedIndex) => {
      const count = bedIndex === 0 ? 38 : bed.radius > 1 ? 18 : 8
      for (let i = 0; i < count; i++) {
        const angle = i * 2.399963, radius = bed.radius * (.38 + Math.sqrt(random()) * .54)
        ferns.push({ position: [bed.position[0] + Math.cos(angle) * radius, .34, bed.position[2] + Math.sin(angle) * radius], height: .4 + random() * .4, rotation: random() * Math.PI * 2 })
        if (i % 8 === 0) flowers.push({ position: [bed.position[0] + Math.cos(angle + .2) * radius, .34, bed.position[2] + Math.sin(angle + .2) * radius], height: .4 + random() * .22, rotation: random() * Math.PI * 2 })
      }
      const plankCount = bedIndex === 0 ? 58 : 20
      for (let i = 0; i < plankCount; i++) {
        const a = i / plankCount * Math.PI * 2
        planks.push({ position: [bed.position[0] + Math.sin(a) * bed.radius, .2, bed.position[2] + Math.cos(a) * bed.radius], rotation: [0, a, 0], scale: [2 * Math.PI * bed.radius / plankCount - .012, .4, .075] })
      }
    })
    return { ferns, flowers, planks }
  }, [])
  return <group name="layered-woodland-garden-beds">
    {BEDS.map((bed, i) => <group key={i} position={bed.position}>
      <mesh position={[0, .17, 0]} material={m.slate} receiveShadow><cylinderGeometry args={[bed.radius - .02, bed.radius - .02, .34, 64]} /></mesh>
      <mesh position={[0, .395, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}><torusGeometry args={[bed.radius, .025, 8, 64]} /></mesh>
    </group>)}
    <BoxInstances items={plants.planks} material={m.walnut} />
    <PlantInstances url={FERN_URL} instances={plants.ferns} />
    <PlantInstances url={FLOWER_URL} instances={plants.flowers} />
    <AssetModel asset="plantBig" height={1.4} position={[-8.3, 0, .1]} castShadow={false} />
    <AssetModel asset="plantMid" height={1.0} position={[-5.7, 0, 3.45]} castShadow={false} />
  </group>
}

function SeedLantern({ anchor, length, index, materials: m, reducedMotion }: {
  anchor: Point; length: number; index: number; materials: ObservatoryMaterials; reducedMotion: boolean
}) {
  const ref = useRef<THREE.Group>(null), radius = .2 + (index % 3) * .028
  useFrame(({ clock }) => {
    if (ref.current && !reducedMotion) ref.current.rotation.z = Math.sin(clock.elapsedTime * .45 + index * 1.6) * .023
  })
  return <group ref={ref} position={anchor} name="hanging-star-seed">
    <Rod from={[0, 0, 0]} to={[0, -length, 0]} radius={.006} material={m.brass} />
    <group position={[0, -length - radius, 0]}>
      <mesh material={m.starGlass}><sphereGeometry args={[radius, 24, 16]} /></mesh>
      <mesh position={[0, -radius, 0]} material={m.brass}><cylinderGeometry args={[.032, .02, .025, 12]} /></mesh>
      <mesh position={[0, radius, 0]} material={m.brass}><cylinderGeometry args={[.04, .04, .04, 12]} /></mesh>
      {[0, Math.PI / 2].map(a => <mesh key={a} rotation={[0, 0, a]} scale={[.28, 1, .28]}><octahedronGeometry args={[.075, 0]} /><meshBasicMaterial color={index % 2 ? '#bedff2' : '#ffe1a0'} toneMapped={false} /></mesh>)}
      {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 3.4 + index) * radius * .65, Math.cos(i * 1.7) * radius * .65, Math.sin(i * 7.9) * radius * .55]}>
        <sphereGeometry args={[.009, 5, 4]} /><meshBasicMaterial color="#b6d6eb" toneMapped={false} />
      </mesh>)}
    </group>
  </group>
}

export function StarTree({ materials: m, reducedMotion }: { materials: ObservatoryMaterials; reducedMotion: boolean }) {
  const halos = useMemo<HaloPoint[]>(() => GARDEN_TREE_ANCHORS.map((anchor,index) => {
    const p=anchor,length=index>6?.42:.6+(index%3)*.21,radius=.2+(index%3)*.028
    return {position:[p[0],p[1]-length-radius,p[2]],radius:.45,color:index%3===1?'#aee6ff':'#ffe0a0',star:true}
  }),[])
  const target=useMemo(()=>{const object=new THREE.Object3D();object.position.set(-1.9,3.25,-2.7);return object},[])
  return <group name="living-star-tree">
    <LivingStarTree reducedMotion={reducedMotion} />
    <TreeJewelry materials={m} reducedMotion={reducedMotion} />
    {GARDEN_TREE_ANCHORS.map((anchor, i) => <SeedLantern key={i} anchor={anchor} length={i > 6 ? .42 : .6 + (i % 3) * .21} index={i} materials={m} reducedMotion={reducedMotion} />)}
    <GardenHalos points={halos} reducedMotion={reducedMotion} />
    <primitive object={target} />
    <spotLight position={[-4.1,.75,.25]} target={target} color="#ffb85c" intensity={75} angle={.6} penumbra={.8} distance={11} decay={2} />
    <pointLight position={[-2, 3.2, -.4]} color="#ffd193" intensity={7} distance={7} decay={2} />
  </group>
}

export function GardenLighting({ materials: m, reducedMotion }: { materials: ObservatoryMaterials; reducedMotion: boolean }) {
  const particles = useRef<THREE.Points>(null)
  const fireflies = useMemo(() => {
    const random = seeded(1937), positions: number[] = []
    for (let i = 0; i < 90; i++) {
      const a = random() * Math.PI * 2, r = 1.4 + random() * 2.4
      positions.push(-2 + Math.cos(a) * r, .65 + random() * 2.6, -2 + Math.sin(a) * r)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float time; varying float glow; void main(){
        vec3 p=position; float s=position.x*5.+position.z*3.;
        p.y+=sin(time*.3+s)*.12; p.x+=sin(time*.15+s)*.07;
        vec4 view=modelViewMatrix*vec4(p,1.); glow=.25+.75*pow(.5+.5*sin(time*.6+s),3.);
        gl_PointSize=clamp(40./-view.z,1.,7.); gl_Position=projectionMatrix*view;
      }`,
      fragmentShader: `varying float glow; void main(){float d=length(gl_PointCoord-.5); float a=exp(-d*d*24.)*glow;gl_FragColor=vec4(1.,.77,.32,a);}`,
    })
    return { geometry: g, material }
  }, [])
  const haloPoints = useMemo<HaloPoint[]>(() => GARDEN_LANTERNS.map(lamp => ({
    position: [lamp.position[0], lamp.position[1]+lamp.height*.41, lamp.position[2]],
    radius: lamp.height*1.0, color: '#ffbb60',
  })), [])
  const compass = useMemo(() => {
    const points: number[] = []
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,r=i%2?.65:1.03,w=.12
      points.push(0,0,0,Math.sin(a)*r,0,Math.cos(a)*r,Math.sin(a+Math.PI/2)*w,0,Math.cos(a+Math.PI/2)*w)
    }
    const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.computeVertexNormals();return geometry
  }, [])
  const path = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([[4.4, .012, 7.2], [2.2, .012, 4.3], [1.1, .012, 1.4], [1.25, .012, -2.4], [2.7, .012, -5.7]].map(p => new THREE.Vector3(...p)))
    return new THREE.TubeGeometry(curve, 100, .013, 5, false)
  }, [])
  useEffect(() => () => { fireflies.geometry.dispose(); fireflies.material.dispose(); path.dispose(); compass.dispose() }, [fireflies, path, compass])
  useFrame((_, delta) => { if (!reducedMotion) advanceUniform(fireflies.material.uniforms.time, delta) })
  return <group name="garden-lanterns-and-fireflies">
    <mesh geometry={path} material={m.inlay} />
    <group name="inlaid-compass-rose" position={[2.2,.014,2.7]}>
      <mesh geometry={compass} material={m.inlay} />
      <mesh rotation={[-Math.PI/2,0,0]} material={m.inlay}><ringGeometry args={[1.12,1.14,96]} /></mesh>
      <mesh rotation={[-Math.PI/2,0,0]} material={m.inlay}><ringGeometry args={[1.22,1.23,96]} /></mesh>
    </group>
    {GARDEN_LANTERNS.map((lamp, i) => i < 8
      ? <DetailedGardenLantern key={i} position={lamp.position} height={lamp.height} lightIntensity={0} />
      : <AssetLantern key={i} position={lamp.position} height={lamp.height} />)}
    <GardenHalos points={haloPoints} reducedMotion={reducedMotion} />
    <pointLight position={[-.25, .75, 1.05]} color="#ffbf73" intensity={9} distance={7} decay={2} />
    <pointLight position={[-5.1, 1.2, -.5]} color="#ffc677" intensity={12} distance={6} decay={2} />
    <pointLight position={[6.9, 1, -3.0]} color="#ffc16b" intensity={11} distance={5.5} decay={2} />
    <points ref={particles} geometry={fireflies.geometry} material={fireflies.material} />
  </group>
}
