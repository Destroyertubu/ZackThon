import { useEffect, useRef, useState } from 'react'
import { Camera, Play, Volume2, VolumeX } from 'lucide-react'
import type { ActivityDefinition } from './content'
import { usePersonalStore } from '../personal/store'

interface Props { activity:ActivityDefinition; drafts:Record<string,string>; update:(values:Record<string,string>)=>void; capture?:()=>string }
const toneNames=['C','D','E','G','A','C↑']
const tones=[261.63,293.66,329.63,392,440,523.25]
export default function ActivityWorkbench({activity,drafts,update,capture}:Props){
  const [notice,setNotice]=useState('')
  const [beat,setBeat]=useState(-1)
  const [playing,setPlaying]=useState(false)
  const muted=usePersonalStore(s=>s.data.settings.muted)
  const audio=useRef<AudioContext|null>(null)
  const timers=useRef<ReturnType<typeof setTimeout>[]>([])
  const alive=useRef(true)
  useEffect(()=>{alive.current=true;const scheduled=timers.current;return()=>{alive.current=false;scheduled.forEach(clearTimeout);void audio.current?.close();audio.current=null}},[])
  const field=(key:string,label:string,placeholder:string)=> <label className="ms-field" key={key}>{label}<textarea maxLength={3000} value={drafts[key]??''} placeholder={placeholder} onChange={e=>update({[key]:e.target.value})}/></label>
  async function photograph(index:number){
    if(!capture){setNotice('风景还在准备，请稍后重试');return}
    try{
      const source=capture();const img=new Image();img.src=source;await img.decode()
      const canvas=document.createElement('canvas');canvas.width=480;canvas.height=Math.round(480*img.height/img.width);canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height)
      if(alive.current){update({[`photo${index}`]:canvas.toDataURL('image/jpeg',.62)});setNotice('实景照片已存入这次旅程，可以关上手记换一个观察位置。')}
    }catch{if(alive.current)setNotice('这次没有拍到照片，请等场景加载完成再试。')}
  }
  const sequence=(row:number)=>drafts[`rhythm${row}`]??['10001000','00100010','00010001'][row]
  function play(){
    timers.current.forEach(clearTimeout);setPlaying(true)
    if(!muted){audio.current??=new AudioContext();void audio.current.resume()}
    for(let i=0;i<8;i++)timers.current.push(setTimeout(()=>{
      if(!alive.current)return;setBeat(i)
      if(muted||!audio.current)return
      const ctx=audio.current
      const pitches=activity.mode==='variation'?[tones[Number(drafts[`tone${i%4}`]??[0,2,3,5][i%4])]]:[0,1,2].filter(r=>sequence(r)[i]==='1').map(r=>[196,392,587.33][r])
      for(const freq of pitches){const oscillator=ctx.createOscillator();const gain=ctx.createGain();oscillator.type=activity.mode==='soundscape'?'sine':'triangle';oscillator.frequency.value=freq;gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.08,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.26);oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();oscillator.stop(ctx.currentTime+.28);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}}
    },i*350))
    timers.current.push(setTimeout(()=>{if(alive.current){setBeat(-1);setPlaying(false)}},8*350))
  }
  const photoMode=['storyboard','macro','framing','beats'].includes(activity.mode)
  const soundMode=['phrasing','beats','variation','soundscape'].includes(activity.mode)
  return <div className="ms-workbench">
    {photoMode&&<section><h3>{activity.mode==='macro'?'三个尺度的标本':activity.mode==='framing'?'你的取景对照':'我的实景三联画'}</h3><p className="ms-muted">拍摄当前三维风景。关闭手记后可以移动，回来继续取景。</p>
      <div className="ms-photo-strip">{[0,1,2].map(i=><div key={i} className="ms-photo"><div className="ms-photo-image">{drafts[`photo${i}`]?<img src={drafts[`photo${i}`]} alt={`我的第${i+1}幅实景照片`} style={activity.mode==='framing'?{objectFit:'cover',transform:`scale(${Number(drafts.crop??1)})`}:undefined}/>:<span>{activity.mode==='macro'?['远景','近景','微距'][i]:['开场','转折','结尾'][i]}</span>}</div><button type="button" onClick={()=>void photograph(i)}><Camera size={14}/> {drafts[`photo${i}`]?'重新拍摄':'拍下此刻'}</button><input aria-label={`第${i+1}幅画面的说明`} maxLength={200} value={drafts[`caption${i}`]??''} onChange={e=>update({[`caption${i}`]:e.target.value})} placeholder="这幅画面说了什么？"/></div>)}</div>
      {activity.mode==='framing'&&<label className="ms-field">取景范围 · 观察画面边缘被省略的事物<input aria-label="取景放大" type="range" min="1" max="2.5" step=".1" value={drafts.crop??1} onChange={e=>update({crop:e.target.value})}/></label>}
      <button type="button" onClick={()=>update({photo0:drafts.photo2??'',photo2:drafts.photo0??'',caption0:drafts.caption2??'',caption2:drafts.caption0??''})}>交换开场与结尾，比较叙事</button>
    </section>}
    {activity.mode==='letters'&&<div className="ms-letter-pair">{field('yesterday','昨天寄来的信','我之所以想这样选择，是因为……')}{field('tomorrow','明天的回信','你还不知道的一件事是……')}<label className="ms-field">这次决定寄出<select value={drafts.sent??'yesterday'} onChange={e=>update({sent:e.target.value})}><option value="yesterday">昨天的信</option><option value="tomorrow">明天的回信</option><option value="both">两封一起寄出</option></select></label></div>}
    {activity.mode==='fieldnotes'&&<>{['叶面','边缘','根部'].map((title,i)=>field(`observation${i}`,`${title} · 可见事实`,'写下颜色、形状、大小或位置……'))}{field('plantLetter','植物的来信 · 文学想象','如果你是这株植物，你会怎样描述今天？')}</>}
    {activity.mode==='seasons'&&<><div className="ms-seasons">{['春','夏','秋','冬'].map((s,i)=><button type="button" key={s} aria-pressed={drafts.season===s} className={`ms-season ms-season-${i}`} onClick={()=>update({season:s})}>{s}<small>{['新叶萌发','树冠浓密','叶色转变','枝条显露'][i]}</small></button>)}</div>{field('changes','改变与延续','改变的部分：\n持续的部分：')}{field('counterexample','这个比喻在哪里失效？','树的季节和人的生活，有什么无法对应？')}</>}
    {soundMode&&<section><div className="ms-inline"><h3>{activity.mode==='variation'?'每次改变一个音':'八拍声景'}</h3><button type="button" onClick={()=>usePersonalStore.getState().settings({muted:!muted})}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>} {muted?'静音 · 视觉节拍':'声音已开启'}</button></div>
      {activity.mode==='variation'?<div className="ms-note-sequence">{[0,1,2,3].map(i=><label key={i}>第 {i+1} 音<select value={drafts[`tone${i}`]??[0,2,3,5][i]} onChange={e=>update({[`tone${i}`]:e.target.value})}>{toneNames.map((n,j)=><option value={j} key={n}>{n}</option>)}</select></label>)}</div>:<div className="ms-sequencer">{['风与叶','水的回声','步履'].map((name,row)=><div key={name}><span>{name}</span>{Array.from({length:8},(_,i)=><button type="button" key={i} aria-label={`${name}第${i+1}拍`} aria-pressed={sequence(row)[i]==='1'} className={beat===i?'current-beat':''} onClick={()=>{const next=sequence(row).split('');next[i]=next[i]==='1'?'0':'1';update({[`rhythm${row}`]:next.join('')})}}>{sequence(row)[i]==='1'?'●':'·'}</button>)}</div>)}</div>}
      <div className="ms-inline"><button type="button" disabled={playing} onClick={play}><Play size={15}/> {playing?`第 ${beat+1} 拍`:'播放 / 观察节奏'}</button><span className="ms-muted">{activity.mode==='variation'?'C · E · G · C↑ 是最初的排列':'音色为原创合成提示；静音时用光点观察节奏。'}</span></div>
      {activity.mode==='variation'&&field('identity','从何时起，它不再是原来的旋律？','写下标准，再给出一个挑战它的反例。')}
      {activity.mode==='phrasing'&&field('phrasing','带着停顿的文字','用 / 标记短停顿，用 // 标记一次长停顿。')}
    </section>}
    {notice&&<p role="status" className="ms-muted">{notice}</p>}
  </div>
}
