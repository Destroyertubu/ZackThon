import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTarget} from '../frontend/engine/interaction.js';
const target=(id,type,x,z)=>({id,type,position:{x,y:1.7,z}});
function scene(targets,obstructed=()=>false){return {player:{x:0,y:0,z:0},eye:[0,2,-3],targets,obstructed,renderer:{vp:null}}}
test('nearby quote is readable outside the camera and without label LOD',()=>{const quote=target('quote','excerpt',0,2);assert.equal(selectTarget(scene([quote])),quote)});
test('nearby quote wins over topic, closest quote wins deterministically',()=>{const near=target('near','excerpt',0,1),far=target('far','excerpt',0,2),node=target('node','node',0,0);assert.equal(selectTarget(scene([far,node,near])),near)});
test('walls and range still prevent reading or facility activation',()=>{assert.equal(selectTarget(scene([target('q','excerpt',0,5)])),null);assert.equal(selectTarget(scene([target('q','excerpt',0,2)],()=>true)),null);assert.equal(selectTarget(scene([target('door','facility',0,3.1)])),null)});
