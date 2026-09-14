const labels:Record<string,string>={
  yesterday:'昨天寄来的信',tomorrow:'明天的回信',sent:'决定寄出',plantLetter:'植物的来信',
  observation0:'叶面观察',observation1:'边缘观察',observation2:'根部观察',
  caption0:'开场画面',caption1:'转折画面',caption2:'结尾画面',crop:'取景放大比例',
  season:'观察的季节',changes:'改变与延续',counterexample:'比喻的边界',
  identity:'旋律与身份',phrasing:'文字中的节奏','ai-journey':'经我编辑的阅读导引',
}
export function activityResult(drafts:Record<string,string>,stations:readonly {id:string;title:string}[]=[]):string{
  return Object.entries(drafts).filter(([key,value])=>value.trim()&&!key.startsWith('photo')&&key!=='title').map(([key,value])=>{
    let label=labels[key]??'旅程记录';let text=value
    if(key.startsWith('station-note:'))label=stations.find(s=>s.id===key.slice(13))?.title??'停靠点手记'
    if(key.startsWith('rhythm')){label=['风与叶','水的回声','步履'][Number(key.slice(6))]+' · 八拍';text=value.split('').map(v=>v==='1'?'●':'○').join(' ')}
    if(key.startsWith('tone')){label=`第 ${Number(key.slice(4))+1} 音`;text=['C','D','E','G','A','高音 C'][Number(value)]??value}
    if(key==='sent')text=({yesterday:'昨天的信',tomorrow:'明天的回信',both:'两封一起寄出'} as Record<string,string>)[value]??value
    return `${label}：${text}`
  }).join('\n\n')
}
