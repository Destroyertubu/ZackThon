import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Matrix4,Vector3,Quaternion,Box3} from '../frontend/vendor/three/three.module.js';
import {Engine} from '../frontend/engine/engine.js';
import {FACILITIES} from '../frontend/engine/home-scene.js';
const base=new URL('../frontend/assets/home/',import.meta.url);
const activeConfig=JSON.parse(fs.readFileSync(new URL('scene.previous.json',base)));
const bytes=fs.readFileSync(new URL(activeConfig.model.split('/').pop(),base));
const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const nodes=[],config=JSON.parse(fs.readFileSync(new URL('scene.previous.json',base)));
function walk(index,parent=new Matrix4()){
 const n=gltf.nodes[index],matrix=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));
 matrix.premultiply(parent);const bounds=new Box3();
 for(const p of gltf.meshes?.[n.mesh]?.primitives||[]){const a=gltf.accessors[p.attributes.POSITION];bounds.union(new Box3(new Vector3(...a.min),new Vector3(...a.max)).applyMatrix4(matrix))}
 nodes.push({...n,worldPosition:new Vector3().setFromMatrixPosition(matrix),bounds});
 for(const i of n.children||[])walk(i,matrix);
}
for(const n of gltf.scenes[gltf.scene||0].nodes)walk(n);
const colliders=nodes.filter(n=>n.name?.startsWith('COL_')).map(n=>({id:n.name,min:n.bounds.min.toArray(),max:n.bounds.max.toArray(),...n.extras}));
const scene={colliders,bounds:config.bounds,boundary:8};
const spawn=nodes.find(n=>n.name==='SPAWN_home').worldPosition;
const pass=(x,z)=>{const b=scene.bounds,r=.28;if(x-r<b.minX||x+r>b.maxX||z-r<b.minZ||z+r>b.maxZ)return false;return !colliders.some(b=>b.player!==false&&x+r>b.min[0]&&x-r<b.max[0]&&z+r>b.min[2]&&z-r<b.max[2]&&1.5>b.min[1]&&0<b.max[1])};
test('rollback fixture: GLB 2 container, embedded images and finite accessor bounds',()=>{
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
 for(const a of gltf.accessors)for(const v of [...(a.min||[]),...(a.max||[])])assert.ok(Number.isFinite(v));
 assert.ok(gltf.images.length>0);for(const image of gltf.images){assert.ok(['image/png','image/jpeg'].includes(image.mimeType));assert.equal(typeof image.bufferView,'number');assert.equal(image.uri,undefined)}
 for(const v of gltf.bufferViews)assert.ok((v.byteOffset||0)+v.byteLength<=gltf.buffers[v.buffer].byteLength);
});
test('rollback fixture: actual GLB retains whitelist facilities, safe spawn and Y-up metre scale',()=>{
 assert.deepEqual(Object.keys(FACILITIES).sort(),['cabinet','door','journal','phone','synthesis']);
 for(const id of config.requiredFacilities)assert.equal(nodes.filter(n=>n.name==='INTERACT_'+id).length,1);
 assert.equal(nodes.filter(n=>n.name==='SPAWN_home').length,1);assert.ok(pass(spawn.x,spawn.z));assert.ok(Math.abs(spawn.y)<1e-5);
 assert.ok(nodes.some(n=>n.name==='SPAWN_safe'));assert.ok(nodes.some(n=>n.name==='VIS_door_leaf'));
 assert.deepEqual(Object.values(FACILITIES).map(x=>x.action).sort(),['bag','journal','phone','seed','synthesis']);
});
test('rollback fixture: all facility approaches share a traversable space; door is under ten seconds away',()=>{
 const step=.20,key=(x,z)=>x+','+z,start=[Math.round(spawn.x/step),Math.round(spawn.z/step)],queue=[start],seen=new Map([[key(...start),0]]);
 for(let i=0;i<queue.length;i++){const [x,z]=queue[i],d=seen.get(key(x,z));for(const [dx,dz] of [[0,1],[1,0],[-1,0],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(!seen.has(k)&&pass(nx*step,nz*step)){seen.set(k,d+step);queue.push([nx,nz])}}}
 for(const [x,z] of [[-.76,-1.5],[-2.35,.95],[1.05,-1.55],[3.2,2.2],[-3.2,-2.5]])assert.ok(seen.has(key(Math.round(x/step),Math.round(z/step))),`unreachable ${x},${z}`);
 assert.ok(seen.get(key(-16,-12))/4.5<10);
});
test('rollback fixture: room bounds replace old hardcoded boundary without clipping a legitimate route',()=>{
 const e={player:{x:2,y:0,z:4.45},kind:'home',scene};Engine.prototype.move.call(e,0,.2);assert.equal(e.player.z,4.45);Engine.prototype.move.call(e,0,-.3);assert.ok(e.player.z<4.45);
});
test('rollback fixture: collision layers distinguish glass, frame, door leaf and camera ceiling',()=>{
 const glass=colliders.filter(b=>b.id.startsWith('COL_phone_glass'));assert.equal(glass.length,2);for(const b of glass){assert.equal(b.player,true);assert.equal(b.camera,false);assert.equal(b.interaction,false)}
 assert.ok(colliders.some(b=>b.id==='COL_door_leaf'));assert.ok(!colliders.some(b=>b.id==='COL_north'&&b.min[0]<-3.2&&b.max[0]>-3.2));
 const ceiling=colliders.find(b=>b.id==='COL_ceiling');assert.equal(ceiling.player,true);assert.equal(ceiling.camera,true);
});
test('rollback fixture: visible geometry and startup artifact have bounded size',()=>{
 let triangles=0;
 for(const n of nodes.filter(n=>n.name?.startsWith('VIS_')))for(const p of gltf.meshes[n.mesh]?.primitives||[])triangles+=gltf.accessors[p.indices??p.attributes.POSITION].count/3;
 assert.ok(triangles<200000,triangles);assert.ok(bytes.length<12*1024*1024);
});
