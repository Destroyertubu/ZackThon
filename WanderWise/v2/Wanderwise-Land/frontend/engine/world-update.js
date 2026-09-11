import {terrainFunctions} from './terrain.js';

export function buildWorldUpdate(world,signal){
 return new Promise((resolve,reject)=>{
  if(signal.aborted)return reject(new DOMException('World update cancelled','AbortError'));
  let settled=false;
  const worker=new Worker(new URL('./world-worker.js',import.meta.url),{type:'module'});
  const finish=(error,scene)=>{
   if(settled)return;settled=true;
   clearTimeout(timer);signal.removeEventListener('abort',abort);worker.terminate();
   if(error)reject(error);else resolve({...scene,height:terrainFunctions(scene.nodes,scene.links).height});
  };
  const abort=()=>finish(new DOMException('World update cancelled','AbortError'));
  const timer=setTimeout(()=>finish(new Error('世界扩展准备超时，原场景仍可漫游。')),18000);
  signal.addEventListener('abort',abort,{once:true});
  worker.onmessage=({data})=>finish(data.error?new Error(data.error):null,data.scene);
  worker.onerror=event=>{event.preventDefault();finish(new Error('世界扩展准备失败，原场景仍可漫游。'))};
  worker.postMessage(world);
 });
}

// Commit only new world data. Player, camera, input, pointer lock, visits and RAF survive.
export async function updateWorldInPlace(world){
 if(this.disposed||this.kind!=='world'||this.busy)return false;
 this.worldUpdateController?.abort();const controller=new AbortController();this.worldUpdateController=controller;
 try{
  const scene=await buildWorldUpdate(world,controller.signal);
  if(controller.signal.aborted||this.disposed||this.kind!=='world')return false;
  this.renderer.upload('scene',scene.geometry);this.scene=scene;this.world=world;
  if(this.requestedScene)this.requestedScene={kind:'world',world,field:null,checkpoint:this.checkpoint()};
  this.updateTargets();this.target=this.targets.find(t=>t.id===this.target?.id)||null;
  return true;
 }catch(error){if(error.name==='AbortError')return false;throw error}
 finally{if(this.worldUpdateController===controller)this.worldUpdateController=null}
}
