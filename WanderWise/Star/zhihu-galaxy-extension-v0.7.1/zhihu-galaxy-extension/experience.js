/* 0.6: world-space identity, screen-space readability, local-only knowledge trails. */
(() => {
  'use strict';
  const C=globalThis.ZGCore, E=globalThis.ZhihuGalaxyEngine;
  const {clamp}=C, F='-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
  const TYPE={keyword:{color:'#82a8d5',name:'主题',alpha:.9},phenomenon:{color:'#bba4d6',name:'交汇观点',alpha:.86},answer:{color:'#72c5bc',name:'回答',alpha:.76}};
  const DEFAULT={sortMode:'votes',previewAfter:20,batchSize:12,maxAnswers:100,motion:'comfort',cardCount:3,fontScale:1,showTrail:true,autoFocus:false,recordTrail:true};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('zh-CN'):'—';
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>{const l=Math.hypot(a.x,a.y,a.z)||1;return{x:a.x/l,y:a.y/l,z:a.z/l};};

  class GalaxyExplorer {
    constructor(graph,options={}) {
      this.graph=C.worldLayout(graph);this.options=options;this.settings={...DEFAULT,...options.settings};
      this.theta=.55;this.phi=1.12;this.radius=145;this.targetRadius=145;this.look={x:0,y:0,z:0};
      this.history=[];this.selected=null;this.hover=null;this.preview=new C.PreviewController();this.previewHold=null;
      this.keys=new Set();this.drag=null;this.pointerAt=null;this.screen=[];this.hits=[];this.boxCache=new Map();this.cardCache=new Map();
      this.filter='all';this.search='';this.matches=new Set();this.panelMode=null;this.panelPage=20;this.reviewTab='bookmarks';this.reviewScope='current';
      this.dirty=true;this.running=true;this.last=performance.now();this.lastUserAt=Date.now();this.sessionId=C.uid('session');this.dwell=null;this.readRecorded=new Set();
      this.state=C.freshState();this.journal=globalThis.ZGJournal.client();this.validAnswerIds=new Set();this.lastPreviewRefresh=0;this.cardsIds=[];
      this.bound=[];this.metrics={};this.renderShell();this.indexGraph();this.resize();
      this.media=matchMedia('(prefers-reduced-motion: reduce)');this.listen(this.media,'change',()=>this.applyAppearance());this.applyAppearance();
      this.unsubscribe=this.journal.subscribe(s=>this.acceptState(s));
      this.ready=this.journal.dispatch({type:'question',payload:this.questionInfo()}).then(s=>{this.acceptState(s);this.storageReady=true;this.settings={...this.settings,...s.settings};this.applyAppearance();return s;}).catch(e=>{this.storageError=e;this.toast(`轨迹暂不能保存：${e.message}`,8000);return this.state;});
      this.setProgress(options.progress||{phase:'ready',loaded:graph.answers.length,source:graph.question.source});
      this.timer=setInterval(()=>this.tickReading(),500);this.frameHandle=requestAnimationFrame(t=>this.frame(t));
    }
    $(selector){return this.root.querySelector(selector);}
    listen(target,type,fn,opts){target.addEventListener(type,fn,opts);this.bound.push(()=>target.removeEventListener(type,fn,opts));}
    questionInfo(){const q=this.graph.question;return{id:String(q.id||`local-${C.hash(q.title)}`),title:q.title||'知乎问题',url:/^\d+$/.test(String(q.id))?`https://www.zhihu.com/question/${q.id}`:''};}
    renderShell(){
      this.root=document.createElement('section');this.root.id='zg-root';this.root.setAttribute('aria-label','知乎问题星系');this.root.__zgApp=this;
      this.root.innerHTML=`
        <div class="zg-stage"><canvas class="zg-canvas" tabindex="0" aria-label="问题星系。拖拽或 WASD 转向，滚轮缩放；所有内容也可从主题目录和搜索中访问。"></canvas></div>
        <header class="zg-topbar"><div class="zg-brand"><div class="zg-kicker"><span class="zg-brand-mark">✧</span> 知乎问题星系 <span> / SEMANTIC GALAXY · 0.6</span></div><h1 class="zg-title"></h1></div>
          <nav class="zg-actions"><button data-action="directory">主题目录</button><button data-action="review" class="zg-journal-button">✧ 知识行囊 <span class="zg-saved-count">0</span></button><button data-action="settings" aria-label="设置">设置</button><button data-action="back">← 返回</button><button data-action="close" class="zg-close" aria-label="关闭星系">×</button></nav></header>
        <div class="zg-toolbar"><div class="zg-search-wrap"><span aria-hidden="true">⌕</span><input class="zg-search" type="search" placeholder="找关键词，或原文里的那句话…" aria-label="搜索已载入的主题和回答"><kbd>/</kbd></div><div class="zg-filters" aria-label="筛选"><button data-action="filter" data-value="all" aria-pressed="true">全部</button><button data-action="filter" data-value="unvisited" aria-pressed="false">未到访</button><button data-action="filter" data-value="saved" aria-pressed="false">已收藏</button></div><div class="zg-legend"><span><i class="zg-dot-keyword"></i>主题</span><span><i class="zg-dot-phenomenon"></i>交汇观点</span><span><i class="zg-dot-answer"></i>回答</span><span><i class="zg-dot-trail"></i>你的轨迹</span></div></div>
        <div class="zg-aim" aria-hidden="true"><i></i></div><div class="zg-label-layer" aria-hidden="true"></div><div class="zg-callouts"></div>
        <aside class="zg-panel" hidden aria-label="内容与知识行囊"></aside>
        <section class="zg-reading-dock" aria-label="稳定阅读卡"><div class="zg-dock-heading"><span>视野拾光</span><button data-action="lock" title="固定本卡，不随指向切换">固定</button></div><button class="zg-dock-body" data-action="read-active"><span class="zg-empty">将鼠标停在青色回答上，或让它靠近视野中央。</span></button><div class="zg-dock-footer"><span class="zg-dock-meta">先读片段，再决定是否深入</span><button data-action="next-preview" title="下一条附近回答">下一条</button><button data-action="save-active">＋ 行囊</button></div></section>
        <div class="zg-view-controls"><button data-action="home" title="回到全貌">⌂</button><span>全貌</span><input class="zg-range" type="range" min="0" max="100" value="8" aria-label="观测距离，向下深入"><span>深入</span><button data-action="toggle-trail" aria-pressed="true" title="显示或隐藏轨迹线">⌁</button></div>
        <div class="zg-route-pill"><button data-action="trail"><span class="zg-route-count">0</span> 站航迹 <span>→</span></button><small>只在此设备保存</small></div>
        <footer class="zg-bottom"><div class="zg-status" role="status"></div><div class="zg-help">拖拽 / WASD 转向 · 滚轮缩放 · B 收藏当前摘录 · / 搜索</div></footer>
        <div class="zg-grow-toast" role="status" aria-live="polite" hidden></div>
        <button class="zg-clip-button" data-action="clip" hidden>保存选中文段</button>
        <dialog class="zg-settings"><form method="dialog"><div class="zg-settings-head"><div><b>阅读与加载设置</b><small>少一些运动，多一些能留下来的内容</small></div><button value="cancel" aria-label="关闭设置">×</button></div>
          <label>运动模式<select data-setting="motion"><option value="comfort">舒适 · 静止背景，慢速转向</option><option value="still">静读 · 锁定转向，即时定位</option><option value="explore">探索 · 较快手动转向</option></select></label>
          <label>空间摘要上限<select data-setting="cardCount"><option value="1">1 张</option><option value="2">2 张</option><option value="3">3 张</option><option value="4">4 张</option><option value="5">5 张</option></select></label>
          <label>文字尺寸<select data-setting="fontScale"><option value="1">标准</option><option value="1.15">大字</option><option value="1.3">更大</option></select></label>
          <label class="zg-checkbox"><input data-setting="autoFocus" type="checkbox">点击节点时自动平移到中央（不旋转）</label>
          <label class="zg-checkbox"><input data-setting="recordTrail" type="checkbox">记录本机探索轨迹（关闭后仍可主动收藏）</label>
          <div class="zg-form-divider"></div><label>回答优先顺序<select data-setting="sortMode"><option value="votes">最多赞</option><option value="latest">最新</option></select></label>
          <label>首批预览篇数<input data-setting="previewAfter" type="number" min="3" max="50"></label><label>每批新增回答<input data-setting="batchSize" type="number" min="3" max="30"></label><label>本次读取上限<input data-setting="maxAnswers" type="number" min="10" max="500"></label>
          <p class="zg-settings-note">操作系统要求减少动态效果时，自动关闭平移补间。最近观测距离仍为 52；不会因为选中回答而突然贴近。画像与跨用户匹配仅预留接口，均未启用。</p><button class="zg-primary" type="button" data-action="apply-settings">应用设置</button></form></dialog>
        <input class="zg-import-file" type="file" accept="application/json,.json" hidden>`;
      document.documentElement.appendChild(this.root);document.body?.classList.add('zg-lock-scroll');this.canvas=this.$('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false});this.panel=this.$('.zg-panel');this.slider=this.$('.zg-range');this.$('.zg-title').textContent=this.graph.question.title||'知乎问题';
      this.noteDrafts=new Map();this.listen(this.root,'input',e=>{const card=e.target.closest('.zg-bookmark');if(card)this.noteDrafts.set(card.dataset.id,{note:card.querySelector('textarea').value,tags:card.querySelector('.zg-tags-input').value});});
      this.listen(this.root,'click',e=>this.action(e));this.listen(this.canvas,'pointerdown',e=>this.pointerDown(e));this.listen(this.canvas,'pointermove',e=>this.pointerMove(e));this.listen(this.canvas,'pointerup',e=>this.pointerUp(e));this.listen(this.canvas,'pointercancel',()=>{this.drag=null;});
      this.listen(this.canvas,'pointerleave',()=>{if(!this.drag){this.hover=null;this.pointerAt=null;this.dirty=true;}});this.listen(this.canvas,'wheel',e=>this.wheel(e),{passive:false});
      this.listen(this.slider,'input',()=>{this.targetRadius=158*Math.pow(52/158,Number(this.slider.value)/100);if(this.reduced)this.radius=this.targetRadius;this.cameraAnim=null;this.dirty=true;this.lastUserAt=Date.now();});
      this.listen(window,'resize',()=>this.resize());this.listen(window,'keydown',e=>this.keydown(e),true);this.listen(window,'keyup',e=>this.keys.delete(e.key.toLowerCase()),true);
      this.listen(window,'blur',()=>{this.keys.clear();this.drag=null;this.dwell=null;});this.listen(document,'visibilitychange',()=>{this.keys.clear();this.dwell=null;this.last=performance.now();this.dirty=true;});
      this.listen(this.$('.zg-search'),'input',()=>{clearTimeout(this.searchTimer);this.searchTimer=setTimeout(()=>this.searchChanged(),120);});
      this.listen(document,'selectionchange',()=>this.captureSelection());this.listen(this.$('.zg-clip-button'),'pointerdown',e=>e.preventDefault());
      this.listen(this.root,'pointerover',e=>{const el=e.target.closest('.zg-quote');if(el){this.previewHold=el.dataset.answerId;this.lastUserAt=Date.now();}});
      this.listen(this.root,'pointerout',e=>{if(e.target.closest('.zg-quote')&&!e.relatedTarget?.closest?.('.zg-quote'))this.previewHold=null;});
      this.listen(this.$('.zg-import-file'),'change',e=>this.importJSON(e));
      this.listen(this.$('.zg-settings'),'close',()=>{this.keys.clear();this.dirty=true;});
      this.listen(this.panel,'scroll',()=>this.lastUserAt=Date.now(),{passive:true});
    }
    indexGraph(){this.nodes=C.allNodes(this.graph);this.nodeMap=new Map(this.nodes.map(n=>[n.id,n]));this.validAnswerIds=new Set(this.graph.satellites.map(n=>n.id));this.answerNodes=new Map(this.graph.satellites.map(n=>[n.answerId,n]));this.dirty=true;}
    nodeById(id){return this.nodeMap.get(id)||null;}
    resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);const d=Math.min(2,devicePixelRatio||1);this.canvas.width=this.w*d;this.canvas.height=this.h*d;this.ctx.setTransform(d,0,0,d,0,0);this.boxCache.clear();this.cardCache.clear();this.syncSlider();this.dirty=true;}
    applyAppearance(){this.reduced=this.settings.motion==='still'||this.media?.matches;this.root.classList.toggle('zg-reduced',!!this.reduced);this.root.classList.toggle('zg-still',this.settings.motion==='still');this.root.style.setProperty('--zg-font-scale',String(clamp(Number(this.settings.fontScale)||1,1,1.3)));this.root.dataset.motion=this.settings.motion;this.dirty=true;this.lastDockId=null;}
    acceptState(s){if(!s||s.schemaVersion!==1||s.revision<this.state.revision)return;this.state=s;const qid=this.questionInfo().id;this.bookmarked=new Set(s.bookmarks.filter(b=>b.questionId===qid).map(b=>b.answerId));this.visited=new Set(s.events.filter(e=>e.questionId===qid&&e.kind==='visit'&&e.node.type==='answer').map(e=>e.node.answerId));this.$('.zg-saved-count').textContent=s.bookmarks.length;this.$('.zg-route-count').textContent=s.events.filter(e=>e.questionId===qid&&e.kind==='visit').length;this.dirty=true;this.lastDockId=null;
      if(this.panelMode==='review'&&!this.panel.querySelector('textarea:focus,input:focus'))this.showReview(false);
    }
    async mutate(action){await this.ready;if(this.storageError)throw this.storageError;const s=await this.journal.dispatch(action);this.acceptState(s);return s;}
    nodeInfo(n){return{id:n.id,type:n.type,label:n.type==='answer'?this.lead(this.graph.byAnswer.get(n.answerId)):n.label,answerId:n.answerId||null,parentIds:n.parent?[n.parent]:(n.parents||[]),position:n.pos?{...n.pos}:null};}
    record(kind,n,source='panel',dwellMs=0){if(!n)return;const e={id:C.uid('e'),sessionId:this.sessionId,questionId:this.questionInfo().id,at:new Date().toISOString(),kind,node:this.nodeInfo(n),source,dwellMs};this.mutate({type:'event',payload:e}).catch(err=>this.toast(`轨迹没有写入：${err.message}`,5000));}
    lead(a){if(!a)return '';const t=a.text||'',candidate=String(a.lead||'').replace(/…$/,'').trim();if(candidate&&t.includes(candidate))return candidate+(a.lead.endsWith('…')?'…':'');return E.firstParagraphLead(t)||t.slice(0,71);}
    urlFor(a){return C.safeUrl(a?.url)||(/^\d+$/.test(String(a?.id))&&/^\d+$/.test(this.questionInfo().id)?`https://www.zhihu.com/question/${this.questionInfo().id}/answer/${a.id}`:'');}
    tickReading(){
      if(!this.running||document.hidden||!document.hasFocus()||Date.now()-this.lastUserAt>60000||this.$('.zg-settings').open){this.dwell=null;return;}
      const id=this.panelMode==='node'&&this.selected?.type==='answer'?this.selected.id:this.preview.active;
      if(!id||!this.nodeMap.has(id)){this.dwell=null;return;}
      if(this.dwell?.id!==id){this.dwell={id,start:Date.now()};return;}
      const elapsed=Date.now()-this.dwell.start;
      if(elapsed>=8000&&!this.readRecorded.has(id)){this.readRecorded.add(id);this.record('read',this.nodeById(id),this.panelMode==='node'?'panel':'preview',elapsed);}
    }
    toast(message,ms=2600){const el=this.$('.zg-grow-toast');el.textContent=message;el.hidden=false;clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.hidden=true,ms);}
    setProgress(p={}){this.progress=p;const a=this.graph.answers.length,k=this.graph.keywords.length,v=this.graph.phenomena.length;this.$('.zg-status').textContent=`${p.phase==='loading'?'补充中 · ':''}${a} 篇回答 · ${k} 个主题 · ${v} 个交汇观点${p.source?` · ${p.source}`:''}`;}
    populateSettings(){for(const [k,v]of Object.entries(this.settings)){const el=this.$(`[data-setting="${k}"]`);if(el){if(el.type==='checkbox')el.checked=!!v;else el.value=String(v);}}}
    async applySettings(){
      const read=(k,a,b)=>clamp(Number(this.$(`[data-setting="${k}"]`).value)||this.settings[k],a,b);
      const next={...this.settings,motion:this.$('[data-setting="motion"]').value,cardCount:read('cardCount',1,5),fontScale:read('fontScale',1,1.3),previewAfter:read('previewAfter',3,50),batchSize:read('batchSize',3,30),maxAnswers:read('maxAnswers',10,500),sortMode:this.$('[data-setting="sortMode"]').value,autoFocus:this.$('[data-setting="autoFocus"]').checked,recordTrail:this.$('[data-setting="recordTrail"]').checked};
      this.settings=next;this.$('.zg-settings').close();this.applyAppearance();this.keys.clear();this.cardCache.clear();
      try{await this.mutate({type:'settings',payload:next});await this.options.onSettingsChange?.(next,this);this.toast('设置已保存；既有节点与收藏保留');}catch(e){this.toast(`设置未能保存：${e.message}`,6000);}
    }
    async action(e){
      const el=e.target.closest('[data-action]');if(!el)return;const action=el.dataset.action;this.lastUserAt=Date.now();
      try{
        if(action==='close'){E.close();return;}
        if(action==='back'){this.back();return;}
        if(action==='home'){this.home();return;}
        if(action==='settings'){this.keys.clear();this.populateSettings();this.$('.zg-settings').showModal();return;}
        if(action==='apply-settings'){await this.applySettings();return;}
        if(action==='directory'){this.showDirectory();return;}
        if(action==='panel-close'){this.closePanel();return;}
        if(action==='node'){this.focus(this.nodeById(el.dataset.id),{source:el.dataset.source||'panel'});return;}
        if(action==='center'){if(this.selected)this.center(this.selected);return;}
        if(action==='filter'){this.filter=el.dataset.value;for(const b of this.root.querySelectorAll('.zg-filters button'))b.setAttribute('aria-pressed',String(b.dataset.value===this.filter));this.dirty=true;this.lastPreviewRefresh=0;if(this.filter==='saved'){this.reviewTab='bookmarks';this.reviewScope='current';this.showReview();}return;}
        if(action==='lock'){this.preview.pinned=this.preview.pinned?null:this.preview.active;this.lastDockId=null;this.dirty=true;return;}
        if(action==='read-active'){if(this.preview.active)this.focus(this.nodeById(this.preview.active),{source:'preview'});return;}
        if(action==='save-active'){const n=this.nodeById(this.preview.active);if(n)await this.saveLead(n.answerId);else this.toast('先指向一颗青色回答');return;}
        if(action==='next-preview'){this.nextPreview();return;}
        if(action==='save-lead'){e.stopPropagation();await this.saveLead(el.dataset.answerId);return;}
        if(action==='clip'){await this.saveSelection();return;}
        if(action==='more'){this.panelPage+=20;const scroll=this.panel.scrollTop;this.showPanel(this.selected);this.panel.scrollTop=scroll;return;}
        if(action==='source'){const n=this.answerNodes.get(el.dataset.answerId);this.record('open_source',n,'panel');return;}
        if(action==='toggle-trail'){this.settings.showTrail=!this.settings.showTrail;el.setAttribute('aria-pressed',String(this.settings.showTrail));await this.mutate({type:'settings',payload:{showTrail:this.settings.showTrail}});return;}
        if(action==='review'||action==='trail'){this.reviewTab=action==='trail'?'trail':'bookmarks';this.showReview();return;}
        if(action==='review-tab'){this.reviewTab=el.dataset.value;this.showReview();return;}
        if(action==='review-scope'){this.reviewScope=this.reviewScope==='current'?'all':'current';this.showReview();return;}
        if(action==='export-md'||action==='export-json'){await this.exportData(action==='export-md'?'md':'json');return;}
        if(action==='import'){this.$('.zg-import-file').click();return;}
        if(action==='note-save'){const card=el.closest('.zg-bookmark');await this.mutate({type:'bookmark.update',payload:{id:el.dataset.id,note:card.querySelector('textarea').value,tags:card.querySelector('.zg-tags-input').value.split(/[,，、]/).map(s=>s.trim()).filter(Boolean)}});this.noteDrafts.delete(el.dataset.id);this.showReview(false);this.toast('笔记已保存');return;}
        if(action==='reviewed'){const b=this.state.bookmarks.find(x=>x.id===el.dataset.id);if(b)await this.mutate({type:'bookmark.update',payload:{id:b.id,reviewedAt:b.reviewedAt?null:new Date().toISOString()}});return;}
        if(action==='remove-bookmark'){if(confirm('移除这条收藏及其笔记？轨迹记录会保留。'))await this.mutate({type:'bookmark.delete',payload:{id:el.dataset.id}});return;}
        if(action==='bookmark-jump'){const b=this.state.bookmarks.find(x=>x.id===el.dataset.id);if(!b)return;const n=b.questionId===this.questionInfo().id?this.answerNodes.get(b.answerId):null;if(n){this.focus(n,{source:'review'});this.highlightBookmark(b);}else this.toast('该回答不在本轮载入池中；已保存的片段仍可阅读，原文链接可返回来源',5000);return;}
        if(action==='trail-jump'){const event=this.state.events.find(x=>x.id===el.dataset.id);const n=event?.questionId===this.questionInfo().id?this.nodeById(event.node.id):null;if(n)this.focus(n,{source:'review'});else this.toast('这站不在当前问题或当前载入池中；可从收藏来源重新进入');return;}
        if(action==='clear-trail'){if(confirm('清除本问题的探索轨迹？已收藏的片段和笔记不会删除。'))await this.mutate({type:'clear_question',payload:{questionId:this.questionInfo().id}});return;}
        if(action==='clear-all'){if(confirm('删除本机所有星系轨迹、收藏和笔记？此操作不能撤销。请先导出 JSON 备份。')){await this.mutate({type:'clear_all'});this.toast('本机数据已清空');}return;}
      }catch(error){this.toast(error.message||String(error),6500);}
    }
    keydown(e){
      const input=e.target.closest?.('input,textarea,select,[contenteditable="true"]');
      if(this.$('.zg-settings').open)return;
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(input){e.target.blur();return;}if(this.pendingSelection){this.pendingSelection=null;this.$('.zg-clip-button').hidden=true;return;}if(this.panelMode){this.closePanel();return;}if(this.history.length){this.back();return;}E.close();return;}
      if(input||e.metaKey||e.ctrlKey||e.altKey)return;
      const k=e.key.toLowerCase();
      if(k==='/'){e.preventDefault();e.stopPropagation();this.$('.zg-search').focus();return;}
      if(k==='b'){e.preventDefault();e.stopPropagation();if(this.pendingSelection)this.saveSelection().catch(err=>this.toast(err.message));else{const n=this.nodeById(this.preview.active);if(n)this.saveLead(n.answerId).catch(err=>this.toast(err.message));}return;}
      if(k==='enter'&&e.target.closest?.('[data-action]')){e.target.closest('[data-action]').click();return;}
      if(['w','a','s','d'].includes(k)){e.preventDefault();e.stopPropagation();this.keys.add(k);this.cameraAnim=null;this.lastUserAt=Date.now();}
    }
    pointerDown(e){if(e.button!==0)return;this.canvas.focus({preventScroll:true});this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};this.canvas.setPointerCapture(e.pointerId);this.lastUserAt=Date.now();}
    pointerMove(e){
      const r=this.canvas.getBoundingClientRect();this.pointerAt={x:e.clientX-r.left,y:e.clientY-r.top};this.lastUserAt=Date.now();
      if(this.drag){const d=this.drag,dx=e.clientX-d.lastX,dy=e.clientY-d.lastY;d.lastX=e.clientX;d.lastY=e.clientY;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>4)d.moved=true;
        if(d.moved&&this.settings.motion!=='still'){const speed=this.settings.motion==='explore'?.003:.0017;this.theta-=clamp(dx,-50,50)*speed;this.phi=clamp(this.phi+clamp(dy,-50,50)*speed,.42,Math.PI-.42);this.cameraAnim=null;this.hover=null;this.dirty=true;}return;
      }
      const hit=this.findHits(this.pointerAt)[0];const node=hit?.node||null;if(this.hover?.id!==node?.id){this.hover=node;this.hoverSince=performance.now();this.dirty=true;this.canvas.classList.toggle('zg-hovering',!!node);}
    }
    pointerUp(e){const d=this.drag;if(!d)return;this.drag=null;try{this.canvas.releasePointerCapture(e.pointerId);}catch{}if(d.moved)return;
      const r=this.canvas.getBoundingClientRect(),hits=this.findHits({x:e.clientX-r.left,y:e.clientY-r.top});
      if(hits.length>1&&Math.abs(hits[0].distance-hits[1].distance)<8){this.showCluster(hits.slice(0,12).map(x=>x.node));return;}
      if(hits[0])this.focus(hits[0].node,{source:'pointer'});
    }
    findHits(p){return this.hits.map(h=>({...h,distance:Math.hypot(h.x-p.x,h.y-p.y)})).filter(h=>h.distance<=h.r+7||(h.labelBox&&C.overlap({x:p.x,y:p.y,w:1,h:1},h.labelBox))).sort((a,b)=>a.distance-b.distance);}
    wheel(e){e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?this.h:1,delta=clamp(e.deltaY*unit,-140,140);this.targetRadius=clamp(this.targetRadius*Math.exp(delta*.00125),52,158);if(this.reduced)this.radius=this.targetRadius;this.cameraAnim=null;this.lastUserAt=Date.now();this.dirty=true;}
    syncSlider(){this.slider.value=String(clamp(Math.log(this.radius/158)/Math.log(52/158)*100,0,100));}
    snapshot(){return{theta:this.theta,phi:this.phi,radius:this.radius,look:{...this.look},selected:this.selected?.id||null};}
    focus(n,{source='panel',center=false}={}){
      if(!n)return;if(this.selected?.id!==n.id){this.history.push(this.snapshot());if(this.history.length>80)this.history.shift();this.record('visit',n,source);}
      this.selected=n;this.panelPage=20;this.preview.pinned=null;this.lastUserAt=Date.now();this.lastPreviewRefresh=0;
      if(n.type==='answer'){this.preview.active=n.id;this.preview.lastValid=performance.now();this.lastDockId=null;}
      this.showPanel(n);if(center||this.settings.autoFocus)this.center(n);this.dirty=true;
    }
    center(n){if(!n?.pos)return;if(this.reduced){this.look={...n.pos};this.cameraAnim=null;}else this.cameraAnim={start:performance.now(),from:{...this.look},to:{...n.pos},duration:360};this.dirty=true;}
    back(){const s=this.history.pop();if(!s){this.home();return;}this.theta=s.theta;this.phi=s.phi;this.radius=this.targetRadius=s.radius;this.look={...s.look};this.selected=this.nodeById(s.selected);this.cameraAnim=null;this.preview.pinned=null;if(this.selected)this.showPanel(this.selected);else this.closePanel();this.syncSlider();this.dirty=true;}
    home(){this.history.push(this.snapshot());this.theta=.55;this.phi=1.12;this.radius=this.targetRadius=145;this.look={x:0,y:0,z:0};this.selected=null;this.preview.pinned=null;this.cameraAnim=null;this.closePanel();this.syncSlider();this.dirty=true;}
    openPanel(mode){this.panelMode=mode;this.panel.hidden=false;this.root.classList.add('zg-panel-open');this.pendingSelection=null;this.$('.zg-clip-button').hidden=true;this.dirty=true;}
    closePanel(){this.panelMode=null;this.panel.hidden=true;this.root.classList.remove('zg-panel-open');this.pendingSelection=null;this.$('.zg-clip-button').hidden=true;this.dirty=true;}
    panelHeader(kicker,title,extra=''){return `<div class="zg-panel-heading"><div><div class="zg-panel-kicker">${esc(kicker)}</div><h2>${esc(title)}</h2></div><button data-action="panel-close" aria-label="关闭侧栏">×</button></div>${extra}`;}
    relatedAnswers(node){
      const ids=new Set(node.answerIds||[]),children=new Set(this.graph.phenomena.filter(p=>p.parents?.includes(node.id)).map(n=>n.id));
      for(const n of this.graph.satellites)if(n.parent===node.id||children.has(n.parent))ids.add(n.answerId);
      return [...ids].map(id=>this.graph.byAnswer.get(String(id))).filter(Boolean).sort((a,b)=>(b.voteup_count||0)-(a.voteup_count||0));
    }
    showPanel(node){
      if(!node)return;this.openPanel('node');const a=node.type==='answer'?this.graph.byAnswer.get(node.answerId):null;
      if(a){this.panel.innerHTML=this.panelHeader('ANSWER / 回答原文',a.author||'知乎用户',`<div class="zg-panel-sub">${num(a.voteup_count)} 赞同 · ${a.text.length.toLocaleString()} 字已载入 <button data-action="center">定位到中央</button></div>`)+
        `<div class="zg-answer-highlight">${esc(this.lead(a))}</div><div class="zg-reading-actions"><button class="zg-primary" data-action="save-lead" data-answer-id="${esc(a.id)}">＋ 收藏段首摘录</button>${this.sourceLink(a)}</div><p class="zg-hint">拖选下面的原文，再点「保存选中文段」。这里仅显示已载入文本，不等同于完整文章。</p><div class="zg-original" data-answer-id="${esc(a.id)}">${esc(a.text)}</div><div class="zg-endnote">已载入文本到此。完整内容请查看知乎原回答。${this.sourceLink(a)}</div>`;
      }else{
        const ans=this.relatedAnswers(node),ps=node.type==='keyword'?this.graph.phenomena.filter(p=>p.parents?.includes(node.id)):[];
        this.panel.innerHTML=this.panelHeader(TYPE[node.type]?.name||'主题',node.label,`<div class="zg-panel-sub">${ans.length} 篇关联候选 · 点击下钻，不需要追着点飞 <button data-action="center">定位</button></div>`)+
          (ps.length?`<div class="zg-branch-grid">${ps.map(p=>`<button data-action="node" data-id="${esc(p.id)}"><i></i>${esc(p.label)} <small>${this.relatedAnswers(p).length}</small></button>`).join('')}</div>`:'')+
          `<div class="zg-section-label">从这些回答开始 <span>只摘原文，不生成金句</span></div>${ans.slice(0,this.panelPage).map(x=>this.answerCard(x)).join('')}${ans.length>this.panelPage?`<button class="zg-load-more" data-action="more">继续显示 ${Math.min(20,ans.length-this.panelPage)} 篇 · 共 ${ans.length} 篇</button>`:''}${!ans.length?'<p class="zg-empty">当前批次还没有可关联的回答。新回答到达后会补充。</p>':''}`;
      }
      this.panel.scrollTop=0;this.dirty=true;
    }
    sourceLink(a){const url=this.urlFor(a);return url?`<a class="zg-source-link" data-action="source" data-answer-id="${esc(a.id)}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">知乎原回答 ↗</a>`:'<span class="zg-hint">该页文本未提供可验证的原回答链接</span>';}
    answerCard(a,query=''){
      const saved=this.bookmarked?.has(a.id),n=this.answerNodes.get(a.id);let excerpt='';
      if(query){const i=a.text.toLowerCase().indexOf(query.toLowerCase());if(i>=0)excerpt=a.text.slice(Math.max(0,i-45),i+query.length+100);}
      return `<article class="zg-answer-card"><div class="zg-answer-meta"><span>${esc(a.author||'知乎用户')}</span><small>${num(a.voteup_count)} 赞同${saved?' · 已收藏':''}</small></div><button class="zg-answer-title" data-action="node" data-id="${esc(n?.id||'')}" data-source="${query?'search':'panel'}">${this.mark( this.lead(a),query)}</button>${excerpt?`<div class="zg-match-excerpt">${this.mark(excerpt,query)}</div>`:''}<div class="zg-card-footer"><button data-action="node" data-id="${esc(n?.id||'')}" data-source="${query?'search':'panel'}">读已载入原文 →</button><button data-action="save-lead" data-answer-id="${esc(a.id)}">${saved?'再存摘录':'＋ 行囊'}</button></div></article>`;
    }
    mark(s,q){if(!q)return esc(s);const i=s.toLowerCase().indexOf(q.toLowerCase());if(i<0)return esc(s);return esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+q.length))+'</mark>'+esc(s.slice(i+q.length));}
    showDirectory(){this.openPanel('directory');this.panel.innerHTML=this.panelHeader('INDEX / 主题目录','从有用的方向进入',`<p class="zg-hint">星系之外的稳定入口。拥挤或转向不舒服时，也能逐条浏览所有已载入回答。</p>`)+this.graph.keywords.map(n=>`<button class="zg-directory-item" data-action="node" data-id="${esc(n.id)}"><span>${esc(n.label)}</span><small>${this.relatedAnswers(n).length} 篇 →</small></button>`).join('')+`<div class="zg-section-label">全部 ${this.graph.answers.length} 篇回答</div>`+this.graph.answers.map(a=>this.answerCard(a)).join('');this.panel.scrollTop=0;}
    showCluster(nodes){this.openPanel('cluster');this.panel.innerHTML=this.panelHeader('NEARBY / 拥挤区域',`这里有 ${nodes.length} 个候选节点`)+`<p class="zg-hint">投影距离很近时，不替你猜。请直接选择要读的那一个。</p>`+nodes.map(n=>`<button class="zg-directory-item" data-action="node" data-id="${esc(n.id)}"><span>${esc(n.type==='answer'?this.lead(this.graph.byAnswer.get(n.answerId)):n.label)}</span><small>${TYPE[n.type].name}</small></button>`).join('');}
    searchChanged(){
      this.search=this.$('.zg-search').value.trim().slice(0,120);this.lastUserAt=Date.now();this.matches.clear();
      if(!this.search){if(this.panelMode==='search')this.closePanel();this.dirty=true;return;}
      const q=this.search.toLowerCase(),ns=this.nodes.filter(n=>n.type!=='answer'&&n.label.toLowerCase().includes(q)),ans=this.graph.answers.filter(a=>a.text.toLowerCase().includes(q)).sort((a,b)=>globalThis.ZGSpatial.compareAnswers(a,b,this.settings));
      ns.forEach(n=>this.matches.add(n.id));for(const a of ans){const n=this.answerNodes.get(a.id);if(n){this.matches.add(n.id);this.matches.add(n.parent);}}
      this.openPanel('search');this.panel.innerHTML=this.panelHeader('FIND / 当前回答池',`“${this.search}”`, `<div class="zg-panel-sub">${ns.length} 个主题/观点 · ${ans.length} 篇回答命中。只搜索本次已载入内容。</div>`)+ns.map(n=>`<button class="zg-directory-item" data-action="node" data-id="${esc(n.id)}" data-source="search">${this.mark(n.label,this.search)}<small>${TYPE[n.type].name} →</small></button>`).join('')+ans.map(a=>this.answerCard(a,this.search)).join('')+(!ns.length&&!ans.length?'<p class="zg-empty">当前回答池没有命中；可以更换关键词，或提高加载上限后再搜。</p>':'');this.panel.scrollTop=0;this.dirty=true;
    }
    async saveLead(answerId){const a=this.graph.byAnswer.get(answerId);if(!a)throw new Error('该回答不在当前载入池中');const exact=this.lead(a).replace(/…$/,'').trim();await this.saveBookmark(a,exact,'lead');}
    async saveBookmark(a,exact,kind,position=null){
      await this.ready;const q=this.questionInfo(),already=this.state.bookmarks.find(b=>b.questionId===q.id&&b.answerId===a.id&&b.selector.exact===exact);
      if(already){this.toast('这段内容已经在行囊里，没有重复保存');return;}
      if(!exact||exact.length>3000)throw new Error('每条片段请选 1–3000 字；较长内容可以分段收藏');
      const anchor=C.anchorFor(a.text,exact);if(position){anchor.position=position;anchor.selector.prefix=a.text.slice(Math.max(0,position.start-80),position.start);anchor.selector.suffix=a.text.slice(position.end,position.end+80);}
      const b={id:C.uid('b'),questionId:q.id,questionTitle:q.title,answerId:a.id,nodeId:this.answerNodes.get(a.id)?.id||'',author:a.author||'知乎用户',sourceUrl:this.urlFor(a),kind,...anchor,note:'',tags:[],reviewedAt:null};
      await this.mutate({type:'bookmark',payload:b});this.record('bookmark',this.answerNodes.get(a.id),'panel');this.toast('已收入知识行囊 · 原文片段和来源已保存在本机');this.dirty=true;
    }
    captureSelection(){
      if(!this.running)return;const sel=getSelection();if(!sel||sel.isCollapsed||!sel.rangeCount)return;
      const range=sel.getRangeAt(0),start=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement,body=start?.closest?.('.zg-original');
      if(!body||!body.contains(range.endContainer)){this.pendingSelection=null;this.$('.zg-clip-button').hidden=true;return;}
      const a=this.graph.byAnswer.get(body.dataset.answerId);if(!a)return;
      const pre=document.createRange();pre.selectNodeContents(body);pre.setEnd(range.startContainer,range.startOffset);
      const startOffset=pre.toString().length,raw=range.toString(),leftTrim=raw.length-raw.trimStart().length,exact=raw.trim();
      if(!exact)return;this.pendingSelection={answerId:a.id,exact,position:{start:startOffset+leftTrim,end:startOffset+leftTrim+exact.length,unit:'utf16'}};
      const rect=range.getBoundingClientRect(),btn=this.$('.zg-clip-button');btn.textContent=exact.length>3000?'选段过长，请缩到 3000 字内':`＋ 保存选中文段 · ${exact.length} 字`;btn.disabled=exact.length>3000;btn.hidden=false;btn.style.left=`${clamp(rect.left,16,this.w-260)}px`;btn.style.top=`${clamp(rect.bottom+10,148,this.h-90)}px`;
    }
    async saveSelection(){const clip=this.pendingSelection;if(!clip)throw new Error('请先在已载入原文中拖选文字');const a=this.graph.byAnswer.get(clip.answerId);if(!a)throw new Error('回答已不在当前载入池中');await this.saveBookmark(a,clip.exact,'selection',clip.position);this.pendingSelection=null;this.$('.zg-clip-button').hidden=true;getSelection()?.removeAllRanges();}
    highlightBookmark(b){const el=this.$('.zg-original');if(!el)return;const text=el.textContent,i=text.indexOf(b.selector.exact);if(i<0){this.toast('原文可能已变化；行囊保留了你当时收藏的版本',5000);return;}el.innerHTML=esc(text.slice(0,i))+`<mark class="zg-saved-highlight">${esc(b.selector.exact)}</mark>`+esc(text.slice(i+b.selector.exact.length));el.querySelector('mark').scrollIntoView({block:'center',behavior:'instant'});}
    reviewData(){return C.scopeState(this.state,this.reviewScope==='current'?this.questionInfo().id:null);}
    showReview(reset=true){
      const scroll=this.panel.scrollTop;this.openPanel('review');const data=this.reviewData(),visits=data.events.filter(e=>e.kind==='visit'),read=data.events.filter(e=>e.kind==='read');
      this.panel.innerHTML=this.panelHeader('YOUR CONSTELLATION / 知识行囊',this.reviewTab==='trail'?'把走过的路留下':'把有用的内容留下',`<div class="zg-review-metrics"><span><b>${data.bookmarks.length}</b> 有用片段</span><span><b>${visits.length}</b> 到访</span><span><b>${new Set(read.map(e=>e.questionId+':'+e.node.id)).size}</b> 停留阅读</span></div>`)+
        `<div class="zg-review-tabs"><button data-action="review-tab" data-value="bookmarks" aria-pressed="${this.reviewTab==='bookmarks'}">知识行囊</button><button data-action="review-tab" data-value="trail" aria-pressed="${this.reviewTab==='trail'}">探索航迹</button><button data-action="review-scope">${this.reviewScope==='current'?'本问题 ▾':'全部问题 ▾'}</button></div><div class="zg-export-row"><button data-action="export-md">导出 Markdown</button><button data-action="export-json">导出 JSON</button><button data-action="import">导入备份</button></div>`+
        (this.reviewTab==='bookmarks'?this.renderBookmarks(data.bookmarks):this.renderRoute(visits))+
        `<div class="zg-privacy-note"><b>你的轨迹不是你的人格。</b><p>点击、前台停留至少 8 秒、主动收藏分别记录。仅主动收藏表达「对我有用」。不记录鼠标坐标，不做后台计时。轨迹和行囊笔记不上传；主动启用 AI 校对时，会发送经授权的少量回答原文选段。</p><p>画像 / 相似用户：接口预留，未启用。${this.journal.isExtension?'扩展数据保存在 chrome.storage.local；卸载前请导出备份。':'这是离线演示；记录保存在此演示站点的 IndexedDB，与正式扩展分开。'}</p><button data-action="clear-trail">清除本问题轨迹，保留收藏</button><button class="zg-danger" data-action="clear-all">清空本机全部数据</button></div>`;
      this.panel.scrollTop=reset?0:scroll;this.dirty=true;
    }
    renderBookmarks(bookmarks){
      if(!bookmarks.length)return '<div class="zg-empty-state"><span>◇</span><h3>尚未留下片段</h3><p>青色回答的「＋ 行囊」保存段首摘录；打开回答后拖选原文，可以收藏真正打动你的那一段。</p></div>';
      return [...bookmarks].reverse().map((b,i)=>`<article class="zg-bookmark" data-id="${esc(b.id)}"><div class="zg-bookmark-head"><span>◇ ${String(bookmarks.length-i).padStart(2,'0')} / ${b.kind==='selection'?'原文选段':'段首摘录'}</span><button data-action="reviewed" data-id="${esc(b.id)}">${b.reviewedAt?'✓ 已复习':'待学习'}</button></div><h3>${esc(b.questionTitle)}</h3><blockquote>${esc(b.selector.exact)}</blockquote><div class="zg-bookmark-source">${esc(b.author)}${b.sourceUrl?` · <a href="${esc(b.sourceUrl)}" target="_blank" rel="noopener noreferrer">回到原回答 ↗</a>`:''}</div><label class="zg-note-label">我的笔记<textarea rows="2" maxlength="2000" placeholder="为什么有用？下一步怎么用？">${esc(this.noteDrafts?.get(b.id)?.note??b.note)}</textarea></label><input class="zg-tags-input" maxlength="480" aria-label="标签，逗号分隔" placeholder="标签，用逗号分隔" value="${esc(this.noteDrafts?.get(b.id)?.tags??b.tags.join('，'))}"><div class="zg-bookmark-actions"><button data-action="note-save" data-id="${esc(b.id)}">保存笔记</button><button data-action="bookmark-jump" data-id="${esc(b.id)}">回到星系位置</button><button class="zg-danger" data-action="remove-bookmark" data-id="${esc(b.id)}">移除</button></div></article>`).join('');
    }
    renderRoute(visits){
      if(!visits.length)return '<div class="zg-empty-state"><span>⌁</span><h3>航迹从一次主动到访开始</h3><p>点开主题、观点或回答，航迹会逐站连接。只是路过的鼠标悬停不会被记成兴趣。</p></div>';
      const recent=visits.slice(-24),points=recent.map((e,i)=>({e,x:25+(i%6)*53,y:28+Math.floor(i/6)*58}));let lines='';
      for(let i=1;i<points.length;i++){const p=points[i-1],q=points[i];if(p.e.sessionId!==q.e.sessionId||p.e.questionId!==q.e.questionId)continue;lines+=`<path d="M ${p.x} ${p.y} C ${p.x} ${p.y+28},${q.x} ${q.y-28},${q.x} ${q.y}"/>`;}
      const svg=`<svg class="zg-route-map" viewBox="0 0 320 ${Math.ceil(points.length/6)*58+16}" role="img" aria-label="最近 ${points.length} 站探索航迹，按时间排序"><defs><linearGradient id="zg-route-ink"><stop stop-color="#71c4ba"/><stop offset="1" stop-color="#d9bc80"/></linearGradient></defs><g fill="none" stroke="url(#zg-route-ink)" stroke-width="1.4" opacity=".5">${lines}</g>${points.map(({e,x,y},i)=>`<g data-action="trail-jump" data-id="${esc(e.id)}" role="button" tabindex="0" aria-label="回到 ${esc(e.node.label)}"><circle cx="${x}" cy="${y}" r="12" fill="#172834" stroke="${this.bookmarked?.has(e.node.answerId)?'#d9bc80':'#71c4ba'}"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="#dfebe8" font-size="10">${i+1}</text><title>${esc(e.node.label)}</title></g>`).join('')}</svg>`;
      return svg+`<p class="zg-hint">最近 ${points.length} 站的静态航线；点击编号逐站回看，不自动带动镜头。不同问题与会话之间断开连线。</p><div class="zg-route-list">`+[...visits].reverse().slice(0,100).map((e,i)=>`<button data-action="trail-jump" data-id="${esc(e.id)}"><span class="zg-route-index">${String(visits.length-i).padStart(2,'0')}</span><span><b>${esc(e.node.label)}</b><small>${TYPE[e.node.type]?.name||'问题'} · ${esc(new Date(e.at).toLocaleString('zh-CN'))}${this.reviewScope==='all'?` · ${esc(this.state.questions[e.questionId]?.title||'')}`:''}</small></span></button>`).join('')+'</div>';
    }
    async exportData(format){await this.ready;const latest=await this.journal.dispatch({type:'read'});this.acceptState(latest);const qid=this.reviewScope==='current'?this.questionInfo().id:null,data=C.scopeState(latest,qid),body=format==='md'?C.exportMarkdown(latest,qid):JSON.stringify(data,null,2);this.download(body,format==='md'?'text/markdown;charset=utf-8':'application/json',`zhihu-galaxy-${qid||'all'}-${new Date().toISOString().slice(0,10)}.${format}`);this.toast(`已导出${qid?'本问题':'全部问题'}的${format==='md'?'收藏笔记':'轨迹与收藏'}`);}
    download(body,type,filename){const blob=new Blob([body],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;this.root.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
    async importJSON(e){try{const file=e.target.files?.[0];if(!file)return;if(file.size>8*1024*1024)throw new Error('备份超过 8 MB，请分问题导出后导入');const incoming=C.validateImport(JSON.parse(await file.text()));if(!confirm(`合并导入 ${incoming.bookmarks.length} 条收藏和 ${incoming.events.length} 条轨迹？已有片段会去重；不会开启画像或联网分享。`))return;await this.mutate({type:'import',payload:incoming});this.showReview();this.toast('备份已合并导入');}catch(err){this.toast(`导入失败：${err.message}`,6000);}finally{e.target.value='';}}
    getProfileInput(){return C.profileInput(this.state);}
    exportSnapshot(){return C.scopeState(this.state);}
    replaceQuestion(question,meta={}){
      // Merge by stable node id; grow the graph without deleting, moving or reparenting old objects.
      const next=E.buildSemanticGraph(question),fixed=new Map(this.nodes.map(n=>[n.id,{...n.pos}]));
      const merge=(old,fresh)=>{const out=[...old],map=new Map(old.map(n=>[n.id,n]));for(const n of fresh){const p=map.get(n.id);if(p){p.answerIds=[...new Set([...(p.answerIds||[]),...(n.answerIds||[])])];p.df=Math.max(p.df||0,n.df||0);p.support=Math.max(p.support||0,n.support||0);p.score=Math.max(p.score||0,n.score||0);}else{out.push(n);map.set(n.id,n);}}return out;};
      const keywords=merge(this.graph.keywords,next.keywords),phenomena=merge(this.graph.phenomena,next.phenomena),satellites=merge(this.graph.satellites,next.satellites);
      const am=new Map(this.graph.answers.map(a=>[a.id,a]));for(const a of next.answers){const old=am.get(a.id);am.set(a.id,old&&old.text.length>a.text.length?{...a,...old}:a);}
      const answers=[...am.values()];this.graph={...next,question,answers,byAnswer:new Map(answers.map(a=>[a.id,a])),keywords,phenomena,satellites};C.worldLayout(this.graph,fixed);this.indexGraph();this.setProgress(meta.progress||{phase:'ready',loaded:answers.length,source:question.source});
      // Never replace a live reading surface during text selection or progressive loading.
      this.$('.zg-title').textContent=question.title||'知乎问题';this.lastPreviewRefresh=0;this.dirty=true;
      if(this.nodes.length>fixed.size)this.toast(`＋${this.nodes.length-fixed.size} 个节点 · 已有位置与阅读卡保持不变`);
      if(this.search&&this.panelMode==='search')this.searchChanged();
    }
    viewBounds(){return{x:18,y:148,w:Math.max(200,this.w-(this.panel.hidden?90:Math.min(400,this.w*.46)+32)),h:Math.max(120,this.h-204)};}
    prepareProjection(){const sp=Math.sin(this.phi),offset={x:this.radius*sp*Math.cos(this.theta),y:this.radius*Math.cos(this.phi),z:this.radius*sp*Math.sin(this.theta)};this.camera={x:this.look.x+offset.x,y:this.look.y+offset.y,z:this.look.z+offset.z};this.forward=norm(sub(this.look,this.camera));this.right=norm(cross(this.forward,{x:0,y:1,z:0}));this.up=cross(this.right,this.forward);this.focal=this.h/(2*Math.tan(55*Math.PI/360));}
    project(p){const rel=sub(p,this.camera),z=dot(rel,this.forward);if(z<2)return null;return{x:this.w/2+dot(rel,this.right)/z*this.focal,y:this.h*.52-dot(rel,this.up)/z*this.focal,z,scale:this.focal/z};}
    isRelevant(n){if(n.type!=='answer')return true;if(this.filter==='saved'&&!this.bookmarked?.has(n.answerId))return false;if(this.filter==='unvisited'&&this.visited?.has(n.answerId))return false;return true;}
    isBranch(n){const s=this.selected;if(!s)return false;if(n.id===s.id||n.parent===s.id||n.parents?.includes(s.id))return true;if(s.type==='answer')return n.id===s.parent||n.parent===s.parent;const parent=this.nodeById(n.parent);return parent?.parents?.includes(s.id)||false;}
    buildScreen(){
      const bounds=this.viewBounds(),key=[this.theta,this.phi,this.radius,this.look.x,this.look.y,this.look.z,this.w,this.h,this.nodes.length,this.panel.hidden].join(':');
      if(key===this.layoutKey)return;this.layoutKey=key;this.prepareProjection();const raw=[];
      for(const node of this.nodes){const p=this.project(node.pos);if(!p||p.x<bounds.x||p.x>bounds.x+bounds.w||p.y<bounds.y||p.y>bounds.y+bounds.h)continue;const r=node.type==='answer'?3.6:node.type==='phenomenon'?4.8:6;raw.push({...p,r,id:node.id,node});}
      this.screen=C.spreadScreen(raw,bounds,46);this.screenMap=new Map(this.screen.map(p=>[p.id,p]));
    }
    nextPreview(){const eligible=this.previewCandidates||[];if(!eligible.length)return;const i=eligible.findIndex(p=>p.id===this.preview.active),n=eligible[(i+1)%eligible.length];this.preview.pinned=n.id;this.preview.active=n.id;this.lastDockId=null;this.lastPreviewRefresh=0;this.dirty=true;this.toast('已切换并固定此摘录；再次点「固定中」可恢复跟随');}
    chooseAttention(t){
      const center={x:this.w/2,y:this.h*.52};let candidates=this.screen.filter(p=>p.node.type==='answer'&&this.isRelevant(p.node)&&(!this.search||this.matches.has(p.id)));
      candidates.sort((a,b)=>{const score=p=>Math.hypot(p.x-center.x,p.y-center.y)-(this.isBranch(p.node)?95:0);return score(a)-score(b);});this.previewCandidates=candidates;
      const hovered=this.hover?.type==='answer'&&t-(this.hoverSince||0)>130?this.hover.id:null;
      const explicit=this.previewHold||hovered||(this.selected?.type==='answer'?this.selected.id:null);
      const active=this.preview.update({now:t,explicit,candidate:candidates[0]?.id||null,validIds:this.validAnswerIds});
      if(t-this.lastPreviewRefresh>2400||this.lastActive!==active||!this.cardsIds.length){
        const wanted=[],leads=new Set(),parents=new Set(),max=clamp(Number(this.settings.cardCount)||3,1,5);
        const add=p=>{if(!p||wanted.includes(p.id))return;const a=this.graph.byAnswer.get(p.node.answerId),lead=this.lead(a).replace(/[\s\p{P}]/gu,'');if(!lead||leads.has(lead))return;leads.add(lead);parents.add(p.node.parent);wanted.push(p.id);};
        add(this.screenMap.get(active));for(const old of this.cardsIds)if(wanted.length<max&&this.isRelevant(this.nodeById(old)||{}))add(this.screenMap.get(old));
        for(const p of candidates)if(wanted.length<max&&!parents.has(p.node.parent))add(p);
        for(const p of candidates)if(wanted.length<max)add(p);
        if(!this.previewHold&&!getSelection()?.toString())this.cardsIds=wanted;
        this.lastPreviewRefresh=t;this.lastActive=active;
      }
      this.updateDock();
    }
    updateDock(){
      const n=this.nodeById(this.preview.active),a=n&&this.graph.byAnswer.get(n.answerId),key=[n?.id,this.preview.pinned,this.bookmarked?.has(a?.id),this.settings.fontScale,a?.text.length].join(':');
      if(key===this.lastDockId)return;this.lastDockId=key;
      this.$('.zg-dock-body').innerHTML=a?esc(this.lead(a)):'<span class="zg-empty">将鼠标停在青色回答上，或让它靠近视野中央。也可从主题目录进入。</span>';
      this.$('.zg-dock-meta').textContent=a?`${a.author||'知乎用户'} · 段首摘录${this.bookmarked?.has(a.id)?' · 已收藏':''}`:'稳定阅读卡 · 不用追着文字移动';
      this.$('[data-action="lock"]').textContent=this.preview.pinned?'固定中':'固定';this.$('[data-action="lock"]').setAttribute('aria-pressed',String(!!this.preview.pinned));
      this.$('.zg-reading-dock').classList.toggle('zg-dock-pinned',!!this.preview.pinned);this.$('[data-action="save-active"]').disabled=!a;this.$('[data-action="read-active"]').disabled=!a;
    }
    obstacleRects(){const selectors=['.zg-reading-dock','.zg-route-pill'];return selectors.map(s=>this.$(s)).filter(el=>el&&!el.hidden).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});}
    renderCallouts(bounds,obstacles){
      const layer=this.$('.zg-callouts'),occupied=[...obstacles],result=[],scale=Number(this.settings.fontScale)||1;
      const width=Math.min(272,Math.max(212,bounds.w*.27)),height=Math.ceil(46+3*21*scale);
      const markerRects=this.screen.map(p=>({x:p.x-5,y:p.y-5,w:10,h:10}));
      // Priority cards occupy the overlay, never the canvas. Other nodes cannot paint over text.
      for(const id of this.cardsIds){const p=this.screenMap.get(id);if(!p)continue;const a=this.graph.byAnswer.get(p.node.answerId);if(!a)continue;
        let box=C.packBox(p,width,height,bounds,[...occupied,...markerRects],this.cardCache.get(id));
        // One active card may use a clear outer dock area; the fixed reading card is always the fallback.
        if(!box)box=C.packFreeBox(p,width,height,bounds,[...occupied,...markerRects],this.cardCache.get(id));
        if(!box)continue;this.cardCache.set(id,box);occupied.push(box);result.push({id,p,a,box});
      }
      const wanted=new Set(result.map(x=>x.id));for(const el of [...layer.children])if(!wanted.has(el.dataset.answerId)&&this.previewHold!==el.dataset.answerId)el.remove();
      for(const {id,p,a,box}of result){let el=[...layer.children].find(x=>x.dataset.answerId===id);if(!el){el=document.createElement('article');el.className='zg-quote';el.dataset.answerId=id;layer.appendChild(el);}
        const contentKey=this.lead(a)+':'+this.bookmarked?.has(a.id);if(el._key!==contentKey){el.innerHTML=`<button class="zg-quote-body" data-action="node" data-id="${esc(id)}" data-source="preview">${esc(this.lead(a))}</button><div class="zg-quote-meta"><span>段首摘录 · ${esc(a.author||'知乎用户')}</span><button data-action="save-lead" data-answer-id="${esc(a.id)}" aria-label="收藏这段摘录">${this.bookmarked?.has(a.id)?'◇ 已存':'＋'}</button></div>`;el._key=contentKey;}
        el.classList.toggle('zg-quote-active',id===this.preview.active);Object.assign(el.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.w}px`,height:`${box.h}px`});
        const edgeX=clamp(p.x,box.x,box.x+box.w),edgeY=clamp(p.y,box.y,box.y+box.h);this.ctx.strokeStyle='rgba(113,189,179,.34)';this.ctx.lineWidth=.8;this.ctx.beginPath();this.ctx.moveTo(p.x,p.y);this.ctx.lineTo(edgeX,edgeY);this.ctx.stroke();
      }
      this.metrics.summaryCards=result.length;this.metrics.summaryRects=result.map(x=>x.box);this.metrics.cardOverlaps=0;for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++)if(C.overlap(result[i].box,result[j].box))this.metrics.cardOverlaps++;
      return occupied;
    }
    drawBackground(){const c=this.ctx;c.fillStyle='#0b131e';c.fillRect(0,0,this.w,this.h);const g=c.createRadialGradient(this.w*.52,this.h*.5,10,this.w*.52,this.h*.5,this.w*.7);g.addColorStop(0,'rgba(33,55,71,.30)');g.addColorStop(1,'rgba(11,19,30,0)');c.fillStyle=g;c.fillRect(0,0,this.w,this.h);
      if(!this.backgroundStars){const seed=this.questionInfo().id;this.backgroundStars=Array.from({length:125},(_,i)=>({x:C.hash(seed+':x:'+i)%10000/10000,y:C.hash(seed+':y:'+i)%10000/10000,b:.12+(C.hash(seed+':b:'+i)%18)/100}));}
      for(const s of this.backgroundStars){c.fillStyle=`rgba(169,190,203,${s.b})`;c.fillRect(s.x*this.w,s.y*this.h,1,1);} // Fixed, non-twinkling background.
    }
    drawEdges(){const c=this.ctx,core=this.project({x:0,y:0,z:0});c.lineWidth=.65;
      for(const p of this.screen){const n=p.node,branch=this.isBranch(n),to=n.type==='keyword'?core:this.screenMap.get(n.parent||(n.parents||[])[0]);if(!to)continue;c.strokeStyle=branch?'rgba(123,184,185,.28)':'rgba(123,157,184,.075)';c.beginPath();c.moveTo(to.x,to.y);c.lineTo(p.x,p.y);c.stroke();if(n.type==='phenomenon'&&branch){const second=this.screenMap.get(n.parents?.[1]);if(second){c.beginPath();c.moveTo(second.x,second.y);c.lineTo(p.x,p.y);c.stroke();}}}
      if(core&&core.x>0&&core.x<this.w&&core.y>148&&core.y<this.h-70){c.strokeStyle='rgba(146,180,204,.28)';c.fillStyle='#c6dbe0';c.beginPath();c.arc(core.x,core.y,13,0,Math.PI*2);c.stroke();c.beginPath();c.arc(core.x,core.y,4.5,0,Math.PI*2);c.fill();c.font=`11px ${F}`;c.fillStyle='#93aab8';c.textAlign='center';c.fillText('问题',core.x,core.y+31);}
    }
    drawTrail(){if(!this.settings.showTrail)return;const c=this.ctx,events=this.state.events.filter(e=>e.questionId===this.questionInfo().id&&e.kind==='visit').slice(-80);c.save();
      let previous=null;for(let i=0;i<events.length;i++){const e=events[i],p=this.screenMap.get(e.node.id);if(previous&&p&&previous.e.sessionId===e.sessionId){const from=previous.p,dx=p.x-from.x,dy=p.y-from.y,bend=Math.min(24,Math.hypot(dx,dy)*.10);c.strokeStyle=`rgba(205,182,133,${.14+.34*i/events.length})`;c.lineWidth=1.35;c.beginPath();c.moveTo(from.x,from.y);c.bezierCurveTo(from.x+dx*.28+dy*.04,from.y+dy*.28-bend,from.x+dx*.72-dy*.04,from.y+dy*.72-bend,p.x,p.y);c.stroke();}
        previous=p?{e,p}:null;
      }
      const last=previous?.p;if(last){c.strokeStyle='#d5bb88';c.lineWidth=1;c.beginPath();c.arc(last.x,last.y,13,0,Math.PI*2);c.stroke();}c.restore();
    }
    drawNodes(){const c=this.ctx;this.hits=[];
      for(const p of [...this.screen].sort((a,b)=>b.z-a.z)){const n=p.node,hover=this.hover?.id===n.id,selected=this.selected?.id===n.id,active=this.preview.active===n.id,style=TYPE[n.type];let alpha=style.alpha;
        if(n.type==='answer'&&!this.isBranch(n))alpha=.62;if(!this.isRelevant(n))alpha=.15;if(this.search&&!this.matches.has(n.id))alpha=.16;if(selected||hover||active)alpha=1;
        c.save();c.globalAlpha=alpha;const r=p.r+(hover||selected?1.2:0);if(hover||selected||active){c.fillStyle=n.type==='answer'?'rgba(102,196,184,.11)':'rgba(130,168,213,.11)';c.beginPath();c.arc(p.x,p.y,r+8,0,Math.PI*2);c.fill();}
        c.fillStyle=style.color;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();
        if(n.type==='answer'&&this.visited?.has(n.answerId)){c.strokeStyle='rgba(155,209,197,.55)';c.lineWidth=.8;c.beginPath();c.arc(p.x,p.y,r+3,0,Math.PI*2);c.stroke();}
        if(n.type==='answer'&&this.bookmarked?.has(n.answerId)){c.strokeStyle='#d5bc86';c.lineWidth=1.2;c.beginPath();c.moveTo(p.x,p.y-r-6);c.lineTo(p.x+r+6,p.y);c.lineTo(p.x,p.y+r+6);c.lineTo(p.x-r-6,p.y);c.closePath();c.stroke();}
        c.restore();this.hits.push({node:n,x:p.x,y:p.y,r:r+3});
      }
    }
    drawLabels(bounds,occupied){
      const c=this.ctx,scale=Number(this.settings.fontScale)||1,markerRects=this.screen.map(p=>({x:p.x-5,y:p.y-5,w:10,h:10}));
      const candidates=this.screen.filter(p=>p.node.type!=='answer').sort((a,b)=>{const score=p=>(this.hover?.id===p.id?600:0)+(this.selected?.id===p.id?700:0)+(this.matches.has(p.id)?500:0)+(this.isBranch(p.node)?100:0)+(p.node.type==='keyword'?60:10)+Math.log2(2+(p.node.df||p.node.support||1))*2;return score(b)-score(a);});
      let labels=0;for(const p of candidates){if(labels>=Math.max(10,Math.floor(bounds.w*bounds.h/17000)))break;const n=p.node,fs=(n.type==='keyword'?13.5:12)*scale;c.font=`${n.type==='keyword'?550:450} ${fs}px ${F}`;const label=n.label+(n.type==='keyword'?`  ${this.relatedCount(n)}`:''),width=c.measureText(label).width+12,height=fs+12;
        const box=C.packBox(p,width,height,bounds,[...occupied,...markerRects],this.boxCache.get(n.id),160);if(!box)continue;this.boxCache.set(n.id,box);occupied.push(box);labels++;
        c.fillStyle='rgba(11,19,30,.93)';c.beginPath();c.roundRect(box.x,box.y,box.w,box.h,5);c.fill();c.fillStyle=TYPE[n.type].color;c.textAlign='left';c.textBaseline='middle';c.fillText(label,box.x+6,box.y+box.h/2);
        if(Math.hypot(box.x-p.x,box.y-p.y)>42){c.strokeStyle='rgba(122,155,181,.23)';c.lineWidth=.65;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(clamp(p.x,box.x,box.x+box.w),clamp(p.y,box.y,box.y+box.h));c.stroke();}
        const hit=this.hits.find(h=>h.node.id===n.id);if(hit)hit.labelBox=box;
      }
      this.metrics.labelCount=labels;
    }
    relatedCount(n){return n.answerIds?.length||n.support||n.df||0;}
    update(dt,t){let moving=false;const speed=this.settings.motion==='explore'?.62:.32;
      if(this.settings.motion!=='still'){if(this.keys.has('a')){this.theta-=speed*dt;moving=true;}if(this.keys.has('d')){this.theta+=speed*dt;moving=true;}if(this.keys.has('w')){this.phi-=speed*.7*dt;moving=true;}if(this.keys.has('s')){this.phi+=speed*.7*dt;moving=true;}}
      this.phi=clamp(this.phi,.42,Math.PI-.42);if(moving){this.cameraAnim=null;this.lastUserAt=Date.now();this.hover=null;}
      if(Math.abs(this.radius-this.targetRadius)>.01){this.radius=this.reduced?this.targetRadius:this.radius+(this.targetRadius-this.radius)*(1-Math.exp(-dt/.10));moving=true;this.syncSlider();}else this.radius=this.targetRadius;
      if(this.cameraAnim){const a=this.cameraAnim,q=clamp((t-a.start)/a.duration,0,1),u=1-(1-q)**3;this.look={x:a.from.x+(a.to.x-a.from.x)*u,y:a.from.y+(a.to.y-a.from.y)*u,z:a.from.z+(a.to.z-a.from.z)*u};moving=true;if(q>=1)this.cameraAnim=null;}
      return moving;
    }
    frame(t){if(!this.running)return;const dt=Math.min(.04,(t-this.last)/1000);this.last=t;if(!document.hidden){const moving=this.update(dt,t);if(this.dirty||moving||t-(this.lastPaint||0)>240){const start=performance.now();this.draw(t);this.metrics.frameMs=performance.now()-start;this.lastPaint=t;this.dirty=false;}}this.frameHandle=requestAnimationFrame(tt=>this.frame(tt));}
    draw(t){this.prepareProjection();this.buildScreen();this.drawBackground();this.chooseAttention(t);this.drawEdges();this.drawTrail();this.drawNodes();const occupied=this.renderCallouts(this.viewBounds(),this.obstacleRects());this.drawLabels(this.viewBounds(),occupied);this.metrics.visibleNodes=this.screen.length;this.metrics.answerNodes=this.graph.satellites.length;this.metrics.activePreview=this.preview.active;this.metrics.worldNodes=this.nodes.length;}
    destroy(){this.running=false;cancelAnimationFrame(this.frameHandle);clearInterval(this.timer);clearTimeout(this.toastTimer);clearTimeout(this.searchTimer);this.unsubscribe?.();for(const off of this.bound)off();this.keys.clear();this.root.remove();document.body?.classList.remove('zg-lock-scroll');}
  }
  globalThis.ZGExperience={GalaxyExplorer};
})();
