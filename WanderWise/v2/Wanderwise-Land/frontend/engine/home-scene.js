import {Box3,Vector3,LoadingManager,TextureLoader} from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {disposeTree} from './renderer-three.js';
export const FACILITIES=Object.freeze({door:{action:'seed',title:'今天，你想去哪里？'},cabinet:{action:'bag',title:'想法收纳柜'},synthesis:{action:'synthesis',title:'思维合成台'},journal:{action:'journal',title:'漫行者日志'},phone:{action:'phone',title:'同频电话亭'}});
function abortable(promise,signal,late){
 return new Promise((resolve,reject)=>{
  let ended=false;const abort=()=>{ended=true;reject(new DOMException('Scene cancelled','AbortError'))};
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  promise.then(v=>{signal.removeEventListener('abort',abort);if(ended){late?.(v);return}ended=true;resolve(v)},e=>{signal.removeEventListener('abort',abort);if(!ended){ended=true;reject(e)}});
 });
}
export async function loadHome(signal){
 const configResponse=await fetch('/static/assets/home/scene.json',{signal});if(!configResponse.ok)throw Error('小屋场景配置加载失败');const config=await configResponse.json();
 if(config.schemaVersion!==1||!/^\/static\/assets\/home\/home-(corner|full)\.glb$/.test(config.model))throw Error('不支持的小屋配置');
 const r=await fetch(config.model,{signal});if(!r.ok)throw Error('小屋模型加载失败，请重试');
 const data=await r.arrayBuffer();if(data.byteLength>12*1024*1024)throw Error('小屋模型超过大小限制');
 const manager=new LoadingManager();let textureError=false;manager.onError=()=>{textureError=true};
 manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const parsed=new URL(url,location.href);if(parsed.origin!==location.origin)throw Error('小屋仅允许同源资源');return url});
 // Embedded image elements obey the existing img-src blob: policy. ImageBitmapLoader
 // would fetch blob: under connect-src, so choose TextureLoader per loader, never globally.
 const loader=new GLTFLoader(manager);loader.register(parser=>{parser.textureLoader=new TextureLoader(manager);return {name:'WW_ImageElementCSP'}});
 const gltf=await abortable(loader.parseAsync(data,location.origin+'/static/assets/home/'),signal,g=>disposeTree(g.scene));
 const root=gltf.scene;
 try{
  if(textureError)throw Error('家具贴图加载失败，请重试');
  root.updateMatrixWorld(true);const colliders=[],targets=[],markers={};
  root.traverse(o=>{
   if(o.name.startsWith('COL_')){
    const b=new Box3().setFromObject(o);if(!b.isEmpty())colliders.push({id:o.name,min:b.min.toArray(),max:b.max.toArray(),player:o.userData.player!==false,camera:o.userData.camera!==false,interaction:o.userData.interaction!==false});o.visible=false;
   }else if(o.name.startsWith('SPAWN_'))markers[o.name]=o.getWorldPosition(new Vector3());
   else if(o.name.startsWith('INTERACT_')){
    const id=o.name.slice(9),definition=Object.hasOwn(FACILITIES,id)?FACILITIES[id]:null;
    if(definition){const p=o.getWorldPosition(new Vector3());targets.push({id,type:'facility',...definition,position:{x:p.x,y:p.y,z:p.z}})}
   }else if(o.isMesh){const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=!o.name.startsWith('VIS_exterior')&&!materials.every(m=>m.transparent);o.receiveShadow=true;
    // Keep GLTFLoader color/data semantics. Never reassign imported map colorSpace.
    for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)m.side=2;
   }
  });
  for(const id of config.requiredFacilities||[])if(!Object.hasOwn(FACILITIES,id)||targets.filter(t=>t.id===id).length!==1)throw Error('小屋设施标记不完整');
  if(!markers.SPAWN_home||colliders.length<4)throw Error('小屋碰撞或出生点缺失');
  const spawn={x:markers.SPAWN_home.x,y:markers.SPAWN_home.y,z:markers.SPAWN_home.z};
  const bounds=config.bounds;if(!bounds||!Object.values(bounds).every(Number.isFinite))throw Error('无效的小屋边界');
  return {kind:'home',stage:config.stage,root,geometry:new Float32Array(0),colliders,targets,nodes:[],links:[],labels:targets.map(t=>({text:t.title,position:[t.position.x,t.position.y+.55,t.position.z],height:.30,target:t})),height:()=>0,bounds,boundary:8,spawn,camera:config.camera,dispose:()=>disposeTree(root),assetBytes:data.byteLength};
 }catch(e){disposeTree(root);throw e}
}
