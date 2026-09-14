import ShowcaseCamera from '@/features/showcase/ShowcaseCamera'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Html } from '@react-three/drei'
import * as THREE from 'three'
import JourneyTree from './JourneyTree'
import GardenShadowSchedule from '../../../components/observatory/GardenShadowSchedule'
import SceneReviewTools from './SceneReviewTools'
import FrameDiagnostics from './FrameDiagnostics'
import { KNOWLEDGE_INGREDIENTS, type KnowledgeId } from '../../../components/observatory/gardenRecipes'
import { getQualityProfile } from '../../../state/gameStore'
import type { WorldSceneProps } from './types'
import type { WalkWorld } from './navigation'
import MirrorSeaBackdrop from './MirrorSeaBackdrop'
import { createWorldGeometry } from './worldGeometry'
import { useWorldMaterials } from './materials'
import WorldController from './WorldController'
import WorldTouchControls from './WorldTouchControls'
import GalleryCredits from './GalleryCredits'
import WorldAtmosphere from './WorldAtmosphere'
import { sceneArt } from './sceneArt'
import { SUNSET_PRACTICAL_LIGHTS, SUNSET_SHORES } from './sunsetLayout'
import CoastlineRocks, { COAST_PATCH_SHORES } from './CoastlineRocks'
import SunsetAssets from './SunsetAssets'
import { advanceWorldUniform } from './worldAnimation'
import InteractionAccent from '@/features/presentation/InteractionAccent'

const PCF_SHADOW_MAP = 1

const SUNSET_WATER_SHORES=[...SUNSET_SHORES,...COAST_PATCH_SHORES]
const NIGHT_REALMS = new Set(['moonlight-andante','blue-hour-shutter','echo-paradox','forest-lento'])
function LoadingWorld() {
  return <Html center><div role="status" style={{whiteSpace:'nowrap',color:'#f4e7d2',padding:'14px 20px',borderRadius:16,background:'transparent',fontSize:14}}>正在铺开这一片风景…</div></Html>
}
function ReadySignal({onReady}:{onReady?:()=>void}) {
  const ready=useRef(false)
  useFrame(()=>{if(!ready.current){ready.current=true;onReady?.()}})
  return null
}
function WorldModel({world,reducedMotion=false,onReady}:{world:WalkWorld;reducedMotion?:boolean;onReady?:()=>void}) {
  const time=useMemo(()=>({value:0}),[])
  const materials=useWorldMaterials(world.palette,time,world.id)
  const geometry=useMemo(()=>createWorldGeometry(world),[world])
  useEffect(()=>()=>geometry.forEach(item=>item.dispose()),[geometry])
  useFrame((_,delta)=>{
    if(!reducedMotion)advanceWorldUniform(time,delta)
  })
  const heroScale=world.id==='moss-letters'?2.45:world.id==='tree-time'?1.85:0
  return <group name={`journey-environment-${world.id}`}>
    {[...geometry].map(([key,item])=><mesh key={key} name={`world-${key}`} geometry={item} material={materials[key]} receiveShadow castShadow={!['glass','glow'].includes(key)} />)}
    {world.id==='sunset-boulevard'&&<><SunsetAssets materials={materials}/><CoastlineRocks/></>}
    {heroScale>0?<Suspense fallback={null}><group scale={heroScale}><JourneyTree reducedMotion={reducedMotion}/></group><ReadySignal onReady={onReady}/></Suspense>:<ReadySignal onReady={onReady}/>}
  </group>
}
export default function WorldCanvas({world,initialPose,initialStationId,onPose,onNearStation,onInteract,onCaptureReady,onReady,disabled=false,reducedMotion=false,qualityMode='auto',firstPercent=50,primaryKnowledge}:WorldSceneProps&{world:WalkWorld;firstPercent?:number;primaryKnowledge?:KnowledgeId}) {
  const profile=getQualityProfile(qualityMode),night=NIGHT_REALMS.has(world.id),still=reducedMotion
  const art=sceneArt(night)
  const ratio=Number.isFinite(firstPercent)?Math.max(.2,Math.min(.8,firstPercent/100)):.5
  const canonicalRatio=world.pair&&primaryKnowledge===world.pair[1]?1-ratio:ratio
  const lightColor=useMemo(()=>{
    const base=new THREE.Color(art.keyColor)
    if(!world.pair)return `#${base.getHexString()}`
    const colors=world.pair.map(id=>new THREE.Color(KNOWLEDGE_INGREDIENTS.find(item=>item.id===id)?.color??'#ffffff'))
    return `#${base.lerp(colors[0].lerp(colors[1],1-canonicalRatio),.1).getHexString()}`
  },[world,art.keyColor,canonicalRatio])
  const camera=useMemo(()=>({position:world.spawn.position,fov:61,near:.08,far:260}),[world])
  return <div className="journey-world-canvas" style={{position:'absolute',inset:0,overflow:'hidden',background:world.palette.skyTop}}>
    <Canvas frameloop="always" camera={camera} dpr={[1,profile.dprMax]} shadows={{type:PCF_SHADOW_MAP}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{
      gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=art.exposure
      gl.outputColorSpace=THREE.SRGBColorSpace
    }}>
      <FrameDiagnostics/>
      <GardenShadowSchedule smooth={!profile.postprocessing}/>
      <fog attach="fog" args={[world.palette.horizon,48,180]}/>
      <hemisphereLight args={[art.skyFill,art.groundFill,art.hemisphere]}/>
      <directionalLight position={art.keyPosition} color={lightColor} intensity={art.keyIntensity} castShadow shadow-mapSize={[profile.shadowMapSize,profile.shadowMapSize]} shadow-camera-near={1} shadow-camera-far={230} shadow-camera-left={-36} shadow-camera-right={36} shadow-camera-top={36} shadow-camera-bottom={-36} shadow-normalBias={.025} shadow-bias={-.00012} shadow-radius={3}/>
      <directionalLight position={[-12,14,28]} color="#aebbec" intensity={night?.18:.24}/>
      {night&&<><pointLight position={[0,4,14]} color="#efbb78" intensity={22} distance={16} decay={2}/><pointLight position={[-14,4,0]} color="#f0b797" intensity={18} distance={15} decay={2}/><pointLight position={[14,4,-12]} color="#eac2ac" intensity={22} distance={16} decay={2}/></>}
      {world.id==='sunset-boulevard'&&SUNSET_PRACTICAL_LIGHTS.filter((_,i)=>i>=7||i===0||i===5).map((position,i)=><pointLight key={i} position={position} color="#ffd094" intensity={i<2?9:20} distance={7} decay={2}/>)}
      <Suspense fallback={null}>
        <Environment files="/textures/kloppenheim_06_puresky_1k.hdr" environmentIntensity={art.environment}/>
        <MirrorSeaBackdrop shores={world.id==='sunset-boulevard'?SUNSET_WATER_SHORES:undefined} quality={profile} sunPosition={art.keyPosition} character={world.id==='sunset-boulevard'?'bay':'ocean'} compactTextures mode={night?'night':'dusk'} reducedMotion={still} waterLevel={-1.1} skyTop={world.palette.skyTop} skyBottom={world.palette.horizon} waterColor={world.palette.water} sunColor={world.palette.sun}/>
      </Suspense>
      <Suspense fallback={<LoadingWorld/>}>
        <WorldModel world={world} reducedMotion={still} onReady={onReady}/>
        {onInteract && world.stations.map(station => <InteractionAccent key={station.id}
          position={[station.position[0],station.position[1]+.073,station.position[2]]} rotation={[-Math.PI/2,0,0]}
          size={2.4} disabled={disabled} quiet={still} onActivate={() => onInteract(station.id)}/>)}
        {world.id!=='sunset-boulevard'&&<WorldAtmosphere rain={world.id==='blue-hour-shutter'} reducedMotion={still} color={world.id==='forest-lento'?'#c4e7b2':night?'#c8c8df':'#f5d7b0'}/>}
        <ShowcaseCamera sceneName="world"/>
        <WorldController world={world} initialPose={initialPose} initialStationId={initialStationId} onPose={onPose} onNearStation={onNearStation} onInteract={onInteract} onCaptureReady={onCaptureReady} disabled={disabled}/>
      </Suspense>
      <SceneReviewTools/>
    </Canvas>
    <WorldTouchControls disabled={disabled}/>
    {(world.id==='sunset-boulevard'||world.id==='blue-hour-shutter')&&!disabled&&<GalleryCredits/>}
  </div>
}
