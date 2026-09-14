import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import GalaxyExplorer from './App'
import { usePersonalStore } from '../personal/store'
import './fonts.css'
import './styles.css'

const PAGE_TITLE = 'Wanderwise · 知识星系'
export default function GalaxyPage() {
  const navigate=useNavigate();const location=useLocation()
  const entry=useMemo(()=>{
    const data=usePersonalStore.getState().data
    const anchor=(location.state as {wanderwiseEntry?:boolean}|null)?.wanderwiseEntry?data.returnAnchor:null
    const journey=anchor?.journeyId?data.journeys.find(j=>j.id===anchor.journeyId):undefined
    const sourceIds=anchor?.sourceId?[anchor.sourceId,...(journey?.sourceIds??[])]:journey?.sourceIds??[]
    return {anchor,sources:[...new Set(sourceIds)].map(id=>data.sources[id]).filter(Boolean)}
  },[location.state])
  useEffect(()=>{
    const previousTitle=document.title;document.title=PAGE_TITLE
    const returnToGarden=(event:Event)=>{
      if(!(event instanceof CustomEvent)||!event.cancelable)return
      event.preventDefault()
      const anchor=entry.anchor
      if(anchor?.journeyId&&anchor.route.startsWith('/journey/')){
        usePersonalStore.getState().updateJourney(anchor.journeyId,{pose:anchor.pose,activeStation:anchor.stationId})
        navigate(`${anchor.route}?trip=${encodeURIComponent(anchor.journeyId)}`)
      }else navigate(anchor?.route??'/observatory',{state:{stationId:anchor?.stationId}})
    }
    window.addEventListener('wanderwise:return',returnToGarden)
    return()=>{window.removeEventListener('wanderwise:return',returnToGarden);if(document.title===PAGE_TITLE)document.title=previousTitle}
  },[navigate,entry])
  return <section className="galaxy-page" aria-label="Wanderwise 知识星系"><GalaxyExplorer returnLabel={`返回${entry.anchor?.label??'观星台'}`} entrySources={entry.sources}/></section>
}
