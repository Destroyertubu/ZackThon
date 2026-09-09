import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';

// Separate VM globals model independent pages. Only ES module export declarations
// are removed; the actual storage module, API gate and identity protocol run intact.
const source=readFileSync(new URL('../frontend/storage.js',import.meta.url),'utf8').replace(/\bexport /g,'')+
  '\nglobalThis.exports={api,get clientId(){return clientId}};';
const KEY='wanderwise-tab-client-v1';

function browser(){
  let time=1000,nextTimer=0;
  const timers=new Map(),channels=new Set();
  const setTimeout=(callback,delay=0)=>{const id=++nextTimer;timers.set(id,{at:time+delay,callback});return id};
  const clearTimeout=id=>timers.delete(id);
  function advance(ms){
    const end=time+ms;
    while(true){
      const next=[...timers].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!next)break;
      timers.delete(next[0]);time=next[1].at;next[1].callback();
    }
    time=end;
  }
  class Channel{
    constructor(name){this.name=name;this.closed=false;channels.add(this)}
    postMessage(data){
      for(const peer of channels)if(peer!==this&&peer.name===this.name&&!peer.closed){
        const cloned=structuredClone(data);
        setTimeout(()=>{if(!peer.closed)peer.onmessage?.({data:cloned})},0);
      }
    }
    close(){this.closed=true;channels.delete(this)}
  }
  function page({saved=new Map(),broadcast=true,blockedStorage=false}={}){
    const requests=[],listeners=new Map();
    const sandbox={
      crypto:{randomUUID},Promise,AbortController,setTimeout,clearTimeout,
      Date:class extends Date{static now(){return time}},
      sessionStorage:{
        getItem:key=>{if(blockedStorage)throw new Error('blocked');return saved.get(key)||null},
        setItem:(key,value)=>{if(blockedStorage)throw new Error('blocked');saved.set(key,value)},
      },
      addEventListener:(name,fn)=>listeners.set(name,fn),
      fetch:async(url,options)=>{requests.push({url,...options});return {ok:true,status:200,json:async()=>({data:{ok:true}})}}
    };
    if(broadcast)sandbox.BroadcastChannel=Channel;
    vm.runInNewContext(source,sandbox,{filename:'frontend/storage.js'});
    return {
      saved,requests,api:sandbox.exports.api,get clientId(){return sandbox.exports.clientId},
      hide:()=>listeners.get('pagehide')?.({persisted:false}),
      restore:()=>listeners.get('pageshow')?.({persisted:true}),
    };
  }
  return {page,advance};
}

test('same-tab reload preserves the lease ID and waits before its first API request',async()=>{
  const b=browser(),first=b.page();
  const id=first.clientId;assert.equal(first.saved.get(KEY),id);first.hide();
  const reload=b.page({saved:first.saved}),call=reload.api.call('/session');
  await Promise.resolve();assert.equal(reload.requests.length,0);
  b.advance(250);await call;
  assert.equal(reload.clientId,id);
  assert.equal(reload.requests[0].headers['X-Client-Id'],id);
});

test('a duplicate tab changes its copied identity while the existing page keeps its lease',async()=>{
  const b=browser(),first=b.page(),id=first.clientId;
  const duplicate=b.page({saved:new Map(first.saved)}),call=duplicate.api.call('/journeys');
  await Promise.resolve();assert.equal(duplicate.requests.length,0);
  b.advance(250);await call;
  assert.equal(first.clientId,id);assert.notEqual(duplicate.clientId,id);
  assert.equal(duplicate.saved.get(KEY),duplicate.clientId);
  assert.equal(duplicate.requests[0].headers['X-Client-Id'],duplicate.clientId);
});

test('simultaneous instances with a copied ID elect one owner before either sends HTTP',async()=>{
  const b=browser(),id=randomUUID(),saved=new Map([[KEY,id]]);
  const first=b.page({saved:new Map(saved)}),second=b.page({saved:new Map(saved)});
  const calls=[first.api.call('/session'),second.api.call('/session')];
  b.advance(250);await Promise.all(calls);
  assert.notEqual(first.clientId,second.clientId);
  assert.equal([first,second].filter(page=>page.clientId===id).length,1);
  for(const page of [first,second])assert.equal(page.requests[0].headers['X-Client-Id'],page.clientId);
});

test('a restored page re-checks an identity that another active page has claimed',async()=>{
  const b=browser(),first=b.page(),id=first.clientId;
  first.hide();
  const duplicate=b.page({saved:new Map(first.saved)});b.advance(250);
  assert.equal(duplicate.clientId,id);
  first.restore();const call=first.api.call('/session');b.advance(250);await call;
  assert.equal(duplicate.clientId,id);assert.notEqual(first.clientId,id);
});

test('without BroadcastChannel each page has a fresh ID and uses existing lease takeover',async()=>{
  const b=browser(),id=randomUUID(),saved=new Map([[KEY,id]]);
  const first=b.page({saved,broadcast:false}),old=first.clientId;
  const reload=b.page({saved,broadcast:false});
  assert.notEqual(old,id);assert.notEqual(reload.clientId,old);
  await reload.api.call('/session');
  assert.equal(reload.requests[0].headers['X-Client-Id'],reload.clientId);
});

test('blocked sessionStorage still permits requests with distinct in-memory identities',async()=>{
  const b=browser(),first=b.page({blockedStorage:true}),second=b.page({blockedStorage:true});
  await Promise.all([first.api.call('/session'),second.api.call('/session')]);
  assert.notEqual(first.clientId,second.clientId);
  assert.equal(first.requests.length,1);assert.equal(second.requests.length,1);
});
