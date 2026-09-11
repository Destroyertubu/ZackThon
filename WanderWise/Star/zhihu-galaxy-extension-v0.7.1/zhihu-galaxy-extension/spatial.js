/* 0.7: bounded 3D physics and perspective geometry. No screen-space node displacement. */
(function(root, factory){const api=factory();root.ZGSpatial=api;if(typeof module==='object'&&module.exports)module.exports=api;})(globalThis,()=>{
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const finite=(x,d,a,b)=>Number.isFinite(Number(x))?clamp(Number(x),a,b):d;
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  const PALETTES={
    tech:{name:'深空科技',bg:'#050911',nebula:'#142c60',keyword:'#70b7ff',phenomenon:'#c59cff',answer:'#72e4dc',ink:'#e7f0ff',trail:'#e9c785'},
    saturated:{name:'日落潮汐',bg:'#191110',nebula:'#6b2c27',keyword:'#ff9e45',phenomenon:'#d9664c',answer:'#4ad1b4',ink:'#fff0df',trail:'#ffc96b'},
    morandi:{name:'雾色花园',bg:'#22262b',nebula:'#4c4855',keyword:'#b9bca1',phenomenon:'#b6a4b9',answer:'#9dbab2',ink:'#eee9e2',trail:'#cbb79f'}
  };
  const DEFAULT={attraction:1,repulsion:1.35,nodeScale:1,answerScale:1,rotationSpeed:1,zoomSpeed:1,holoScale:1,holoOpacity:.85,glow:.55,starDensity:.65,cardCount:4,theme:'tech',customPalette:{...PALETTES.tech},nodeColorMode:'uniform',layoutFrozen:false,showReadingDock:false,motion:'comfort',fontScale:1,showTrail:true,autoFocus:false,recordTrail:true,sortMode:'votes',randomSeed:731927,previewAfter:20,batchSize:12,maxAnswers:100};
  const RANGES={attraction:[0,3],repulsion:[0,4],nodeScale:[.4,2.5],answerScale:[.4,2.5],rotationSpeed:[.1,3],zoomSpeed:[.2,2.5],holoScale:[.65,1.7],holoOpacity:[.35,1],glow:[0,1.3],starDensity:[0,1.5],cardCount:[1,8],fontScale:[1,1.3],previewAfter:[3,50],batchSize:[3,30],maxAnswers:[10,500],randomSeed:[1,2147483647]};
  function cleanSettings(input={}){
    const out={...DEFAULT};for(const [k,[a,b]]of Object.entries(RANGES))out[k]=finite(input[k],DEFAULT[k],a,b);
    for(const k of ['layoutFrozen','showReadingDock','showTrail','autoFocus','recordTrail'])if(typeof input[k]==='boolean')out[k]=input[k];
    for(const k of ['cardCount','previewAfter','batchSize','maxAnswers','randomSeed'])out[k]=Math.round(out[k]);
    out.motion=['comfort','still','explore'].includes(input.motion)?input.motion:DEFAULT.motion;
    out.sortMode=['votes','latest','random'].includes(input.sortMode)?input.sortMode:DEFAULT.sortMode;
    out.nodeColorMode=['uniform','lineage'].includes(input.nodeColorMode)?input.nodeColorMode:DEFAULT.nodeColorMode;
    out.theme=['tech','saturated','morandi','custom'].includes(input.theme)?input.theme:'tech';
    out.customPalette={};for(const k of Object.keys(PALETTES.tech).filter(k=>k!=='name'))out.customPalette[k]=/^#[0-9a-f]{6}$/i.test(input.customPalette?.[k]||'')?input.customPalette[k]:PALETTES.tech[k];
    return out;
  }
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const rgba=(h,a)=>`rgba(${rgb(h).join(',')},${clamp(a,0,1)})`;
  function mix(a,b,t){const aa=rgb(a),bb=rgb(b);return '#'+aa.map((x,i)=>Math.round(x+(bb[i]-x)*t).toString(16).padStart(2,'0')).join('');}
  const luminance=h=>rgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  function palette(settings){const p={...(settings.theme==='custom'?settings.customPalette:PALETTES[settings.theme]||PALETTES.tech)};p.requestedInk=p.ink;p.inkAdjusted=contrast(p.bg,p.ink)<4.5;if(p.inkAdjusted)p.ink=luminance(p.bg)>.35?'#17202a':'#f3f5f7';p.surface=mix(p.bg,p.ink,.065);p.line=mix(p.bg,p.ink,.19);p.muted=mix(p.bg,p.ink,.64);p.hover=mix(p.bg,p.answer,.12);return p;}
  const add=(a,b,k=1)=>({x:a.x+b.x*k,y:a.y+b.y*k,z:a.z+b.z*k});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const norm=a=>{const l=Math.hypot(a.x,a.y,a.z)||1;return{x:a.x/l,y:a.y/l,z:a.z/l};};
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  function timestamp(a){const v=a.updated_time||a.created_time||0;if(typeof v==='number')return v<1e12?v*1000:v;return Date.parse(v)||0;}
  function compareAnswers(a,b,settings=DEFAULT){if(settings.sortMode==='random')return hash(`${settings.randomSeed}:${a.id}`)-hash(`${settings.randomSeed}:${b.id}`)||String(a.id).localeCompare(String(b.id));if(settings.sortMode==='latest')return timestamp(b)-timestamp(a)||(b.voteup_count||0)-(a.voteup_count||0)||String(a.id).localeCompare(String(b.id));return(b.voteup_count||0)-(a.voteup_count||0)||timestamp(b)-timestamp(a)||String(a.id).localeCompare(String(b.id));}
  function worldRadius(n,s){return (n.type==='keyword'?1.10:n.type==='phenomenon'?.82:.54)*s.nodeScale*(n.type==='answer'?s.answerScale:1);}
  class ForceLayout{
    constructor(nodes,settings){this.vel=new Map();this.anchors=new Map();this.steps=0;this.revision=0;this.setNodes(nodes);this.configure(settings);}
    setNodes(nodes){this.nodes=nodes;this.map=new Map(nodes.map(n=>[n.id,n]));for(const n of nodes){if(!this.anchors.has(n.id))this.anchors.set(n.id,{...n.pos});if(!this.vel.has(n.id))this.vel.set(n.id,{x:0,y:0,z:0});}this.edges=[];const seen=new Set();const edge=(a,b,rest,k=1)=>{if(!this.map.has(a)||!this.map.has(b)||a===b)return;const key=[a,b].sort().join('|');if(seen.has(key))return;seen.add(key);this.edges.push({a,b,rest,k});};for(const n of nodes){if(n.type==='answer')edge(n.id,n.parent,6.6+(hash(n.id)%100)/28,.95);if(n.type==='phenomenon')for(const p of n.parents||[])edge(n.id,p,25,.45);}
      // Up to three co-evidence links per topic, preserving a sparse O(E) spring graph.
      const topics=nodes.filter(n=>n.type==='keyword');for(const a of topics){const ids=new Set(a.evidenceAnswerIds||a.answerIds||[]);topics.filter(b=>b.id!==a.id).map(b=>({b,n:(b.evidenceAnswerIds||b.answerIds||[]).filter(x=>ids.has(x)).length})).filter(x=>x.n>1).sort((x,y)=>y.n-x.n).slice(0,3).forEach(({b,n})=>edge(a.id,b.id,48,Math.min(.18,n*.02)));}this.wake(180);}
    configure(s){this.s=cleanSettings(s);this.wake(210);}
    wake(steps=180){this.steps=steps;this.quiet=0;}
    stop(){this.steps=0;for(const v of this.vel.values())v.x=v.y=v.z=0;}
    step(dt=1/60){if(!this.steps||this.s.layoutFrozen)return false;dt=clamp(dt,1/240,1/30);const ns=this.nodes,forces=new Map(ns.map(n=>[n.id,{x:0,y:0,z:0}])),size=25,buckets=new Map();
      ns.forEach((n,i)=>{const p=n.pos,k=`${Math.floor(p.x/size)},${Math.floor(p.y/size)},${Math.floor(p.z/size)}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i);});
      for(let i=0;i<ns.length;i++){const a=ns[i],p=a.pos,bx=Math.floor(p.x/size),by=Math.floor(p.y/size),bz=Math.floor(p.z/size);
        for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const j of buckets.get(`${bx+x},${by+y},${bz+z}`)||[]){if(j<=i)continue;const b=ns[j];let dx=p.x-b.pos.x,dy=p.y-b.pos.y,dz=p.z-b.pos.z,d=Math.hypot(dx,dy,dz);if(d>25)continue;if(d<.01){const h=hash(a.id+'|'+b.id);dx=((h%99)-49)/49||.1;dy=(((h>>>8)%99)-49)/49;dz=(((h>>>16)%99)-49)/49;d=Math.hypot(dx,dy,dz);}
          const safe=worldRadius(a,this.s)+worldRadius(b,this.s)+2.8;const strength=this.s.repulsion*(280/(d*d+8)+Math.max(0,safe-d)*5),m=Math.min(65,strength)/d,fa=forces.get(a.id),fb=forces.get(b.id);fa.x+=dx*m;fa.y+=dy*m;fa.z+=dz*m;fb.x-=dx*m;fb.y-=dy*m;fb.z-=dz*m;}
      }
      for(const e of this.edges){const a=this.map.get(e.a),b=this.map.get(e.b),v=sub(b.pos,a.pos),d=Math.hypot(v.x,v.y,v.z)||1,m=(d-e.rest)*1.7*this.s.attraction*e.k/d,fa=forces.get(a.id),fb=forces.get(b.id);fa.x+=v.x*m;fa.y+=v.y*m;fa.z+=v.z*m;fb.x-=v.x*m;fb.y-=v.y*m;fb.z-=v.z*m;}
      let maxSpeed=0;for(const n of ns){const p=n.pos,f=forces.get(n.id),v=this.vel.get(n.id),anchor=this.anchors.get(n.id),r=Math.hypot(p.x,p.y,p.z)||1;
        // A weak tether prevents unbounded drift even when attraction is zero.
        const tether=n.type==='answer'?.025:.13;f.x+=(anchor.x-p.x)*tether;f.y+=(anchor.y-p.y)*tether;f.z+=(anchor.z-p.z)*tether;
        if(n.type==='keyword'){const radial=(55-r)*.32;f.x+=p.x/r*radial;f.y+=p.y/r*radial;f.z+=p.z/r*radial;}
        const damping=Math.exp(-3.4*dt);v.x=(v.x+f.x*dt)*damping;v.y=(v.y+f.y*dt)*damping;v.z=(v.z+f.z*dt)*damping;const speed=Math.hypot(v.x,v.y,v.z),limit=speed>20?20/speed:1;v.x*=limit;v.y*=limit;v.z*=limit;p.x+=v.x*dt;p.y+=v.y*dt;p.z+=v.z*dt;const pr=Math.hypot(p.x,p.y,p.z);if(pr>122){p.x*=122/pr;p.y*=122/pr;p.z*=122/pr;}
        if(![p.x,p.y,p.z].every(Number.isFinite)){Object.assign(p,anchor);v.x=v.y=v.z=0;}maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));}
      this.steps--;this.revision++;this.quiet=maxSpeed<.14?this.quiet+1:0;if(this.quiet>18)this.stop();return true;
    }
    settle(steps=200){this.wake(steps);for(let i=0;i<steps&&this.steps;i++)this.step(1/60);this.stop();}
  }
  // CSS perspective matrix for a real 3D plane. Browser performs inverse hit-testing.
  // Local (u,v) pixels map to world origin + u*axisX + v*axisY, then the same camera as nodes.
  function planeMatrix(origin,axisX,axisY,camera,right,up,forward,focal,cx,cy){
    const rel=sub(origin,camera),z=dot(rel,forward);if(z<3)return null;
    const x=dot(rel,right),y=dot(rel,up),xu=dot(axisX,right),yu=dot(axisX,up),zu=dot(axisX,forward),xv=dot(axisY,right),yv=dot(axisY,up),zv=dot(axisY,forward);
    return [(focal*xu+cx*zu)/z,(-focal*yu+cy*zu)/z,0,zu/z,(focal*xv+cx*zv)/z,(-focal*yv+cy*zv)/z,0,zv/z,0,0,1,0,(focal*x+cx*z)/z,(-focal*y+cy*z)/z,0,1];
  }
  function applyMatrix(m,x,y){const w=m[3]*x+m[7]*y+1;return{x:(m[0]*x+m[4]*y+m[12])/w,y:(m[1]*x+m[5]*y+m[13])/w};}
  return {DEFAULT,RANGES,PALETTES,cleanSettings,palette,rgba,mix,luminance,contrast,hash,clamp,add,sub,dot,norm,cross,compareAnswers,worldRadius,ForceLayout,planeMatrix,applyMatrix};
});
