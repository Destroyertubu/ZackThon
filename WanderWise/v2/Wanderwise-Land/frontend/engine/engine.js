import {updateWorldInPlace} from './world-update.js';
import {pickTarget as pickNearbyTarget} from './interaction.js';
import {Renderer} from './renderer-three.js';
import {buildScene,playerGeometry,C} from './scenes.js';
import {loadHome} from './home-scene.js';
import {Geometry,color} from './geometry.js';
import {clamp,mix,dist,segmentBox,pathBetween,project} from './math.js';
function withSignal(promise,signal){return new Promise((resolve,reject)=>{const abort=()=>reject(new DOMException('Scene cancelled','AbortError'));if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true});promise.then(v=>{signal.removeEventListener('abort',abort);resolve(v)},e=>{signal.removeEventListener('abort',abort);reject(e)})})}
export class Engine{
 constructor(canvas,callbacks={}){
  this.canvas=canvas;this.callbacks=callbacks;this.renderer=new Renderer(canvas);this.keys=new Set();this.active=false;this.kind='home';this.player={x:0,y:0,z:5,yaw:0};this.camera={yaw:0,pitch:.22,distance:5};this.eye=[0,3,10];this.target=null;this.contents=new Map();this.anchors=[];this.settings={quality:'medium',sensitivity:1,reduceMotion:false,invertY:false,autoQuality:true};this.navigation={id:null,mode:0};this.last=performance.now();this.time=0;this.vy=0;this.grounded=true;this.aimSince=0;this.nearId=null;this.visitedSeconds=0;this.totalDwell=0;this.visited=false;this.busy=false;this.expansionAttempt=new Set();this.cleanup=[];
  let listen=(el,type,fn,options)=>{el.addEventListener(type,fn,options);this.cleanup.push(()=>el.removeEventListener(type,fn,options))};
  let typing=e=>e.isComposing||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable;
  listen(document,'keydown',e=>{if(e.defaultPrevented||typing(e)||e.repeat)return;if(e.code==='Escape'){this.pause();callbacks.escape?.();return}if(!this.active)return;this.keys.add(e.code);if(['Space','KeyE','KeyF','KeyB','KeyR','KeyT','KeyV'].includes(e.code))e.preventDefault();if(e.code==='Space'&&this.grounded){this.vy=3.96;this.grounded=false}if(['KeyE','KeyF','KeyB','KeyR','KeyT','KeyV'].includes(e.code))callbacks.action?.(e.code.slice(3).toLowerCase(),this.target)});
  listen(document,'keyup',e=>this.keys.delete(e.code));listen(window,'blur',()=>this.pause());listen(document,'visibilitychange',()=>{if(document.hidden)this.pause()});
  listen(document,'pointerlockchange',()=>{if(document.pointerLockElement===canvas)this.controlMode='locked';else if(this.controlMode==='locked')this.pause(false)});
  listen(canvas,'contextmenu',e=>e.preventDefault());
  listen(canvas,'pointerdown',e=>{if(this.active&&e.button===2&&document.pointerLockElement!==canvas){this.dragLook=true;canvas.setPointerCapture(e.pointerId)}});
  listen(canvas,'pointerup',e=>{if(e.button===2)this.dragLook=false});
  listen(document,'mousemove',e=>{if(this.active&&!this.busy&&(document.pointerLockElement===canvas||this.dragLook)){this.camera.yaw-=e.movementX*.0023*this.settings.sensitivity;this.camera.pitch=clamp(this.camera.pitch+e.movementY*.0018*this.settings.sensitivity*(this.settings.invertY?-1:1),-.5,1.15)}});
  listen(canvas,'wheel',e=>{if(this.active){this.camera.distance=clamp(this.camera.distance+e.deltaY*.007,2,10);e.preventDefault()}},{passive:false});
  listen(canvas,'mousedown',e=>{if(e.button===0&&this.active&&!this.busy){this.pickTarget(true);callbacks.action?.('read',this.target)}});
  listen(canvas,'webglcontextlost',e=>{e.preventDefault();this.pause();callbacks.contextLost?.()});
  this.status='loading';this.sceneEpoch=0;this.disposed=false;this.frame=this.frame.bind(this);this.renderer.setLoop(this.frame);
  this.ready=this.setScene('home');
 }
 cancelSceneLoad(){this.worldUpdateController?.abort();this.sceneEpoch++;this.loadController?.abort();this.presentReady?.resolve(false);this.presentReady=null;this.pause();}
 async setScene(kind,world=null,field=null,checkpoint=null){
  this.cancelSceneLoad();this.busy=true;const epoch=this.sceneEpoch;this.requestedScene={kind,world,field,checkpoint};
  const controller=new AbortController();this.loadController=controller;this.status='loading';this.callbacks.sceneState?.('loading');
  const timer=setTimeout(()=>controller.abort(),18000);let next;
  try{
   next=kind==='home'?await loadHome(controller.signal):buildScene(kind,world,field);
   if(epoch!==this.sceneEpoch||this.disposed){next.dispose?.();return false}
   this.renderer.detach();this.scene?.dispose?.();this.world=world;this.field=field;this.kind=kind;this.scene=next;
   this.renderer.upload('scene',next.geometry);this.renderer.clearText();this.renderer.install(next.root);this.renderer.configure(kind);
   this.player={...(checkpoint?.position||next.spawn),yaw:checkpoint?.yaw||0};
   if(kind==='home'&&checkpoint?.position&&next.colliders.some(b=>b.player!==false&&this.player.x+.28>b.min[0]&&this.player.x-.28<b.max[0]&&this.player.z+.28>b.min[2]&&this.player.z-.28<b.max[2]&&this.player.y+1.5>b.min[1]&&this.player.y<b.max[1]-.001)){this.player={...next.spawn,yaw:0};this.callbacks.notice?.('小屋陈设已更新，已将你放到安全落点。')}

   this.camera={yaw:0,pitch:.22,distance:5,...next.camera,...checkpoint?.camera};
   this.navigation={id:checkpoint?.trackedNodeId||null,mode:checkpoint?.navigationMode||0};this.vy=0;this.grounded=true;this.target=null;this.nearId=null;this.visitedSeconds=0;this.visited=false;this.totalDwell=0;
   this.eye=[this.player.x,2.5,this.player.z+2];this.updateTargets();
   await withSignal(this.renderer.compile(),controller.signal);if(epoch!==this.sceneEpoch||this.disposed)return false;
   await withSignal(new Promise(resolve=>{this.presentReady={epoch,resolve}}),controller.signal);if(epoch!==this.sceneEpoch||this.disposed)return false;
   this.metricsAccumulator=[];this.last=performance.now();this.busy=false;this.status='ready';this.callbacks.sceneState?.('ready');return true;
  }catch(e){if(epoch!==this.sceneEpoch||this.disposed)return false;this.busy=true;this.status='error';this.callbacks.sceneState?.('error',e.name==='AbortError'?'场景加载超时，请重试。':e.message);return false}
  finally{clearTimeout(timer)}
 }
 async retryScene(){const a=this.requestedScene;return this.setScene(a.kind,a.world,a.field,a.checkpoint)}
 updateWorld(w){return updateWorldInPlace.call(this,w)}
 setContents(contents){this.contents=new Map(contents.map(c=>[c.id,c]));this.updateTargets()}
 setAnchors(anchors){this.anchors=anchors}
 updateTargets(){if(!this.scene)return;this.targets=[...this.scene.targets];if(this.kind!=='home')for(let n of this.scene.nodes){let c=this.contents.get(n.contentIds[0]);if(!c)continue;let excerpts=this.kind==='field'?[{id:n.section.excerptId,text:n.section.text,kind:'original_excerpt'}]:c.excerpts.filter(e=>n.excerptIds.includes(e.id)).slice(0,2);for(let [i,e] of excerpts.entries())this.targets.push({id:e.id+'@'+n.id,type:'excerpt',node:n,content:c,excerpt:e,title:c.title,position:{x:n.position.x+(i?2.1:-1.8),y:2.25+i*.6,z:n.position.z+1.8}})}}
 async resume(){
  if(this.busy||this.status!=='ready')return;
  try{await this.canvas.requestPointerLock();this.controlMode=document.pointerLockElement===this.canvas?'locked':'drag'}
  catch{this.controlMode='drag';this.callbacks.notice?.('鼠标捕获不可用：按住右键转动视角，WASD 移动，左键打开设施。')}
  if(this.disposed||this.busy)return;this.active=true;this.canvas.tabIndex=0;this.canvas.focus({preventScroll:true});this.callbacks.active?.(true);
 }
 pause(unlock=true){this.active=false;this.dragLook=false;this.keys.clear();this.callbacks.active?.(false);if(unlock&&document.pointerLockElement===this.canvas)document.exitPointerLock()}
 nearest(){if(!this.scene?.nodes.length)return null;return this.scene.nodes.reduce((a,b)=>dist(this.player,a.position)<dist(this.player,b.position)?a:b)}
 checkpoint(){return {position:{x:+this.player.x.toFixed(3),y:+this.player.y.toFixed(3),z:+this.player.z.toFixed(3)},yaw:this.player.yaw,camera:{...this.camera},trackedNodeId:this.navigation.id,navigationMode:this.navigation.mode}}
 clearKeys(){this.keys.clear()}
 cycleNav(node){if(!node)return this.callbacks.notice?.('先靠近一个话题，再开启追踪。');if(this.navigation.id!==node.id)this.navigation={id:node.id,mode:1};else this.navigation.mode=(this.navigation.mode+1)%3;this.callbacks.navigation?.(this.navigation,node)}
 obstructed(a,b){return this.scene.colliders.some(box=>{if(box.interaction===false)return false;let hit=segmentBox(a,b,box);return hit!==null&&hit>.005&&hit<.97})}
 move(dx,dz){let p=this.player,r=.28;let attempt=(x,z)=>{const bounds=this.scene.bounds;if(bounds){if(x-r<bounds.minX||x+r>bounds.maxX||z-r<bounds.minZ||z+r>bounds.maxZ)return false}else if(Math.abs(x)>this.scene.boundary-2||Math.abs(z)>this.scene.boundary-2)return false;return !this.scene.colliders.some(b=>b.player!==false&&x+r>b.min[0]&&x-r<b.max[0]&&z+r>b.min[2]&&z-r<b.max[2]&&p.y+1.5>b.min[1]&&p.y<b.max[1])};if(attempt(p.x+dx,p.z))p.x+=dx;if(attempt(p.x,p.z+dz))p.z+=dz}
 frame(stamp){if(this.disposed)return;const rawDt=Math.max(.0001,(stamp-this.last)/1000);let dt=Math.min(.04,rawDt);this.last=stamp;this.time+=dt;let p=this.player;this.metricsAccumulator=(this.metricsAccumulator||[]);this.metricsAccumulator.push(rawDt);this.frameTrace??=[];this.frameTrace.push([stamp,rawDt*1000,document.hidden?1:0]);if(this.frameTrace.length>1800)this.frameTrace.shift();if(this.metricsAccumulator.length>300)this.metricsAccumulator.shift();let moving=false;if(!this.scene)return;
  if(this.active&&!this.busy&&!document.hidden){let f=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0),s=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),l=Math.hypot(f,s);moving=l>0;if(l){f/=l;s/=l;let dx=(-Math.sin(this.camera.yaw)*f+Math.cos(this.camera.yaw)*s)*4.5*dt,dz=(-Math.cos(this.camera.yaw)*f-Math.sin(this.camera.yaw)*s)*4.5*dt;if(!this.scene.physics)this.move(dx,dz);else this.pendingMove={x:dx,z:dz};p.yaw=Math.atan2(-dx,-dz)}
   this.vy-=9.81*dt;if(this.scene.physics){const move=this.pendingMove||{x:0,z:0};this.pendingMove=null;const result=this.scene.physics.move(p,{x:move.x,y:this.vy*dt,z:move.z});this.grounded=result.grounded;if(this.grounded||Math.abs(result.corrected.y-this.vy*dt)>.001)this.vy=0}else p.y+=this.vy*dt;let floor=this.scene.height(p.x,p.z);if(p.y<=floor){p.y=floor;this.vy=0;this.grounded=true}if(p.y< -10){Object.assign(p,this.scene.spawn);this.vy=0;this.callbacks.notice?.('已返回安全落点，已保存的收获仍在。')}
  }
  let target=[p.x,p.y+1.18,p.z],d=this.camera.distance,ideal=[p.x+Math.sin(this.camera.yaw)*Math.cos(this.camera.pitch)*d,p.y+1.18+Math.sin(this.camera.pitch)*d,p.z+Math.cos(this.camera.yaw)*Math.cos(this.camera.pitch)*d];let fraction=1;if(this.scene.physics)ideal=this.scene.physics.camera(target,ideal);for(let b of this.scene.physics?[]:this.scene.colliders){if(b.camera===false)continue;let t=segmentBox(target,ideal,b,.16);if(t!==null)fraction=Math.min(fraction,Math.max(0,t-.20/Math.max(d,.1)))}ideal=target.map((v,i)=>mix(v,ideal[i],fraction));let factor=1-Math.exp(-dt*12);this.eye=this.eye.map((v,i)=>mix(v,ideal[i],factor));// Re-clip the smoothed camera segment; smoothing must not slide through a wall.
  if(this.scene.physics)this.eye=this.scene.physics.camera(target,this.eye);
  for(const b of this.scene.physics?[]:this.scene.colliders){if(b.camera===false)continue;const hit=segmentBox(target,this.eye,b,.12);if(hit!==null)this.eye=target.map((v,i)=>mix(v,this.eye[i],Math.max(0,hit-.01)))}
  this.eye[1]=Math.max(this.eye[1],this.scene.height(this.eye[0],this.eye[2])+.3);
  this.renderer.begin(this.eye,target,{fog:this.kind==='home'?[.33,.31,.24]:[.49,.66,.59],fogDistance:this.kind==='home'?85:130,quality:this.settings.quality});this.renderer.draw('scene');let dynamic=playerGeometry(p,this.settings.reduceMotion?0:this.time,moving);dynamic.transform=null;
  // Persisted private anchors only, rendered as small lanterns at stable node-relative offsets.
  if(this.kind==='world')for(let a of this.anchors){let n=this.scene.nodes.find(n=>n.topicId===a.topicId);if(n&&dist(p,n.position)<32){let x=n.position.x+a.localOffset.x,z=n.position.z+a.localOffset.z;dynamic.cylinder(x,0,z,.18,.8,C.gold,6,.1);dynamic.rock(x,.8,z,.12,C.cream)}}
  if(this.kind==='world'&&this.navigation.mode){let dest=this.scene.nodes.find(n=>n.id===this.navigation.id),near=this.nearest();if(dest&&near&&dist(p,dest.position)>6){let path=pathBetween(this.scene.nodes,this.scene.links,near.id,dest.id);if(path.length===1)path=[{x:p.x,y:0,z:p.z},...path];for(let i=1;i<path.length;i++){let a=path[i-1],b=path[i],length=dist(a,b);if(this.navigation.mode===2||this.settings.reduceMotion){for(let t=0;t<length;t+=2.4){let f=t/length,v=Math.min(1,(t+1.3)/length);dynamic.path({x:mix(a.x,b.x,f),z:mix(a.z,b.z,f)},{x:mix(a.x,b.x,v),z:mix(a.z,b.z,v)},.14,C.cream,.13)}}else for(let j=0;j<9;j++){let f=(j/9+this.time*.11)%1;dynamic.rock(mix(a.x,b.x,f),.45+Math.sin(f*6)*.1,mix(a.z,b.z,f),.055,C.cream)}}}}
  this.renderer.upload('dynamic',dynamic.data(),true);this.renderer.draw('dynamic');
  this.drawLabels();if(!this.busy){this.pickTarget();this.trackVisits(dt)}this.renderer.end();if(this.presentReady?.epoch===this.sceneEpoch){this.presentReady.resolve(true);this.presentReady=null}
  if(stamp-(this.lastMetrics||0)>1000){this.lastMetrics=stamp;let avg=this.metricsAccumulator.reduce((a,b)=>a+b,0)/this.metricsAccumulator.length;let sorted=this.metricsAccumulator.slice().sort((a,b)=>a-b);this.callbacks.metrics?.({...this.renderer.metrics,fps:Math.round(1/avg),medianFps:+(1/sorted[Math.floor(sorted.length/2)]).toFixed(1),p95ms:+(sorted[Math.floor(sorted.length*.95)]*1000).toFixed(2),rawFrameMs:rawDt*1000});if(this.settings.autoQuality&&this.active&&this.settings.quality!=='low'&&avg>1/30&&stamp-(this.lastDowngrade||0)>60000){this.settings.quality='low';this.lastDowngrade=stamp;this.callbacks.notice?.('帧率偏低，已自动切换低画质；可在设置中关闭自动调整。')}}

 }
 drawLabels(){
  const p=this.player;
  if(this.kind==='home'){for(const l of this.scene.labels)if(dist(p,l.target.position)<=3&&!this.obstructed(this.eye,l.position))this.renderer.text({...l,style:'facility'});return}
  const themes={forest:{name:'林地',accent:'#a6d8b5'},lake:{name:'湖畔',accent:'#9ddae4'},meadow:{name:'旷野',accent:'#edd091'},ruins:{name:'遗迹',accent:'#d1c5e8'}};
  let count=0;
  for(const t of this.targets.filter(t=>t.type==='excerpt').sort((a,b)=>dist(p,a.position)-dist(p,b.position))){
   const distance=dist(p,t.node.position);t.lod=t.lod?distance<14:distance<12;
   if(t.lod&&count<6){const pos=[t.position.x,t.position.y,t.position.z];if(!this.obstructed(this.eye,pos)){const txt=t.excerpt.text;this.renderer.text({text:txt.length>68?txt.slice(0,65)+'…':txt,position:pos,height:.35,minPixels:16,maxChars:20,avoidOverlap:true,style:this.target?.id===t.id?'quote-active':'quote',accent:this.target?.id===t.id?'#b88937':'#a6b6a0'});count++}}
  }
  const near=this.scene.nodes.slice().sort((a,b)=>dist(p,a.position)-dist(p,b.position));
  for(const n of near.slice(0,10)){
   const d=dist(p,n.position),theme=themes[n.biome]||themes.forest,pos=[n.position.x,4.65,n.position.z];
   let shown=false;
   if(d<110&&!this.obstructed(this.eye,pos))shown=this.renderer.text({text:n.title,position:pos,height:.72,minPixels:d>30?26:30,maxChars:14,avoidOverlap:true,style:'topic',accent:theme.accent});
   if(shown&&d<32&&!this.obstructed(this.eye,[pos[0],3.5,pos[2]]))this.renderer.text({text:this.kind==='field'?'原文段落 · 可溯源':theme.name+' / '+(n.expansionState==='expanded'?'已展开':n.expansionState==='exhausted'?'已探访':'沿路探索'),position:[pos[0],3.5,pos[2]],height:.28,minPixels:15,avoidOverlap:true,style:'meta',accent:theme.accent});
  }

 }

 pickTarget(immediate=false){return pickNearbyTarget.call(this,immediate)}
 trackVisits(dt){if(!this.active||this.kind==='home')return;let n=this.nearest(),id=n&&dist(this.player,n.position)<10?n.id:null;if(id!==this.nearId){if(this.visited&&this.nearId)this.callbacks.leave?.(this.scene.nodes.find(x=>x.id===this.nearId),this.totalDwell);this.nearId=id;this.visitedSeconds=0;this.totalDwell=0;this.visited=false;this.callbacks.near?.(id?n:null)}if(id){this.visitedSeconds+=dt;this.totalDwell+=dt;if(!this.visited&&this.visitedSeconds>=2){this.visited=true;this.callbacks.visit?.(n)}}if(this.kind==='world'&&n&&dist(this.player,n.position)<18&&n.expansionState==='unexpanded'&&this.visitedSeconds>.8&&!this.expansionAttempt.has(n.id)&&this.world.nodes[0].id!==n.id){this.expansionAttempt.add(n.id);this.callbacks.expand?.(n)}}
 dispose(){this.disposed=true;this.cancelSceneLoad();this.renderer.setLoop(null);this.cleanup.forEach(f=>f());this.scene?.dispose?.();this.renderer.dispose()}
}
