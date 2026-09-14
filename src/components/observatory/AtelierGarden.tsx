import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ObservatoryMaterials } from './materials'
import { PlantInstances } from './StarGarden'
import { TIDE_POOL } from './starTideLayout'

function tube(points: THREE.Vector3[], radius: number) { return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,radius,8,false) }
function join(parts:THREE.BufferGeometry[]){const geometry=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return geometry}

/** A rooted petal canopy frames the reading corner, leaving the telescope's sky open. */
export default function AtelierGarden({materials:m}:{materials:ObservatoryMaterials}) {
  const resources=useMemo(()=>{
    const brass:THREE.BufferGeometry[]=[],glass:THREE.BufferGeometry[]=[],rocks:THREE.BufferGeometry[]=[]
    const flowerPlants:{position:[number,number,number];height:number;rotation:number}[]=[]
    const center=new THREE.Vector3(8.3,3.58,3.0)
    for(let petal=0;petal<3;petal++) {
      const angle=-1.8+petal*.95
      const point=(u:number,v:number)=>{
        const r=u*2.05,w=Math.sin(Math.PI*u)*.78*v
        return new THREE.Vector3(center.x+Math.cos(angle)*r-Math.sin(angle)*w,center.y+Math.sin(u*Math.PI)*.56-u*.46+v*v*.14,center.z+Math.sin(angle)*r+Math.cos(angle)*w)
      }
      const panel=new THREE.PlaneGeometry(1,1,28,10),p=panel.attributes.position,uv=panel.attributes.uv
      for(let i=0;i<p.count;i++){const v=point(uv.getX(i),uv.getY(i)*2-1);p.setXYZ(i,v.x,v.y,v.z)}
      panel.computeVertexNormals();glass.push(panel)
      for(const edge of [-1,0,1])brass.push(tube(Array.from({length:40},(_,i)=>point(i/39,edge)),edge===0?.019:.012))
    }
    brass.push(tube([new THREE.Vector3(10.1,.54,4.4),new THREE.Vector3(10.05,2,4.4),new THREE.Vector3(9.4,3.15,3.9),center],.055))
    brass.push(tube([new THREE.Vector3(10.1,1.7,4.4),new THREE.Vector3(9.6,2.8,3.1),new THREE.Vector3(8.7,3.5,2.5),center],.027))
    for(let i=0;i<42;i++) {
      const a=TIDE_POOL.start+(TIDE_POOL.end-TIDE_POOL.start)*i/41
      const radius=TIDE_POOL.outer+.014
      const x=TIDE_POOL.x+Math.sin(a)*radius,z=TIDE_POOL.z+Math.cos(a)*radius
      if (Math.abs(x-TIDE_POOL.x)<.88) continue
      const g=new THREE.IcosahedronGeometry(1,2)
      const p=g.attributes.position
      for(let j=0;j<p.count;j++){const v=new THREE.Vector3().fromBufferAttribute(p,j);const noise=1+Math.sin(v.x*7+v.z*5+i)*.09;p.setXYZ(j,v.x*noise,v.y*noise,v.z*noise)}
      g.computeVertexNormals();g.scale(.10+(i%3)*.018,.072+(i%4)*.012,.08);g.rotateY(a);g.translate(x,.105,z);rocks.push(g)
      if(i%10===0)flowerPlants.push({position:[TIDE_POOL.x+Math.sin(a)*(TIDE_POOL.inner-.1),.21,TIDE_POOL.z+Math.cos(a)*(TIDE_POOL.inner-.1)],height:.28+(i%3)*.05,rotation:a})
    }
    // Fern and flower groups are rooted inside existing perimeter beds.
    for(const [a,r,h] of [[.78,10.65,.8],[1.05,10.55,.55],[2.2,10.3,.74],[3.58,10.48,.8],[4.32,10.4,.68],[5.4,10.4,.75]]) {
      flowerPlants.push({position:[Math.sin(a)*r,.55,Math.cos(a)*r],height:h,rotation:a})
    }
    const stone=m.stone.clone();stone.color.set('#d1cbb6');stone.roughness=.47;stone.normalScale.set(.2,.2)
    const opal=new THREE.MeshPhysicalMaterial({color:'#8aaca9',transparent:true,opacity:.12,roughness:.17,metalness:.15,clearcoat:.8,envMapIntensity:1,side:THREE.DoubleSide,depthWrite:false,forceSinglePass:true})
    return {brass:join(brass),glass:join(glass),rocks:join(rocks),stone,opal,flowerPlants}
  },[m])
  useEffect(()=>()=>{resources.brass.dispose();resources.glass.dispose();resources.rocks.dispose();resources.stone.dispose();resources.opal.dispose()},[resources])
  return <group name="pearl-shore-and-petal-reading-canopy">
    <mesh geometry={resources.brass} material={m.brass} castShadow/>
    <mesh geometry={resources.glass} material={resources.opal}/>
    <mesh geometry={resources.rocks} material={resources.stone} receiveShadow castShadow/>
    <PlantInstances url="/models/garden/optimized/flowers.glb" instances={resources.flowerPlants}/>
    <group name="level-moonwater-bridge" position={[-2,0,1.46]}>
      {Array.from({length:9},(_,i)=><mesh key={i} position={[0,.166,-.40+i*.10]} material={m.walnut} castShadow receiveShadow><boxGeometry args={[1.38,.046,.095]}/></mesh>)}
      {[-.67,.67].map(x=><mesh key={x} position={[x,.191,0]} material={m.brass}><boxGeometry args={[.012,.007,.91]}/></mesh>)}
      {[-1,1].map(side=><mesh key={side} position={[0,.085,side*.465]} rotation={[side*.96,0,0]} material={m.walnut} receiveShadow><boxGeometry args={[1.38,.019,.23]}/></mesh>)}
    </group>
  </group>
}
