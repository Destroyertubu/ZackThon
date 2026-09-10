import {spawnSync} from 'node:child_process';import fs from 'node:fs';import crypto from 'node:crypto';
const stage=process.argv[2]||'corner';if(!['corner','full','materials'].includes(stage))throw Error('Unsupported stage');
const file=`frontend/assets/home/production/${stage}.glb`,out=`reports/${stage}-gltf`;fs.mkdirSync(out,{recursive:true});fs.copyFileSync(file,`assets-source/room-production/${stage}-uncompressed.glb`);
for(const [command,args] of [['inspect',[]],['dedup',[]],['weld',[]],['tangents',[]],['jpeg',['--formats','*','--quality','87']],...stage==='full'?[['meshopt',['--level','medium','--quantize-position','16','--quantize-texcoord','16']]]:[],['validate',[]]]){const ro=['inspect','validate'].includes(command),r=spawnSync('node_modules/.bin/gltf-transform',[command,file,...ro?[]:[file],...args],{encoding:'utf8'});fs.writeFileSync(`${out}/${command}.txt`,r.stdout+r.stderr);if(r.status)throw Error(`${command}: ${r.stderr}`)}
fs.writeFileSync(`${out}/manifest.json`,JSON.stringify({file,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),pipeline:'inspect; dedup; weld; tangents; JPEG87; full only Meshopt-medium 16bit position/UV with same-origin decoder; validate. No hierarchy flattening or scene simplification.'},null,2));console.log(fs.statSync(file).size);
if(stage==='full'){
 const config=JSON.parse(fs.readFileSync('frontend/assets/home/production/full.json','utf8'));
 config.lightRig=JSON.parse(fs.readFileSync('design/home/light_rig.json','utf8'));
 for(const path of ['frontend/assets/home/production/full.json','frontend/assets/home/scene.json'])fs.writeFileSync(path,JSON.stringify(config,null,2));
}
