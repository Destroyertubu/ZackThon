import {fileURLToPath} from 'node:url';import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
let scripts=walk(path.join(root,'frontend')).filter(f=>f.endsWith('.js'));
for(let script of scripts){let r=spawnSync(process.execPath,['--check',script],{stdio:'inherit'});if(r.status)process.exit(r.status)}
console.log(`${scripts.length} ES modules passed syntax checks. Frontend is already the distributable; no npm dependencies and no generated bundle.`);
