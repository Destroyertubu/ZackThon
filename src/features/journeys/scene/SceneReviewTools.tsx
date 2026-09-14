import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { createRoot, type Root } from 'react-dom/client'
import * as THREE from 'three'

/** Optional visual QA lens. It never writes a journey, collection, or player save. */
export default function SceneReviewTools() {
  const enabled=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('visualReview')==='1'
  const {camera,gl}=useThree()
  const [recording,setRecording]=useState(false),[file,setFile]=useState(''),[view,setView]=useState(0)
  const ui=useRef<Root|null>(null)
  const recorder=useRef<MediaRecorder|null>(null),recordStarted=useRef(0)
  const original=useRef<{position:THREE.Vector3;quaternion:THREE.Quaternion}|null>(null)
  const data=useRef<BlobPart[]>([])
  const tour=useRef(false),mounted=useRef(false),url=useRef(''),streamRef=useRef<MediaStream|null>(null),timer=useRef<number|undefined>(undefined)
  const isSunset=typeof window!=='undefined'&&window.location.pathname.includes('sunset-boulevard')
  useEffect(()=>{mounted.current=true;return ()=>{
    mounted.current=false;window.clearTimeout(timer.current)
    const rec=recorder.current;if(rec){rec.onstop=null;rec.ondataavailable=null;if(rec.state!=='inactive')rec.stop()}
    streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null;recorder.current=null
    if(url.current)URL.revokeObjectURL(url.current);url.current=''
  }},[])
  useFrame(()=>{
    if(!enabled||(!recording&&view===0))return
    if(!original.current)original.current={position:camera.position.clone(),quaternion:camera.quaternion.clone()}
    if(tour.current){
      const t=Math.min(1,(performance.now()-recordStarted.current)/16_000)
      if(isSunset){camera.position.set(.2,1.7,17-t*21);camera.lookAt(-2.5+Math.sin(t*5)*2,2.4,7-t*21)}
      else {camera.position.set(3.65,1.7,7.15);const a=.3+Math.sin(t*Math.PI*2)*1.6;camera.lookAt(3.65-Math.sin(a)*10,2.3,7.15-Math.cos(a)*10)}
    }else if(isSunset){
      if(view===1){camera.position.set(1,1.7,17);camera.lookAt(-4,2.5,10)}
      else if(view===2){camera.position.set(2,1.7,-1.8);camera.lookAt(10,-.2,-6)}
      else if(view===3){camera.position.set(0,1.7,-18);camera.lookAt(0,2.2,-29)}
      else if(view===4){camera.position.set(5.4,.65,-2);camera.lookAt(12,-.65,-3)}
      else if(view===5){camera.position.set(-1.5,1.7,22);camera.lookAt(5.2,2.8,20)}
      else if(view===6){camera.position.set(2,1.4,20.2);camera.lookAt(5.2,.8,20)}
    }else{
      if(view===5){camera.position.set(-3.9,1.8,1.35);camera.lookAt(-6.65,1.58,1.4)}
      else if(view===6){camera.position.set(.3,1.7,4.1);camera.lookAt(-2.6,.35,1.1)}
      else if(view===7){camera.position.set(4.7,1.7,5.8);camera.lookAt(8.8,2.6,2.1)}
      else {camera.position.set(3.65,1.7,7.15)
        const a=[.3,.3,1.9,3.5,5.1][view]??.3
        camera.lookAt(3.65-Math.sin(a)*10,2.2,7.15-Math.cos(a)*10)}
    }
  })
  function reset(){setView(0);tour.current=false;if(original.current){camera.position.copy(original.current.position);camera.quaternion.copy(original.current.quaternion);original.current=null}}
  function record(walk:boolean){
    if(!('MediaRecorder'in window)||recorder.current?.state==='recording'){return}
    const stream=gl.domElement.captureStream(30),type=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'
    let rec:MediaRecorder
    try{rec=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:8_000_000})}catch{stream.getTracks().forEach(t=>t.stop());return}
    streamRef.current=stream
    recorder.current=rec;data.current=[];recordStarted.current=performance.now();tour.current=walk
    rec.ondataavailable=e=>{if(e.data.size)data.current.push(e.data)}
    rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());streamRef.current=null;recorder.current=null;if(!mounted.current)return;if(url.current)URL.revokeObjectURL(url.current);const reader=new FileReader();reader.onload=()=>{if(mounted.current)setFile(String(reader.result))};reader.readAsDataURL(new Blob(data.current,{type:'video/webm'}));url.current='';setRecording(false);tour.current=false}
    rec.start(1000);setRecording(true);timer.current=window.setTimeout(()=>{if(rec.state==='recording')rec.stop()},16_000)
  }
  useEffect(()=>{
    if(!enabled)return
    const element=document.createElement('div');document.body.append(element);ui.current=createRoot(element)
    return ()=>{const root=ui.current;ui.current=null;queueMicrotask(()=>{root?.unmount();element.remove()})}
  },[enabled])
  useEffect(()=>{if(!enabled)return;ui.current?.render(<nav aria-label="场景验收镜头" style={{pointerEvents:'auto',position:'fixed',zIndex:9999,left:24,top:140,color:'#fff',display:'flex',gap:14,fontSize:13,textShadow:'0 1px 3px #000'}}>
    {(isSunset?[1,2,3,4,5,6]:[1,2,3,4,5,6,7]).map(i=><button key={i} onClick={()=>setView(i)}>镜头 {i}</button>)}
    <button onClick={reset}>恢复行走</button>
    <button disabled={recording} onClick={()=>record(false)}>{recording?'录制中':'录制水面'}</button>
    <button disabled={recording} onClick={()=>record(true)}>录制行走</button>
    {file&&<a href={file} download={`${isSunset?'sunset':'observatory'}-motion.webm`}>保存录像</a>}
  </nav>)})
  return null
}
