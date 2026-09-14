import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, BookOpen, Check, Compass, Search, Sparkles, X } from 'lucide-react'
import JourneyWorld from './scene/JourneyWorld'
import { getRealmDefinition } from './realmDefinitions'
import type { RealmStation } from './realmDefinitions'
import { ACTIVITIES, realmSources } from './content'
import ActivityWorkbench from './ActivityWorkbench'
import { activityResult } from './activityResult'
import { SceneBoundary } from './SceneBoundary'
import { mixThoughtRecipe } from '../../components/observatory/gardenRecipes'
import { useGameStore } from '../../state/gameStore'
import { usePersonalStore } from '../personal/store'
import type { ContentSource, ScenePose } from '../personal/types'
import SourceCard from '../personal/SourceCard'
import { api, normalizeSearchSource } from '../personal/api'
import type { SearchResponse, SynthesisResponse } from '../personal/api'
import '../personal/personal.css'
import './journeys.css'

export default function JourneyPage(){
  const {realmId}=useParams();const realm=getRealmDefinition(realmId??'')
  const [params,setParams]=useSearchParams();const navigate=useNavigate()
  const data=usePersonalStore(s=>s.data);const error=usePersonalStore(s=>s.error)
  const qualityMode=useGameStore(s=>s.qualityMode)
  const trip=data.journeys.find(j=>j.id===params.get('trip')&&j.realmId===realm?.id)
  const [near,setNear]=useState<RealmStation|null>(null)
  const [stationId,setStationId]=useState<string|null>(null)
  const [notice,setNotice]=useState('')
  const [searching,setSearching]=useState(false)
  const [aiBusy,setAiBusy]=useState(false)
  const [query,setQuery]=useState('')
  const [searchError,setSearchError]=useState('')
  const [guideOpen,setGuideOpen]=useState(false)
  const pose=useRef<ScenePose|undefined>(undefined)
  const capture=useRef<(()=>string)|null>(null)
  const creating=useRef(false)
  const request=useRef<AbortController|null>(null)
  const dialog=useRef<HTMLElement>(null)
  const tripId=trip?.id
  const activity=realm?ACTIVITIES[realm.id]:undefined
  const sources=useMemo(()=>trip?trip.sourceIds.map(id=>data.sources[id]).filter(Boolean):[],[trip,data.sources])
  const activeStation=realm?.stations.find(s=>s.id===stationId)
  const stationIndex=realm?.stations.findIndex(s=>s.id===stationId)??0

  useEffect(()=>{if(!realm||trip||creating.current)return;creating.current=true
    const sourceIds=realmSources(realm).map(s=>usePersonalStore.getState().putSource(s))
    const created=usePersonalStore.getState().createJourney({realmId:realm.id,title:realm.title,recipe:mixThoughtRecipe(realm.pair[0],realm.pair[1],50),personalText:'',sourceIds})
    setParams(previous=>{const next=new URLSearchParams(previous);next.set('trip',created.id);return next},{replace:true})
  },[realm,trip,setParams])
  useEffect(()=>{if(tripId){pose.current=usePersonalStore.getState().data.journeys.find(j=>j.id===tripId)?.progress.pose;setStationId(usePersonalStore.getState().data.journeys.find(j=>j.id===tripId)?.progress.activeStation??null);creating.current=false}},[tripId])
  useEffect(()=>()=>request.current?.abort(),[])
  useEffect(()=>{const previous=document.title;document.title=`${realm?.title??'旅程'} · 镜海群岛`;return()=>{document.title=previous}},[realm?.title])
  useEffect(()=>{
    if(!stationId&&!guideOpen)return
    const previous=document.activeElement;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close=(e:KeyboardEvent)=>{if(e.code==='Escape'){e.preventDefault();setStationId(null);setGuideOpen(false);if(tripId)usePersonalStore.getState().updateJourney(tripId,{activeStation:undefined})}}
    window.addEventListener('keydown',close)
    return()=>{window.removeEventListener('keydown',close);if(previous instanceof HTMLElement&&previous.isConnected)previous.focus()}
  },[stationId,guideOpen,tripId])
  const onPose=useCallback((value:ScenePose)=>{pose.current=value;if(tripId)usePersonalStore.getState().updateJourney(tripId,{pose:value})},[tripId])
  const captureReady=useCallback((value:(()=>string)|null)=>{capture.current=value},[])
  const interact=useCallback((id:string)=>{
    if(!tripId)return
    const current=usePersonalStore.getState().data.journeys.find(j=>j.id===tripId);if(!current)return
    setStationId(id);setGuideOpen(false);setSearchError('')
    usePersonalStore.getState().updateJourney(tripId,{visited:[...new Set([...current.progress.visited,id])],activeStation:id})
  },[tripId])
  if(!realm||!activity)return <main className="ms-scene-error"><h1>这杯酒的风景尚未找到</h1><button onClick={()=>navigate('/observatory')}>返回观星台重新调制</button></main>
  if(!trip)return <main className="ms-scene-error" role="status">正在打开这杯酒的风景…</main>
  function updateDraft(values:Record<string,string>){const current=usePersonalStore.getState().data.journeys.find(j=>j.id===tripId);if(current)usePersonalStore.getState().updateJourney(current.id,{drafts:{...current.progress.drafts,...values}})}
  function closeNotebook(){setStationId(null);setGuideOpen(false);usePersonalStore.getState().updateJourney(trip!.id,{activeStation:undefined})}
  function enterGalaxy(source?:ContentSource){
    usePersonalStore.getState().setReturn({route:`/journey/${realm!.id}`,label:realm!.title,journeyId:trip!.id,stationId:stationId??undefined,sourceId:source?usePersonalStore.getState().putSource(source):undefined,pose:pose.current})
    navigate(`/galaxy?q=${encodeURIComponent((source?.title??(trip!.personalText||realm!.title)).slice(0,160)||realm!.title)}`,{state:{wanderwiseEntry:true}})
  }
  async function findMore(){
    request.current?.abort();const controller=new AbortController();request.current=controller;setSearching(true);setSearchError('')
    try{
      const result=await api<SearchResponse>(`/api/search?q=${encodeURIComponent(query.trim()||`${realm!.title} ${realm!.pair.join(' ')}`)}&provider=zhihu`,{signal:controller.signal})
      if(controller.signal.aborted)return
      const ids=result.items.map(item=>usePersonalStore.getState().putSource(normalizeSearchSource(item)))
      usePersonalStore.setState(s=>({data:{...s.data,journeys:s.data.journeys.map(j=>j.id===tripId?{...j,sourceIds:[...new Set([...j.sourceIds,...ids])]}:j)}}))
      setNotice(result.items.length?`${result.cached?'从本地缓存读到':'已保存到本地缓存'} ${result.items.length} 份资料`:'没有找到匹配资料，试试换一个问题。')
    }catch(e){if(!controller.signal.aborted)setSearchError(e instanceof Error?e.message:'检索暂时不可用')}finally{if(!controller.signal.aborted)setSearching(false)}
  }
  async function synthesizeJourney(){
    request.current?.abort();const controller=new AbortController();request.current=controller;setAiBusy(true);setSearchError('')
    try{const result=await api<SynthesisResponse>('/api/synthesis',{method:'POST',signal:controller.signal,body:JSON.stringify({mode:'journey',realmId:realm!.id,prompt:`请围绕${realm!.title}，把所选资料整理成五个有递进关系的阅读停靠点。`,sourceIds:sources.slice(0,6).map(s=>s.remoteId??s.id),personalText:trip!.personalText})});if(!controller.signal.aborted){updateDraft({'ai-journey':result.draft.text});setNotice('AI 导引已放入草稿，你可以修改后采纳。')}}catch(e){if(!controller.signal.aborted)setSearchError(e instanceof Error?e.message:'整理暂未完成')}finally{if(!controller.signal.aborted)setAiBusy(false)}
  }
  function saveOutcome(){
    const current=usePersonalStore.getState().data.journeys.find(j=>j.id===tripId)!
    const result=activityResult(current.progress.drafts,realm!.stations)
    if(result.trim().length<8){setNotice('先留下一点自己的文字、照片说明或节奏，再把作品带回小屋。');return}
    usePersonalStore.getState().saveWork({id:`journey-work:${current.id}`,kind:'journey',title:current.progress.drafts.title||activity!.outputTitle,text:`${current.title}\n\n${current.recipe.prompt}\n\n${result}`,sourceIds:current.sourceIds,journeyId:current.id})
    usePersonalStore.getState().updateJourney(current.id,{completed:current.progress.visited.length>=5})
    setNotice(current.progress.visited.length>=5?'旅程已完成，作品已放回小屋。':'作品已保存。继续看看剩下的停靠点，随时回来补充。')
  }
  const selectedSources=activeStation?[sources[stationIndex%sources.length],sources[(stationIndex+3)%sources.length]].filter(Boolean):sources
  return <main className="ms-world-page">
    <SceneBoundary key={trip.id}><Suspense fallback={<div className="ms-world-loading" role="status">杯中的风景正在展开…<button type="button" onClick={()=>navigate('/observatory')}>取消，返回观星台</button></div>}><JourneyWorld key={trip.id} realmId={realm.id} firstPercent={trip.recipe.firstPercent} primaryKnowledge={trip.recipe.first} initialPose={trip.progress.pose} initialStationId={trip.progress.activeStation} onPose={onPose} onNearStation={setNear} onInteract={interact} onCaptureReady={captureReady} disabled={!!stationId||guideOpen} qualityMode={qualityMode}/></Suspense></SceneBoundary>
    <div className="ms-world-vignette"/>
    <header className="ms-world-header"><div><p className="ms-eyebrow">镜海群岛 / 一杯思想的旅行</p><h1>{realm.title}</h1><p>{realm.description}</p></div><nav><button type="button" onClick={()=>{request.current?.abort();navigate('/observatory')}}><ArrowLeft size={15}/>返回观星台</button><button type="button" onClick={()=>{setGuideOpen(true);setStationId(null)}}><BookOpen size={15}/>旅程手记</button></nav></header>
    <aside className="ms-route-progress" aria-label="旅程进度"><span>{trip.progress.completed?<Check size={15}/>:<Compass size={15}/>} {trip.progress.visited.length} / 5 处停靠</span><div>{realm.stations.map((s,i)=><button type="button" key={s.id} title={s.title} aria-label={`阅读${s.title}`} aria-pressed={trip.progress.visited.includes(s.id)} onClick={()=>interact(s.id)}>{String(i+1).padStart(2,'0')}</button>)}</div></aside>
    {!stationId&&!guideOpen&&near&&<button type="button" className="ms-near-prompt" onClick={()=>interact(near.id)}><kbd>E</kbd>{near.title}<BookOpen size={17}/></button>}
    <footer className="ms-world-footer"><span>{trip.recipe.firstPercent} / {100-trip.recipe.firstPercent} · {trip.personalText||activity.intro}</span><button type="button" onClick={()=>enterGalaxy()}><Sparkles size={15}/>在星系中展开</button></footer>
    {(stationId||guideOpen)&&<div className="ms-notebook-backdrop" onClick={closeNotebook}><section className="ms-notebook" ref={dialog} role="dialog" aria-modal="true" aria-label={activeStation?.title??'旅程手记'} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key!=='Tab')return;const controls=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,select');const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}>
      <header><div><p className="ms-eyebrow">{realm.title} / {activeStation?`停靠点 ${stationIndex+1}`:'我的旅程'}</p><h2>{activeStation?.title??activity.outputTitle}</h2></div><button type="button" aria-label="合上手记，继续行走" onClick={closeNotebook}><X size={20}/></button></header>
      <div className="ms-notebook-content"><p className="ms-lead">{activeStation?activity.steps[stationIndex]:activity.intro}</p>
        {activeStation&&<label className="ms-field">在这里想到的事 · 自动保存<textarea maxLength={3000} value={trip.progress.drafts[`station-note:${activeStation.id}`]??''} placeholder="记录观察、判断或还没有答案的问题……" onChange={e=>updateDraft({[`station-note:${activeStation.id}`]:e.target.value})}/></label>}
        <p className="ms-muted">这次调制的方向：{trip.recipe.prompt}</p><ActivityWorkbench activity={activity} drafts={trip.progress.drafts} update={updateDraft} capture={capture.current??undefined}/>
        <div className="ms-section-heading"><h3>沿途阅读</h3><span>保留作者与来源</span></div>
        {selectedSources.map(source=><SourceCard key={source.id} source={source} onExplore={enterGalaxy}/>)}
        <form className="ms-journey-search" onSubmit={e=>{e.preventDefault();void findMore()}}><label htmlFor="ms-journey-query">再找一些知乎讨论</label><div><input id="ms-journey-query" maxLength={160} value={query} onChange={e=>setQuery(e.target.value)} placeholder={`例如：${realm.title}中的${realm.pair.includes('photography')?'摄影叙事':'自然与时间'}`}/><button type="submit" disabled={searching||aiBusy}><Search size={16}/>{searching?'检索中…':'搜索'}</button></div></form>
        <div className="ms-ai-journey"><p className="ms-muted">已解锁 AI 的访客可以用本旅程前六份资料与调酒时选入的个人文字整理阅读导引。</p><button type="button" disabled={aiBusy||searching} onClick={()=>void synthesizeJourney()}><Sparkles size={15}/>{aiBusy?'正在整理…':'AI 整理这段旅程'}</button>{trip.progress.drafts['ai-journey']&&<label className="ms-field">AI 导引草稿 · 可编辑<textarea value={trip.progress.drafts['ai-journey']} maxLength={12000} onChange={e=>updateDraft({'ai-journey':e.target.value})}/></label>}</div>
        <label className="ms-field">作品名称<input maxLength={120} value={trip.progress.drafts.title??activity.outputTitle} onChange={e=>updateDraft({title:e.target.value})}/></label>
        <button type="button" className="ms-primary" onClick={saveOutcome}><Check size={16}/>把作品放回小屋</button>
        {(notice||searchError||error)&&<p role="status" className={searchError?'ms-error':'ms-notice'}>{searchError||error||notice}</p>}
      </div>
    </section></div>}
  </main>
}
