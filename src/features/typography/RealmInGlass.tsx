import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getRealmForRecipe } from '@/features/journeys/realmDefinitions'
import type { ThoughtRecipe } from '@/components/observatory/gardenRecipes'
import { useReducedMotion } from './useReducedMotion'

/** The miniature uses the destination's real route layout, so every drink opens its own geography. */
export default function RealmInGlass({ recipe }: { recipe: ThoughtRecipe }) {
  const realm = getRealmForRecipe(recipe)!
  const group = useRef<THREE.Group>(null)
  const elapsed = useRef(0)
  const reduced = useReducedMotion()
  const paths = useMemo(() => realm.surfaces.map(surface => {
    if (surface.kind === 'path') return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(surface.points.map(p => new THREE.Vector3(...p))),48,surface.width*.25,5,false)
    if (surface.kind === 'disc') return new THREE.CylinderGeometry(surface.radius,surface.radius*.86,.65,32).translate(...surface.center)
    return new THREE.BoxGeometry(surface.width,.65,surface.depth).translate(...surface.center)
  }),[realm])
  useEffect(()=>()=>paths.forEach(path=>path.dispose()),[paths])
  useFrame((_,delta)=>{
    if (!group.current) return
    elapsed.current = Math.min(1,elapsed.current+Math.min(delta,.05)*.7)
    const phase = reduced ? 1 : elapsed.current
    group.current.scale.setScalar(.014 + phase*.008)
    group.current.position.y = .48 + phase*.19
    group.current.rotation.y = reduced ? -.3 : -.3 + phase*.2
  })
  const natural = realm.pair.includes('nature'), music = realm.pair.includes('music')
  return <group ref={group} name={`drink-destination-${realm.id}`} position={[0,.6,-.2]} rotation={[.4,-.3,0]} scale={.022}>
    {paths.map((geometry,i)=><mesh key={i} geometry={geometry}><meshStandardMaterial color={realm.palette.stone} emissive={realm.palette.accent} emissiveIntensity={.35} roughness={.6}/></mesh>)}
    {realm.stations.map((station,i)=><group key={station.id} position={station.position}>
      <mesh position={[-3,2,0]}><cylinderGeometry args={[.22,.35,4,8]}/><meshStandardMaterial color="#b49a70" metalness={.45} roughness={.4}/></mesh>
      {natural?<mesh position={[-3,4,0]}><icosahedronGeometry args={[2.5,1]}/><meshStandardMaterial color={realm.palette.foliage} emissive={realm.palette.foliage} emissiveIntensity={.15}/></mesh>:<mesh position={[-3,4,0]}><torusGeometry args={[music?2.2:1.4,.12,6,32,music?Math.PI*2:Math.PI]}/><meshBasicMaterial color={realm.palette.accent}/></mesh>}
      <mesh position={[3,1.5,0]}><boxGeometry args={[2,3+i*.2,2]}/><meshStandardMaterial color={realm.palette.stone} roughness={.7}/></mesh>
    </group>)}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.8,0]}><circleGeometry args={[29,64]}/><meshBasicMaterial color={realm.palette.water} transparent opacity={.23} depthWrite={false}/></mesh>
  </group>
}
