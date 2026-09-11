/* Zhihu Galaxy 0.6 — pure, dependency-free layout / attention / journal contracts. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ZGCore = api;
})(globalThis, () => {
  'use strict';
  const VERSION = 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  const clone = x => JSON.parse(JSON.stringify(x));
  const safeUrl = url => { try { const u = new URL(url); return u.protocol === 'https:' && /^(www\.)?zhihu\.com$/.test(u.hostname) ? u.href : ''; } catch { return ''; } };
  const text = (s, n = 400) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  const allNodes = g => [...g.keywords, ...g.phenomena, ...g.satellites];

  // A deterministic best-candidate sampler. Existing points are NEVER re-simulated.
  function placeNode(node, occupied, center, minR, maxR, count = 42) {
    const seed = hash(node.id) / 4294967296, ga = Math.PI * (3 - Math.sqrt(5));
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < count; i++) {
      const y = 1 - 2 * ((i + .5) / count), rr = Math.sqrt(1 - y * y), a = ga * i + seed * Math.PI * 2;
      const r = minR + (maxR - minR) * ((seed + i * .61803398875) % 1);
      const p = {x: center.x + r * rr * Math.cos(a), y: center.y + r * y, z: center.z + r * rr * Math.sin(a)};
      let clearance = Infinity;
      for (const other of occupied) {
        const weight = node.type === 'answer' && other.type === 'answer' ? 1 : 1.65;
        clearance = Math.min(clearance, dist(p, other.pos) / weight);
      }
      // Avoid piling nodes at the question centre, even when there are no neighbours.
      clearance = Math.min(clearance, Math.hypot(p.x, p.y, p.z) * .8);
      const score = clearance - (node.type === 'answer' ? (r - minR) * .1 : 0);
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best;
  }
  function worldLayout(graph, fixed = new Map()) {
    const occupied = [], index = new Map(allNodes(graph).map(n => [n.id, n]));
    for (const n of allNodes(graph)) if (fixed.has(n.id)) { n.pos = {...fixed.get(n.id)}; occupied.push(n); }
    for (const n of graph.keywords) if (!fixed.has(n.id)) {
      n.pos = placeNode(n, occupied, {x:0,y:0,z:0}, 48, 59, 72); occupied.push(n);
    }
    for (const n of graph.phenomena) if (!fixed.has(n.id)) {
      const ps = (n.parents || []).map(id => index.get(id)?.pos).filter(Boolean);
      const avg = ps.length ? {x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length,z:ps.reduce((s,p)=>s+p.z,0)/ps.length} : {x:0,y:0,z:0};
      n.pos = placeNode(n, occupied, avg, 7, 21, 48); occupied.push(n);
    }
    for (const n of graph.satellites) if (!fixed.has(n.id)) {
      const center = index.get(n.parent)?.pos || {x:0,y:0,z:0};
      n.pos = placeNode(n, occupied, center, 7, 18, 32); occupied.push(n);
    }
    return graph;
  }

  function overlap(a, b, gap = 0) { return a.x < b.x+b.w+gap && a.x+a.w+gap > b.x && a.y < b.y+b.h+gap && a.y+a.h+gap > b.y; }
  function inside(r, bounds) { return r.x >= bounds.x && r.y >= bounds.y && r.x+r.w <= bounds.x+bounds.w && r.y+r.h <= bounds.y+bounds.h; }
  // Projection compensation is in pixels, not world coordinates. It cannot change the path data.
  function spreadScreen(input, bounds, maxShift = 46) {
    const pts = input.map(p => ({...p, ax:p.x, ay:p.y}));
    for (let it = 0; it < 9; it++) {
      const buckets = new Map(), size = 34;
      for (let i = 0; i < pts.length; i++) { const p=pts[i],k=`${Math.floor(p.x/size)},${Math.floor(p.y/size)}`; if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(i); }
      for (let i=0;i<pts.length;i++) {
        const p=pts[i],bx=Math.floor(p.x/size),by=Math.floor(p.y/size);
        for(let ix=-1;ix<=1;ix++)for(let iy=-1;iy<=1;iy++)for(const j of buckets.get(`${bx+ix},${by+iy}`)||[]) {
          if(j<=i)continue;const q=pts[j];let dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);const min=(p.r||5)+(q.r||5)+9;
          if(d>=min)continue;if(d<.001){const a=hash(p.id+q.id)%628/100;dx=Math.cos(a);dy=Math.sin(a);d=1;}
          const f=(min-d)*.51, ux=dx/d*f,uy=dy/d*f;
          if(!p.locked){p.x-=ux;p.y-=uy;}if(!q.locked){q.x+=ux;q.y+=uy;}
        }
      }
      for(const p of pts){if(p.locked)continue;let dx=p.x-p.ax,dy=p.y-p.ay,d=Math.hypot(dx,dy);if(d>maxShift){p.x=p.ax+dx/d*maxShift;p.y=p.ay+dy/d*maxShift;}
        p.x=clamp(p.x,bounds.x+8,bounds.x+bounds.w-8);p.y=clamp(p.y,bounds.y+8,bounds.y+bounds.h-8);
      }
    }
    return pts;
  }
  function packBox(anchor, width, height, bounds, occupied, previous, maxDistance = 240) {
    const candidates = [];
    if(previous && Math.hypot(previous.x-anchor.x,previous.y-anchor.y) < maxDistance) candidates.push(previous);
    for(const d of [18,44,82,132,190]) {
      candidates.push({x:anchor.x+d,y:anchor.y-height/2},{x:anchor.x-width-d,y:anchor.y-height/2},
        {x:anchor.x-width/2,y:anchor.y-height-d},{x:anchor.x-width/2,y:anchor.y+d},
        {x:anchor.x+d,y:anchor.y-height-d},{x:anchor.x-width-d,y:anchor.y+d});
    }
    for(const p of candidates){const r={x:p.x,y:p.y,w:width,h:height};if(inside(r,bounds)&&!occupied.some(o=>overlap(r,o,7)))return r;}
    return null;
  }

  // Sparse outer regions are preferable to hiding a summary in a crowded cluster.
  function packFreeBox(anchor,width,height,bounds,occupied,previous){
    if(previous&&inside(previous,bounds)&&!occupied.some(o=>overlap(previous,o,7)))return previous;
    const candidates=[];
    for(let x=bounds.x;x+width<=bounds.x+bounds.w;x+=34)for(let y=bounds.y;y+height<=bounds.y+bounds.h;y+=30){
      const r={x,y,w:width,h:height};
      const dx=anchor.x-clamp(anchor.x,x,x+width),dy=anchor.y-clamp(anchor.y,y,y+height);
      candidates.push({r,d:Math.hypot(dx,dy)});
    }
    candidates.sort((a,b)=>a.d-b.d);
    for(const {r}of candidates)if(!occupied.some(o=>overlap(r,o,7)))return r;
    return null;
  }

  class PreviewController {
    constructor() { this.active = null; this.pinned = null; this.candidate = null; this.since = 0; this.lastValid = 0; }
    update({now, explicit = null, candidate = null, validIds = new Set(), holdMs = 1800}) {
      if(this.pinned && validIds.has(this.pinned)) return this.active=this.pinned;
      if(explicit && validIds.has(explicit)) { this.active=explicit;this.candidate=explicit;this.lastValid=now;return this.active; }
      if(candidate !== this.candidate){this.candidate=candidate;this.since=now;}
      if(candidate && validIds.has(candidate) && (this.active===null || now-this.since >= 200)){
        if(!this.active || candidate===this.active || now-this.lastValid>=holdMs){this.active=candidate;this.lastValid=now;}
      }
      if(this.active && !validIds.has(this.active) && now-this.lastValid>holdMs)this.active=null;
      return this.active;
    }
  }

  function freshState() { return {schemaVersion:VERSION,revision:0,createdAt:new Date().toISOString(),consent:{recordTrail:true,profiling:false,sharing:false},questions:{},events:[],bookmarks:[],settings:{},profile:null}; }
  function questionRecord(q){if(!q||['__proto__','constructor','prototype'].includes(String(q.id)))throw new Error('无效问题 ID');return {id:text(q.id,160),title:text(q.title,400),url:safeUrl(q.url)};}
  function nodeRecord(n){return {id:text(n?.id,180),type:['keyword','phenomenon','answer','question'].includes(n?.type)?n.type:'question',label:text(n?.label,180),answerId:n?.answerId?text(n.answerId,180):null,parentIds:(n?.parentIds||[]).slice(0,8).map(x=>text(x,180)),position:n?.position&&['x','y','z'].every(k=>Number.isFinite(n.position[k]))?{x:n.position.x,y:n.position.y,z:n.position.z}:null};}
  const EVENT_KINDS = new Set(['visit','read','bookmark','open_source']);
  function eventRecord(e){if(!EVENT_KINDS.has(e.kind))throw new Error('未知轨迹事件');return {id:text(e.id||uid('e'),180),schemaVersion:1,sessionId:text(e.sessionId,180),questionId:text(e.questionId,160),at:text(e.at||new Date().toISOString(),40),kind:e.kind,node:nodeRecord(e.node),dwellMs:clamp(Number(e.dwellMs)||0,0,3600000),source:['pointer','keyboard','search','review','preview','panel'].includes(e.source)?e.source:'panel'};}
  function bookmarkRecord(b){
    const exact=text(b.selector?.exact || b.exact,3000).trim();if(!exact)throw new Error('不能保存空片段');
    return {id:text(b.id||uid('b'),180),schemaVersion:1,questionId:text(b.questionId,160),questionTitle:text(b.questionTitle,400),answerId:text(b.answerId,180),nodeId:text(b.nodeId,180),author:text(b.author,180),sourceUrl:safeUrl(b.sourceUrl),createdAt:text(b.createdAt||new Date().toISOString(),40),updatedAt:text(b.updatedAt||new Date().toISOString(),40),kind:b.kind==='selection'?'selection':'lead',selector:{type:'TextQuoteSelector',exact,prefix:text(b.selector?.prefix,80),suffix:text(b.selector?.suffix,80)},position:b.position&&Number.isInteger(b.position.start)&&b.position.start>=0&&Number.isInteger(b.position.end)&&b.position.end>=b.position.start?{start:b.position.start,end:b.position.end,unit:'utf16'}:null,textHash:text(b.textHash,100),note:text(b.note,2000),tags:Array.isArray(b.tags)?b.tags.slice(0,12).map(x=>text(x,40)).filter(Boolean):[],reviewedAt:b.reviewedAt?text(b.reviewedAt,40):null};
  }
  function reduce(state, action) {
    if(state?.schemaVersion!==VERSION)throw new Error('不支持的轨迹数据版本，请先导出备份');
    const s=clone(state);const p=action.payload||{};
    switch(action.type){
      case 'question': {const q=questionRecord(p);if(!q.id)throw new Error('缺少问题 ID');s.questions[q.id]=q;break;}
      case 'event': {if(!s.consent.recordTrail)return s;const e=eventRecord(p);if(!s.events.some(x=>x.id===e.id))s.events.push(e);if(s.events.length>5000)s.events.splice(0,s.events.length-5000);break;}
      case 'bookmark': {const b=bookmarkRecord(p);const old=s.bookmarks.find(x=>x.questionId===b.questionId&&x.answerId===b.answerId&&x.selector.exact===b.selector.exact);if(old)break;if(s.bookmarks.length>=600)throw new Error('已达 600 条收藏上限，请先导出并整理收藏');s.bookmarks.push(b);break;}
      case 'bookmark.update': {const b=s.bookmarks.find(x=>x.id===p.id);if(!b)throw new Error('收藏不存在');if('note'in p)b.note=text(p.note,2000);if('tags'in p)b.tags=Array.isArray(p.tags)?p.tags.slice(0,12).map(x=>text(x,40)).filter(Boolean):[];if('reviewedAt'in p)b.reviewedAt=p.reviewedAt?text(p.reviewedAt,40):null;b.updatedAt=new Date().toISOString();break;}
      case 'bookmark.delete': s.bookmarks=s.bookmarks.filter(b=>b.id!==p.id);break;
      case 'settings': { const keys=['motion','cardCount','fontScale','showTrail','autoFocus','recordTrail','attraction','repulsion','nodeScale','answerScale','rotationSpeed','zoomSpeed','holoScale','holoOpacity','glow','starDensity','theme','customPalette','layoutFrozen','showReadingDock','sortMode','randomSeed','previewAfter','batchSize','maxAnswers'];for(const k of keys)if(k in p)s.settings[k]=p[k];if(globalThis.ZGSpatial)s.settings=globalThis.ZGSpatial.cleanSettings(s.settings);if('recordTrail'in p)s.consent.recordTrail=!!p.recordTrail;break; }
      case 'clear_question': s.events=s.events.filter(e=>e.questionId!==p.questionId);break;
      case 'clear_all': return {...freshState(),revision:s.revision+1};
      case 'import': {const incoming=validateImport(p);for(const q of Object.values(incoming.questions||{})){const qr=questionRecord(q);s.questions[qr.id]=qr;}const ei=new Set(s.events.map(e=>e.id));for(const raw of incoming.events){const e=eventRecord(raw);if(!ei.has(e.id)){s.events.push(e);ei.add(e.id);}}
        for(const raw of incoming.bookmarks){const b=bookmarkRecord(raw);if(!s.bookmarks.some(x=>x.questionId===b.questionId&&x.answerId===b.answerId&&x.selector.exact===b.selector.exact)){if(s.bookmarks.some(x=>x.id===b.id))b.id=uid('b');s.bookmarks.push(b);}}
        if(s.bookmarks.length>600)throw new Error('导入后超过 600 条收藏上限');s.events=s.events.slice(-5000);break;}
      default: throw new Error('未知存储操作');
    }
    s.profile=null;s.consent.profiling=false;s.consent.sharing=false;s.revision++;
    // Reserve space for the existing extension's settings; never evict a bookmark.
    if(new TextEncoder().encode(JSON.stringify(s)).length>7*1024*1024)throw new Error('本地存储预算已满，请先导出并整理内容；本次没有覆盖原数据');
    return s;
  }
  function validateImport(s){
    if(!s||s.schemaVersion!==1||!Array.isArray(s.events)||!Array.isArray(s.bookmarks)||typeof s.questions!=='object'||!s.questions)throw new Error('不是受支持的 v1 轨迹 JSON');
    if(s.events.length>20000||s.bookmarks.length>600||Object.keys(s.questions).length>3000)throw new Error('导入数据超过安全上限');
    for(const e of s.events)if(!e||!e.node||!EVENT_KINDS.has(e.kind))throw new Error('轨迹事件格式错误');
    for(const b of s.bookmarks)if(!b||typeof b.selector?.exact!=='string'||b.selector.exact.length>3000)throw new Error('收藏片段格式错误');
    return s;
  }
  function scopeState(s,qid=null){const out=clone(s);if(qid){out.events=out.events.filter(e=>e.questionId===qid);out.bookmarks=out.bookmarks.filter(b=>b.questionId===qid);out.questions=Object.fromEntries(Object.entries(out.questions).filter(([id])=>id===qid));}out.exportedAt=new Date().toISOString();out.exportScope=qid||'all';out.profile=null;return out;}
  function exportMarkdown(s,qid=null){
    const data=scopeState(s,qid),md=s=>String(s||'').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;'),lines=['# 知乎星系 · 知识行囊','',`导出时间：${data.exportedAt}`,`收藏 ${data.bookmarks.length} 条；轨迹事件 ${data.events.length} 条。浏览和停留不等于认可。`,''];
    for(const b of data.bookmarks){lines.push(`## ${md(b.questionTitle)}`,'',`作者：${md(b.author)} ｜ ${b.kind==='selection'?'原文选段':'段首摘录'} ｜ ${b.reviewedAt?'已复习':'待学习'}`,'',...b.selector.exact.split('\n').map(l=>`> ${md(l)}`),'');if(b.sourceUrl)lines.push(`[知乎原回答](${b.sourceUrl.replace(/\(/g,'%28').replace(/\)/g,'%29')})`,'');if(b.note)lines.push(`**我的笔记**：${md(b.note)}`,'');if(b.tags.length)lines.push(`标签：${b.tags.map(md).join('、')}`,'');lines.push(`收藏时间：${b.createdAt}`,'');}
    lines.push('---','轨迹与选择器的完整结构保存在 JSON 导出中；本文件中的摘录不是生成的总结。');return lines.join('\n');
  }
  // Reserved interface: no inference, no identity, no embedding, no network access.
  function profileInput(s){return {schemaVersion:1,status:'not_implemented',subjectId:null,consent:{profiling:false,sharing:false},observationSchema:'schemas/profile-input.schema.json',observations:[],inferredTraits:null,embedding:null};}
  function anchorFor(full, exact){const start=full.indexOf(exact);return {selector:{type:'TextQuoteSelector',exact,prefix:start>=0?full.slice(Math.max(0,start-80),start):'',suffix:start>=0?full.slice(start+exact.length,start+exact.length+80):''},position:start>=0?{start,end:start+exact.length,unit:'utf16'}:null,textHash:`fnv1a32:${hash(full).toString(16)}`};}
  return {VERSION,clamp,hash,uid,clone,safeUrl,text,dist,allNodes,worldLayout,spreadScreen,overlap,inside,packBox,packFreeBox,PreviewController,freshState,reduce,validateImport,scopeState,exportMarkdown,profileInput,anchorFor};
});
