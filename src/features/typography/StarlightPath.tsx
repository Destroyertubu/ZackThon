import { advanceShader } from './vfxAnimation'
import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useReducedMotion } from './useReducedMotion'

const PATHS = [
  [[3.65,.035,7.15],[4.7,.035,3.6],[5.3,.035,.8],[4.5,.035,-3.8],[2.7,.035,-6.15]],
  [[5.3,.037,.8],[6.25,.037,-.8],[6.9,.037,-2.6]],
] as const
export default function StarlightPath() {
  const reduced = useReducedMotion()
  const resources = useMemo(() => {
    const positions: number[] = [], progress: number[] = []
    PATHS.forEach(path => {
      const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p)))
      curve.getPoints(180).forEach((p,i) => { positions.push(...p.toArray()); progress.push(i / 180) })
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions,3))
    geometry.setAttribute('progress', new THREE.Float32BufferAttribute(progress,1))
    const material = new THREE.ShaderMaterial({ uniforms: { time:{value:0} },
      vertexShader:`attribute float progress;uniform float time;varying float glow;void main(){glow=.14+.86*pow(max(0.,sin(progress*22.-time*1.3)),8.);vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(35./max(1.,-mv.z),1.5,6.);}`,
      fragmentShader:`varying float glow;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(1.,.72,.32,glow*smoothstep(.5,0.,d));}`,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending })
    return {geometry,material}
  },[])
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose()},[resources])
  useFrame((_,delta)=>{if(!reduced)advanceShader(resources.material,delta)})
  return <points name="stardust-way-home-and-galaxy" geometry={resources.geometry} material={resources.material} raycast={()=>{}}/>
}
