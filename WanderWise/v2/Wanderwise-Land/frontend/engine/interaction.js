import {dist,project} from './math.js';

// Reading follows proximity, not the camera or a hidden crosshair. Walls still block it.
export function selectTarget(engine){
 const head=[engine.player.x,engine.player.y+1.18,engine.player.z];
 const close=[],directions=[];
 for(const target of engine.targets){
  const distance=dist(engine.player,target.position),point=[target.position.x,target.position.y,target.position.z];
  if(target.type==='excerpt'||target.type==='facility'){
   if(distance<=(target.type==='facility'?3:4)&&!engine.obstructed(head,point))close.push({target,distance});
  }else{
   if(distance<=4&&!engine.obstructed(head,point))close.push({target,distance});
   else if(engine.renderer.vp){const p=project(point,engine.renderer.vp);if(p[2]>=0&&Math.abs(p[0])<.35&&Math.abs(p[1])<.24&&!engine.obstructed(head,point)&&!engine.obstructed(engine.eye,point))directions.push({target,distance})}
  }
 }
 // A nearby quote always wins over its topic marker; hotkey meanings stay unchanged.
 const priority=t=>t.type==='node'?1:0;
 close.sort((a,b)=>priority(a.target)-priority(b.target)||a.distance-b.distance||a.target.id.localeCompare(b.target.id));
 directions.sort((a,b)=>a.distance-b.distance);
 return close[0]?.target||directions[0]?.target||null;
}

export function pickTarget(immediate=false){
 const selected=selectTarget(this);
 if(selected?.id!==this.aimId){this.aimId=selected?.id;this.aimSince=this.time}
 if((immediate||this.time-this.aimSince>.1)&&this.target?.id!==selected?.id){this.target=selected;this.callbacks.target?.(selected,selected?dist(this.player,selected.position):0)}
}
