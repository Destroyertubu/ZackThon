import assert from 'node:assert/strict'
import { getRealmDefinition, type WorldObstacle } from '../src/features/journeys/realmDefinitions'
import { groundHeight, PLAYER_RADIUS } from '../src/features/journeys/scene/navigation'
import { SUNSET_PLANTERS, sunsetPlanterObstacles } from '../src/features/journeys/scene/sunsetLayout'
import { sunsetPlanter } from '../src/features/journeys/scene/architecture'
import { WorldBuilder } from '../src/features/journeys/scene/geometry'

const world=getRealmDefinition('sunset-boulevard')!
let checks=0,coverageSamples=0,corridorSamples=0
const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++}
function contains(obstacle:WorldObstacle,x:number,z:number) {
  return 'radius' in obstacle?Math.hypot(x-obstacle.center[0],z-obstacle.center[2])<=obstacle.radius+1e-7:
    Math.abs(x-obstacle.center[0])<=obstacle.width/2+1e-7&&Math.abs(z-obstacle.center[2])<=obstacle.depth/2+1e-7
}

check(SUNSET_PLANTERS.length===6,'All six existing stone planters survive the static planting change')
check(new Set(SUNSET_PLANTERS.map(planter=>planter.id)).size===6,'Planter identifiers remain distinct')
for(const planter of SUNSET_PLANTERS){
  const obstacles=sunsetPlanterObstacles(planter),c=Math.cos(planter.yaw),s=Math.sin(planter.yaw)
  // Cover the stone, coping and brass edge independently of whether their island is walkable.
  const length=planter.length+.04,depth=planter.depth+.09
  const nx=Math.ceil(length/.08),nz=Math.ceil(depth/.08)
  for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
    const x=-length/2+length*ix/nx,z=-depth/2+depth*iz/nz
    const wx=planter.position[0]+c*x+s*z,wz=planter.position[2]-s*x+c*z
    check(obstacles.some(obstacle=>contains(obstacle,wx,wz)),`${planter.id}: coping has no collision holes at ${x}, ${z}`)
    coverageSamples++
  }
  for(const site of planter.plantSites){
    const dx=site.position[0]-planter.position[0],dz=site.position[2]-planter.position[2]
    const localX=c*dx-s*dz,localZ=s*dx+c*dz
    check(Math.abs(site.position[1]-planter.position[1]-planter.soilHeight)<1e-8,`${planter.id}: plant roots touch the soil`)
    check(Math.abs(localX)+site.maxRadius<=planter.innerLength/2,`${planter.id}: plant envelope fits between end rails`)
    check(Math.abs(localZ)+site.maxRadius<=planter.innerDepth/2,`${planter.id}: plant envelope fits between side rails`)
  }
  const builder=new WorldBuilder();sunsetPlanter(builder,planter)
  const geometries=builder.finish()
  check(!geometries.has('leaves')&&!geometries.has('petals')&&!geometries.has('leaf'),`${planter.id}: no detached procedural plants remain`)
  check(geometries.has('stone')&&geometries.has('darkWood'),`${planter.id}: static soil and stone remain`)
  for(const geometry of geometries.values()){
    check([...geometry.getAttribute('position').array].every(Number.isFinite),`${planter.id}: finite static geometry`)
    geometry.dispose()
  }
}

// These points used to pass navigation even 0.8 m inside the rendered stone boxes.
for(const [x,z] of [[-3.684,21.687],[3.488,19.444],[4.805,-21.453],[-6.157,-24.912]])
  check(groundHeight(world,x,z)===null,`Player cannot enter the formerly permeable stone box at ${x}, ${z}`)

const route=world.surfaces.find(surface=>surface.kind==='path')!
assert.equal(route.kind,'path')
for(let segment=1;segment<route.points.length;segment++){
  const a=route.points[segment-1],b=route.points[segment],steps=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/.1)
  for(let index=0;index<=steps;index++){
    const t=index/steps,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t
    check(groundHeight(world,x,z,1.25)!==null,`A 2.5 m clear main route survives near ${x}, ${z}`)
    corridorSamples++
  }
}
for(const station of world.stations)
  check(groundHeight(world,station.position[0],station.position[2],1.25)!==null,`${station.id}: a 2.5 m clear stopping area survives`)

// Four-neighbour BFS cannot jump over diagonal corners or a newly solid stone planter.
const spacing=.25,minX=-12,maxX=12,minZ=-31,maxZ=28
const width=Math.round((maxX-minX)/spacing)+1,height=Math.round((maxZ-minZ)/spacing)+1
const cell=(x:number,z:number)=>Math.round((z-minZ)/spacing)*width+Math.round((x-minX)/spacing)
const open=new Uint8Array(width*height),seen=new Uint8Array(width*height)
for(let iz=0;iz<height;iz++)for(let ix=0;ix<width;ix++)
  open[iz*width+ix]=groundHeight(world,minX+ix*spacing,minZ+iz*spacing,PLAYER_RADIUS)!==null?1:0
const start=cell(world.spawn.position[0],world.spawn.position[2]),queue=[start]
check(open[start]===1,'The existing spawn remains walkable');seen[start]=1
for(let head=0;head<queue.length;head++){
  const current=queue[head],x=current%width,z=Math.floor(current/width)
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,nz=z+dz,next=nz*width+nx
    if(nx<0||nx>=width||nz<0||nz>=height||seen[next]||!open[next])continue
    seen[next]=1;queue.push(next)
  }
}
for(const station of world.stations)
  check(seen[cell(station.position[0],station.position[2])]===1,`${station.id}: the station is reachable from the original entry`)

console.log(JSON.stringify({result:'passed',checks,planters:SUNSET_PLANTERS.length,
  collisionCells:SUNSET_PLANTERS.reduce((sum,p)=>sum+sunsetPlanterObstacles(p).length,0),coverageSamples,
  plantingSites:SUNSET_PLANTERS.reduce((sum,p)=>sum+p.plantSites.length,0),soilHeight:.44,
  clearRouteWidth:2.5,corridorSamples,reachableSamples:queue.length,stations:world.stations.map(s=>s.id)},null,2))
