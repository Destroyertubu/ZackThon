(() => {
  'use strict';const form=document.querySelector('form'),status=document.querySelector('#status');let current=null;
  async function send(type,rest={}){const r=await chrome.runtime.sendMessage({type:'ZH_GALAXY_AI_'+type,...rest});if(!r?.ok)throw new Error(r?.error||'扩展后台未响应');return r.data;}
  const report=(s,error=false)=>{status.textContent=s;status.style.color=error?'#efb1a5':'#b5d8d1';};
  function fill(c){current=c;for(const [k,v]of Object.entries(c)){const el=form.elements[k];if(!el)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=v;}form.elements.apiKey.value='';document.querySelector('#key-state').textContent=c.hasKey?(c.remember?'已保存本机密钥；页面不回读密钥。':'密钥仅在本次浏览器会话中可用。'):'没有已保存的密钥。';notes();}
  function notes(){const p=form.elements.provider.value;document.querySelector('#endpoint-note').textContent=p==='qwen'?'请复制百炼控制台所在地域 / 工作空间的 OpenAI 兼容 Base URL；模型与密钥必须属于该地域。':'填到 /v1 或供应商给出的基础路径，不需要追加 /chat/completions；自定义供应商必须兼容 Chat Completions。';}
  form.elements.provider.addEventListener('change',()=>{const p=current?.presets[form.elements.provider.value];if(p){form.elements.baseUrl.value=p.baseUrl;form.elements.model.value=p.model;form.elements.apiKey.value='';}notes();});
  form.addEventListener('submit',async e=>{e.preventDefault();try{const u=new URL(form.elements.baseUrl.value.trim());if(!['https:','http:'].includes(u.protocol))throw new Error('仅支持 HTTPS 或本机 HTTP');
      // Call in the actual button gesture, before any asynchronous operation.
      const granted=await chrome.permissions.request({origins:[`${u.protocol}//${u.hostname}/*`]});if(!granted)throw new Error('域名授权未获批准，未更改配置');const data={};for(const el of form.elements){if(!el.name)continue;data[el.name]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;}fill(await send('SAVE',{data}));report('已保存。回到星系即可校对；密钥不会显示在知乎页面。');}catch(err){report(err.message,true);}});
  document.querySelector('#test').addEventListener('click',async e=>{e.target.disabled=true;try{report('测试已保存的端点与模型…');const out=await send('RUN',{task:'test',data:{},runId:'connection-test'});if(out.result?.ok!==true)throw new Error('模型返回成功，但未遵守测试 JSON 格式');report(`连接成功 · ${out.meta.model} · ${out.meta.latencyMs} ms。此测试未发送知乎内容。`);}catch(err){report(err.message,true);}finally{e.target.disabled=false;}});
  document.querySelector('#clear').addEventListener('click',async()=>{try{if(!confirm('删除此扩展保存的 API Key 并关闭 AI？收藏和轨迹不受影响。'))return;fill(await send('CLEAR'));report('密钥已删除，AI 已关闭；已授予的域名权限可在扩展管理中撤销。');}catch(err){report(err.message,true);}});
  send('CONFIG').then(c=>{fill(c);report('设置已读取；填写 / 保存后再测试连接。');}).catch(e=>report(e.message,true));
})();
