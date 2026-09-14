import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { WorldPoint, WalkSurface } from '../realmDefinitions'
import { WorldBuilder, random, taperedBranch, leafBlade, stoneIsland, type MaterialKey } from './geometry'
import { sunsetBridgeCenterX, type SunsetPlanterDefinition } from './sunsetLayout'

export function local(b: WorldBuilder, position: WorldPoint, yaw: number, build: (part: WorldBuilder) => void, scale = 1) {
  const part = new WorldBuilder(); build(part)
  part.finish().forEach((geometry, key) => b.add(geometry, key, position, [0,yaw,0], [scale,scale,scale]))
}
export function floors(b: WorldBuilder, surfaces: readonly WalkSurface[], natural = false) {
  type Interval = [number, number]
  const heightTolerance = .08, trimRadius = .025, trimClearance = .04
  const intersect = (...ranges: (Interval | null)[]): Interval | null => {
    if (ranges.some(range => range === null)) return null
    const start = Math.max(0, ...ranges.map(range => range![0]))
    const end = Math.min(1, ...ranges.map(range => range![1]))
    return end > start ? [start, end] : null
  }
  const linearRange = (start: number, delta: number, low: number, high: number): Interval | null => {
    if (Math.abs(delta) < 1e-10) return start >= low && start <= high ? [0, 1] : null
    const a = (low - start) / delta, c = (high - start) / delta
    return intersect([Math.min(a, c), Math.max(a, c)])
  }
  const exposedEdge = (a: WorldPoint, c: WorldPoint, owner: number, segment: number, key: MaterialKey) => {
    const dx = c[0] - a[0], dy = c[1] - a[1], dz = c[2] - a[2], lengthSquared = dx * dx + dz * dz
    if (lengthSquared < 1e-10) return
    const covered: Interval[] = []
    const keep = (range: Interval | null) => { if (range) covered.push(range) }
    const atHeight = (height: number, slope = 0) => linearRange(a[1] - height, dy - slope, -heightTolerance, heightTolerance)
    const circle = (center: WorldPoint, radius: number): Interval | null => {
      const x = a[0] - center[0], z = a[2] - center[2], dot = x * dx + z * dz
      const discriminant = dot * dot - lengthSquared * (x * x + z * z - radius * radius)
      if (discriminant <= 0) return null
      const root = Math.sqrt(discriminant)
      return intersect([(-dot - root) / lengthSquared, (-dot + root) / lengthSquared])
    }
    surfaces.forEach((other, otherIndex) => {
      if (other.kind === 'disc') {
        keep(intersect(circle(other.center, other.radius + trimClearance), atHeight(other.center[1])))
      } else if (other.kind === 'rect') {
        keep(intersect(
          linearRange(a[0] - other.center[0], dx, -other.width / 2 - trimClearance, other.width / 2 + trimClearance),
          linearRange(a[2] - other.center[2], dz, -other.depth / 2 - trimClearance, other.depth / 2 + trimClearance),
          atHeight(other.center[1]),
        ))
      } else {
        for (let j = 1; j < other.points.length; j++) {
          if (otherIndex === owner && j === segment) continue
          const p = other.points[j - 1], q = other.points[j], sx = q[0] - p[0], sz = q[2] - p[2], size = Math.hypot(sx, sz)
          if (size < 1e-5) continue
          const radius = other.width / 2 + trimClearance
          const projection = ((a[0] - p[0]) * sx + (a[2] - p[2]) * sz) / (size * size)
          const projectionDelta = (dx * sx + dz * sz) / (size * size)
          const cross = ((a[0] - p[0]) * -sz + (a[2] - p[2]) * sx) / size
          const crossDelta = (dx * -sz + dz * sx) / size, rise = q[1] - p[1]
          // Clip the strip and both capsule caps separately, matching each part's floor height.
          keep(intersect(linearRange(projection, projectionDelta, 0, 1), linearRange(cross, crossDelta, -radius, radius), atHeight(p[1] + rise * projection, rise * projectionDelta)))
          keep(intersect(linearRange(projection, projectionDelta, -Infinity, 0), circle(p, radius), atHeight(p[1])))
          keep(intersect(linearRange(projection, projectionDelta, 1, Infinity), circle(q, radius), atHeight(q[1])))
        }
      }
    })
    const draw = (start: number, end: number) => {
      if ((end - start) * Math.sqrt(lengthSquared) < .05) return
      const point = (t: number): WorldPoint => [a[0] + dx * t, a[1] + dy * t + .018, a[2] + dz * t]
      b.rod(key, point(start), point(end), trimRadius)
    }
    // The complement of the union leaves only outer edges; even narrow crossings are clipped exactly.
    covered.sort((left, right) => left[0] - right[0])
    let cursor = 0
    for (const [start, end] of covered) {
      if (start > cursor) draw(cursor, start)
      cursor = Math.max(cursor, end)
    }
    if (cursor < 1) draw(cursor, 1)
  }
  surfaces.forEach((surface, index) => {
    const key = surface.material === 'wood' ? 'wood' : surface.material === 'leaf' ? 'leaf' : 'paving'
    if (surface.kind === 'disc') {
      if (key === 'paving') {
        b.add(stoneIsland(surface.radius, index + 55), 'stone', surface.center)
        if(!natural){const cap=new THREE.CircleGeometry(surface.radius-.18,56);cap.rotateX(-Math.PI/2);const positions=cap.getAttribute('position'),uv=cap.getAttribute('uv');for(let v=0;v<positions.count;v++)uv.setXY(v,positions.getX(v)*.5,positions.getZ(v)*.32);b.add(cap,'paving',[surface.center[0],surface.center[1]+.003,surface.center[2]])}
      }
      else b.add(new THREE.CylinderGeometry(surface.radius,surface.radius,.25,48), key, [surface.center[0],surface.center[1]-.125,surface.center[2]])
      // An inset, almost flush seam remains unobtrusive where a path enters the platform.
      b.ring(key === 'leaf' ? 'brass' : 'darkWood', [surface.center[0],surface.center[1]+.008,surface.center[2]],surface.radius-.18,.014)
      return
    }
    if (surface.kind === 'rect') { b.box(key,[surface.center[0],surface.center[1]-.15,surface.center[2]],[surface.width,.3,surface.depth]); return }
    for (let i=1;i<surface.points.length;i++) {
      const a=surface.points[i-1],c=surface.points[i],dx=c[0]-a[0],dz=c[2]-a[2],length=Math.hypot(dx,dz),nx=-dz/length,nz=dx/length,w=surface.width*.5
      const p:number[]=[],uv:number[]=[],indices=[0,1,2,1,3,2,4,6,5,5,6,7,0,4,1,1,4,5,2,3,6,3,7,6]
      for(const down of [0,.25]) for(const point of [a,c]) for(const side of [-1,1]) {p.push(point[0]+nx*w*side,point[1]-down+.008,point[2]+nz*w*side);uv.push((side+1)*w*.5,(point===a?0:length)*.32)}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();b.add(g,key)
      // Fine edging stops at adjoining platforms and paths instead of crossing their walking area.
      for(const side of [-1,1]) exposedEdge([a[0]+nx*(w-.1)*side,a[1],a[2]+nz*(w-.1)*side],[c[0]+nx*(w-.1)*side,c[1],c[2]+nz*(w-.1)*side],index,i,key === 'wood'?'darkWood':'brass')
      if (key==='wood' && length>5) for(let t=1;t<length;t+=2.5) {
        const mix=t/length,x=a[0]+dx*mix,z=a[2]+dz*mix,y=a[1]+(c[1]-a[1])*mix
        b.rod('darkWood',[x+nx*w,y-.2,z+nz*w],[x+nx*w,-1.5,z+nz*w],.12)
        b.rod('darkWood',[x-nx*w,y-.2,z-nz*w],[x-nx*w,-1.5,z-nz*w],.12)
      }
      // Rounded, flush joins exactly match the navigable capsule at each vertex.
      for(const point of [a,c]) b.add(new THREE.CylinderGeometry(w,w,.22,20),key,[point[0],point[1]-.12,point[2]])
    }
  })
}
export function pillar(b: WorldBuilder, x:number,z:number,height=4,key:MaterialKey='stone',y=0) {
  b.box(key,[x,y+.14,z],[.62,.28,.62]);b.box(key,[x,y+.36,z],[.45,.16,.45])
  b.rod(key,[x,y+.4,z],[x,y+height-.32,z],.16,.13)
  b.add(new THREE.LatheGeometry([new THREE.Vector2(.13,0),new THREE.Vector2(.16,.08),new THREE.Vector2(.24,.13),new THREE.Vector2(.27,.23)],12),key,[x,y+height-.38,z])
  b.box(key,[x,y+height-.07,z],[.58,.14,.58])
  b.ring('brass',[x,y+.62,z],.167,.018)
}
export function arch(b:WorldBuilder,width=3,height=4,key:MaterialKey='brass',thickness=.07) {
  const radius=width/2,spring=height-radius
  const points:WorldPoint[]=[[-radius,0,0],[-radius,spring,0]]
  for(let i=0;i<=24;i++){const a=Math.PI-i/24*Math.PI;points.push([Math.cos(a)*radius,spring+Math.sin(a)*radius,0])}
  points.push([radius,0,0]);b.curve(key,points,thickness,56)
}
export function lantern(b:WorldBuilder,p:WorldPoint,wall=false) {
  local(b,p,0,q=>{
    if(!wall){q.rod('iron',[0,0,0],[0,2.65,0],.048);q.add(new THREE.LatheGeometry([new THREE.Vector2(.22,0),new THREE.Vector2(.22,.12),new THREE.Vector2(.1,.18),new THREE.Vector2(.06,.4)],10),'iron')}
    const h=wall?.1:2.8
    q.add(new THREE.CylinderGeometry(.23,.3,.1,6),'brass',[0,h,0]);q.add(new THREE.CylinderGeometry(.3,.05,.22,6),'iron',[0,h+.61,0]);q.sphere('glow',[0,h+.3,0],[.1,.2,.1],12)
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;q.rod('brass',[Math.cos(a)*.22,h,Math.sin(a)*.22],[Math.cos(a)*.2,h+.52,Math.sin(a)*.2],.015)}
    q.add(new THREE.CylinderGeometry(.19,.22,.46,6,1,true),'glass',[0,h+.26,0])
  })
}
export function railing(b:WorldBuilder,a:WorldPoint,c:WorldPoint,ornate=true) {
  const dx=c[0]-a[0],dz=c[2]-a[2],length=Math.hypot(dx,dz),count=Math.max(1,Math.ceil(length/1.3)),yaw=Math.atan2(dx,dz)
  for(const h of [.18,1.05])b.rod('brass',[a[0],a[1]+h,a[2]],[c[0],c[1]+h,c[2]],.025)
  for(let i=0;i<=count;i++){
    const t=i/count,x=a[0]+dx*t,z=a[2]+dz*t,y=a[1]+(c[1]-a[1])*t
    b.rod('iron',[x,y,z],[x,y+1.08,z],.027);b.sphere('brass',[x,y+1.12,z],[.055,.055,.055],8)
    if(ornate && i<count)local(b,[x,y,z],yaw,q=>{q.curve('brass',[[0,.18,0],[.12,.4,.25],[0,.9,.5],[-.12,.4,.75],[0,.18,length/count]],.015,20)})
  }
}
export function tree(b:WorldBuilder,p:WorldPoint,height:number,seed:number,foliage:MaterialKey='petals',bare=false) {
  const rnd=random(seed)
  local(b,p,rnd()*6.28,q=>{
    const bend=.55+(rnd()-.5)*.8,trunk:WorldPoint[]=[[0,-.12,0],[-.2,height*.27,.1],[bend,height*.6,-.25],[bend+.25,height*.87,.15]]
    q.add(taperedBranch(trunk,height*.062,height*.008),'bark')
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2; q.add(taperedBranch([[Math.cos(a)*height*.14,.02,Math.sin(a)*height*.14],[Math.cos(a)*.26,height*.06,Math.sin(a)*.26],[0,height*.25,0]],height*.035,.045),'bark')}
    for(let branch=0;branch<9;branch++){
      const a=branch*2.399,r=height*(.3+rnd()*.17),h=height*(.66+rnd()*.27),tip:WorldPoint=[Math.cos(a)*r+bend,h,Math.sin(a)*r]
      q.add(taperedBranch([[bend*.6,height*(.36+branch*.025),0],[tip[0]*.48,h*.85,tip[2]*.45],tip],height*.025,.016),'bark')
      for(let twig=0;twig<3;twig++){
        const t=twig*2.399+branch,tipp:WorldPoint=[tip[0]+Math.cos(t)*height*.12,h+height*.1,tip[2]+Math.sin(t)*height*.12]
        q.rod('bark',[tip[0]*.77,h*.94,tip[2]*.77],tipp,.04,.01)
        if(!bare)for(let leaf=0;leaf<9;leaf++){
          const az=rnd()*6.28,rad=Math.sqrt(rnd())*height*.14,size=height*(.11+rnd()*.08)
          q.add(new THREE.PlaneGeometry(size,size),foliage,[tipp[0]+Math.cos(az)*rad,tipp[1]+(rnd()-.5)*height*.16,tipp[2]+Math.sin(az)*rad],[-.9+rnd()*1.8,rnd()*6.28,rnd()*6.28])
        }
      }
    }
  })
}
export function reeds(b:WorldBuilder,p:WorldPoint,radius:number,seed:number,count=45) {
  const rnd=random(seed)
  for(let i=0;i<count;i++){
    const a=rnd()*6.28,r=Math.sqrt(rnd())*radius,x=p[0]+Math.cos(a)*r,z=p[2]+Math.sin(a)*r,h=.7+rnd()*1.6
    b.rod('leaf',[x,p[1]-.1,z],[x+.12,p[1]+h,z],.022,.009)
    if(i%3===0)b.rod('darkWood',[x+.12,p[1]+h*.82,z],[x+.13,p[1]+h+.12,z],.055,.05)
    for(let j=0;j<2;j++)b.add(leafBlade(.13,h*.65,.12,4,2),'leaf',[x+(j?-.15:.15),p[1]+h*.38,z],[.4,j?1.9:-1.1,.6])
  }
}
export function flowerBed(b:WorldBuilder,p:WorldPoint,length:number,seed:number) {
  const rnd=random(seed)
  b.box('darkWood',[p[0],p[1]+.18,p[2]],[length,.36,.6]);b.box('brass',[p[0],p[1]+.32,p[2]+.305],[length,.04,.03])
  for(let i=0;i<Math.ceil(length*12);i++){
    const x=p[0]+(rnd()-.5)*(length-.15),z=p[2]+(rnd()-.5)*.4,h=.4+rnd()*.4
    b.rod('leaf',[x,p[1]+.25,z],[x,p[1]+h,z],.009)
    for(let petal=0;petal<4;petal++)b.add(new THREE.CircleGeometry(.055,6),'rose',[x,p[1]+h,z],[rnd(),petal*1.57,0])
  }
}
export function bench(b:WorldBuilder,p:WorldPoint,yaw=0) {
  local(b,p,yaw,q=>{
    for(const x of [-.9,.9]){q.curve('iron',[[x,0,.32],[x,.6,.25],[x,.5,-.3],[x,.05,-.38]],.043);q.curve('iron',[[x,.5,.28],[x,.85,.15],[x,.85,-.35],[x,.5,-.38]],.026)}
    for(let i=0;i<4;i++)q.box('wood',[0,.52,-.3+i*.17],[2.3,.09,.13])
    for(let i=0;i<3;i++)q.box('wood',[0,.75+i*.16,-.38],[2.3,.12,.065],[.12,0,0])
  })
}
export function galleryFacade(b:WorldBuilder,p:WorldPoint,yaw:number,seed:number) {
  local(b,p,yaw,q=>{
    q.box('plaster',[0,3,-2.15],[8,6,.3]);q.box('darkWood',[0,5.85,-.6],[8.5,.3,3.8]);q.box('darkWood',[0,.18,-.7],[8.5,.36,3.8])
    for(const x of [-4,-1.35,1.35,4]){pillar(q,x,0,5.75,'darkWood');q.box('brass',[x,2.85,.17],[.035,5.1,.025])}
    for(const x of [-2.68,0,2.68])local(q,[x,.7,-.2],0,w=>{
      arch(w,2.2,4.3,'brass',.055);arch(w,2.35,4.42,'darkWood',.075)
      w.box('glass',[0,1.9,-.035],[2.05,3.7,.025]);w.rod('brass',[-1.05,2.7,.03],[1.05,2.7,.03],.017);w.rod('brass',[0,0,.03],[0,4.25,.03],.017)
      if(x===0){
        for(let row=0;row<4;row++){
          const y=.6+row*.69;w.box('darkWood',[0,y,-.45],[1.88,.1,.65])
          for(let book=0;book<10;book++){
            const bx=-.81+book*.18,bh=.38+((book+row)%3)*.06,key:MaterialKey=(book+row)%3===0?'rose':(book+row)%3===1?'ink':'darkWood'
            w.box(key,[bx,y+.07+bh/2,-.38],[.14,bh,.4],[0,0,book===9?-.1:0]);for(const band of [.12,.32])w.box('brass',[bx,y+band,-.173],[.13,.012,.012])
          }
        }
      }else{
        const art:MaterialKey=seed%3===0?'artMonet':seed%3===1?'artBridge':'artVenice'
        w.box('darkWood',[0,1.95,-.3],[1.92,2.14,.18]);w.box('brass',[0,1.95,-.192],[1.82,2.04,.075]);w.box('paper',[0,1.95,-.14],[1.72,1.94,.04]);w.add(new THREE.PlaneGeometry(1.52,art==='artMonet'?1.34:1.05),art,[0,1.95,-.112])
        w.box('brass',[0,.76,-.12],[.7,.18,.025])
      }
    })
    for(let i=0;i<18;i++)q.box(i%2?'paper':'rose',[-4.2+i*.49,5.3,.6],[.48,.08,2.2],[.14,0,0])
    flowerBed(q,[-2.7,.35,1.15],2.2,seed);flowerBed(q,[2.7,.35,1.15],2.2,seed+1)
    lantern(q,[-3.95,3.7,.25],true);lantern(q,[3.95,3.7,.25],true)
    q.box('brass',[0,5.57,.17],[7.7,.04,.04]);q.box('brass',[0,5.4,.17],[7.7,.025,.025])
  })
}
export function mailHouse(b:WorldBuilder,p:WorldPoint,yaw:number,variant:number) {
  local(b,p,yaw,q=>{
    for(const x of [-3,3]){pillar(q,x,0,4.7,'darkWood');pillar(q,x,-3.7,4.7,'darkWood')}
    q.box('plaster',[0,2.3,-3.8],[6.4,4.6,.22]);q.box('darkWood',[0,4.85,-1.8],[6.8,.18,4.6]);q.box('darkWood',[0,5.65,-1.8],[3.8,.18,4.8],[0,0,.37]);q.box('darkWood',[0,5.65,-1.8],[3.8,.18,4.8],[0,0,-.37])
    local(q,[0,0,0],0,r=>arch(r,5.6,4.5,'brass',.085))
    for(let row=0;row<3;row++)for(let col=0;col<6;col++){
      const x=-2.25+col*.9,y=.9+row*.6;q.box('wood',[x,y,-3.45],[.8,.52,.45]);q.box('brass',[x,y,-3.21],[.38,.09,.025]);q.box('iron',[x,y+.13,-3.205],[.38,.03,.035])
    }
    q.add(new THREE.CylinderGeometry(.88,.88,.15,40),'brass',[0,3.5,-3.52],[Math.PI/2,0,0]);q.add(new THREE.CircleGeometry(.8,40),'paper',[0,3.5,-3.42])
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;q.rod('darkWood',[Math.sin(a)*.64,3.5+Math.cos(a)*.64,-3.4],[Math.sin(a)*.73,3.5+Math.cos(a)*.73,-3.4],.016)}
    q.rod('iron',[0,3.5,-3.36],[Math.sin(variant)*.53,3.5+Math.cos(variant)*.53,-3.36],.022);q.rod('iron',[0,3.5,-3.33],[.34,3.67,-3.33],.027)
    lantern(q,[-2.8,2.9,.1],true);lantern(q,[2.8,2.9,.1],true)
  })
}
export function pergola(b:WorldBuilder,p:WorldPoint,yaw:number,size=1) {
  local(b,p,yaw,q=>{
    for(const x of [-2.7,2.7])for(const z of [-2,2])pillar(q,x,z,4,'stone')
    for(const z of [-2,2]){q.box('darkWood',[0,4,z],[6.6,.25,.24]);local(q,[0,1,z],0,w=>arch(w,5.3,2.8,'brass',.048))}
    for(let i=0;i<9;i++)q.box('wood',[-3.2+i*.8,4.2,0],[.16,.2,5.2]);bench(q,[0,0,-1.55])
  },size)
}

/** Sunset-only stonework; authored static plants use this same layout's soil contacts. */
export function sunsetPlanter(b:WorldBuilder,definition:SunsetPlanterDefinition) {
  const {position,length,depth,yaw,soilHeight,innerLength,innerDepth}=definition
  local(b,position,yaw,q=>{
    q.add(new RoundedBoxGeometry(length,.5,depth,2,.16),'stone',[0,.17,0])
    // Four rails replace the former solid lid, exposing a soil bed below the coping.
    const outerLength=length+.04,outerDepth=depth+.05,rail=(outerDepth-innerDepth)/2
    for(const side of [-1,1]){
      q.add(new RoundedBoxGeometry(outerLength,.12,rail,2,.045),'darkWood',[0,.45,side*(outerDepth-rail)/2])
      q.add(new RoundedBoxGeometry((outerLength-innerLength)/2,.12,innerDepth,2,.045),'darkWood',[side*(outerLength+innerLength)/4,.45,0])
    }
    q.add(new RoundedBoxGeometry(innerLength,.024,innerDepth,2,.01),'darkWood',[0,soilHeight-.012,0])
    q.curve('brass',[[-length/2+.15,.5,outerDepth/2],[0,.5,outerDepth/2],[length/2-.15,.5,outerDepth/2]],.018)
  })
}

export function sunsetBridge(b:WorldBuilder) {
  const centerZ=-2.0,half=3.6
  for(const side of [-1,1]){
    // The sculpted arch is below a level walking deck. There is no walkable underpass.
    const outline=new THREE.Shape();outline.moveTo(-half,-1.08)
    for(let i=0;i<=28;i++){const t=i/28;outline.lineTo(-half+t*half*2,-.95+Math.sin(t*Math.PI)*.72)}
    for(let i=28;i>=0;i--){const t=i/28;outline.lineTo(-half+t*half*2,-1.13+Math.sin(t*Math.PI)*.67)}
    outline.closePath()
    b.add(new THREE.ExtrudeGeometry(outline,{depth:.28,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:2,steps:1}),'stone',[sunsetBridgeCenterX(centerZ)+side*4.1,0,centerZ],[0,Math.PI/2+Math.atan(.178571),0])
    const rail:WorldPoint[]=[],lower:WorldPoint[]=[]
    for(let i=0;i<=24;i++){
      const t=i/24,z=centerZ-half+t*half*2,x=sunsetBridgeCenterX(z)+side*4.1,y=1.02+.2*Math.sin(t*Math.PI)
      rail.push([x,y,z]);lower.push([x,.19,z])
      if(i%3===0){b.rod('iron',[x,.05,z],[x,y,z],.028);b.sphere('brass',[x,y+.035,z],[.047,.047,.047],12)}
    }
    b.curve('brass',rail,.041,50);b.curve('brass',lower,.024,40)
    for(let i=0;i<8;i++){
      const z=centerZ-half+i*.9
      b.curve('brass',[[sunsetBridgeCenterX(z)+side*4.1,.2,z],[sunsetBridgeCenterX(z+.22)+side*4.1,.65,z+.22],[sunsetBridgeCenterX(z+.45)+side*4.1,.95,z+.45],[sunsetBridgeCenterX(z+.68)+side*4.1,.65,z+.68],[sunsetBridgeCenterX(z+.9)+side*4.1,.2,z+.9]],.014,16)
    }
  }
}

export function sunsetBelvedere(b:WorldBuilder) {
  local(b,[0,0,-26],0,q=>{
    // Open toward the sunset: columns sit around the rim, never across the central view.
    for(const [x,z] of [[-5,-1],[-4.5,-4],[4.5,-4],[5,-1]]){
      pillar(q,x,z,4.1,'stone');q.add(new RoundedBoxGeometry(.64,.13,.64,2,.06),'brass',[x,3.65,z])
    }
    for(let rib=0;rib<7;rib++){
      const z=-4.2+rib*.55;const points:WorldPoint[]=[]
      for(let i=0;i<=24;i++){const t=i/24;points.push([-5.2+t*10.4,4.13+.75*Math.sin(t*Math.PI),z])}
      q.curve('darkWood',points,.07,36)
      if(rib===0||rib===6)q.curve('brass',points.map(([x,y,z])=>[x,y+.065,z]),.023,36)
    }
    q.curve('brass',[[-5,1,-1],[-5.35,1,-3],[-4.5,1,-5],[0,1,-5.3],[4.5,1,-5],[5.35,1,-3],[5,1,-1]],.03,64)
  })
}
