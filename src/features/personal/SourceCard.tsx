import ReadingLight from '@/features/typography/ReadingLight'
import { useState } from 'react'
import { Bookmark, Check, ExternalLink, PenLine } from 'lucide-react'
import type { ContentSource } from './types'
import { canonicalSource, safeSourceUrl } from './persistence'
import { usePersonalStore } from './store'

export default function SourceCard({source,onExplore}:{source:ContentSource;onExplore?:(source:ContentSource)=>void}){
  const canonical=canonicalSource(source)
  const data=usePersonalStore(s=>s.data)
  const collected=data.collections.find(c=>c.sourceId===canonical.id)
  const note=data.notes.find(n=>n.id===`note:${canonical.id}`)??data.notes.find(n=>n.sourceId===canonical.id)
  const [writing,setWriting]=useState(false)
  const [reading,setReading]=useState(false)
  const url=safeSourceUrl(source.url)
  return <article className="ms-source">
    <div className="ms-source-meta"><span>{source.source}</span><span>{source.kind==='curated'?'精选阅读导引':source.kind==='excerpt'?'内容节选':source.contentType==='article'?'文章摘要':source.contentType==='question'?'问题摘要':source.contentType==='answer'?'回答摘要':'搜索摘要'}</span></div>
    <h3>{source.title}</h3><p className="ms-author">{source.author||'作者未提供'}</p>
    <p className="ms-source-summary">{source.summary}</p>
    {source.readingGuide&&<p className="ms-reading-guide">一起想想：{source.readingGuide}</p>}
    <div className="ms-source-actions">
      <button type="button" onClick={()=>setReading(true)}>静读这份材料</button>
      <button type="button" aria-pressed={!!collected} onClick={()=>collected?usePersonalStore.getState().uncollect(collected.id):usePersonalStore.getState().collect(source)}>{collected?<Check size={14}/>:<Bookmark size={14}/>} {collected?'已收藏':'收藏'}</button>
      <button type="button" onClick={()=>setWriting(v=>!v)}><PenLine size={14}/> {note?'查看笔记':'记下想法'}</button>
      {onExplore&&<button type="button" onClick={()=>onExplore(source)}>在星系中展开</button>}
      {url&&<a href={url} target="_blank" rel="noreferrer">阅读原文 <ExternalLink size={13}/></a>}
    </div>
    {writing&&<label className="ms-field">我的笔记 · 自动保存在本机<textarea aria-label={`关于${source.title}的笔记`} maxLength={6000} value={note?.text??''} placeholder="哪些地方启发了你？还有什么疑问？" onChange={event=>{usePersonalStore.getState().putSource(source);usePersonalStore.getState().saveNote({id:note?.id??`note:${canonical.id}`,sourceId:canonical.id,title:source.title,text:event.target.value})}}/></label>}
    <small className="ms-source-date">获取于 {new Date(source.fetchedAt).toLocaleDateString('zh-CN')} · {source.kind==='curated'?'导引由项目编写，原文见来源':'摘要不等于全文'}</small>
    {reading&&<ReadingLight id={canonical.id} title={source.title} author={source.author} provenance={`${source.source} · ${source.kind==='curated'?'精选阅读导引':'摘要 / 节选，非全文'}`} paragraphs={[...source.summary.split(/\n+/).filter(Boolean),...(source.readingGuide?[`一起想想：${source.readingGuide}`]:[])]} url={url??undefined} saved={!!collected} onSave={()=>collected?usePersonalStore.getState().uncollect(collected.id):usePersonalStore.getState().collect(source)} onClose={()=>setReading(false)}/>}
  </article>
}
