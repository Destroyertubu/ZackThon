import { SUNSET_DECOR_OBSTACLES } from './sunsetLayout'
import { MOON_STAGES, stageSeatRuns } from './stageLayout'
import type { WorldObstacle, WorldPoint } from '../realmDefinitions'

/** Solid furnishings share their placements with the architectural builders. Soft planting stays permeable. */
export function decorObstacles(id:string):WorldObstacle[] {
  const result:WorldObstacle[]=[]
  const circle=(x:number,z:number,radius:number,y=0)=>result.push({center:[x,y,z],radius})
  const rect=(x:number,z:number,width:number,depth:number,y=0)=>result.push({center:[x,y,z],width,depth})
  const pergola=(x:number,z:number,scale:number,y=0)=>{
    for(const dx of [-2.7,2.7])for(const dz of [-2,2])circle(x+dx*scale,z+dz*scale,.31*scale,y)
    rect(x,z-1.55*scale,2.3*scale,.8*scale,y)
  }
  const facade=(x:number,z:number,yaw:number)=>{
    for(const localX of [-2.7,2.7]){
      const cx=x+Math.cos(yaw)*localX+Math.sin(yaw)*1.15,cz=z-Math.sin(yaw)*localX+Math.cos(yaw)*1.15
      rect(cx,cz,Math.abs(Math.cos(yaw))*2.2+Math.abs(Math.sin(yaw))*.6,Math.abs(Math.sin(yaw))*2.2+Math.abs(Math.cos(yaw))*.6)
    }
  }
  if(id==='mirror-sea') {
    for(const [x,z,h] of [[-7,21,0],[7,22,0],[15,-6.5,0]])circle(x,z,.7,h)
    pergola(12,-7.2,.8);pergola(-10,-23,.72,3.2)
    rect(8,-3,.8,2.3);rect(15.8,-2,.8,2.3)
    for(const [x,y,z] of [[-8,0,13],[7,0,12],[-20,1,-6],[-17,2.2,-15],[20,0,-10],[17,0,-20]] as WorldPoint[])circle(x,z,.13,y)
    circle(21,-24,.85)
    for(const x of [-4.5,4.5])rect(x,24.3,3,.6)
  } else if(id==='sunset-boulevard') {
    result.push(...SUNSET_DECOR_OBSTACLES)
  } else if(id==='unsent-answers') {
    for(const [x,z] of [[-16,-1.2],[16,-1.2],[0,-22]]){
      for(const dx of [-3,3])for(const dz of [0,-3.7])circle(x+dx,z+dz,.31)
      rect(x,z-3.8,6.4,.3);rect(x,z-3.45,5.5,.5)
    }
    for(const x of [-5,5]){circle(x,13,.13);rect(x,10,2,.6)}
    circle(-21,2,.7);circle(21,2,.7)
  } else if(id==='moss-letters') {
    for(let i=0;i<14;i++){const a=i/14*6.28;circle(Math.cos(a)*25,Math.sin(a)*25,.7)}
    for(const [x,z] of [[-6,12],[-15,1],[-10,-13],[12,-12],[16,9]])circle(x,z,1.1)
  } else if(id==='moonlight-andante') {
    for(const [x,z,r] of MOON_STAGES) {
      for(const side of [-1,1])circle(x+side*(r-.3),z,.13)
      for(let tier=0;tier<3;tier++)for(const run of stageSeatRuns(x,z,r,tier))for(let i=0;i<run.length;i++)if(i%3===0||i===run.length-1)circle(run[i][0],run[i][2],.2)
    }
    rect(-9,-16.5,2.6,.4)
  } else if(id==='dew-specimens') {
    for(const [x,y,z] of [[-15,1,6],[14,1.5,-1],[-12,1.1,-15],[5,2,-25]])circle(x,z,1.65,y)
  } else if(id==='blue-hour-shutter') {
    for(const [x,z] of [[-18,16],[-12,7],[-18,-2],[-6,3],[3,3],[16,-7],[11,-16],[17,-24]])circle(x,z,.13)
    for(let i=0;i<4;i++){facade(-20.3,21-i*8,Math.PI/2);facade(-9.7,22-i*7.5,-Math.PI/2);facade(8.7,-8-i*6,Math.PI/2);facade(19.3,-8-i*6,-Math.PI/2)}
    for(let i=0;i<3;i++)facade(-7+i*8,-5.3,0)
  } else if(id==='forest-lento') {
    for(const [x,z] of [[-12,7],[-6,-16],[15,-14],[16,10]])circle(x-Math.cos(.5),z+Math.sin(.5),.09)
  }
  return result
}
