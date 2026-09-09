import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApplication} from '../cloud/application.mjs';
import {memoryStorage} from '../cloud/storage.mjs';

const base = 'https://wanderwise.test';
function setup(storage = memoryStorage()) {
  const app = createApplication({storage, getEnv: () => ''});
  const client = (credentials = {}) => ({...credentials,
    async call(path, method = 'GET', body, extra = {}) {
      const headers = {'Origin': base, 'Content-Type': 'application/json', 'X-Client-Id': 'test-client-123', ...(this.cookie ? {Cookie: this.cookie} : {}), ...(this.csrf ? {'X-CSRF-Token': this.csrf} : {}), ...extra};
      const res = await app.handler(new Request(base + '/api/v1' + path, {method, headers, ...(body === undefined ? {} : {body: JSON.stringify(body)})}), {ip: '192.0.2.1'});
      const payload = await res.json();
      if (res.headers.has('set-cookie')) this.cookie = res.headers.get('set-cookie').split(';')[0];
      if (payload.data?.csrfToken) this.csrf = payload.data.csrfToken;
      return {status: res.status, headers: res.headers, ...payload};
    },
    async write(path, body, method = 'POST', key = randomUUID()) {return this.call(path, method, body, {'Idempotency-Key': key});},
  });
  return {storage, client};
}
async function journey(client) {
  assert.equal((await client.call('/session/guest','POST',{})).status,200);
  const created = await client.write('/worlds',{seedMode:'demo',presetId:'demo-growth'});
  assert.equal(created.status,202,JSON.stringify(created)); assert.equal(created.data.status,'succeeded',JSON.stringify(created));
  const {worldId,journeyId} = created.data.result;
  return {world:(await client.call('/worlds/'+worldId)).data,journey:(await client.call('/journeys/'+journeyId)).data};
}

test('HTTPS sessions, CSRF, exact origin, private isolation and deletion', async () => {
  const env=setup(), a=env.client(), b=env.client();
  const denied=await a.call('/session/guest','POST',{}, {Origin:'https://evil.test'});assert.equal(denied.status,403);
  const guest=await a.call('/session/guest','POST',{});assert.equal(guest.status,200);
  assert.match(guest.headers.get('set-cookie'),/HttpOnly/);assert.match(guest.headers.get('set-cookie'),/Secure/);assert.match(guest.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await a.call('/worlds','POST',{seedMode:'demo'}, {'X-CSRF-Token':'bad'})).status,403);
  const {world}=await journey(a); await b.call('/session/guest','POST',{});
  assert.equal((await b.call('/worlds/'+world.worldId)).status,404);
  const oldCookie=a.cookie; assert.equal((await a.call('/me/data','DELETE',{confirm:'DELETE_MY_DATA'})).status,200);
  a.cookie=oldCookie;assert.equal((await a.call('/session')).status,401);
});

test('demo route, excerpt, field, checkpoint, manual synthesis and reload', async () => {
  const env=setup(), a=env.client();const {world,journey:j}=await journey(a);
  assert.equal(world.nodes.length,7); assert.equal(world.dataMode,'demo');
  const ct=(await a.call('/contents/'+world.nodes[0].contentIds[0])).data;
  const bag=[];
  for(const e of ct.excerpts.slice(0,2)) {const r=await a.write('/bag/items',{targetType:'excerpt',targetId:e.id,journeyId:j.id});assert.equal(r.status,200,JSON.stringify(r));bag.push(r.data);}
  const f=await a.write('/contents/'+ct.id+'/fields',{snapshotId:ct.snapshotId});assert.equal(f.data.status,'succeeded',JSON.stringify(f));
  const field=(await a.call('/fields/'+f.data.result.fieldId)).data;assert.ok(field.sections.length>=3);
  assert.equal((await a.call('/journeys/'+j.id+'/lease','POST',{expectedVersion:j.version})).status,200);
  const cp={...j.checkpoint,scene:'field',fieldId:field.id,returnContext:{position:j.checkpoint.position,camera:j.checkpoint.camera,yaw:0,navigationMode:0}};
  assert.equal((await a.call('/journeys/'+j.id+'/checkpoint','PUT',{expectedVersion:j.version,checkpoint:cp})).status,200);
  const syn=await a.write('/syntheses',{bagItemIds:bag.map(b=>b.id),mode:'manual',question:'两份材料如何联系？'});assert.equal(syn.data.status,'succeeded',JSON.stringify(syn));
  const id=syn.data.result.synthesisId;
  assert.equal((await a.write('/syntheses/'+id+'/save',{title:'有出处的联系',coreInsight:'通过保留来源对比不同条件，帮助自己判断。'})).status,200);
  const reloaded=setup(env.storage).client({cookie:a.cookie,csrf:a.csrf});
  assert.equal((await reloaded.call('/bag')).data.items.length,3);
  assert.equal((await reloaded.call('/journeys/'+j.id)).data.checkpoint.fieldId,field.id);
  assert.equal((await reloaded.call('/insights')).data.items.length,1);
});

test('idempotent mutations and version conflicts preserve prior content', async()=>{
  const {client}=setup(),a=client();const {world,journey:j}=await journey(a);
  const ct=(await a.call('/contents/'+world.nodes[0].contentIds[0])).data, body={targetType:'excerpt',targetId:ct.excerpts[0].id,journeyId:j.id}, key=randomUUID();
  const first=await a.write('/bag/items',body,'POST',key), repeat=await a.write('/bag/items',body,'POST',key);
  assert.deepEqual(repeat.data,first.data);
  assert.equal((await a.write('/bag/items',{...body,targetId:ct.excerpts[1].id},'POST',key)).status,409);
  assert.equal((await a.write('/bag/items/'+first.data.id,{expectedVersion:1,note:'new note'},'PATCH')).status,200);
  assert.equal((await a.write('/bag/items/'+first.data.id,{expectedVersion:1,note:'stale note'},'PATCH')).status,409);
  assert.equal((await a.call('/bag')).data.items[0].note,'new note');
});

test('parallel independent collections survive conditional write races', async()=>{
  const {client}=setup(),a=client();const {world,journey:j}=await journey(a);
  const ct=(await a.call('/contents/'+world.nodes[0].contentIds[0])).data;
  const results=await Promise.all(ct.excerpts.slice(0,3).map(e=>a.write('/bag/items',{targetType:'excerpt',targetId:e.id,journeyId:j.id})));
  assert.ok(results.every(r=>r.status===200),JSON.stringify(results));assert.equal((await a.call('/bag')).data.items.length,3);
});

test('schema rejects extra properties, invalid enums, positions and missing idempotency', async()=>{
  const {client}=setup(),a=client();await a.call('/session/guest','POST',{});
  assert.equal((await a.write('/worlds',{seedMode:'demo',admin:true})).status,422);
  assert.equal((await a.write('/worlds',{seedMode:'invented'})).status,422);
  assert.equal((await a.call('/worlds','POST',{seedMode:'demo'})).status,422);
});

test('concurrent identical generation invokes upstream only once and replay returns saved job', async()=>{
  const storage=memoryStorage();let calls=0, release;
  const gate=new Promise(resolve=>{release=resolve;});
  const {seedDemo}=await import('../cloud/providers.mjs');
  const provider={async search(state){calls++;await gate;const preset=seedDemo(state)[0];return {contents:preset.contentIds.map(id=>state.contents[id]),mode:'demo',at:preset.sourceFetchedAt};}};
  const app=createApplication({storage,provider,getEnv:()=>''});
  const request=(path,method,body,headers={})=>app.handler(new Request(base+'/api/v1'+path,{method,headers:{Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)}),{ip:'192.0.2.2'});
  const guest=await request('/session/guest','POST',{}),g=(await guest.json()).data;
  const headers={Cookie:guest.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':g.csrfToken,'Idempotency-Key':randomUUID()};
  const first=request('/worlds','POST',{seedMode:'search',seedText:'如何学习'},headers);
  while(!calls) await new Promise(resolve=>setImmediate(resolve));
  const concurrent=await request('/worlds','POST',{seedMode:'search',seedText:'如何学习'},headers);
  assert.equal(concurrent.status,409); assert.equal(calls,1);
  release();const firstResult=await (await first).json();assert.equal(firstResult.data.status,'succeeded');
  const retry=await (await request('/worlds','POST',{seedMode:'search',seedText:'如何学习'},headers)).json();
  assert.deepEqual(retry.data,firstResult.data);assert.equal(calls,1);
});
