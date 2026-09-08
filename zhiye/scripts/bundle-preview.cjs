/** Test-only bundler using TypeScript installed in the build environment.
 * Production uses browser ESM directly; this is NOT needed to start the app.
 */
const fs=require('node:fs'),path=require('node:path');
let ts;try{ts=require('typescript');}catch{console.error('Preview bundling requires TypeScript. Run npm install first.');process.exit(1);}
const root=path.resolve(__dirname,'../web/js');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]).filter(f=>f.endsWith('.js'));}
let out='(()=>{const modules={},cache={};';
for(const file of files(root)){
 let src=fs.readFileSync(file,'utf8');
 if(file.endsWith('/app.js'))src=src.replace(/\[['"]localhost['"],\s*['"]127\.0\.0\.1['"]\]\.includes\(location\.hostname\)\s*&&\s*new URLSearchParams\(location\.search\)\.has\(['"]debug['"]\)/,'window.__ZHIYE_TEST__');
 const result=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 out+=`modules[${JSON.stringify(path.relative(root,file).replaceAll('\\','/'))}]=function(require,module,exports){${result.outputText}\n};\n`;
}
out+=`function resolve(id,parent){if(!id.startsWith('.'))return id;const p=parent.split('/');p.pop();for(const s of id.split('/')){if(s==='..')p.pop();else if(s!=='.')p.push(s);}return p.join('/');}function require(id){if(cache[id])return cache[id].exports;if(!modules[id])throw Error('Preview module absent: '+id);const m={exports:{}};cache[id]=m;modules[id](s=>require(resolve(s,id)),m,m.exports);return m.exports;}require('app.js');})();`;
fs.writeFileSync(path.resolve(__dirname,'../previews/test-bundle.js'),out);
