import * as THREE from 'three'
import { MOON_STAGES, stageSeatRuns } from './stageLayout'
import { WorldBuilder, leafBlade, random, taperedBranch, stoneIsland } from './geometry'
import { arch, bench, floors, flowerBed, galleryFacade, lantern, local, mailHouse, pergola, pillar, reeds, sunsetBelvedere, sunsetBridge, sunsetPlanter, tree } from './architecture'
import { SUNSET_BENCHES, SUNSET_FACADES, SUNSET_FACADE_FOOTINGS, SUNSET_LANTERNS, SUNSET_PLANTERS, SUNSET_ROAD_FOOTINGS, SUNSET_TREES } from './sunsetLayout'
import type { WalkWorld } from './navigation'
import type { WorldPoint } from '../realmDefinitions'

function stationBeacons(b:WorldBuilder,world:WalkWorld) {
  world.stations.forEach((station,index)=>{
    const [x,y,z]=station.position
    b.ring('brass',[x,y+.055,z],.8,.027)
    b.ring('brass',[x,y+.055,z],.69,.009)
    for(let i=0;i<=index;i++) {const a=(i-index*.5)*.2;b.sphere('glow',[x+Math.sin(a)*.8,y+.063,z+Math.cos(a)*.8],[.032,.018,.032],8)}
  })
}
function sunset(b:WorldBuilder) {
  // The five stations share one promenade; massing opens and closes around it.
  for(const points of SUNSET_ROAD_FOOTINGS)for(let i=1;i<points.length;i++){
    const a=points[i-1],c=points[i],dx=c[0]-a[0],dz=c[2]-a[2]
    b.box('stone',[(a[0]+c[0])/2,-.69,(a[2]+c[2])/2],[8,1.32,Math.hypot(dx,dz)],[0,Math.atan2(dx,dz),0])
  }
  for(const {center,width,depth,yaw} of SUNSET_FACADE_FOOTINGS)b.box('stone',center,[width,1.32,depth],[0,yaw,0])
  for(const {position,height,seed} of SUNSET_TREES)b.add(stoneIsland(height*.32,seed),'stone',[position[0],-.025,position[2]])
  for(const p of SUNSET_LANTERNS)lantern(b,p)
  for(const {position,yaw} of SUNSET_BENCHES)bench(b,position,yaw)
  for(const planter of SUNSET_PLANTERS)sunsetPlanter(b,planter)
  sunsetBridge(b);sunsetBelvedere(b)
  // Real public-domain paintings sit inside the recessed galleries, behind their glazing.
  for(const {position,yaw,kind,scale} of SUNSET_FACADES){
    if(kind==='bookshop')continue
    local(b,position,yaw,q=>{
      const bays=kind==='gallery'?[-2.944,0,2.944]:[1.65]
      bays.forEach((x,i)=>q.add(new THREE.PlaneGeometry(1.52,1.15),i%2?'artBridge':'artVenice',[x,2.13,-1.7]))
    },scale)
  }
  // A vine-covered entrance hints at the sheltered tree tunnel without blocking the sky.
  local(b,[0,0,25.5],0,q=>{arch(q,8.8,5.9,'darkWood',.095);arch(q,8.62,5.8,'brass',.025)})
}
function postOffice(b:WorldBuilder) {
  mailHouse(b,[-16,0,-1.2],0,3.3);mailHouse(b,[16,0,-1.2],0,1.2);mailHouse(b,[0,0,-22],0,5.4)
  local(b,[0,0,8],0,q=>{
    q.add(new THREE.CylinderGeometry(1.18,1.3,.3,12),'stone',[0,.15,0]);q.rod('darkWood',[0,.3,0],[0,4.1,0],.25,.19)
    for(let j=0;j<4;j++)local(q,[0,0,0],j*Math.PI/2,w=>{
      w.add(new THREE.CylinderGeometry(.8,.8,.18,36),'brass',[0,3.7,.2],[Math.PI/2,0,0]);w.add(new THREE.CircleGeometry(.74,36),'paper',[0,3.7,.3]);w.rod('iron',[0,3.7,.33],[.3,4.16,.33],.025);w.rod('iron',[0,3.7,.34],[-.4,3.5,.34],.027)
    })
    q.add(new THREE.ConeGeometry(1.25,.8,4),'darkWood',[0,4.75,0],[0,Math.PI/4,0])
  })
  for(const x of [-5,5]){lantern(b,[x,0,13]);flowerBed(b,[x,0,10],2,12+x)}
  for(const x of [-21,21])tree(b,[x,-.2,2],8,x+100)
  const points:WorldPoint[]=[[-16,5,-2],[0,7,4],[16,5,-2]];b.curve('brass',points,.017)
  for(let i=0;i<13;i++){const x=-14+i*2.3,y=6.8-Math.abs(x)*.085,z=3-Math.abs(x)*.25;b.box('paper',[x,y,z],[.42,.29,.02],[0,.2*i,.13]);b.curve('brass',[[x-.2,y+.14,z+.02],[x,y,z+.02],[x+.2,y+.14,z+.02]],.005,8)}
}
function moss(b:WorldBuilder) {
  // Buttress roots meet the same protected trunk footprint as the real tree.
  for(let i=0;i<11;i++){const a=i*2.399;b.add(taperedBranch([[Math.cos(a)*4.5,.03,Math.sin(a)*4.5],[Math.cos(a)*2.5,.3,Math.sin(a)*2.5],[Math.cos(a)*.8,2.3,Math.sin(a)*.8]],.4,.12),'bark')}
  tree(b,[-19,0,-9],12,61,'leaves');tree(b,[19,0,0],11,62,'leaves')
  for(let i=0;i<14;i++){const a=i/14*6.28;tree(b,[Math.cos(a)*25,-.3,Math.sin(a)*25],10+(i%3),80+i,'leaves')}
  for(const [x,z] of [[-6,12],[-15,1],[-10,-13],[12,-12],[16,9]]){
    local(b,[x,0,z],.4,q=>{
      q.add(new THREE.LatheGeometry([new THREE.Vector2(1.2,0),new THREE.Vector2(1.05,.35),new THREE.Vector2(.8,.7),new THREE.Vector2(.9,1)],20),'bark')
      q.add(leafBlade(2.4,3.8,.2),'leaf',[0,1.05,0],[0,.6,0]);q.box('paper',[0,1.27,.2],[.7,.025,.48],[0,.25,0])
      q.curve('brass',[[-1.2,0,0],[-1.5,1.6,0],[-.2,2.3,0],[.6,2,0]],.024);lantern(q,[.6,1.65,0],true)
    });reeds(b,[x+2,0,z-2],1.8,Math.round(x*20+z+100),22)
  }
  for(let i=0;i<30;i++){const a=i*2.399,r=7+(i%5)*3,x=Math.cos(a)*r,z=Math.sin(a)*r;
    b.rod('paper',[x,0,z],[x,.4,z],.065);b.sphere('rose',[x,.43,z],[.35,.16,.35],12)
  }
}
function moonStages(b:WorldBuilder) {
  for(const [x,z,r] of MOON_STAGES){
    for(let tier=0;tier<3;tier++){
      for(const points of stageSeatRuns(x,z,r,tier))b.curve('wood',points,.19,Math.max(12,points.length))
    }
    for(let rib=0;rib<7;rib++){
      const a=(rib/6-.5)*Math.PI*.86,outer:WorldPoint=[x+Math.sin(a)*r,0,z-Math.cos(a)*r]
      b.curve('brass',[outer,[x+Math.sin(a)*r*.85,4.2,z-Math.cos(a)*r*.95],[x,6,z-r*.4]],.065,28)
    }
    for(const side of [-1,1])lantern(b,[x+side*(r-.3),0,z])
  }
  // A sculpted harp and shell are recognisable instruments, not generic activity desks.
  local(b,[-9,0,-16.5],0,q=>{
    q.curve('darkWood',[[-1,0,0],[-.5,3.4,0],[.8,4.2,0],[1.3,3.7,0],[.4,0,0]],.14,36)
    for(let i=0;i<14;i++)q.rod('brass',[-.7+i*.13,.25,0],[-.2+i*.095,3.4+i*.025,0],.006)
  })
  b.add(new THREE.TorusGeometry(2.5,.06,8,64),'glow',[13,5,-17],[0,0,0])
}
function mirrorCourt(b:WorldBuilder) {
  // A central, unreachable double ribbon is framed differently by every arcade.
  for(const r of [4,4.4,10.3])b.ring('stone',[0,-.18,0],r,.13)
  for(const side of [-1,1]){
    const pts:WorldPoint[]=[];for(let i=0;i<=60;i++){const t=i/60;pts.push([Math.cos(t*6.28+side)*2.2*side,.3+t*8,Math.sin(t*6.28+side)*2.2])}
    b.curve('brass',pts,.18,90)
  }
  for(let i=0;i<12;i++){
    const a=i/12*6.28,x=Math.sin(a)*21.3,z=Math.cos(a)*21.3
    local(b,[x,0,z],a,q=>{pillar(q,-2.4,0,6);pillar(q,2.4,0,6);arch(q,4.55,5.8,'stone',.2);arch(q,4.2,5.6,'brass',.04);q.box('glass',[0,2.4,0],[3.65,4.4,.055])})
    if(i%3===1)tree(b,[x*1.13,0,z*1.13],9,221+i)
  }
  for(let i=0;i<5;i++){
    const a=(i/5+.09)*6.28
    local(b,[Math.sin(a)*12.8,0,Math.cos(a)*12.8],a+.3,q=>{
      pillar(q,-.8,0,3.1,'brass');pillar(q,.8,0,3.1,'brass');arch(q,1.6,3.2,'brass',.07);q.box('glass',[0,1.45,0],[1.4,2.5,.08])
    })
  }
}
function dewGarden(b:WorldBuilder) {
  const rnd=random(921)
  for(let i=0;i<18;i++){
    // Frame the paths with tall peripheral leaves; keep all interaction eye volumes open.
    const a=i*2.399,r=36+rnd()*9,x=Math.cos(a)*r,z=Math.sin(a)*r,h=6+rnd()*3
    b.add(leafBlade(6+rnd()*5,12+rnd()*5,1.1),'leaf',[x,h,z],[.45+rnd()*.25,a,.25-rnd()*.5])
    b.curve('brass',[[x,h-1,z+5],[x,h+1,z],[x,h-1,z-5]],.025)
    for(let v=0;v<6;v++)for(const side of [-1,1])b.curve('leaf',[[x,h+.8,z+4-v*1.4],[x+side*1.6,h+1,z+3-v*1.4],[x+side*3,h+.6,z+2-v*1.4]],.055,16)
    b.rod('leaf',[x,-1.2,z],[x,h,z],.11,.07)
    if(i%3===0)b.sphere('glass',[x,h+1,z],[1.3,1.1,1.3],24)
  }
  for(const [x,y,z] of [[-15,1,6],[14,1.5,-1],[-12,1.1,-15],[5,2,-25]]){
    b.sphere('glass',[x,y+1.2,z],[1.8,1.4,1.8],28);b.ring('brass',[x,y+.2,z],1.6,.035)
    for(let i=0;i<9;i++){const a=i/9*6.28;b.curve('paper',[[x+Math.cos(a)*3,y,z+Math.sin(a)*3],[x+Math.cos(a)*2.8,y+2,z+Math.sin(a)*2.8],[x+Math.cos(a)*2.4,y+3.5,z+Math.sin(a)*2.4]],.018,14);b.sphere('rose',[x+Math.cos(a)*2.4,y+3.5,z+Math.sin(a)*2.4],[.16,.35,.16],10)}
  }
  for(let i=0;i<20;i++){
    const a=i*2.399,x=Math.cos(a)*(7+i*.9),z=Math.sin(a)*(7+i*.9)
    b.rod('paper',[x,-1,z],[x,2.4,z],.13,.08);b.sphere('rose',[x,2.35,z],[1.3,.4,1.3],20)
    for(let j=0;j<7;j++){const t=j/7*6.28;b.rod('paper',[x,2.2,z],[x+Math.cos(t)*1.2,2.2,z+Math.sin(t)*1.2],.02)}
  }
}
function rainyAlley(b:WorldBuilder) {
  for(let i=0;i<4;i++){
    galleryFacade(b,[-20.3,0,21-i*8],Math.PI/2,41+i)
    galleryFacade(b,[-9.7,0,22-i*7.5],-Math.PI/2,81+i)
    galleryFacade(b,[8.7,0,-8-i*6],Math.PI/2,91+i)
    galleryFacade(b,[19.3,0,-8-i*6],-Math.PI/2,31+i)
  }
  for(let i=0;i<3;i++)galleryFacade(b,[-7+i*8,0,-5.3],0,14+i)
  for(const [x,z] of [[-18,16],[-12,7],[-18,-2],[-6,3],[3,3],[16,-7],[11,-16],[17,-24]]){
    lantern(b,[x,0,z]);b.box('glass',[x*.96,.02,z+1.5],[1.5,.012,2.2],[0,.4,0])
  }
  local(b,[14,0,-28],0,q=>{
    arch(q,7,5.8,'darkWood',.23);arch(q,6.7,5.7,'brass',.03)
    for(let i=0;i<13;i++)q.rod('brass',[-2.8+i*.46,.2,-1],[-2.8+i*.46,2.5+Math.sin(i*.5),-1],.055)
  })
  for(const x of [-18.8,-11.2])b.curve('iron',[[x,5.3,24],[x,5.3,-1],[x,0,-1]],.055,32)
}
function seasons(b:WorldBuilder) {
  for(let i=0;i<12;i++)b.ring('brass',[0,.025,0],8+i*.24,.012)
  for(let quarter=0;quarter<4;quarter++){
    const key=quarter===0?'petals':quarter===1?'leaves':quarter===2?'rose':'paper'
    for(let j=0;j<4;j++){
      const a=(quarter/4+j/20+.035)*6.28,r=23+(j%2)*3;tree(b,[Math.cos(a)*r,0,Math.sin(a)*r],9+(j%3),quarter*20+j+112,key,quarter===3)
    }
    const a=(quarter/4+.125)*6.28, x=Math.cos(a)*12.2,z=Math.sin(a)*12.2
    local(b,[x,0,z],-a,q=>{q.add(new THREE.CylinderGeometry(1.35,1.42,.55,40),'bark',[0,.4,0],[.15,0,0]);for(let r=.2;r<1.25;r+=.17)q.ring('brass',[0,.705,0],r,.012);q.curve('brass',[[0,0,0],[0,1.7,0],[.5,2.2,0]],.02);lantern(q,[.5,1.88,0],true)})
  }
  for(let i=0;i<8;i++){const a=i*.785;b.add(taperedBranch([[Math.cos(a)*2.8,.02,Math.sin(a)*2.8],[Math.cos(a),.25,Math.sin(a)],[0,1.7,0]],.26,.08),'bark')}
}
function resonance(b:WorldBuilder) {
  for(let i=0;i<20;i++){
    const a=i/20*6.28
    for(const radius of [13,21]){
      const x=Math.sin(a)*radius,z=Math.cos(a)*radius;pillar(b,x,z,7.2,'stone')
      local(b,[x,0,z],a,q=>{q.box('brass',[0,4,.19],[.06,4.6,.03]);lantern(q,[0,2.6,.3],true)})
    }
    const a2=(i+1)/20*6.28,x=(Math.sin(a)+Math.sin(a2))*10.5,z=(Math.cos(a)+Math.cos(a2))*10.5
    local(b,[x,3.7,z],a+.157,q=>arch(q,6.2,3.65,'stone',.15))
    const pts:WorldPoint[]=[[Math.sin(a)*13,7,Math.cos(a)*13],[Math.sin(a)*16,10.3,Math.cos(a)*16],[Math.sin(a)*21,7,Math.cos(a)*21]]
    b.curve('brass',pts,.065,28)
  }
  for(const radius of [13,17,21])b.ring('brass',[0,7.45,0],radius,.08)
  for(let i=0;i<5;i++){
    const a=(i/5+.03)*6.28
    local(b,[Math.sin(a)*12.4,0,Math.cos(a)*12.4],a,q=>{
      arch(q,2.6,4.7,'darkWood',.15)
      for(let j=0;j<11;j++)q.rod('brass',[-1.1+j*.22,.3,0],[-1.1+j*.22,3.2+Math.sin(j*.29+i*.13)*.8,0],.009)
      q.add(new THREE.LatheGeometry([new THREE.Vector2(.9,0),new THREE.Vector2(.9,.12),new THREE.Vector2(.7,.25),new THREE.Vector2(.2,.35)],24),'brass',[0,.1,0])
    })
  }
}
function wetland(b:WorldBuilder) {
  for(let i=0;i<21;i++){
    const a=i*2.399,r=19+(i%5)*2.7,x=Math.sin(a)*r,z=Math.cos(a)*r
    reeds(b,[x,-.6,z],3,128+i,45)
    if(i%3===0)tree(b,[x,-.7,z],8+(i%4),331+i,'leaves')
  }
  for(const [x,z] of [[-12,7],[-6,-16],[15,-14],[16,10]])local(b,[x,0,z],.5,q=>{
    q.rod('darkWood',[-1,0,0],[-1,3.5,0],.09);q.rod('darkWood',[-1,3.5,0],[1,3.5,0],.065)
    for(let j=0;j<7;j++){q.rod('brass',[-.8+j*.26,3.5,0],[-.8+j*.26,3-j*.08,0],.006);q.rod('brass',[-.8+j*.26,3-j*.08,0],[-.8+j*.26,2-j*.035,0],.034)}
  })
  const rnd=random(182)
  for(let i=0;i<90;i++){
    const x=(rnd()-.5)*58,z=(rnd()-.5)*58
    b.add(leafBlade(.7+rnd(),1.2+rnd(),.08),'leaf',[x,-.96,z],[0,rnd()*6.28,0])
    if(i%6===0)for(let j=0;j<7;j++)b.add(leafBlade(.24,.5,.15),'rose',[x,-.85,z],[.5,j/7*6.28,0])
  }
}
function land(b:WorldBuilder) {
  local(b,[0,0,27.2],0,q=>{
    pillar(q,-3.2,0,5.4);pillar(q,3.2,0,5.4);arch(q,6.2,5.6,'stone',.2);arch(q,5.9,5.4,'brass',.04)
    for(const x of [-3.2,3.2])lantern(q,[x,2.7,.35],true)
  })
  tree(b,[-20,0,5],10,761);tree(b,[-12,0,0],9,762);tree(b,[-13,3.2,-22],8.5,763)
  tree(b,[-7,0,21],8,764);tree(b,[7,0,22],7.5,765);tree(b,[15,0,-6.5],7,766)
  pergola(b,[12,0,-7.2],0,.8);pergola(b,[-10,3.2,-23],0,.72)
  bench(b,[8,0,-3],Math.PI/2);bench(b,[15.8,0,-2],-Math.PI/2)
  for(const p of [[-8,0,13],[7,0,12],[-20,1,-6],[-17,2.2,-15],[20,0,-10],[17,0,-20]] as WorldPoint[])lantern(b,p)
  for(const x of [-4.5,4.5])flowerBed(b,[x,0,24.3],3,291+x)
  local(b,[21,0,-24],0,q=>{
    q.add(new THREE.LatheGeometry([new THREE.Vector2(.9,0),new THREE.Vector2(.8,.2),new THREE.Vector2(.6,4.5),new THREE.Vector2(.85,4.7)],24),'plaster')
    q.add(new THREE.CylinderGeometry(.7,.7,1,12,1,true),'glass',[0,5.15,0]);q.add(new THREE.ConeGeometry(1.1,.8,12),'darkWood',[0,6.05,0]);q.sphere('glow',[0,5.1,0],[.3,.36,.3],16)
    for(let i=0;i<6;i++){const a=i/6*6.28;q.rod('brass',[Math.cos(a)*.7,4.65,Math.sin(a)*.7],[Math.cos(a)*.7,5.7,Math.sin(a)*.7],.025)}
    q.ring('brass',[0,4.75,0],1,.05)
  })
  // A narrow hull, ribs and cloth sail make the departure shore legible.
  local(b,[26,-.8,-19],-.35,q=>{
    const hull=new THREE.Shape();hull.moveTo(0,-3.5);hull.bezierCurveTo(-1.2,-1.5,-1.25,1.5,0,3.4);hull.bezierCurveTo(1.25,1.5,1.2,-1.5,0,-3.5)
    q.add(new THREE.ExtrudeGeometry(hull,{depth:.55,bevelEnabled:true,bevelSize:.18,bevelThickness:.2,bevelSegments:2,steps:1}),'darkWood',[0,0,0],[-Math.PI/2,0,0])
    q.rod('darkWood',[0,.3,0],[0,7.5,0],.065,.03);q.rod('darkWood',[0,1.8,0],[0,1.8,2.8],.055)
    const sail=new THREE.BufferGeometry();sail.setAttribute('position',new THREE.Float32BufferAttribute([0,7.2,0,0,2,2.7,.55,3.1,1,0,2,0],3));sail.setIndex([0,1,2,0,2,3,2,1,3]);q.add(sail,'paper')
    for(const z of [-2,-1,1,2])q.box('wood',[0,.74,z],[1.55,.1,.28])
  })
}
export function createWorldGeometry(world:WalkWorld) {
  const builder=new WorldBuilder();floors(builder,world.surfaces,world.id==='moss-letters');stationBeacons(builder,world)
  const build={
    'mirror-sea':land,'sunset-boulevard':sunset,'unsent-answers':postOffice,'moss-letters':moss,
    'moonlight-andante':moonStages,'beyond-the-frame':mirrorCourt,'dew-specimens':dewGarden,
    'blue-hour-shutter':rainyAlley,'tree-time':seasons,'echo-paradox':resonance,'forest-lento':wetland,
  }[world.id]
  build(builder)
  const geometries=builder.finish()
  if(world.id==='sunset-boulevard'){
    const pavement=geometries.get('paving')
    if(pavement){const p=pavement.getAttribute('position'),uv=pavement.getAttribute('uv');for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/2.5,p.getZ(i)/2.5)}
  }
  return geometries
}
