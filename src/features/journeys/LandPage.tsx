import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Compass, Sparkles, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import LandWorld from './scene/LandWorld'
import { LAND_DEFINITION, REALM_DEFINITIONS } from './realmDefinitions'
import type { RealmStation } from './realmDefinitions'
import { CURATED_SOURCES } from './content'
import { SceneBoundary } from './SceneBoundary'
import SourceCard from '../personal/SourceCard'
import { usePersonalStore } from '../personal/store'
import type { ContentSource, ScenePose } from '../personal/types'
import { useGameStore } from '../../state/gameStore'
import { KNOWLEDGE_INGREDIENTS } from '../../components/observatory/gardenRecipes'
import '../personal/personal.css'
import './journeys.css'

const messages:Record<string,{title:string;text:string}>={
  forest:{title:'森林 · 从一个兴趣分岔',text:'先选一个熟悉的话题，再沿着相邻的领域走一点。路口的意义来自你正在追问什么。'},
  lake:{title:'镜湖 · 为两种解释留位置',text:'把两份材料并置。写下它们共享的前提，也保留无法消解的差异。'},
  mountain:{title:'山径 · 一步一步地深入',text:'先观察，再理解方法，最后尝试解释。高度记录你的阅读进度。'},
  coast:{title:'海岸 · 去一处陌生的地方',text:'选择两个相遇的领域，把这个方向带上观星台。调好酒之后，就能走进它对应的世界。'},
}
export default function LandPage(){
  const navigate=useNavigate();const location=useLocation();const data=usePersonalStore(s=>s.data);const quality=useGameStore(s=>s.qualityMode)
  const [near,setNear]=useState<RealmStation|null>(null);const [active,setActive]=useState<string|null>(()=>(location.state as {stationId?:string}|null)?.stationId??null)
  const [topic,setTopic]=useState('nature');const [step,setStep]=useState(0)
  const [initial]=useState(()=>data.poses.land);const pose=useRef<ScenePose|undefined>(initial)
  const dialog=useRef<HTMLElement>(null)
  const onPose=useCallback((value:ScenePose)=>{pose.current=value;usePersonalStore.getState().savePose('land',value)},[])
  const interact=useCallback((id:string)=>{if(id==='home'){navigate('/home');return}setActive(id)},[navigate])
  useEffect(()=>{const old=document.title;document.title='镜海群岛 · 门外的思想世界';return()=>{document.title=old}},[])
  useEffect(()=>{if(!active)return;dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setActive(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[active])
  function explore(source:ContentSource){usePersonalStore.getState().setReturn({route:'/land',label:'镜海群岛',stationId:active??undefined,sourceId:usePersonalStore.getState().putSource(source),pose:pose.current});navigate(`/galaxy?q=${encodeURIComponent(source.title.slice(0,160))}`,{state:{wanderwiseEntry:true}})}
  const selected=CURATED_SOURCES.filter(s=>s.tags?.includes(topic)).slice(0,3)
  const lakeNote=data.notes.find(n=>n.id==='land:lake')
  return <main className="ms-world-page">
    <SceneBoundary><Suspense fallback={<div className="ms-world-loading">镜海正在醒来…</div>}><LandWorld initialPose={initial} onPose={onPose} onNearStation={setNear} onInteract={interact} disabled={!!active} qualityMode={quality}/></Suspense></SceneBoundary>
    <div className="ms-world-vignette"/>
    <header className="ms-world-header"><div><p className="ms-eyebrow">漫思 WANDERWISE / 家园之外</p><h1>镜海群岛</h1><p>森林容纳岔路，湖水留住思考，海岸通向下一次相遇。</p></div><nav><button type="button" onClick={()=>navigate('/home')}><ArrowLeft size={15}/>返回小屋</button><button type="button" onClick={()=>navigate('/observatory')}><Sparkles size={15}/>前往观星台</button></nav></header>
    <aside className="ms-land-compass"><Compass size={20}/><span>珍珠岸 · 暮色</span><div>{LAND_DEFINITION.stations.map(s=><button type="button" key={s.id} title={s.title} onClick={()=>interact(s.id)}><BookOpen size={16}/>{s.title}</button>)}</div></aside>
    {near&&!active&&<button type="button" className="ms-near-prompt" onClick={()=>interact(near.id)}><kbd>E</kbd>{near.title}<BookOpen size={16}/></button>}
    <footer className="ms-world-footer"><span>WASD 行走 · 鼠标环顾 · 靠近后 E 互动 · Esc 释放视角</span></footer>
    {active&&messages[active]&&<div className="ms-notebook-backdrop" onClick={()=>setActive(null)}><section className="ms-notebook" ref={dialog} role="dialog" aria-modal="true" aria-label={messages[active].title} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key!=='Tab')return;const list=e.currentTarget.querySelectorAll<HTMLElement>('button,a[href],input,textarea,select');const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}}>
      <header><div><p className="ms-eyebrow">镜海群岛 / {active==='coast'?'下一次出发':'沿路停留'}</p><h2>{messages[active].title}</h2></div><button type="button" aria-label="继续漫步" onClick={()=>setActive(null)}><X size={20}/></button></header>
      <div className="ms-notebook-content"><p className="ms-lead">{messages[active].text}</p>
        {active!=='coast'&&<div className="ms-topic-tabs">{KNOWLEDGE_INGREDIENTS.map(i=><button type="button" key={i.id} aria-pressed={topic===i.id} onClick={()=>{setTopic(i.id);setStep(0)}}>{i.name}</button>)}</div>}
        {active==='forest'&&<><p className="ms-muted">选择材料进入星系，会从这个林间路口返回。</p>{selected.map(s=><SourceCard key={s.id} source={s} onExplore={explore}/>)}<button type="button" onClick={()=>usePersonalStore.getState().setInterests([...data.interests,KNOWLEDGE_INGREDIENTS.find(i=>i.id===topic)!.name])}>把这个兴趣带回小屋</button></>}
        {active==='lake'&&<><div className="ms-comparison">{selected.slice(0,2).map(s=><SourceCard key={s.id} source={s} onExplore={explore}/>)}</div><label className="ms-field">相同的前提，不同的解释<textarea maxLength={5000} value={lakeNote?.text??''} placeholder="我同意……\n我仍然不确定……\n它们可能在使用不同的……" onChange={e=>usePersonalStore.getState().saveNote({id:'land:lake',title:'镜湖边的对照',text:e.target.value})}/></label><p className="ms-muted">这页对照会自动保存在小屋的笔记中。</p></>}
        {active==='mountain'&&<><div className="ms-topic-tabs">{['观察','理解方法','提出解释'].map((name,i)=><button type="button" key={name} aria-pressed={step===i} onClick={()=>setStep(i)}>{i+1}. {name}</button>)}</div>{selected[step]&&<SourceCard source={selected[step]} onExplore={explore}/>}<label className="ms-field">这一步带来的问题<textarea maxLength={3000} value={data.notes.find(n=>n.id===`land:mountain:${topic}:${step}`)?.text??''} onChange={e=>usePersonalStore.getState().saveNote({id:`land:mountain:${topic}:${step}`,title:`山径 · ${topic} · 第${step+1}步`,text:e.target.value})}/></label><button type="button" onClick={()=>setStep((step+1)%3)}>{step===2?'回看最初的观察':'继续向上一步'}</button></>}
        {active==='coast'&&<div className="ms-realm-catalog">{REALM_DEFINITIONS.map(r=><button type="button" key={r.id} onClick={()=>navigate('/observatory',{state:{openWorkshop:true,recipePair:r.pair}})}><span>{r.pair.map(id=>KNOWLEDGE_INGREDIENTS.find(i=>i.id===id)?.name).join(' × ')}</span><h3>{r.title}</h3><p>{r.description}</p><small>带这个方向去调酒 ↗</small></button>)}</div>}
      </div>
    </section></div>}
  </main>
}
