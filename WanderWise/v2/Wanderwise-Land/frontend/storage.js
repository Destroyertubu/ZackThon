let promise;
function database(){if(!promise)promise=new Promise((resolve,reject)=>{let r=indexedDB.open('wanderwise-land-v1',1);r.onupgradeneeded=()=>{for(let name of ['outbox','cache','drafts'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return promise}
async function run(store,mode,fn){let db=await database();return new Promise((resolve,reject)=>{let tx=db.transaction(store,mode),req=fn(tx.objectStore(store));tx.oncomplete=()=>resolve(req?.result);tx.onerror=()=>reject(tx.error)})}
export const local={get:(s,id)=>run(s,'readonly',o=>o.get(id)),put:(s,id,value)=>run(s,'readwrite',o=>o.put({id,value})),del:(s,id)=>run(s,'readwrite',o=>o.delete(id)),all:s=>run(s,'readonly',o=>o.getAll()),clear:s=>run(s,'readwrite',o=>o.clear())};
export class ApiError extends Error{constructor(e,status){super(e.message||'请求失败');this.code=e.code;this.retryable=e.retryable;this.status=status;this.details=e.details}}
const TAB_KEY='wanderwise-tab-client-v1';
export let clientId;
let stopIdentity=()=>{};
function storedClient(){try{let id=sessionStorage.getItem(TAB_KEY);return typeof id==='string'&&/^[\w-]{8,100}$/.test(id)?id:null}catch{return null}}
function rememberClient(){try{sessionStorage.setItem(TAB_KEY,clientId)}catch{/* Restricted storage falls back to an in-memory identity. */}}
function identifyClient(){
  stopIdentity();
  const stored=storedClient();
  clientId=stored||crypto.randomUUID();
  let channel;
  try{
    if(typeof BroadcastChannel!=='function')throw new Error('BroadcastChannel unavailable');
    channel=new BroadcastChannel('wanderwise-tab-identity-v1');
  }catch{
    // Without cross-tab detection, a copied sessionStorage must not share a lease.
    // Use the original per-page identity and let the existing takeover UI resolve it.
    clientId=crypto.randomUUID();rememberClient();return Promise.resolve();
  }
  rememberClient();
  const instance=crypto.randomUUID(),started=Date.now();
  let settled=false,timer,resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve});
  const finish=()=>{if(!settled){settled=true;clearTimeout(timer);resolveReady()}};
  const rotate=()=>{clientId=crypto.randomUUID();rememberClient();finish()};
  channel.onmessage=({data})=>{
    if(!data||data.clientId!==clientId||typeof data.instance!=='string'||data.instance===instance)return;
    if(data.type==='probe'){
      // An established page always wins. Simultaneous starts use one stable tie-break.
      const earlier=started<data.started||(started===data.started&&instance<data.instance);
      if(settled||earlier)channel.postMessage({type:'occupied',clientId,instance,target:data.instance});
      else rotate();
    }else if(data.type==='occupied'&&data.target===instance&&!settled)rotate();
  };
  stopIdentity=()=>{channel.onmessage=null;channel.close();finish()};
  if(stored){
    timer=setTimeout(finish,250);
    try{channel.postMessage({type:'probe',clientId,instance,started})}catch{rotate();stopIdentity()}
  }else finish();
  return ready;
}
let identityReady=identifyClient();
if(typeof addEventListener==='function'){
  addEventListener('pagehide',()=>stopIdentity());
  // A page restored from the back/forward cache must re-check its suspended identity.
  addEventListener('pageshow',event=>{if(event.persisted)identityReady=identifyClient()});
}
export const api={csrf:'',owner:'',async call(path,method='GET',body=null,key=null){await identityReady;let headers={'Content-Type':'application/json','X-Client-Id':clientId};if(method!=='GET'){headers['X-CSRF-Token']=this.csrf;if(key)headers['Idempotency-Key']=key}let controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{let response=await fetch('/api/v1'+path,{method,credentials:'same-origin',headers,signal:controller.signal,...(body===null?{}:{body:JSON.stringify(body)})});let payload;try{payload=await response.json()}catch{throw new ApiError({code:'INVALID_RESPONSE',message:'服务返回了无法识别的数据。'},response.status)}if(!response.ok)throw new ApiError(payload.error||{},response.status);return payload.data}finally{clearTimeout(timer)}},async mutate(path,method,body,key=crypto.randomUUID(),offline=true){try{return await this.call(path,method,body,key)}catch(e){if(offline&&!(e instanceof ApiError)&&this.owner){let entries=await local.all('outbox');if(entries.length>=200)throw new Error('本机待同步队列已满，请联网完成同步。');await local.put('outbox',key,{path,method,body,key,owner:this.owner,queuedAt:new Date().toISOString()});return {pending:true}}throw e}},async flush(onResult){let entries=await local.all('outbox');for(let {id,value:v} of entries){if(v.owner!==this.owner)continue;try{let result=await this.call(v.path,v.method,v.body,v.key);await local.del('outbox',id);onResult?.(result,v)}catch(e){if(e instanceof ApiError){await local.put('outbox',id,{...v,error:e.message});onResult?.(null,v,e)}break}}}};
