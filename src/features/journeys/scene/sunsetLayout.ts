import type { WorldObstacle, WorldPoint } from '../realmDefinitions'
import type { WaterShore } from './waterSurface'

export type SunsetFacadeKind = 'bookshop' | 'atelier' | 'gallery'
export const SUNSET_FACADES: readonly { kind: SunsetFacadeKind; position: WorldPoint; yaw: number; scale: number }[] = [
  { kind: 'bookshop', position: [-4.9, 0, 13], yaw: Math.PI / 2, scale: 1 },
  { kind: 'atelier', position: [-5.15, 0, 2.8], yaw: Math.PI / 2, scale: 1 },
  { kind: 'gallery', position: [5.3, 0, -13.3], yaw: -Math.PI / 2, scale: 1 },
  { kind: 'atelier', position: [-5.8, 0, -16.5], yaw: Math.PI / 2, scale: .88 },
]
export const SUNSET_TREES: readonly { position: WorldPoint; height: number; seed: number; flower: boolean }[] = [
  { position: [-6.5, 0, 22], height: 9.6, seed: 129, flower: true },
  { position: [6.3, 0, 19.5], height: 10.2, seed: 173, flower: true },
  { position: [7.8, 0, 10], height: 8.8, seed: 237, flower: false },
  { position: [6.4, 0, 5.4], height: 9.8, seed: 355, flower: true },
  { position: [-7.7, 0, -5.6], height: 10.4, seed: 477, flower: false },
  { position: [-6, 0, -9.5], height: 8.9, seed: 519, flower: true },
  { position: [8.6, 0, -22.5], height: 9.1, seed: 622, flower: true },
]
export interface SunsetPlantingSite {
  /** World-space root contact point; GLB placement must anchor its root here. */
  position: WorldPoint
  yaw: number
  /** Maximum horizontal crown/root envelope inside the recessed soil. */
  maxRadius: number
}
export interface SunsetPlanterDefinition {
  id: string
  position: WorldPoint
  length: number
  depth: number
  yaw: number
  seed: number
  /** Soil surface, relative to position[1]; the coping top is 0.51 m. */
  soilHeight: number
  innerLength: number
  innerDepth: number
  plantSites: readonly SunsetPlantingSite[]
}
function definePlanter(id:string,position:WorldPoint,length:number,seed:number,yaw:number):SunsetPlanterDefinition {
  const depth=1.65,soilHeight=.44,innerLength=length-.26,innerDepth=depth-.24
  const count=Math.max(2,Math.floor((innerLength-.84)/.72)+1),span=innerLength-.88
  const plantSites=Array.from({length:count},(_,index):SunsetPlantingSite=>{
    const x=-span/2+span*index/(count-1),z=index%2?.21:-.21
    return {
      position:[position[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,position[1]+soilHeight,position[2]-Math.sin(yaw)*x+Math.cos(yaw)*z],
      yaw:yaw+index*2.39996,maxRadius:.42,
    }
  })
  return {id,position,length,depth,yaw,seed,soilHeight,innerLength,innerDepth,plantSites}
}
/** Stone boxes, recessed planting, static assets and collision share these six placements. */
export const SUNSET_PLANTERS:readonly SunsetPlanterDefinition[]=[
  definePlanter('entrance-west',[-5.1,0,22],4.8,41,.2),
  definePlanter('entrance-east',[5.2,0,20],5.3,61,-.3),
  definePlanter('bridge-east',[5.6,0,8.2],5.5,91,Math.PI/2),
  definePlanter('bridge-west',[-5.6,0,-7.5],4.9,171,Math.PI/2),
  definePlanter('belvedere-east',[6.1,0,-20.8],4.5,232,-.45),
  definePlanter('belvedere-west',[-5.4,0,-25.4],3.4,334,.6),
]
/** Small rotated cells cover the full coping without a street-blocking whole-box AABB. */
export function sunsetPlanterObstacles(planter:SunsetPlanterDefinition):WorldObstacle[] {
  const length=planter.length+.04,depth=planter.depth+.09
  const columns=Math.ceil(length/.4),rows=Math.ceil(depth/.4),dx=length/columns,dz=depth/rows
  const c=Math.cos(planter.yaw),s=Math.sin(planter.yaw)
  return Array.from({length:columns*rows},(_,index)=>{
    const x=-length/2+(index%columns+.5)*dx,z=-depth/2+(Math.floor(index/columns)+.5)*dz
    return {center:[planter.position[0]+c*x+s*z,planter.position[1],planter.position[2]-s*x+c*z] as WorldPoint,
      width:Math.abs(c)*dx+Math.abs(s)*dz,depth:Math.abs(s)*dx+Math.abs(c)*dz}
  })
}
export const SUNSET_LANTERNS: readonly WorldPoint[] = [[3.5,0,15.5],[-3.65,0,7.1],[4,0,1.2],[-3.8,0,-5.7],[3.3,0,-18.5],[-4.6,0,-25.4],[4.7,0,-25.4]]
/** Physical lamp bulbs and the lighting rig use these same world locations. */
export const SUNSET_PRACTICAL_LIGHTS: readonly WorldPoint[] = [
  ...SUNSET_LANTERNS.map(([x,y,z]):WorldPoint=>[x,y+3.1,z]),
  [-5.4,2.4,13],[-5.65,2.3,2.8],[5.8,2.7,-13.3],[-6.15,2.1,-16.5],
]
export const SUNSET_BENCHES: readonly { position: WorldPoint; yaw: number }[] = [
  {position:[4.6,0,11.6],yaw:-Math.PI/2},
  {position:[-4.8,0,-7.1],yaw:Math.PI/2},
  {position:[3.6,0,-26.2],yaw:-.45},
]
export const sunsetBridgeCenterX=(z:number)=>1.142857142857+z*.178571428571
export const SUNSET_ROAD_FOOTINGS: readonly (readonly WorldPoint[])[] = [
  [[0,0,26],[0,0,13],[1.5,0,2],[1.428571,0,1.6]],
  [[.142857,0,-5.6],[-1,0,-12],[0,0,-26]],
]
export const SUNSET_FACADE_FOOTINGS=SUNSET_FACADES.map(({position,yaw,kind,scale})=>({
  center:[position[0]-Math.sin(yaw)*1.23*scale,-.69,position[2]-Math.cos(yaw)*1.23*scale] as WorldPoint,
  width:(kind==='bookshop'?9.0:kind==='gallery'?9.4:7.0)*scale,depth:3.05*scale,yaw,
}))
function rectangleShore(center:WorldPoint,width:number,depth:number,yaw=0):WaterShore {
  return {closed:true,points:[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2],[-width/2,depth/2]].map(([x,z])=>[center[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,center[2]-Math.sin(yaw)*x+Math.cos(yaw)*z] as const)}
}
/** Shore foam follows the real stone supports, leaving the 7.2 m bridge channel open. */
export const SUNSET_SHORES:readonly WaterShore[]=[
  ...SUNSET_ROAD_FOOTINGS.flatMap(points=>points.slice(1).map((b,i)=>{
    const a=points[i],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)
    return rectangleShore([(a[0]+b[0])/2,-.69,(a[2]+b[2])/2],8,length,Math.atan2(dx,dz))
  })),
  ...SUNSET_FACADE_FOOTINGS.map(({center,width,depth,yaw})=>rectangleShore(center,width,depth,yaw)),
  ...SUNSET_TREES.map(({position,height})=>({center:[position[0],position[2]] as const,radii:[height*.32+.2,height*.32+.2] as const})),
  {center:[0,-24],radii:[7.2,7.2]},
]
/** No bridge-underpass is navigable: the promenade and bridge deck remain at y=0. */
export const SUNSET_DECOR_OBSTACLES: readonly WorldObstacle[] = [
  ...SUNSET_PLANTERS.flatMap(sunsetPlanterObstacles),
  ...SUNSET_LANTERNS.map(([x,y,z])=>({center:[x,y,z] as WorldPoint,radius:.17})),
  ...SUNSET_BENCHES.map(({position,yaw})=>({center:position,width:Math.abs(Math.cos(yaw))*2.4+Math.abs(Math.sin(yaw))*.9,depth:Math.abs(Math.sin(yaw))*2.4+Math.abs(Math.cos(yaw))*.9})),
  ...SUNSET_TREES.map(({position,height})=>({center:position,radius:height*.072})),
  // Front walls remain outside the main route. The deep interiors are display spaces.
  ...SUNSET_FACADES.map(({position,kind,scale})=>({center:position,width:.3,depth:(kind==='bookshop'?8.8:kind==='gallery'?9.2:6.8)*scale})),
  ...[[-5,0,-27],[-4.5,0,-30],[4.5,0,-30],[5,0,-27]].map(center=>({center:center as WorldPoint,radius:.34})),
  ...[-1,1].flatMap(side=>Array.from({length:8},(_,i)=>{
    const z=-5.6+(i+.5)*.9
    return {center:[sunsetBridgeCenterX(z)+side*4.1,0,z] as WorldPoint,width:.34,depth:.92}
  })),
]
