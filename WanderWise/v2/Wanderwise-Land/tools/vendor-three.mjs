// Development only. Runtime startup consumes the committed same-origin files.
import fs from 'node:fs/promises';
const pkg=JSON.parse(await fs.readFile('node_modules/three/package.json','utf8'));
if(pkg.version!=='0.186.0')throw Error('Expected pinned Three.js 0.186.0');
const dest='frontend/vendor/three';await fs.mkdir(dest,{recursive:true});
for(const name of ['three.module.js','three.core.js'])await fs.copyFile('node_modules/three/build/'+name,dest+'/'+name);
for(const [src,name] of [['loaders/GLTFLoader.js','GLTFLoader.js'],['utils/BufferGeometryUtils.js','BufferGeometryUtils.js'],['utils/SkeletonUtils.js','SkeletonUtils.js']]){
 let text=await fs.readFile('node_modules/three/examples/jsm/'+src,'utf8');
 text=text.replaceAll("from 'three'","from './three.module.js'").replaceAll("from '../utils/BufferGeometryUtils.js'","from './BufferGeometryUtils.js'").replaceAll("from '../utils/SkeletonUtils.js'","from './SkeletonUtils.js'");
 await fs.writeFile(dest+'/'+name,text);
}
await fs.copyFile('node_modules/three/LICENSE',dest+'/LICENSE');
console.log('Vendored Three.js '+pkg.version+'; imports are same-origin relative URLs.');
