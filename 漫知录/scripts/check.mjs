import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
function files(path){return readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(path,e.name)):e.name.endsWith('.js')||e.name.endsWith('.mjs')?[join(path,e.name)]:[]);}
let ok=true;for(const file of [...files('web/js'),...files('scripts')]){const p=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(p.status)ok=false;}
if(!ok)process.exit(1);console.log('All JavaScript modules parsed successfully.');
