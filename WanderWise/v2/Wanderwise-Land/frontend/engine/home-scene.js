import {Box3,Vector3,Matrix4,InstancedMesh,LoadingManager,TextureLoader} from '../vendor/three/three.module.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
import {MeshoptDecoder} from '../vendor/meshoptimizer/meshopt_decoder.mjs';
import {createHomePhysics} from './home-physics.js';
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
 const preview=new URLSearchParams(location.search).get('room');
 const localPreview=['127.0.0.1','localhost'].includes(location.hostname)&&['graybox','corner','calibration','materials','full'].includes(preview);
 const legacy=['127.0.0.1','localhost'].includes(location.hostname)&&preview==='legacy';
 const configResponse=await fetch(legacy?'/static/assets/home/scene.previous.json':localPreview?`/static/assets/home/production/${preview}.json`:'/static/assets/home/scene.json',{signal});if(!configResponse.ok)throw Error('小屋场景配置加载失败');const config=await configResponse.json();
 if(config.schemaVersion!==1||!(/^\/static\/assets\/home\/home-(?:realistic-)?(corner|full)\.glb$/.test(config.model)||(localPreview||config.model==='/static/assets/home/production/full.glb')&&/^\/static\/assets\/home\/production\/(graybox|corner|calibration|materials|full)\.glb$/.test(config.model)))throw Error('不支持的小屋配置');
 const r=await fetch(config.model,{signal});if(!r.ok)throw Error('小屋模型加载失败，请重试');
 const data=await r.arrayBuffer();if(data.byteLength>12*1024*1024)throw Error('小屋模型超过大小限制');
 const manager=new LoadingManager();let textureError=false;manager.onError=()=>{textureError=true};
 manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const parsed=new URL(url,location.href);if(parsed.origin!==location.origin)throw Error('小屋仅允许同源资源');return url});
 // Embedded image elements obey the existing img-src blob: policy. ImageBitmapLoader
 // would fetch blob: under connect-src, so choose TextureLoader per loader, never globally.
 const loader=new GLTFLoader(manager);loader.setMeshoptDecoder(MeshoptDecoder);loader.register(parser=>{parser.textureLoader=new TextureLoader(manager);return {name:'WW_ImageElementCSP'}});
 const gltf=await abortable(loader.parseAsync(data,location.origin+'/static/assets/home/'),signal,g=>disposeTree(g.scene));
 const root=gltf.scene;let physics;
 try{
  if(textureError)throw Error('家具贴图加载失败，请重试');
  root.updateMatrixWorld(true);const colliders=[],targets=[],markers={};
  root.traverse(o=>{
   if(o.name.startsWith('COL_')){
    const b=new Box3().setFromObject(o);if(!b.isEmpty())colliders.push({id:o.name,min:b.min.toArray(),max:b.max.toArray(),player:o.userData.player!==false,camera:o.userData.camera!==false,interaction:o.userData.interaction!==false});// The circular table must not inherit the corners of its AABB. A union of
    // 16 metre-scale strips follows the authored round proxy for all three rules.
    if(o.name==='COL_F10_round'&&!b.isEmpty()){
     const base=colliders.pop(),cx=(base.min[0]+base.max[0])/2,cz=(base.min[2]+base.max[2])/2,r=(base.max[0]-base.min[0])/2;
     for(let i=0;i<16;i++){const z0=-r+2*r*i/16,z1=-r+2*r*(i+1)/16,w=Math.sqrt(Math.max(0,r*r-Math.max(z0*z0,z1*z1)));if(w>.001)colliders.push({...base,id:base.id+'_'+i,min:[cx-w,base.min[1],cz+z0],max:[cx+w,base.max[1],cz+z1]})}
    }
    o.visible=false;
   }else if(o.name.startsWith('SPAWN_'))markers[o.name]=o.getWorldPosition(new Vector3());
   else if(o.name.startsWith('INTERACT_')){
    const id=o.name.slice(9),definition=Object.hasOwn(FACILITIES,id)?FACILITIES[id]:null;
    if(definition){const p=o.getWorldPosition(new Vector3());targets.push({id,type:'facility',...definition,position:{x:p.x,y:p.y,z:p.z}})}
   }else if(o.isMesh){const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=!/^VIS_(exterior|E0[1235]|V07)/.test(o.name)&&!o.name.startsWith('VIS_drapery')&&!materials.every(m=>m.transparent);o.receiveShadow=!o.name.startsWith('VIS_drapery');
    // Keep GLTFLoader color/data semantics. Never reassign imported map colorSpace.
    for(const m of materials)if(m){if(m.name==='M17'){m.transmission=0;m.metalness=.15;m.needsUpdate=true}if(m.name==='M16'){m.opacity=.045;m.depthWrite=false;m.side=0;}if(o.name.includes('plants')||o.name.includes('window')||o.name.includes('drapery'))m.side=2;for(const value of Object.values(m))if(value?.isTexture)value.anisotropy=4;}
   }
  });
  // Only repeated decorative pots and wall lamps are instanced. Facility roots,
  // authored sockets and collision nodes keep their identities and transforms.
  const repeats=new Map();root.traverse(o=>{if(!o.isMesh||!o.visible||o.name.startsWith('COL_'))return;let p=o.parent,asset;while(p){if(p.userData.assetId){asset=p.userData.assetId;break}p=p.parent}if(!(asset==='V06'||asset?.startsWith('L03')))return;const key=o.geometry.uuid+':'+(Array.isArray(o.material)?o.material.map(m=>m.uuid).join(','):o.material.uuid);if(!repeats.has(key))repeats.set(key,[]);repeats.get(key).push(o)});
  const inverse=new Matrix4().copy(root.matrixWorld).invert();
  for(const sources of repeats.values())if(sources.length>1){const first=sources[0],batch=new InstancedMesh(first.geometry,first.material,sources.length);batch.name='VIS_decor_instances';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;sources.forEach((o,i)=>{batch.setMatrixAt(i,new Matrix4().multiplyMatrices(inverse,o.matrixWorld));o.visible=false});batch.computeBoundingSphere();root.add(batch)}
  for(const id of config.requiredFacilities||[])if(!Object.hasOwn(FACILITIES,id)||targets.filter(t=>t.id===id).length!==1)throw Error('小屋设施标记不完整');
  if(!markers.SPAWN_home||colliders.length<4)throw Error('小屋碰撞或出生点缺失');
  const spawn={x:markers.SPAWN_home.x,y:markers.SPAWN_home.y,z:markers.SPAWN_home.z};
  const bounds=config.bounds;if(!bounds||!Object.values(bounds).every(Number.isFinite))throw Error('无效的小屋边界');
  if(config.stage==='production-full'){
   for(const [id,min,max] of [['north',[-3.3,0,-7.05],[3.3,4.8,-6.98]],['west',[-3.27,0,-7],[-3.20,4.8,-5]],['east',[3.20,0,-7],[3.27,4.8,-5]]])colliders.push({id:'COL_A14_safety_'+id,min,max,player:true,camera:false,interaction:false});
  }
  physics=await createHomePhysics(colliders,signal);
  return {physics,kind:'home',stage:config.stage,lightRig:config.stage?.startsWith('production-')?config.lightRig:null,root,geometry:new Float32Array(0),colliders,targets,nodes:[],links:[],labels:targets.map(t=>({text:t.title,position:[t.position.x,t.position.y+.55,t.position.z],height:.30,target:t})),height:()=>0,bounds,boundary:8,spawn,camera:config.camera,dispose:()=>{physics?.dispose();disposeTree(root)},assetBytes:data.byteLength};
 }catch(e){physics?.dispose();disposeTree(root);throw e}
}
