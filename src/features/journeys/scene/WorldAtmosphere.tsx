import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { random } from './geometry'
import { advanceWorldUniform } from './worldAnimation'

/** One GPU batch for falling rain or quietly drifting pollen/fireflies. */
export default function WorldAtmosphere({rain=false,reducedMotion=false,color='#e1d6a0'}:{rain?:boolean;reducedMotion?:boolean;color?:string}) {
  const bundle=useMemo(()=>{
    const rnd=random(rain?617:815),count=rain?1050:200,positions:number[]=[],phases:number[]=[]
    for(let i=0;i<count;i++){
      const x=(rnd()-.5)*64,y=rnd()*14,z=(rnd()-.5)*64,phase=rnd()*6.28
      positions.push(x,y,z);phases.push(phase)
      if(rain){positions.push(x-.02,y+.45,z);phases.push(phase)}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));geometry.computeBoundingSphere()
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:rain?THREE.NormalBlending:THREE.AdditiveBlending,
      uniforms:{time:{value:0},tint:{value:new THREE.Color(color)}},
      vertexShader:`uniform float time;attribute float phase;varying float opacity;
        void main(){vec3 p=position;
        ${rain?'p.y=mod(p.y-time*6.4+1008.,14.);opacity=.2;':'p.x+=sin(time*.22+phase)*.7;p.y+=sin(time*.32+phase)*.28;opacity=.35+.25*sin(time*1.7+phase);'}
        vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(68./max(5.,-view.z),1.2,7.);opacity*=(1.-smoothstep(15.,48.,-view.z));}`,
      fragmentShader:`uniform vec3 tint;varying float opacity;void main(){
        ${rain?'gl_FragColor=vec4(tint,opacity);':'float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(tint,pow(1.-r,2.)*opacity);'}
      }`,toneMapped:false,
    })
    return {geometry,material}
  },[rain,color])
  useEffect(()=>()=>{bundle.geometry.dispose();bundle.material.dispose()},[bundle])
  useFrame((_,delta)=>{if(!reducedMotion)advanceWorldUniform(bundle.material.uniforms.time,delta)})
  return rain?<lineSegments geometry={bundle.geometry} material={bundle.material} frustumCulled={false}/>:<points geometry={bundle.geometry} material={bundle.material} frustumCulled={false}/>
}
