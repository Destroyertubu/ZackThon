import fs from 'node:fs';import {fileURLToPath} from 'node:url';import path from 'node:path';
const ROOT=path.resolve(fileURLToPath(new URL('..',import.meta.url))),OUT=path.join(ROOT,'reports','native');fs.mkdirSync(OUT,{recursive:true});
import {buildScene,playerGeometry} from '../frontend/engine/scenes.js';
import {lookAt,perspective,multiply,segmentBox,mix} from '../frontend/engine/math.js';
const world=JSON.parse(fs.readFileSync(path.join(ROOT,'contracts','demo-world.example.json'),'utf8'));
for(const kind of ['home','world']){
 const scene=buildScene(kind,kind==='world'?world:null);let p={...scene.spawn,yaw:0};let character=playerGeometry(p,0,false).data();let merged=new Float32Array(scene.geometry.length+character.length);merged.set(scene.geometry);merged.set(character,scene.geometry.length);fs.writeFileSync(path.join(OUT,kind+'.bin'),Buffer.from(merged.buffer));
 let target=[p.x,p.y+1.18,p.z],eye=[p.x,p.y+2.7,p.z+5.2];let fraction=1;for(let b of scene.colliders){let t=segmentBox(target,eye,b,.16);if(t!==null)fraction=Math.min(fraction,Math.max(.1,t-.045))}eye=target.map((v,i)=>mix(v,eye[i],fraction));let vp=multiply(perspective(65*Math.PI/180,1440/1000,.08,650),lookAt(eye,target));
 fs.writeFileSync(path.join(OUT,kind+'.json'),JSON.stringify({eye,vp:[...vp],fog:kind==='home'?[.33,.31,.24]:[.49,.66,.59],fogDistance:kind==='home'?85:130,vertices:merged.length/9,labels:scene.labels}));
 console.log(kind,scene.geometry.length/27,'triangles',scene.colliders.length,'colliders');
}
