// Home-only physics bridge. Simulation owns player state; Rapier returns corrected motion.
// The module/WASM is shared, each scene owns and frees its World and controller.
import RAPIER from '../vendor/rapier/rapier.mjs';
let initialized;
const vec=a=>({x:a[0],y:a[1],z:a[2]});
export async function createHomePhysics(colliders,signal){
 initialized??=RAPIER.init().catch(e=>{initialized=null;throw e});await initialized;
 if(signal.aborted)throw new DOMException('Scene cancelled','AbortError');
 const world=new RAPIER.World({x:0,y:0,z:0}),layers=new Map();
 for(const box of colliders){
  const size=box.max.map((v,i)=>(v-box.min[i])/2),center=box.min.map((v,i)=>(v+box.max[i])/2);
  const c=world.createCollider(RAPIER.ColliderDesc.cuboid(...size).setTranslation(...center));layers.set(c.handle,box);
 }
 const character=world.createCollider(RAPIER.ColliderDesc.capsule(.47,.28).setTranslation(0,.76,.65));
 const controller=world.createCharacterController(.012);controller.setSlideEnabled(true);controller.enableSnapToGround(.12);controller.enableAutostep(.12,.25,false);
 world.step();let disposed=false;
 return {
  name:'Rapier 0.19.3 capsule',
  move(player,delta){
   character.setTranslation({x:player.x,y:player.y+.75,z:player.z});world.step();
   controller.computeColliderMovement(character,delta,undefined,undefined,c=>layers.get(c.handle)?.player!==false&&c.handle!==character.handle);
   const corrected=controller.computedMovement();player.x+=corrected.x;player.y+=corrected.y;player.z+=corrected.z;
   character.setTranslation({x:player.x,y:player.y+.75,z:player.z});
   return {grounded:controller.computedGrounded(),corrected};
  },
  camera(target,desired){
   const velocity=desired.map((v,i)=>v-target[i]),length=Math.hypot(...velocity);if(length<.0001)return desired;
   // A 17 cm sphere encloses this camera's near plane; reclipped after smoothing.
   const hit=world.castShape(vec(target),{x:0,y:0,z:0,w:1},vec(velocity),new RAPIER.Ball(.17),.01,1,true,undefined,undefined,character,undefined,c=>layers.get(c.handle)?.camera!==false);
   const fraction=hit?Math.max(0,hit.time_of_impact-.015/length):1;
   return target.map((v,i)=>v+velocity[i]*fraction);
  },
  dispose(){if(disposed)return;disposed=true;world.removeCharacterController(controller);world.free();layers.clear()},
 };
}
