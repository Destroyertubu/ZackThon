(() => {
  "use strict";
  const Engine = globalThis.ZhihuGalaxyEngine;
  const DEFAULT_SETTINGS={...globalThis.ZGSpatial.DEFAULT};
  let exploreMode=false,lastUrl=location.href,opening=false,currentSession=null;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function questionIdFromUrl(url=location.href){const m=String(url).match(/\/question\/(\d+)/);return m?m[1]:null;}
  function isQuestionPage(){return !!questionIdFromUrl();}
  function questionTitle(){for(const s of ["h1.QuestionHeader-title",".QuestionHeader-title","[data-za-detail-view-name='Title']","h1"]){const t=document.querySelector(s)?.textContent?.trim();if(t&&t.length>=4&&t.length<300)return t;}return document.title.replace(/\s*[-_]\s*知乎.*$/," ").trim()||"知乎问题";}

  const plain=input=>Engine.stripHtml(input||"");
  function naturalEnough(text){const t=plain(text);if(t.length<30)return false;const cjk=(t.match(/[\u3400-\u9fff]/g)||[]).length,meta=(t.match(/\b(?:src|href|data|v\d+|api|jpg|jpeg|png|gif|webp|com|https?)\b/gi)||[]).length;return cjk>=12&&meta<=2;}
  function firstLead(input){return Engine.firstParagraphLead?.(input)||plain(input).split(/[。！？!?]/)[0].slice(0,52);}
  function parseCount(v){if(v==null)return undefined;if(typeof v==="number")return Number.isFinite(v)?v:undefined;const s=String(v).replace(/,/g,"").trim();const n=Number(s.match(/[\d.]+/)?.[0]);if(!Number.isFinite(n))return undefined;if(/万/.test(s))return Math.round(n*10000);if(/k/i.test(s))return Math.round(n*1000);return n;}
  function timeValue(v){if(v==null)return 0;if(typeof v==="number")return v<1e12?v*1000:v;const t=Date.parse(String(v));return Number.isFinite(t)?t:0;}

  function normalizeAnswer(raw,fallbackId){
    if(!raw)return null;const q=raw.question||raw.target?.question||{},authorObj=raw.author||raw.target?.author||{};
    const sourceContent=raw.content||raw.rich_text||raw.excerpt||raw.target?.content||raw.target?.excerpt||raw.ContentText||"",text=plain(sourceContent);if(!naturalEnough(text))return null;
    const rawUrl=raw.Url||raw.url||raw.target?.url||"",urlAnswerId=String(rawUrl).match(/\/answer\/(\d+)/)?.[1],id=String(urlAnswerId||raw.id||raw.answer_id||raw.target?.id||raw.ContentID||fallbackId||""),pageQid=questionIdFromUrl();
    return {id,author:(typeof raw.author==="string"?raw.author:authorObj.name)||raw.author_name||raw.AuthorName||"知乎用户",content:text,excerpt:plain(raw.excerpt||raw.target?.excerpt||raw.ContentText||text.slice(0,300)),lead:plain(raw.lead||firstLead(sourceContent)),voteup_count:parseCount(raw.voteup_count??raw.target?.voteup_count??raw.VoteUpCount),comment_count:parseCount(raw.comment_count??raw.target?.comment_count??raw.CommentCount),created_time:raw.created_time??raw.target?.created_time??raw.CreatedTime??raw.created_at,updated_time:raw.updated_time??raw.target?.updated_time??raw.UpdatedTime??raw.updated_at,url:rawUrl||((id&&/^\d+$/.test(id)&&pageQid)?`https://www.zhihu.com/question/${pageQid}/answer/${id}`:null),questionId:String(q.id||raw.question_id||pageQid||"")};
  }

  function isDefinitelyAnswerObject(obj,qid){if(!obj||Array.isArray(obj)||typeof obj!=="object")return false;const type=String(obj.type||obj.target?.type||"").toLowerCase();if(type==="answer")return true;if(obj.answer_type||obj.answer_id)return true;const rqid=String(obj.question?.id||obj.question_id||obj.target?.question?.id||""),id=String(obj.id||obj.target?.id||""),content=obj.content||obj.target?.content;return !!(rqid&&rqid===String(qid)&&/^\d+$/.test(id)&&typeof content==="string"&&obj.author&&content.length>80);}
  function extractInitialStateAnswers(qid){const scripts=[...document.querySelectorAll("script#js-initialData, script#__NEXT_DATA__, script[type='application/json']")],out=[],visited=new Set();for(const script of scripts.slice(0,12)){const txt=script.textContent?.trim();if(!txt||txt.length<20||txt.length>12000000)continue;let data;try{data=JSON.parse(txt);}catch{continue;}const stack=[data];let count=0;while(stack.length&&count++<140000){const obj=stack.pop();if(!obj||typeof obj!=="object"||visited.has(obj))continue;visited.add(obj);if(isDefinitelyAnswerObject(obj,qid)){const a=normalizeAnswer(obj,`state-${out.length}`);if(a)out.push(a);}if(Array.isArray(obj)){for(const v of obj)if(v&&typeof v==="object")stack.push(v);}else{for(const v of Object.values(obj))if(v&&typeof v==="object")stack.push(v);}}}return dedupeAnswers(out);}

  function extractDomAnswers(){
    const out=[],containers=[...document.querySelectorAll(".AnswerItem, [class*='AnswerItem'], .List-item")];
    for(const el of containers){const rich=el.querySelector(".RichContent-inner, .RichText, [itemprop='text'], [class*='RichContent']"),text=plain(rich?.innerText||rich?.textContent||"");if(!naturalEnough(text))continue;const href=[...el.querySelectorAll("a[href*='/answer/']")].map(a=>a.href).find(Boolean),id=href?.match(/\/answer\/(\d+)/)?.[1]||`dom-${out.length}`,author=el.querySelector(".AuthorInfo-name, [class*='AuthorInfo'] [class*='name'], [data-za-detail-view-element_name='User']")?.textContent?.trim()||"知乎用户",buttons=[...el.querySelectorAll("button")].map(b=>b.textContent?.trim()).filter(Boolean),voteText=buttons.find(t=>/赞同|赞/.test(t))||"";out.push({id,author,content:text,excerpt:text.slice(0,300),lead:firstLead(rich?.innerHTML||text),voteup_count:parseCount(voteText),url:href||null});}
    if(out.length<2){for(const rich of document.querySelectorAll(".RichContent-inner, [itemprop='text']")){const text=plain(rich.innerText||rich.textContent||"");if(!naturalEnough(text))continue;out.push({id:`dom-fallback-${out.length}`,author:"知乎用户",content:text,excerpt:text.slice(0,300),lead:firstLead(rich.innerHTML||text)});}}
    return dedupeAnswers(out);
  }

  function answerFingerprint(text){return plain(text).toLowerCase().replace(/[^0-9a-z\u3400-\u9fff]+/g,"").slice(0,900);}
  function dedupeAnswers(list){
    const byId=new Map(),byFp=new Map(),out=[];
    for(const a0 of list){
      const a=normalizeAnswer(a0,a0?.id)||a0;if(!a||!naturalEnough(a.content||a.excerpt))continue;
      const text=plain(a.content||a.excerpt),id=(a.id&&/^\d+$/.test(String(a.id)))?String(a.id):null,fp=answerFingerprint(text),idKey=id?`id:${id}`:null,fpKey=fp.length>=80?`fp:${fp}`:null;
      let idx=(idKey&&byId.get(idKey));if(idx==null&&fpKey)idx=byFp.get(fpKey);
      const normalized={...a,content:text,excerpt:plain(a.excerpt||text.slice(0,300)),lead:plain(a.lead||firstLead(text))};
      if(idx==null){idx=out.length;out.push(normalized);}else{const old=out[idx];if(plain(old.content||"").length<text.length||(!old.voteup_count&&a.voteup_count))out[idx]={...old,...normalized};}
      if(idKey)byId.set(idKey,idx);if(fpKey)byFp.set(fpKey,idx);
    }
    return out;
  }
  function sortAnswers(list,settings){return [...list].sort((a,b)=>globalThis.ZGSpatial.compareAnswers(a,b,settings));}

  async function getSettings(){try{const obj=await chrome.storage.local.get("zgSettings");return {...DEFAULT_SETTINGS,...(obj.zgSettings||{})};}catch{return {...DEFAULT_SETTINGS};}}
  async function saveSettings(settings){try{await chrome.storage.local.set({zgSettings:settings});}catch{}}

  async function fetchLegacyApiAnswers(qid,settings,onPage){
    const out=[];let offset=0,empty=0;const pageLimit=Math.min(30,Math.max(1,Math.ceil(settings.maxAnswers/20)+2));
    for(let page=0;page<pageLimit&&dedupeAnswers(out).length<settings.maxAnswers;page++){
      let j=null;
      for(let attempt=0;attempt<2&&!j;attempt++){
        const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),5600),params=new URLSearchParams({include:"data[*].content,data[*].excerpt,data[*].voteup_count,data[*].comment_count,data[*].created_time,data[*].updated_time,data[*].author.name",limit:"20",offset:String(offset),platform:"desktop",sort_by:settings.sortMode==="latest"?"updated":"default"});
        try{
          const r=await fetch(`/api/v4/questions/${qid}/answers?${params}`,{credentials:"include",headers:{accept:"application/json"},signal:ctl.signal});
          if(r.ok)j=await r.json();else if(r.status===429||r.status>=500)await sleep(650*(attempt+1));else break;
        }catch{if(attempt===0)await sleep(520);}finally{clearTimeout(timer);}
      }
      if(!j)break;
      const batch=[];for(const raw of j.data||[]){const a=normalizeAnswer(raw,`api-${offset+batch.length}`);if(a){out.push(a);batch.push(a);}}
      const cleanBatch=dedupeAnswers(batch);if(cleanBatch.length){empty=0;onPage?.(cleanBatch);}else empty++;
      if(j.paging?.is_end||!(j.data?.length)||empty>=2)break;offset+=j.data.length;
    }
    return dedupeAnswers(out).slice(0,settings.maxAnswers);
  }

  function compactBridgeAnswers(list,maxAnswers,sortMode="votes",randomSeed=globalThis.ZGSpatial.DEFAULT.randomSeed){return sortAnswers(dedupeAnswers(list),{sortMode,randomSeed}).slice(0,Math.min(500,maxAnswers)).map(a=>({id:a.id,author:a.author,content:plain(a.content||a.excerpt).slice(0,2600),excerpt:plain(a.excerpt||"").slice(0,360),lead:a.lead,voteup_count:a.voteup_count,comment_count:a.comment_count,created_time:a.created_time,updated_time:a.updated_time,url:a.url}));}

  function callBridge(payload){return new Promise(resolve=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;resolve(null);}},118000);try{chrome.runtime.sendMessage({type:"ZH_GALAXY_ANALYZE",payload},res=>{if(done)return;done=true;clearTimeout(timer);if(chrome.runtime.lastError||!res?.ok)return resolve(null);resolve(res.data||null);});}catch{clearTimeout(timer);resolve(null);}});}

  function sessionAlive(session){return currentSession===session&&document.getElementById("zg-root")?.__zgApp===session.app;}
  function progressFor(session,phase="loading"){return {loaded:session.visibleCount,total:session.settings.maxAnswers,max:session.settings.maxAnswers,phase,source:[...session.sources].join(" + ")};}
  function currentQuestion(session,useSemantic=false){const sorted=sortAnswers(session.pool,session.settings).slice(0,session.settings.maxAnswers),answers=sorted.slice(0,session.visibleCount);return {id:session.qid,title:session.title,answers,semantic:useSemantic?session.semantic:null,source:[...session.sources].join(" + ")||"page"};}

  function updateSessionGraph(session,useSemantic=false,phase="loading"){if(!sessionAlive(session))return;session.app.replaceQuestion(currentQuestion(session,useSemantic),{progress:progressFor(session,phase)});}
  async function growSession(session){if(session.growing)return;session.growing=true;try{while(sessionAlive(session)){const target=Math.min(session.settings.maxAnswers,session.pool.length);if(session.visibleCount>=target)break;await sleep(780);if(!sessionAlive(session))break;const before=session.visibleCount;session.visibleCount=Math.min(target,session.visibleCount+session.settings.batchSize);session.app.showGrowToast?.(`+${session.visibleCount-before} 篇回答已加入 · 正在生成节点`);updateSessionGraph(session,false,session.pending>0||session.visibleCount<target?"loading":"ready");}}finally{session.growing=false;if(sessionAlive(session)&&session.pending===0){const target=Math.min(session.settings.maxAnswers,session.pool.length);if(session.visibleCount<target){growSession(session);return;}updateSessionGraph(session,!!session.semantic,"ready");if(session.semantic)session.app.showGrowToast?.("高质量语义提炼已完成");}}
  }
  function ingest(session,answers,source,semantic=null){if(!session||currentSession!==session)return;if(source)session.sources.add(source);if(semantic)session.semantic=semantic;session.pool=dedupeAnswers([...session.pool,...(answers||[])]);const cap=Math.min(session.settings.maxAnswers,session.pool.length);if(session.visibleCount>cap)session.visibleCount=cap;if(sessionAlive(session)){session.app.setProgress(progressFor(session,"loading"));growSession(session);}}
  async function applyNewSettings(session,next){if(!sessionAlive(session))return;const prev={...session.settings};session.settings={...DEFAULT_SETTINGS,...next};await saveSettings(session.settings);session.pool=sortAnswers(session.pool,session.settings);session.visibleCount=Math.min(session.settings.maxAnswers,Math.max(Math.min(session.settings.previewAfter,session.pool.length),Math.min(session.visibleCount,session.settings.maxAnswers)));updateSessionGraph(session,false,session.pending>0?"loading":"ready");growSession(session);
    if(session.settings.maxAnswers>prev.maxAnswers||session.settings.sortMode!==prev.sortMode){
      session.pending+=2;session.app.setProgress(progressFor(session,"loading"));
      fetchLegacyApiAnswers(session.qid,session.settings,batch=>ingest(session,batch,"web")).then(ans=>{if(currentSession!==session)return;session.pending--;ingest(session,ans,"web");if(session.pending===0)growSession(session);});
      callBridge({questionId:session.qid,title:session.title,pageAnswers:compactBridgeAnswers(session.pool,session.settings.maxAnswers,session.settings.sortMode,session.settings.randomSeed),settings:session.settings}).then(res=>{if(currentSession!==session)return;session.pending--;if(res?.answers?.length)ingest(session,res.answers,res.source||"zhihu-cli",res.semantic||null);else if(res?.semantic)ingest(session,[],res.source||"zhihu-cli",res.semantic);if(session.pending===0)growSession(session);});
    }
  }

  async function openGalaxy(){
    const qid=questionIdFromUrl();if(!qid||opening)return;opening=true;const title=questionTitle(),settings=await getSettings();showLoading("正在准备首批高质量回答…","优先展示 · 后台继续补充 · 无需等待全部语义分析");
    try{
      let pageAnswers=sortAnswers(dedupeAnswers([...extractInitialStateAnswers(qid),...extractDomAnswers()]),settings).slice(0,settings.maxAnswers),legacyEarly=null,bridgeEarly=null;
      const legacyPromise=fetchLegacyApiAnswers(qid,settings,batch=>{if(currentSession?.qid===qid)ingest(currentSession,batch,"web");}).then(x=>{legacyEarly=x;return x;});
      const bridgePromise=callBridge({questionId:qid,title,pageAnswers:compactBridgeAnswers(pageAnswers,settings.maxAnswers,settings.sortMode,settings.randomSeed),settings}).then(x=>{bridgeEarly=x;return x;});
      if(pageAnswers.length<settings.previewAfter){await Promise.race([legacyPromise,bridgePromise,sleep(1800)]);if(legacyEarly?.length)pageAnswers=dedupeAnswers([...pageAnswers,...legacyEarly]);if(bridgeEarly?.answers?.length)pageAnswers=dedupeAnswers([...pageAnswers,...bridgeEarly.answers]);}
      pageAnswers=sortAnswers(pageAnswers,settings).slice(0,settings.maxAnswers);hideLoading();
      if(!pageAnswers.length){const first=await Promise.race([legacyPromise.then(x=>x||[]),bridgePromise.then(x=>x?.answers||[]),sleep(2600).then(()=>[])]);pageAnswers=sortAnswers(dedupeAnswers(first),settings).slice(0,settings.maxAnswers);}
      if(!pageAnswers.length){alert("暂时没有读取到可用回答。请启动 zhihu-cli bridge，或先向下滚动加载几条回答后重试。");return;}
      const visibleCount=Math.min(settings.maxAnswers,pageAnswers.length,Math.max(1,settings.previewAfter));
      const sourceSet=new Set(["page"]);if(legacyEarly?.length)sourceSet.add("web");if(bridgeEarly?.answers?.length)sourceSet.add(bridgeEarly.source||"zhihu-cli");
      const q={id:qid,title,answers:pageAnswers.slice(0,visibleCount),semantic:null,source:[...sourceSet].join(" + ")};
      const session={qid,title,settings,pool:pageAnswers,visibleCount,semantic:null,sources:sourceSet,pending:2,growing:false,app:null};
      const app=Engine.open(q,{settings,progress:{loaded:visibleCount,total:settings.maxAnswers,max:settings.maxAnswers,phase:"loading",source:q.source},onSettingsChange:(next)=>applyNewSettings(session,next)});session.app=app;currentSession=session;

      legacyPromise.then(ans=>{if(currentSession!==session)return;session.pending--;ingest(session,ans,"web");if(session.pending===0)growSession(session);});
      bridgePromise.then(res=>{if(currentSession!==session)return;session.pending--;if(res?.answers?.length)ingest(session,res.answers,res.source||"zhihu-cli",res.semantic||null);else if(res?.semantic)ingest(session,[],res.source||"zhihu-cli",res.semantic);if(session.pending===0)growSession(session);});
    }finally{opening=false;hideLoading();}
  }

  function showLoading(title="正在读取知乎回答…",sub="清洗元数据 · 语义提炼 · 三维布局"){if(document.getElementById("zg-loading-overlay")||document.getElementById("zg-root"))return;const d=document.createElement("div");d.id="zg-loading-overlay";d.style.cssText="position:fixed;inset:0;z-index:2147483645;background:rgba(2,4,10,.92);color:#fff;display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;";d.innerHTML=`<div style="text-align:center"><div style="width:48px;height:48px;border:1px solid rgba(100,150,255,.25);border-top-color:#76a5ff;border-radius:50%;margin:auto;animation:zg-spin 1s linear infinite"></div><div style="margin-top:16px;font-size:15px">${title}</div><div style="margin-top:7px;font-size:12px;color:rgba(210,222,250,.55)">${sub}</div></div>`;document.documentElement.appendChild(d);}
  function hideLoading(){document.getElementById("zg-loading-overlay")?.remove();}

  function ensureQuestionPill(){const existing=document.querySelector(".zg-page-pill");if(!isQuestionPage()||document.getElementById("zg-root")){existing?.remove();return;}if(existing)return;const b=document.createElement("button");b.className="zg-page-pill";b.textContent="✦ 探索问题星系";b.onclick=openGalaxy;document.documentElement.appendChild(b);}
  function toggleExploreMode(){exploreMode=!exploreMode;document.querySelectorAll(".zg-inline-badge").forEach(x=>x.remove());document.querySelectorAll("a[data-zg-badged='1']").forEach(a=>delete a.dataset.zgBadged);document.querySelector(".zg-explore-indicator")?.remove();if(exploreMode){const d=document.createElement("div");d.className="zg-explore-indicator";d.textContent="✦ 星系探索已开启 · 点击任意问题旁的“星系”";document.documentElement.appendChild(d);injectBadges();}}
  function injectBadges(){if(!exploreMode)return;const links=[...document.querySelectorAll("a[href*='/question/']")],used=new Set();for(const a of links){if(a.dataset.zgBadged==="1"||a.closest("#zg-root"))continue;const id=questionIdFromUrl(a.href);if(!id)continue;const text=a.textContent?.trim()||"",rect=a.getBoundingClientRect();if(text.length<6||text.length>180||rect.width<80||rect.height<12)continue;const localKey=`${id}:${Math.round(rect.top)}`;if(used.has(localKey))continue;used.add(localKey);const badge=document.createElement("span");badge.className="zg-inline-badge";badge.textContent="✦ 星系";badge.title="在三维语义星系中探索这个问题";badge.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();const u=new URL(a.href,location.href);u.hash="zhihu-galaxy";location.href=u.toString();});a.insertAdjacentElement("afterend",badge);a.dataset.zgBadged="1";}}

  chrome.runtime.onMessage.addListener(msg=>{if(msg?.type!=="ZH_GALAXY_ACTION")return;if(document.getElementById("zg-root")){currentSession=null;Engine.close();setTimeout(ensureQuestionPill,100);return;}if(isQuestionPage())openGalaxy();else toggleExploreMode();});
  const observer=new MutationObserver(()=>{ensureQuestionPill();if(exploreMode)injectBadges();});observer.observe(document.documentElement,{subtree:true,childList:true});
  setInterval(()=>{if(location.href!==lastUrl){lastUrl=location.href;currentSession=null;setTimeout(()=>{ensureQuestionPill();if(location.hash.includes("zhihu-galaxy"))openGalaxy();if(exploreMode)injectBadges();},450);}},450);
  ensureQuestionPill();if(location.hash.includes("zhihu-galaxy"))setTimeout(openGalaxy,650);
})();
