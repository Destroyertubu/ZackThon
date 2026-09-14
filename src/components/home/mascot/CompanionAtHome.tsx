import { useEffect, useRef, useState } from 'react'
import Liukanshan from './Liukanshan'
import { useGameStore } from '@/state/gameStore'
import { usePersonalStore } from '@/features/personal/store'

export default function CompanionAtHome(){
  const panel=useGameStore(s=>s.panel)
  const settings=usePersonalStore(s=>s.data.settings)
  const collectedTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined)
  const [greeting,setGreeting]=useState(true)
  const [searching,setSearching]=useState(false)
  const [collected,setCollected]=useState(false)
  useEffect(()=>{const t=setTimeout(()=>setGreeting(false),4200);return()=>clearTimeout(t)},[])
  useEffect(()=>{const listener=(e:Event)=>{if(e instanceof CustomEvent)setSearching(e.detail==='searching')};window.addEventListener('wanderwise:mascot-state',listener);return()=>window.removeEventListener('wanderwise:mascot-state',listener)},[])
  useEffect(()=>{
    const unsubscribe=usePersonalStore.subscribe((current,previous)=>{
      if(current.data.collections.length<=previous.data.collections.length)return
      clearTimeout(collectedTimer.current);setCollected(true)
      collectedTimer.current=setTimeout(()=>setCollected(false),1800)
    })
    return()=>{unsubscribe();clearTimeout(collectedTimer.current)}
  },[])
  const state=searching?'searching':collected?'collected':greeting?'greeting':panel?'reading':'idle'
  return <group>
    <mesh position={[-2.95,.08,-3.2]} receiveShadow><cylinderGeometry args={[.55,.58,.16,48]}/><meshStandardMaterial color="#64756b" roughness={.95}/></mesh>
    <Liukanshan position={[-2.95,.17,-3.2]} rotation={[0,.4,0]} state={state} animated={settings.mascotAnimated}/>
  </group>
}
