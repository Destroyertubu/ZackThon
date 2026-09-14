import type { WorldPoint } from '../realmDefinitions'
export const MOON_STAGES = [[0,15,5],[-14,5,5],[-9,-14,6],[13,-13,6],[15,9,5]] as const
/** Curved seating deliberately opens at every connecting bridge. */
export function stageSeatRuns(x:number,z:number,radius:number,tier:number):WorldPoint[][] {
  const index=MOON_STAGES.findIndex(stage=>stage[0]===x&&stage[1]===z)
  const exits=[MOON_STAGES[(index+4)%5],MOON_STAGES[(index+1)%5]].map(p=>Math.atan2(-(p[1]-z),p[0]-x))
  const runs:WorldPoint[][]=[];let run:WorldPoint[]=[]
  for(let i=0;i<=48;i++){
    const angle=Math.PI*.16+i/48*Math.PI*.68
    if(exits.some(exit=>Math.abs(Math.atan2(Math.sin(angle-exit),Math.cos(angle-exit)))<.38)){
      if(run.length>1)runs.push(run);run=[];continue
    }
    run.push([x+Math.cos(angle)*(radius-tier*.65),.4+tier*.3,z-Math.sin(angle)*(radius-tier*.65)])
  }
  if(run.length>1)runs.push(run)
  return runs
}
