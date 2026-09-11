/* Chrome uses one service-worker writer; demo uses a serializable IndexedDB transaction. */
(() => {
  'use strict';
  const C=globalThis.ZGCore,KEY='zg_journal_v1';
  let queue=Promise.resolve();
  function chromeDispatch(action){
    const task=queue.then(async()=>{const data=await chrome.storage.local.get(KEY);const state=data[KEY]||C.freshState();if(action.type==='read')return state;const next=C.reduce(state,action);await chrome.storage.local.set({[KEY]:next});return next;});
    queue=task.catch(()=>{});return task;
  }
  let dbPromise;
  function database(){return dbPromise ||= new Promise((resolve,reject)=>{const req=indexedDB.open('zhihu-galaxy-journal',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function demoDispatch(action){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('state',action.type==='read'?'readonly':'readwrite'),store=tx.objectStore('state');let result;const req=store.get(KEY);req.onsuccess=()=>{try{const s=req.result||C.freshState();result=action.type==='read'?s:C.reduce(s,action);if(action.type!=='read')store.put(result,KEY);}catch(e){reject(e);tx.abort();}};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('存储事务已取消'));});}
  function client(){
    const ext=!!globalThis.chrome?.runtime?.id;
    return {async dispatch(action){if(ext){const r=await chrome.runtime.sendMessage({type:'ZH_GALAXY_JOURNAL',action});if(!r?.ok)throw new Error(r?.error||'扩展后台暂不可用，请刷新知乎页面');return r.state;}return demoDispatch(action);},
      subscribe(fn){if(ext){const cb=(changes,area)=>{if(area==='local'&&changes[KEY])fn(changes[KEY].newValue||C.freshState());};chrome.storage.onChanged.addListener(cb);return()=>chrome.storage.onChanged.removeListener(cb);}return()=>{};},isExtension:ext};
  }
  globalThis.ZGJournal={KEY,client,chromeDispatch};
})();
