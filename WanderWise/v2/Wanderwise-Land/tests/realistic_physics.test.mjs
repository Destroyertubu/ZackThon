import test from 'node:test';import assert from 'node:assert/strict';
import {createHomePhysics} from '../frontend/engine/home-physics.js';
const floor={min:[-6,-.2,-5],max:[6,0,5],player:true,camera:true,interaction:false};
const wall={min:[1,0,-3],max:[1.2,4,3],player:true,camera:true,interaction:true};
test('Rapier capsule applies swept corrected motion, slides, lands, and jumps',async()=>{
 const physics=await createHomePhysics([floor,wall],new AbortController().signal);try{
 const p={x:0,y:.02,z:0};for(let i=0;i<30;i++)physics.move(p,{x:.12,y:-.03,z:.04});assert.ok(p.x<.73,p.x);assert.ok(p.z>1,p.z);assert.ok(p.y>=-.002,p.y);
 const y=p.y;physics.move(p,{x:0,y:.25,z:0});assert.ok(p.y>y+.2);for(let i=0;i<30;i++)physics.move(p,{x:0,y:-.1,z:0});assert.ok(p.y>=-.002);assert.ok(p.y<.03);
 }finally{physics.dispose();physics.dispose()}
});
test('camera sphere protects near-plane volume independently of character layers',async()=>{
 const physics=await createHomePhysics([floor,wall,{min:[-.1,.3,2],max:[.1,3,2.1],player:true,camera:false}],new AbortController().signal);try{
 const eye=physics.camera([0,1.2,0],[3,1.2,0]);assert.ok(eye[0]<.84&&eye[0]>.7,eye);assert.deepEqual(physics.camera([0,1.2,0],[0,1.2,3]),[0,1.2,3]);
 }finally{physics.dispose()}
});
test('cancelled home setup does not create a live physics world',async()=>{const c=new AbortController();c.abort();await assert.rejects(createHomePhysics([floor],c.signal),{name:'AbortError'})});
