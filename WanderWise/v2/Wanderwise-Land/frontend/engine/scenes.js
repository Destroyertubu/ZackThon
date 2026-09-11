import {terrainFunctions} from './terrain.js';
import {Geometry,color} from './geometry.js';
import {random,segmentDistance,clamp,dist} from './math.js';
const C={grass:color('#739977'),forest:color('#244e45'),leaf:color('#3e7259'),leafLight:color('#729777'),wood:color('#675242'),bark:color('#725342'),sand:color('#c4b593'),stone:color('#9ea994'),gold:color('#eab969'),cream:color('#eee3c9'),lake:color('#699f9b'),dark:color('#34483c')};
export function buildScene(kind,world=null,field=null){
 let g=new Geometry(),colliders=[],targets=[],nodes=[],links=[],labels=[],rng=random((world?.layoutSeed||731)+17);
 function box(x,y,z,w,h,d,c,solid=false,yaw=0){g.box(x,y,z,w,h,d,c,yaw);if(solid)colliders.push({min:[x-w/2,y,z-d/2],max:[x+w/2,y+h,z+d/2]})}
 function tree(x,z,scale=1,variant=0){let y=height(x,z);g.cylinder(x,y,z,.26*scale,3.1*scale,C.bark,6,.16*scale);if(variant%3===0){g.cylinder(x,y+1.8*scale,z,1.85*scale,3.6*scale,C.forest,7,0,variant);g.cylinder(x,y+3.6*scale,z,1.3*scale,2.8*scale,C.leaf,7,0,variant+.2)}else{g.rock(x,y+2.1*scale,z,2.15*scale,variant%2?C.leafLight:C.leaf);g.rock(x-.8*scale,y+2.2*scale,z+.1,1.25*scale,C.leafLight)}colliders.push({min:[x-.25*scale,y,z-.25*scale],max:[x+.25*scale,y+3*scale,z+.25*scale]})}
 function lantern(x,y,z){box(x,y,z,.12,1.9,.12,C.bark);box(x,y+1.55,z,.45,.45,.4,C.gold);box(x,y+2,z,.6,.08,.55,C.dark)}
 let height=()=>0,boundary=18;
 if(kind==='home'){
   // A single walkable cabin: doorway, four facilities, window openings, modest furniture colliders.
   for(let i=0;i<30;i++)box(-8.7+i*.6,-.16,0,.57,.16,16,i%3===0?color('#8e7152'):color('#967b5a'));
   box(-9,0,0,.4,4.5,16,C.wood,true);box(9,0,0,.4,4.5,16,C.wood,true);box(0,0,8,18,4.5,.35,C.wood,true);
   box(-5.6,0,-8,6.8,4.5,.35,C.wood,true);box(5.6,0,-8,6.8,4.5,.35,C.wood,true);box(0,3.8,-8,4.4,.7,.35,C.wood,true);
   box(0,0,-8.4,4.2,3.8,.08,color('#7dab99'));box(0,0,-9,4.2,.1,3,C.sand);
   for(let x of [-8.7,8.7])for(let z of [-7,-2,3,7])box(x,0,z,.32,4.6,.35,C.bark);
   for(let z of [-7.8,0,7.8])box(0,4.45,z,18,.3,.35,C.bark);
   box(0,4.85,0,18,.18,16,color('#76604b'),true);
   // Faux window inset visually opens the side wall without permitting movement outside the cabin.
   for(let x of [-8.77,8.77]){box(x,1.6,0,.08,1.85,3.7,color('#91bca9'));box(x+(x<0?.06:-.06),1.6,0,.08,1.85,.10,C.bark);box(x+(x<0?.06:-.06),2.5,0,.08,.10,3.7,C.bark)}
   // Rug and central world-projection table.
   box(0,.005,0,5.6,.012,5.7,color('#638b7e'));for(let x of [-2.7,2.7])box(x,.02,0,.07,.01,5.7,C.gold);
   g.cylinder(0,0,0,1.65,.75,C.wood,12);g.cylinder(0,.75,0,1.9,.13,C.dark,16);g.cylinder(0,.89,0,1.5,.025,C.lake,24);
   g.rock(0,.93,0,.48,C.leaf);for(let i=0;i<7;i++)g.cylinder(Math.cos(i)*1.2,.93,Math.sin(i)*1.2,.05,.12,C.gold,5);
   colliders.push({min:[-1.65,0,-1.65],max:[1.65,.9,1.65]});
   // Desk with notebooks and a small desk lamp.
   box(-5.6,1,-4,3,.2,1.4,C.wood,true);for(let x of [-6.8,-4.4])for(let z of [-4.5,-3.5])box(x,0,z,.16,1,.16,C.bark);
   box(-5.5,1.21,-4,.8,.07,.6,C.cream);box(-5.2,1.22,-3.8,.55,.07,.5,C.gold);lantern(-6.5,1.15,-4.2);
   // Telephone booth: geometry is decorative, interaction is an honest unavailable state.
   box(6,0,-4,1.7,.15,1.7,C.dark);for(let x of [5.2,6.8])for(let z of [-4.8,-3.2])box(x,0,z,.12,3,.12,C.wood);
   box(6,2.95,-4,2,.18,2,C.dark);box(6,1.25,-4.6,.65,.75,.3,C.gold);colliders.push({min:[5.15,0,-4.95],max:[6.85,3,-3.05]});
   // Journal stand, bookshelf.
   box(-5.7,.75,4,2,.15,1.3,C.wood,true);box(-5.7,.92,4,1.25,.12,.8,C.cream);for(let x of [-6.5,-4.9])box(x,0,4,.18,.75,1,C.bark);
   box(6,0,4,2.7,.18,1.2,C.wood);for(let y of [.8,1.7,2.6]){box(6,y,4,2.7,.1,1.2,C.wood);for(let i=0;i<8;i++)box(4.86+i*.3,y+.1,4,.22,.45+(i%3)*.12,.55,[C.leaf,C.gold,C.lake,C.cream][i%4])}
   for(let x of [4.6,7.4])box(x,0,4,.12,2.85,1.2,C.bark);colliders.push({min:[4.5,0,3.4],max:[7.5,2.9,4.6]});
   // Hearth and fire are warm landmarks, not a post-processing effect.
   box(-5.5,0,7.65,3,1.8,.7,C.stone);box(-5.5,.2,7.2,1.8,1.2,.08,C.dark);for(let i=0;i<3;i++)g.cylinder(-6+i*.5,.2,7.1,.3,.9+i*.1,C.gold,5,0);
   targets=[{id:'door',type:'facility',action:'seed',title:'今天，你想去哪里？',position:{x:0,y:1.7,z:-7.7}},
    {id:'synthesis',type:'facility',action:'synthesis',title:'思维合成台',position:{x:-5.5,y:1.85,z:-3.65}},
    {id:'phone',type:'facility',action:'phone',title:'同频电话亭',position:{x:6,y:2.1,z:-3.15}},
    {id:'journal',type:'facility',action:'journal',title:'漫行者日志',position:{x:-5.7,y:1.7,z:4.15}},
    {id:'cabinet',type:'facility',action:'bag',title:'想法收纳柜',position:{x:6,y:3.3,z:3.9}}];
   boundary=9;labels=targets.map(t=>({text:t.title,position:[t.position.x,t.position.y+.7,t.position.z],height:.45,target:t}));
 }else{
   nodes=kind==='field'?field.sections.map((s,i)=>({id:s.id,title:s.title,topicId:world.nodes[0].topicId,position:s.position,biome:'ruins',section:s,contentIds:[field.contentId],excerptIds:[s.excerptId]})):world.nodes;
   links=kind==='field'?field.relations.map(l=>({...l,kind:'path',waypoints:[nodes.find(n=>n.id===l.source).position,nodes.find(n=>n.id===l.target).position]})):world.walkableLinks;
   boundary=Math.max(90,...nodes.map(n=>Math.max(Math.abs(n.position.x),Math.abs(n.position.z))+40));
   const terrain=terrainFunctions(nodes,links),clearance=terrain.clearance;
   height=terrain.height;
   let gridBound=Math.ceil(boundary/3)*3,segments=Math.ceil(gridBound*2/3),step=3;
   for(let iz=0;iz<segments;iz++)for(let ix=0;ix<segments;ix++){let x=-gridBound+ix*step,z=-gridBound+iz*step,h=height(x,z),shade=.9+rng()*.15,col=C.grass.map(v=>v*shade);g.quad([x,h,z],[x,height(x,z+step),z+step],[x+step,height(x+step,z+step),z+step],[x+step,height(x+step,z),z],col)}
   // Trails are real traversable terrain. No disconnected floating islands.
   for(let l of links){let a=l.waypoints[0],b=l.waypoints.at(-1);g.path(a,b,4,C.sand);g.path(a,b,.10,C.gold,.06)}
   for(let [i,n] of nodes.entries()){
    let {x,z}=n.position;g.cylinder(x,-.02,z,7.4,.08,n.biome==='lake'?color('#a9b9a3'):color('#b1b393'),24);
    g.cylinder(x,.05,z,5.4,.015,C.grass,24);
    // A low plinth behind the text preserves a clear walking/reading area in front.
    g.cylinder(x,.04,z-1.5,1.45,.35,C.stone,8);g.cylinder(x,.4,z-1.5,.5,.45,C.dark,6,.3);g.cylinder(x,.86,z-1.5,.17,.45,C.gold,5,0);
    if(n.biome==='ruins'){
      for(let dx of [-4.5,4.5]){box(x+dx,0,z-4,.9,3.8,.9,C.stone,true);box(x+dx,3.8,z-4,1.3,.3,1.3,C.cream)}box(x,4.1,z-4,10,.42,1,C.stone);
    }else if(n.biome==='forest'){tree(x-5.8,z-4,1,1);tree(x+5.8,z-3,1.05,0)}else if(n.biome==='meadow'){
      for(let k=0;k<14;k++){let a=k/14*Math.PI*2;g.cylinder(x+Math.cos(a)*6.5,0,z+Math.sin(a)*6.5,.12,.2,C.gold,5)}
    }else{for(let k=0;k<6;k++)g.rock(x+Math.cos(k)*6,z===0?0:height(x+Math.cos(k)*6,z+Math.sin(k)*6),z+Math.sin(k)*6,.6,C.stone)}
    lantern(x-3,0,z+1);
    targets.push({id:n.id,type:'node',node:n,title:n.title,position:{x,y:2.05,z:z+.15}});
   }
   // Consistent asset vocabulary: merged low-poly mesh batches and one stable seeded scatter.
   // Grid-local random seeds keep existing vegetation stable after a world expansion.
   let cells=Math.ceil(boundary/12);
   for(let gx=-cells;gx<cells;gx++)for(let gz=-cells;gz<cells;gz++){
     let localRandom=random(((world.layoutSeed||731)^Math.imul(gx,73856093)^Math.imul(gz,19349663))>>>0);
     let x=gx*12+localRandom()*12,z=gz*12+localRandom()*12;
     if(Math.abs(x)>boundary-7||Math.abs(z)>boundary-7||clearance(x,z)<4)continue;
     tree(x,z,.7+localRandom()*.65,Math.abs(gx+gz));
   }
   for(let i=0;i<200;i++){let x=(rng()*2-1)*boundary,z=(rng()*2-1)*boundary;if(clearance(x,z)>1.8){let y=height(x,z);g.rock(x,y,z,.2+rng()*.4,C.stone)}}
   // A lake lies outside the node/path network; shoreline has collision to avoid deceptive walkable water.
   let lx=boundary-19,lz=10;g.cylinder(lx,-.25,lz,13,.25,C.sand,36);g.cylinder(lx,.015,lz,11,.012,C.lake,36);
   colliders.push({min:[lx-8,-1,lz-8],max:[lx+8,1,lz+8]});
   for(let i=0;i<9;i++)g.path({x:lx-6+i*.7,z:lz-4+i*1.1},{x:lx-2+i*.7,z:lz-4+i*1.1},.025,color('#b5d2bb'),.035);
   // Distant mountain silhouettes.
   for(let i=0;i<24;i++){let a=i/24*Math.PI*2,x=Math.cos(a)*(boundary+22),z=Math.sin(a)*(boundary+22);g.cylinder(x,-4,z,24,24+rng()*25,color('#678a79'),6,0,a)}
 }
 return {kind,geometry:g.data(),colliders,targets,nodes,links,labels,height,boundary,spawn:kind==='home'?{x:0,y:0,z:3.6}:(kind==='field'?field.spawn.position:world.spawn.position)};
}

export function playerGeometry(p,t,moving){let g=new Geometry(),stride=moving?Math.sin(t*11)*.16:0,breath=moving?0:Math.sin(t*1.7)*.025;g.transform={x:p.x,y:p.y,z:p.z,yaw:p.yaw};let coat=color('#dab579'),shadow=color('#5c6555'),skin=color('#ead6b1');
 g.box(-.16,0,Math.max(0,stride),.21,.47,.26,shadow);g.box(.16,0,Math.max(0,-stride),.21,.47,.26,shadow);
 g.cylinder(0,.42+breath,0,.48,.77,coat,7,.29,.2);g.cylinder(0,1.15+breath,0,.32,.44,color('#658578'),8,.26,.2);
 g.box(0,1.25+breath,-.26,.33,.22,.06,skin);g.box(0,.65+breath,.34,.52,.57,.27,color('#795d44'));
 g.box(-.38,.58+breath,-stride,.15,.51,.16,coat);g.box(.38,.58+breath,stride,.15,.51,.16,coat);return g}
export {C};
