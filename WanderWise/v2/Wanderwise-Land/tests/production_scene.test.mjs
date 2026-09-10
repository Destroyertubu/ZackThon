import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Matrix4,Vector3,Quaternion,Box3} from '../frontend/vendor/three/three.module.js';
import {createHomePhysics} from '../frontend/engine/home-physics.js';
const config=JSON.parse(fs.readFileSync(new URL('../frontend/assets/home/scene.json',import.meta.url)));
const bytes=fs.readFileSync(new URL('../frontend/'+config.model.replace('/static/',''),import.meta.url));
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),nodes=[];
function walk(i,parent=new Matrix4()){
 const n=gltf.nodes[i],m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...n.translation||[0,0,0]),new Quaternion(...n.rotation||[0,0,0,1]),new Vector3(...n.scale||[1,1,1]));m.premultiply(parent);
 const box=new Box3();for(const p of gltf.meshes?.[n.mesh]?.primitives||[]){const a=gltf.accessors[p.attributes.POSITION],scale=a.normalized?({5120:127,5121:255,5122:32767,5123:65535}[a.componentType]||1):1;box.union(new Box3(new Vector3(...a.min.map(v=>v/scale)),new Vector3(...a.max.map(v=>v/scale))).applyMatrix4(m))}
 nodes.push({...n,position:new Vector3().setFromMatrixPosition(m),bounds:box});for(const child of n.children||[])walk(child,m);
}
for(const root of gltf.scenes[gltf.scene||0].nodes)walk(root);
const colliders=nodes.filter(n=>n.name?.startsWith('COL_')).map(n=>({id:n.name,min:n.bounds.min.toArray(),max:n.bounds.max.toArray(),...n.extras}));
test('production artifact retains exact business markers and self-contained resources',()=>{
 assert.equal(config.stage,'production-full');assert.equal(bytes.readUInt32LE(8),bytes.length);assert.ok(bytes.length<12*1024*1024);
 for(const id of ['door','cabinet','synthesis','journal','phone'])assert.equal(nodes.filter(n=>n.name==='INTERACT_'+id).length,1);
 assert.equal(nodes.filter(n=>n.name==='SPAWN_home').length,1);
 for(const image of gltf.images){assert.equal(image.uri,undefined);assert.equal(typeof image.bufferView,'number')}
 assert.ok(gltf.extensionsUsed.includes('EXT_meshopt_compression'));assert.ok(fs.existsSync(new URL('../frontend/vendor/meshoptimizer/meshopt_decoder.mjs',import.meta.url)));
});
test('exported east and west collision proxies match wall orientation and block interaction',()=>{
 for(const i of [2,6]){const wall=colliders.find(c=>c.id==='COL_A03.06_perimeter_'+i);assert.ok(wall);assert.ok(wall.max[2]-wall.min[2]>8.5);assert.ok(wall.max[0]-wall.min[0]<.25);assert.equal(wall.interaction,true);assert.equal(wall.camera,true)}
});
test('real production collider geometry stops swept capsule and camera at east wall',async()=>{
 const physics=await createHomePhysics(colliders,new AbortController().signal);
 try{const player={x:5,y:.02,z:2};for(let i=0;i<90;i++)physics.move(player,{x:.15,y:-.03,z:0});assert.ok(player.x<5.61,JSON.stringify(player));assert.ok(player.x>5.3);const eye=physics.camera([5.3,1.18,2],[9,1.18,2]);assert.ok(eye[0]<5.73&&eye[0]>5.4,eye)}finally{physics.dispose()}
});
test('opaque architecture is separate from floor and glass interaction filtering',()=>{
 assert.ok(colliders.filter(c=>c.id.startsWith('COL_A03')).every(c=>c.interaction!==false));
 const glasses=colliders.filter(c=>c.id.includes('glass'));assert.ok(glasses.length>=2);for(const c of glasses){assert.equal(c.camera,false);assert.equal(c.interaction,false)}
});
