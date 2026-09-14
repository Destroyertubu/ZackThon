import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..')
const temp=await mkdtemp(path.join(tmpdir(),'wanderwise-worlds-'))
try {
  const outfile=path.join(temp,'worlds.cjs')
  await build({stdin:{contents:`export * from './src/features/journeys/realmDefinitions';export * from './src/features/journeys/scene/navigation';export * from './src/features/journeys/scene/worldGeometry';`,resolveDir:root},outfile,bundle:true,platform:'node',format:'cjs',logLevel:'silent'})
  const {REALM_DEFINITIONS,LAND_DEFINITION,getRealmForRecipe,groundHeight,safePose,nearestStation,createWorldGeometry}=createRequire(import.meta.url)(outfile)
  let checks=0
  const check=(condition,message)=>{assert.ok(condition,message);checks++}
  check(REALM_DEFINITIONS.length===10,'Every canonical pair has a world')
  const pairs=new Set(),shapes=new Set(),stats=[]
  for(const world of [LAND_DEFINITION,...REALM_DEFINITIONS]) {
    if(world.pair){pairs.add([...world.pair].sort().join('|'));check(getRealmForRecipe({first:world.pair[1],second:world.pair[0]}).id===world.id,'Recipe order is immaterial')}
    check(world.stations.length>=5,`${world.id}: five stations`)
    check(new Set(world.stations.map(s=>s.id)).size===world.stations.length,`${world.id}: unique station identifiers`)
    check(groundHeight(world,world.spawn.position[0],world.spawn.position[2])!==null,`${world.id}: grounded entry`)
    check(groundHeight(world,Infinity,0)===null&&groundHeight(world,0,NaN)===null,`${world.id}: non-finite rejected`)
    check(groundHeight(world,1000,1000)===null,`${world.id}: water cannot be walked`)
    check(groundHeight(world,...[safePose(world,{position:[1000,2,1000],yaw:0,pitch:0}).position[0],safePose(world,{position:[1000,2,1000],yaw:0,pitch:0}).position[2]])!==null,`${world.id}: invalid saved pose recovers on safe ground`)
    // BFS follows the same finite-width, obstacle-aware surfaces as the actual controller.
    // The 0.35 m height bound is slightly stricter than a single rendered platform's rim.
    const spacing=.4,bound=82,side=bound*2+1,heights=new Float64Array(side*side).fill(NaN)
    for(let iz=-bound;iz<=bound;iz++)for(let ix=-bound;ix<=bound;ix++){
      const h=groundHeight(world,ix*spacing,iz*spacing);if(h!==null)heights[(iz+bound)*side+ix+bound]=h
    }
    const sx=Math.round(world.spawn.position[0]/spacing)+bound,sz=Math.round(world.spawn.position[2]/spacing)+bound,start=sz*side+sx,queue=[start],seen=new Uint8Array(side*side);seen[start]=1
    for(let head=0;head<queue.length;head++){
      const current=queue[head],x=current%side,z=Math.floor(current/side)
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const nx=x+dx,nz=z+dz,next=nz*side+nx
        if(nx<0||nx>=side||nz<0||nz>=side||seen[next]||!Number.isFinite(heights[next])||Math.abs(heights[next]-heights[current])>.32)continue
        seen[next]=1;queue.push(next)
      }
    }
    for(const station of world.stations){
      const [x,y,z]=station.position
      check(Math.abs(groundHeight(world,x,z)-y)<.025,`${world.id}/${station.id}: visible station sits on declared floor`)
      check(nearestStation(world,[x,y+1.7,z])?.id===station.id,`${world.id}/${station.id}: interaction reaches correct station`)
      const ix=Math.round(x/spacing)+bound,iz=Math.round(z/spacing)+bound
      check(seen[iz*side+ix]===1,`${world.id}/${station.id}: reachable from entry without crossing water/obstacles`)
    }
    for(const obstacle of world.obstacles)check(groundHeight(world,obstacle.center[0],obstacle.center[2])===null,`${world.id}: solid trunk protected`)
    shapes.add(JSON.stringify(world.surfaces))
    const geometries=createWorldGeometry(world);let triangles=0
    for(const [name,geometry] of geometries){
      const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv')
      check([...positions.array].every(Number.isFinite),`${world.id}/${name}: finite vertices`)
      check([...normals.array].every(Number.isFinite),`${world.id}/${name}: finite normals`)
      check(uv.count===positions.count,`${world.id}/${name}: textured geometry`)
      check(geometry.index.count%3===0,`${world.id}/${name}: valid triangles`)
      triangles+=geometry.index.count/3;geometry.dispose()
    }
    check(triangles<500000,`${world.id}: procedural budget under 500k tris`)
    stats.push({world:world.id,batches:geometries.size,triangles,reachable:queue.length})
  }
  check(pairs.size===10,'No missing or duplicate ingredient pair')
  check(shapes.size>=10,'Worlds have distinct walkable footprints')
  console.table(stats)
  console.log(`Mirror Sea navigation and geometry: ${checks} checks passed.`)
} finally {await rm(temp,{recursive:true,force:true})}
