import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Mesh, InstancedMesh, type WebGLRenderer } from 'three'

function publishFrameStats(gl:WebGLRenderer,fps:number) {
  const info=gl.info,element=gl.domElement
  element.setAttribute('data-world-fps',fps.toFixed(1))
  element.setAttribute('data-world-triangles',String(info.render.triangles))
  element.setAttribute('data-world-draw-calls',String(info.render.calls))
  element.setAttribute('data-world-textures',String(info.memory.textures))
  element.setAttribute('data-world-geometries',String(info.memory.geometries))
}

function setAutoReset(gl:WebGLRenderer,autoReset:boolean) { gl.info.autoReset=autoReset }

/** Read-only DOM diagnostics for local performance audits; no on-screen panel or telemetry. */
export default function FrameDiagnostics() {
  const {gl,scene}=useThree(),sample=useRef({elapsed:0,frames:0}),durations=useRef<number[]>([]),history=useRef<{fps:number;p95Ms:number;calls:number;triangles:number}[]>([])
  useEffect(()=>{
    const element=gl.domElement,previous=gl.info.autoReset
    const context=gl.getContext(),debug=context.getExtension('WEBGL_debug_renderer_info')
    element.dataset.worldDevice=String(debug?context.getParameter(debug.UNMASKED_RENDERER_WEBGL):context.getParameter(context.RENDERER))
    const resetSample=()=>{sample.current={elapsed:0,frames:0};durations.current=[]}
    document.addEventListener('visibilitychange',resetSample)
    setAutoReset(gl,false)
    return ()=>{document.removeEventListener('visibilitychange',resetSample);setAutoReset(gl,previous);for(const key of ['worldFps','worldTriangles','worldDrawCalls','worldTextures','worldGeometries','worldDevice','worldMeshAudit','worldSamples','worldP95Ms'])delete element.dataset[key]}
  },[gl])
  useFrame((_,delta)=>{
    if(document.hidden){sample.current.elapsed=0;sample.current.frames=0;durations.current=[];gl.info.reset();return}
    sample.current.elapsed+=delta;sample.current.frames++;durations.current.push(delta*1000)
    if(sample.current.elapsed<2){gl.info.reset();return}
    publishFrameStats(gl,sample.current.frames/sample.current.elapsed)
    const ordered=durations.current.sort((a,b)=>a-b),p95=ordered[Math.floor(ordered.length*.95)]??0
    history.current.push({fps:Number((sample.current.frames/sample.current.elapsed).toFixed(1)),p95Ms:Number(p95.toFixed(1)),calls:gl.info.render.calls,triangles:gl.info.render.triangles})
    if(history.current.length>20)history.current.shift()
    gl.domElement.dataset.worldSamples=JSON.stringify(history.current)
    gl.domElement.dataset.worldP95Ms=p95.toFixed(1)
    durations.current=[]
    if(import.meta.env.DEV && !gl.domElement.dataset.worldMeshAudit){
      const rows:{name:string;triangles:number}[]=[]
      scene.traverse(object=>{
        if(object instanceof Mesh){
          const count=object.geometry.index?.count??object.geometry.attributes.position?.count??0
          rows.push({name:object.name||object.parent?.name||object.geometry.type,triangles:Math.round(count/3*(object instanceof InstancedMesh?object.count:1))})
        }
      })
      gl.domElement.setAttribute('data-world-mesh-audit',JSON.stringify(rows.sort((a,b)=>b.triangles-a.triangles).slice(0,12)))
    }
    sample.current.elapsed=0;sample.current.frames=0
    gl.info.reset()
  })
  return null
}
