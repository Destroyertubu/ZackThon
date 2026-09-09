import {readFile, writeFile, unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';

const [base, mode = 'smoke', stateFile = '/private/tmp/wanderwise-netlify-persistence.json'] = process.argv.slice(2);
assert(base && new URL(base).protocol === 'https:', 'An HTTPS site URL is required');
let cookie='',csrf='';const checks=[];
async function call(path,method='GET',body,extra={}) {
  const res=await fetch(base+'/api/v1'+path,{method,headers:{Origin:base,'Content-Type':'application/json','X-Client-Id':'cloud-verifier-123',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000),redirect:'error'});
  const payload=await res.json();
  if(res.headers.has('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];
  if(payload.data?.csrfToken)csrf=payload.data.csrfToken;
  return {status:res.status,headers:res.headers,...payload};
}
async function ok(path,method='GET',body,extra={}){const r=await call(path,method,body,extra);assert(r.status>=200&&r.status<300,`${method} ${path}: ${r.status} ${r.error?.code||''}`);return r;}
async function task(path,body){const r=await ok(path,'POST',body,{'Idempotency-Key':randomUUID()});assert.equal(r.data.status,'succeeded',`${path}: ${r.data.error?.code||r.data.status}`);return r.data.result;}
async function report(){const out={status:'passed',siteUrl:base,checkedAt:new Date().toISOString(),checks};await writeFile('docs/evidence/netlify-'+mode+'.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));}

if(mode==='verify-persistence'){
  const saved=JSON.parse(await readFile(stateFile,'utf8'));assert.equal(saved.siteUrl,base);cookie=saved.cookie;csrf=saved.csrf;
  const bag=(await ok('/bag')).data.items;assert(bag.some(x=>x.id===saved.bagId&&x.text===saved.text),'saved collection changed or disappeared');
  assert.equal((await ok('/journeys/'+saved.journeyId)).data.worldId,saved.worldId);
  checks.push('same visitor and same collection survive a new production deployment');
  await ok('/me/data','DELETE',{confirm:'DELETE_MY_DATA'});await unlink(stateFile);checks.push('test visitor removed');await report();
}else{
  for(const path of ['/','/home','/static/app.js','/static/engine/renderer.js']){const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200,path);checks.push('HTTPS '+path);}
  for(const path of ['/health/live','/health/ready']){assert.equal((await ok(path)).data.status,'ok');checks.push(path);}
  assert.equal((await call('/session/guest','POST',{}, {Origin:'https://untrusted.example'})).status,403);checks.push('cross-origin write rejected');
  const guest=await ok('/session/guest','POST',{});const c=guest.headers.get('set-cookie');assert.match(c,/HttpOnly/i);assert.match(c,/Secure/i);assert.match(c,/SameSite=Strict/i);checks.push('secure private guest cookie');
  assert.equal((await call('/worlds','POST',{seedMode:'demo'},{'X-CSRF-Token':'wrong','Idempotency-Key':randomUUID()})).status,403);checks.push('invalid CSRF rejected');
  const created=await task('/worlds',{seedMode:'demo',presetId:'demo-growth'}),world=(await ok('/worlds/'+created.worldId)).data;
  assert.equal(world.dataMode,'demo');assert.equal(world.nodes.length,7);checks.push('persistent demo world generation');
  const content=(await ok('/contents/'+world.nodes[0].contentIds[0])).data;const bags=[];
  for(const excerpt of content.excerpts.slice(0,2)){const r=await ok('/bag/items','POST',{targetType:'excerpt',targetId:excerpt.id,journeyId:created.journeyId},{'Idempotency-Key':randomUUID()});bags.push(r.data);}
  assert.equal((await ok('/bag')).data.items.length,2);checks.push('collections persist across function requests');
  if(mode==='prepare-persistence'){
    await writeFile(stateFile,JSON.stringify({siteUrl:base,cookie,csrf,bagId:bags[0].id,text:bags[0].text,...created}),{mode:0o600});checks.push('private cross-deployment fixture prepared');
  }else{
    const field=await task('/contents/'+content.id+'/fields',{snapshotId:content.snapshotId});assert((await ok('/fields/'+field.fieldId)).data.sections.length>=3);checks.push('actual paragraph field');
    const synthesis=await task('/syntheses',{bagItemIds:bags.map(x=>x.id),mode:'manual',question:'如何保留材料的出处？'});
    await ok('/syntheses/'+synthesis.synthesisId+'/save','POST',{title:'云端验证',coreInsight:'先保留出处，再比较不同条件。'},{'Idempotency-Key':randomUUID()});assert.equal((await ok('/insights')).data.items.length,1);checks.push('manual insight and source materials saved');
    const firstCookie=cookie,firstCsrf=csrf;cookie='';csrf='';await ok('/session/guest','POST',{});assert.equal((await call('/worlds/'+created.worldId)).status,404);await ok('/me/data','DELETE',{confirm:'DELETE_MY_DATA'});cookie=firstCookie;csrf=firstCsrf;checks.push('different visitors cannot read each other');
    await ok('/me/data','DELETE',{confirm:'DELETE_MY_DATA'});checks.push('test visitors removed');
  }
  await report();
}
