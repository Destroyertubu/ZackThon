// Opt-in local QA only. No account, content, API or persistence operations are exposed.
export function installRenderQA(getEngine){
 if(!['127.0.0.1','localhost'].includes(location.hostname)||new URLSearchParams(location.search).get('qa')!=='1')return;
 window.wanderwiseRenderQA=Object.freeze({
  setView({position,yaw=0,pitch=.22,distance=3.8}){
   const e=getEngine();if(!e||e.status!=='ready')throw Error('Scene not ready');e.pause();
   if(position){const b=e.scene.bounds;if(b&&(position.x<b.minX||position.x>b.maxX||position.z<b.minZ||position.z>b.maxZ))throw Error('QA viewpoint outside room');e.player={...e.player,...position};}
   e.renderer.setCutaway(false);e.photoCamera=null;e.renderer.camera.fov=e.scene?.camera?.fov||65;e.renderer.camera.updateProjectionMatrix();e.camera={yaw,pitch,distance};const p=e.player;e.eye=[p.x+Math.sin(yaw)*Math.cos(pitch)*distance,p.y+1.18+Math.sin(pitch)*distance,p.z+Math.cos(yaw)*Math.cos(pitch)*distance];
  },
  photograph({position,target,fov=58,cutaway=false}){const e=getEngine();if(e?.status!=='ready')throw Error('Scene not ready');if(![...position,...target,fov].every(Number.isFinite))throw Error('Invalid camera');e.pause();e.renderer.setCutaway(cutaway===true);e.photoCamera={position,target};e.renderer.camera.fov=fov;e.renderer.camera.updateProjectionMatrix()},
  inspect(){const e=getEngine();if(!e)return null;const meshes=[];e.scene?.root?.traverse(o=>{if(o.isMesh)meshes.push({name:o.name,visible:o.visible,castShadow:o.castShadow,receiveShadow:o.receiveShadow,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,materials:(Array.isArray(o.material)?o.material:[o.material]).map(m=>({name:m.name,roughness:m.roughness,metalness:m.metalness,map:!!m.map,mapColorSpace:m.map?.colorSpace,normalMapColorSpace:m.normalMap?.colorSpace}))})});return {meshes,resources:{...e.renderer.metrics},colliders:e.scene?.colliders,bounds:e.scene?.bounds,shadowEnabled:e.renderer.webgl?.shadowMap.enabled,lights:e.renderer.scene?.children.filter(o=>o.isLight).map(o=>({type:o.type,castShadow:o.castShadow,visible:o.visible})),frameTimes:e.metricsAccumulator?.slice(),frameTrace:e.frameTrace?.slice(),canvasCount:document.querySelectorAll('canvas').length,hasFocus:document.hasFocus(),controlMode:e.controlMode,visibility:document.visibilityState}},
 });
}
