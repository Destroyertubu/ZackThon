import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { WorldPoint } from '../realmDefinitions'
export type MaterialKey='stone'|'wood'|'darkWood'|'brass'|'iron'|'plaster'|'bark'|'leaves'|'petals'|'glass'|'glow'|'leaf'|'ink'|'paper'|'rose'|'paving'|'artMonet'|'artBridge'|'artVenice'
export class WorldBuilder {
  parts=new Map<MaterialKey,THREE.BufferGeometry[]>()
  add(geometry:THREE.BufferGeometry,key:MaterialKey,position:WorldPoint=[0,0,0],rotation:WorldPoint=[0,0,0],scale:WorldPoint=[1,1,1]){
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale))
    geometry.applyMatrix4(matrix)
    if(!geometry.index)geometry.setIndex(Array.from({length:geometry.getAttribute('position').count},(_,i)=>i))
    if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2))
    if(!geometry.getAttribute('normal'))geometry.computeVertexNormals()
    const parts=this.parts.get(key)??[];parts.push(geometry);this.parts.set(key,parts)
  }
  box(key:MaterialKey,p:WorldPoint,size:WorldPoint,rotation:WorldPoint=[0,0,0]){this.add(new THREE.BoxGeometry(...size),key,p,rotation)}
  rod(key:MaterialKey,a:WorldPoint,b:WorldPoint,radius:number,top=radius){
    const direction=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),geometry=new THREE.CylinderGeometry(top,radius,direction.length(),10)
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()))
    this.add(geometry,key,[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2])
  }
  curve(key:MaterialKey,points:WorldPoint[],radius=.06,segments=32){this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,7,false),key)}
  ring(key:MaterialKey,p:WorldPoint,radius:number,tube=.03,rotation:WorldPoint=[Math.PI/2,0,0]){this.add(new THREE.TorusGeometry(radius,tube,6,48),key,p,rotation)}
  sphere(key:MaterialKey,p:WorldPoint,scale:WorldPoint,detail=16){this.add(new THREE.SphereGeometry(1,detail,Math.max(8,detail/2)),key,p,[0,0,0],scale)}
  finish(){
    const result=new Map<MaterialKey,THREE.BufferGeometry>()
    this.parts.forEach((parts,key)=>{const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(geometry){geometry.computeBoundingSphere();result.set(key,geometry)}})
    this.parts.clear();return result
  }
}
export function random(seed:number){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
export function taperedBranch(points:WorldPoint[],radius:number,end=.03){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),frames=curve.computeFrenetFrames(18,false)
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[]
  for(let i=0;i<=18;i++){
    const t=i/18,p=curve.getPointAt(t),r=end+(radius-end)*Math.pow(1-t,.83)
    for(let j=0;j<=9;j++){const a=j/9*Math.PI*2,v=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);positions.push(v.x,v.y,v.z);uvs.push(j/9,t*3);if(i<18&&j<9){const k=i*10+j;indices.push(k,k+10,k+1,k+1,k+10,k+11)}}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g
}
export function leafBlade(width:number,length:number,curl=1,rows=20,columns=8){
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[]
  for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const t=row/rows,u=column/columns*2-1,spread=Math.pow(Math.max(.001,Math.sin(t*Math.PI)),.75)
    positions.push(u*width*.5*spread,Math.sin(t*Math.PI)*curl+Math.abs(u)*.15,t*length-length*.5);uvs.push(column/columns,t)
    if(row<rows&&column<columns){const k=row*(columns+1)+column;indices.push(k,k+columns+1,k+1,k+1,k+columns+1,k+columns+2)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g
}
export function stoneIsland(radius:number,seed:number){
  const rnd=random(seed),points:THREE.Vector2[]=[]
  for(let i=0;i<40;i++){const angle=i/40*Math.PI*2,r=radius+.08+rnd()*.4;points.push(new THREE.Vector2(Math.cos(angle)*r,Math.sin(angle)*r))}
  const geometry=new THREE.ExtrudeGeometry(new THREE.Shape(points),{depth:1.5,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.24,bevelThickness:.22,curveSegments:24})
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-1.72,0)
  const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv')
  for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)*.24,positions.getZ(i)*.24)
  return geometry
}
