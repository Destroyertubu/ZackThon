// Narrow optimization: no flatten/prune/simplify that could erase semantic nodes.
import {spawnSync} from 'node:child_process';import fs from 'node:fs';import crypto from 'node:crypto';
const stage=process.argv[2]||'full',file=`frontend/assets/home/home-realistic-${stage}.glb`,out='docs/realistic-home/evidence';
for(const [command,args] of [['inspect',[]],['dedup',[]],['weld',[]],['tangents',[]],['jpeg',['--formats','*','--quality','90']],['validate',[]]]){
 const readOnly=['inspect','validate'].includes(command);const result=spawnSync('node_modules/.bin/gltf-transform',[command,file,...(readOnly?[]:[file]),...args],{encoding:'utf8'});fs.writeFileSync(`${out}/${stage}-${command}.txt`,result.stdout+result.stderr);if(result.status!==0)throw Error(command+' failed: '+result.stderr);
}
const build=`frontend/assets/home/home-realistic-${stage}.build.json`,j=JSON.parse(fs.readFileSync(build));j.optimizedBytes=fs.statSync(file).size;j.optimizedSHA256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');j.optimization='glTF Transform 4.5.0 inspect -> dedup -> weld -> MikkTSpace tangents -> JPEG90 -> validate. No hierarchy flatten/prune/mesh simplification.';fs.writeFileSync(build,JSON.stringify(j,null,2));console.log(stage,j.optimizedBytes,j.optimizedSHA256);
