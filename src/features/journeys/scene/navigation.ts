import type { LandDefinition, RealmDefinition, WorldPose, WorldPoint } from '../realmDefinitions'
export type WalkWorld = RealmDefinition | LandDefinition
export const PLAYER_RADIUS = .3
export const EYE_HEIGHT = 1.7
export function segmentProjection(x:number,z:number,a:WorldPoint,b:WorldPoint) {
  const dx=b[0]-a[0],dz=b[2]-a[2],length=dx*dx+dz*dz
  const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/length)):0
  return { distance:Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t),height:a[1]+(b[1]-a[1])*t }
}
/** The rendered walkways and movement boundaries share exactly these surfaces. */
export function groundHeight(world:WalkWorld,x:number,z:number,margin=PLAYER_RADIUS):number|null {
  if(!Number.isFinite(x)||!Number.isFinite(z))return null
  let height:number|null=null
  for(const surface of world.surfaces){
    if(surface.kind==='disc'){
      if(Math.hypot(x-surface.center[0],z-surface.center[2])<=surface.radius-margin)height=Math.max(height??-Infinity,surface.center[1])
    }else if(surface.kind==='rect'){
      if(Math.abs(x-surface.center[0])<=surface.width/2-margin&&Math.abs(z-surface.center[2])<=surface.depth/2-margin)height=Math.max(height??-Infinity,surface.center[1])
    }else for(let i=1;i<surface.points.length;i++){
      const sample=segmentProjection(x,z,surface.points[i-1],surface.points[i])
      if(sample.distance<=surface.width/2-margin)height=Math.max(height??-Infinity,sample.height)
    }
  }
  if(height===null)return null
  for(const obstacle of world.obstacles){
    if(Math.abs(obstacle.center[1]-height)>1.7)continue
    if('radius'in obstacle){if(Math.hypot(x-obstacle.center[0],z-obstacle.center[2])<obstacle.radius+margin)return null}
    else if(Math.abs(x-obstacle.center[0])<obstacle.width/2+margin&&Math.abs(z-obstacle.center[2])<obstacle.depth/2+margin)return null
  }
  return height
}
/** A station survives scene reconstruction even when a saved position is now inside a prop. */
export function stationSafePose(world:WalkWorld,stationId:string):WorldPose | undefined {
  const station=world.stations.find(item=>item.id===stationId)
  if(!station)return undefined
  const candidates: [number,number][]=[[0,0],[0,.8],[.8,0],[-.8,0],[0,-.8],[1.4,0],[-1.4,0],[0,1.4],[0,-1.4]]
  for(const [dx,dz] of candidates){
    const x=station.position[0]+dx,z=station.position[2]+dz,y=groundHeight(world,x,z)
    if(y!==null)return {position:[x,y+EYE_HEIGHT,z],yaw:world.spawn.yaw,pitch:0}
  }
  return undefined
}
export function safePose(world:WalkWorld,value?:WorldPose,stationId?:string):WorldPose {
  const valid=value&&value.position?.length===3&&value.position.every(Number.isFinite)&&Number.isFinite(value.yaw)&&Number.isFinite(value.pitch)
  const station=world.stations.find(item=>item.id===stationId)
  if(valid){
    const y=groundHeight(world,value.position[0],value.position[2])
    const near=!station||Math.hypot(value.position[0]-station.position[0],value.position[2]-station.position[2])<=3.1
    if(y!==null&&near)return {position:[value.position[0],y+EYE_HEIGHT,value.position[2]],yaw:value.yaw,pitch:Math.max(-1.25,Math.min(1.25,value.pitch))}
  }
  const arrival=station&&stationSafePose(world,station.id)
  if(arrival)return arrival
  if(valid){
    const nearest=[...world.stations].sort((a,b)=>Math.hypot(a.position[0]-value.position[0],a.position[2]-value.position[2])-Math.hypot(b.position[0]-value.position[0],b.position[2]-value.position[2]))
    for(const item of nearest){const pose=stationSafePose(world,item.id);if(pose)return pose}
  }
  return {position:[...world.spawn.position],yaw:world.spawn.yaw,pitch:world.spawn.pitch}
}
export function nearestStation(world:WalkWorld,position:WorldPoint,radius=3.1){
  let result=null,best=radius
  for(const station of world.stations){
    const distance=Math.hypot(station.position[0]-position[0],station.position[2]-position[2])
    if(distance<best&&Math.abs(position[1]-EYE_HEIGHT-station.position[1])<1.3){best=distance;result=station}
  }
  return result
}
