import { useEffect, useMemo, useRef, useState } from 'react'
import { Feather, LoaderCircle, Phone, Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useGameStore } from '@/state/gameStore'
import { usePersonalStore } from '@/features/personal/store'
import { api, normalizeSearchSource, type SearchResponse } from '@/features/personal/api'
import { groupEchoQuestions, expandedEchoSources, type EchoQuestion } from '@/features/personal/echoes'
import type { QuestionResponse } from '@/features/galaxy/types'
import SourceCard from '@/features/personal/SourceCard'
import '@/features/personal/personal.css'
import '@/features/personal/workspaces.css'

export default function PhonePanel() {
  const sources = usePersonalStore(s=>s.data.sources), notes=usePersonalStore(s=>s.data.notes)
  const groups=useMemo(()=>groupEchoQuestions(Object.values(sources)),[sources])
  const [selected,setSelected]=useState(''),[query,setQuery]=useState(''),[filterIds,setFilterIds]=useState<string[]|null>(null)
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
  const request=useRef<AbortController|null>(null)
  const close=useGameStore(s=>s.closePanel)
  const visible=filterIds ? groups.filter(g=>filterIds.includes(g.id)) : groups
  const current=visible.find(g=>g.id===selected) ?? visible[0]
  const [voice,setVoice]=useState('')
  const answers=current?.answers ?? []
  const active=answers.find(a=>a.id===voice) ?? answers[0]
  const noteId=current ? `echo-followup:${current.id}` : ''
  const followup=notes.find(n=>n.id===noteId)
  useEffect(()=>()=>request.current?.abort(),[])
  const begin=()=>{request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');setNotice('');return controller}
  async function search(){
    if(!query.trim())return
    const controller=begin()
    try{
      const result=await api<SearchResponse>(`/api/search?${new URLSearchParams({q:query.trim(),provider:'zhihu'})}`,{signal:controller.signal})
      if(controller.signal.aborted)return
      const items=result.items.map(normalizeSearchSource); items.forEach(source=>usePersonalStore.getState().putSource(source))
      const found=groupEchoQuestions(items);setFilterIds(found.map(g=>g.id));setSelected(found[0]?.id ?? '');setVoice('')
      setNotice(`${result.cached?'来自本地缓存':'已获取并缓存'} · ${found.length} 个有真实归属的问题${result.notice?` · ${result.notice}`:''}`)
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'暂时没有找到回答。')}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  async function expand(group:EchoQuestion){
    const controller=begin()
    try{
      const result=await api<QuestionResponse>(`/api/questions/${encodeURIComponent(group.id)}?${new URLSearchParams({q:group.query})}`,{signal:controller.signal})
      if(controller.signal.aborted)return
      const additions=expandedEchoSources(result,group)
      additions.forEach(source=>usePersonalStore.getState().putSource(source))
      setNotice(result.notice || (additions.length?`已取得 ${additions.length} 份公开回答摘要。`:'暂未取得更多回答，已有材料仍可阅读。'))
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'暂未取得更多回答，已有材料仍可阅读。')}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  return <Dialog open onOpenChange={open=>{if(!open)close()}}><DialogContent className="ms-personal home-workspace echo-workspace" showCloseButton={false}>
    <header className="ms-panel-header"><Phone size={25} strokeWidth={1}/><div className="ms-grow"><p className="ms-eyebrow">THE ECHO LINE · 观点回声</p><DialogTitle>让同一个问题，响起不同的回答</DialogTitle><DialogDescription>来自真实作者的公开内容。先读懂，再比较，留下自己的追问。</DialogDescription></div><button className="ms-close" onClick={close} aria-label="放下话筒"><X size={20}/></button></header>
    <main className="echo-main">
      <form className="echo-search" onSubmit={e=>{e.preventDefault();void search()}}><label className="ms-field ms-grow">想听见哪一个问题的回声？<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={160} placeholder="例如：悲伤的音乐为什么让人舒服"/></label><button className="ms-button" disabled={busy||!query.trim()}><Search size={16}/>找寻回答</button></form>
      <div className="echo-layout"><nav className="echo-dial" aria-label="选择一个真实问题">
        <p className="ms-eyebrow">拨向一个问题</p>
        {filterIds && <button className="ms-button" onClick={()=>{request.current?.abort();setBusy(false);setFilterIds(null);setNotice('')}}>回到已有材料</button>}
        {visible.map((group,i)=><button key={group.id} className={current?.id===group.id?'is-active':''} aria-pressed={current?.id===group.id} onClick={()=>{request.current?.abort();setBusy(false);setError('');setNotice('');setSelected(group.id);setVoice('')}}><span>{String(i+1).padStart(2,'0')}</span><strong>{group.title}</strong><small>{group.answers.length} 份公开回答</small></button>)}
      </nav><section className="echo-reading">
        {current ? <><p className="ms-eyebrow">同一问题 · 逐一读懂</p><h2>{current.title}</h2><div className="echo-voices" aria-label="切换回答作者">{answers.map(source=><button key={source.id} aria-pressed={active?.id===source.id} onClick={()=>setVoice(source.id)}>{source.author||'作者未提供'}</button>)}</div>
          {active && <SourceCard source={active}/>}
          {new Set(answers.map(a=>a.author).filter(Boolean)).size < 2 && <p className="ms-notice">目前不足两位作者的回答，先保留这个问题，取得更多材料后再比较。</p>}
          <button className="ms-button" disabled={busy} onClick={()=>void expand(current)}>{busy?<LoaderCircle size={16} className="ms-spin"/>:<Phone size={16}/>}查找这个问题的更多回答</button>
          {answers.length>1 && <details className="ms-details"><summary>把回答并置阅读 · 不预设谁赞成谁反对</summary><div className="echo-comparison">{answers.map(source=><SourceCard key={source.id} source={source}/>)}</div></details>}
          <label className="ms-field echo-followup"><span><Feather size={15}/> 我的比较与追问 · 自动保存在手记</span><textarea rows={4} maxLength={6000} value={followup?.text??''} placeholder="他们分别依据什么？适用条件有什么不同？我还想追问……" onChange={e=>usePersonalStore.getState().saveNote({id:noteId,sourceId:active?.id,title:`追问：${current.title}`,text:e.target.value})}/></label>
        </> : <p className="ms-notice">尚未找到有明确问题归属的回答。可以换一个具体的问题，也可以回到已有材料。</p>}
      </section></div>
      {error && <p className="ms-error" role="alert">{error}</p>}<p className="ms-notice" role="status">{busy?'正在接入公开内容，已有回答仍可阅读。':notice}</p>
    </main><footer className="ms-panel-footer"><span>公开回答摘要 · 原文独立阅读 · 追问留在这台设备</span><button className="ms-button" onClick={close}>放下话筒</button></footer>
  </DialogContent></Dialog>
}
