import{chromium}from'/Users/gauss/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
import{writeFile}from'node:fs/promises';
const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1100,height:1000},deviceScaleFactor:1});const errors=[];const checks=[];
const snapshot=()=>page.evaluate(()=>{const nodes=[];window.__liukanshanReview?.traverse(obj=>{if(obj.name.endsWith('_joint')||obj.name==='liukanshan_root'||obj.name==='mascot_laptop')nodes.push([obj.name,obj.position.toArray(),obj.quaternion.toArray(),obj.scale.toArray(),obj.visible])});return nodes});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+JSON.stringify(m.location()))});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
try{await page.goto('http://127.0.0.1:4173/assets/source/liukanshan/preview.html',{waitUntil:'networkidle'});await page.waitForTimeout(1800);
for(const state of ['idle','greeting','searching','reading','collected']){await page.locator(`[data-state="${state}"]`).click();await page.waitForTimeout(state==='collected'?500:900);await page.screenshot({path:`assets/source/liukanshan/renders/web-${state}.png`})}
await page.locator('[data-motion]').click();
for(const state of ['idle','greeting','searching','reading','collected']){await page.locator(`[data-state="${state}"]`).click();await page.waitForTimeout(250);const a=await snapshot();await page.waitForTimeout(350);const b=await snapshot();if(a.length<12||JSON.stringify(a)!==JSON.stringify(b))throw Error('Static pose moved: '+state);checks.push({state,animated:false,joints:a.length,unchanged:true})}
await page.screenshot({path:'assets/source/liukanshan/renders/web-static.png'});
console.log(JSON.stringify({errors,checks}));await writeFile('assets/source/liukanshan/runtime-report.json',JSON.stringify({errors,checks,states:['idle','greeting','searching','reading','collected'],localModel:'/models/liukanshan/liukanshan.glb'},null,2));
}finally{await browser.close()}
