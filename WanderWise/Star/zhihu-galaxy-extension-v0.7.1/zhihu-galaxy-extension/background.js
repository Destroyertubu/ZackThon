importScripts('core.js', 'trail-store.js', 'spatial.js', 'ai-semantic.js', 'ai-background.js');

// Single writer prevents lost updates when different question tabs save simultaneously.
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type !== 'ZH_GALAXY_JOURNAL') return;
  if (sender.id !== chrome.runtime.id) { respond({ok:false,error:'来源校验失败'}); return; }
  const action=msg.action;
  if(!action || typeof action.type !== 'string') { respond({ok:false,error:'无效存储请求'}); return; }
  ZGJournal.chromeDispatch(action).then(state=>respond({ok:true,state}),error=>respond({ok:false,error:error.message}));
  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const url = tab.url || "";
  if (/^https:\/\/(www\.)?zhihu\.com\//.test(url)) {
    try { await chrome.tabs.sendMessage(tab.id, { type: "ZH_GALAXY_ACTION" }); }
    catch (error) { console.warn("Zhihu Galaxy: content script unavailable", error); }
  } else {
    await chrome.tabs.create({ url: chrome.runtime.getURL("demo.html") });
  }
});

// Require the updated local bridge before sending page excerpts. Old bridges may
// launch their own remote summarizer; 0.7 keeps that path explicitly disabled.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "ZH_GALAXY_ANALYZE") return;
  if(sender.id!==chrome.runtime.id || !/^https:\/\/(www\.)?zhihu\.com\//.test(sender.url||'')) {sendResponse({ok:false,error:'bridge 来源校验失败'});return;}
  (async()=>{
    const probe=new AbortController(),pt=setTimeout(()=>probe.abort(),1500);let health;
    try{const r=await fetch('http://127.0.0.1:8765/health',{signal:probe.signal,credentials:'omit',redirect:'error',cache:'no-store'});if(!r.ok)throw new Error('bridge health');health=await r.json();}finally{clearTimeout(pt);}
    if(health?.version!=='0.7.0'||health.semanticPolicy!=='explicit-only')throw new Error('请重启随 v0.7 提供的 bridge；旧版自动语义服务已跳过');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),25000);
    try{const r=await fetch('http://127.0.0.1:8765/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',redirect:'error',body:JSON.stringify({...msg.payload,allowLegacyAI:false}),signal:ctl.signal});if(!r.ok)throw new Error('bridge HTTP '+r.status);const j=await r.json();return j?.ok?{ok:true,data:j.data}:{ok:false,error:'本地数据 bridge 暂不可用'};}finally{clearTimeout(timer);}
  })().then(sendResponse,error=>sendResponse({ok:false,error:error?.name==='AbortError'?'本地 bridge 超时，继续使用页面数据':String(error?.message||'bridge error').slice(0,180)}));
  return true;
});
