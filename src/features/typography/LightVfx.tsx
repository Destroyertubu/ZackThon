import { advanceShader, setUniform } from './vfxAnimation'
import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useReducedMotion } from './useReducedMotion'

/** Kenney CC0 particles are animated in one GPU batch, not a sequence of DOM elements. */
export function LightVapor({ color = '#e6cba0', active = false }: { color?: string; active?: boolean }) {
  const [mist, star] = useTexture(['/textures/typography/mist.png','/textures/typography/starlight.png'])
  const reduced = useReducedMotion()
  const resources = useMemo(() => {
    const positions: number[] = [], seeds: number[] = []
    for(let i=0;i<44;i++){const seed=(i*137%997)/997;positions.push(Math.sin(i*2.399)*.34,.42,Math.cos(i*2.399)*.16);seeds.push(seed)}
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1))
    const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},strength:{value:.2},mist:{value:mist},star:{value:star},tint:{value:new THREE.Color(color)}},
      vertexShader:`attribute float seed;uniform float time;uniform float strength;varying float fade;varying float kind;void main(){float t=fract(seed+time*.11);vec3 p=position;p.x+=sin(time*.7+seed*20.)*.13*t;p.y+=t*.68;p.z+=cos(seed*14.+time*.4)*.06;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;kind=step(.62,seed);gl_PointSize=mix(110.,18.,kind)/max(1.,-mv.z);fade=sin(t*3.14159)*strength;}`,
      fragmentShader:`uniform sampler2D mist;uniform sampler2D star;uniform vec3 tint;varying float fade;varying float kind;void main(){vec4 s=mix(texture2D(mist,gl_PointCoord),texture2D(star,gl_PointCoord),kind);gl_FragColor=vec4(tint, s.a*fade*mix(.16,.9,kind));}`,
      transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})
    return{geometry,material}
  },[mist,star,color])
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose()},[resources])
  useFrame((_,delta)=>{if(!reduced)advanceShader(resources.material,delta);setUniform(resources.material,'strength',reduced?.12:active?.85:.38)})
  return <points name="kenney-cocktail-vapor" geometry={resources.geometry} material={resources.material} frustumCulled={false} raycast={()=>{}}/>
}

export function MaterialCaustics({ position, rotation = [-Math.PI/2,0,0], scale = 2.4, color = '#d4ab6b' }: { position:[number,number,number]; rotation?:[number,number,number]; scale?:number; color?:string }) {
  const mask=useTexture('/textures/typography/caustics.png')
  const reduced=useReducedMotion()
  const material=useMemo(()=>new THREE.ShaderMaterial({uniforms:{time:{value:0},mask:{value:mask},tint:{value:new THREE.Color(color)}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform sampler2D mask;uniform vec3 tint;void main(){vec2 p=vUv-.5;float fade=1.-smoothstep(.2,.5,length(p));vec2 uv=vUv+vec2(sin(time*.32+p.y*7.),cos(time*.26+p.x*7.))*.027;float light=texture2D(mask,uv).r;gl_FragColor=vec4(tint,light*fade*.22);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide}),[mask,color])
  useEffect(()=>()=>material.dispose(),[material])
  useFrame((_,delta)=>{if(!reduced)advanceShader(material,delta)})
  return <mesh name="kenney-material-caustics" position={position} rotation={rotation} material={material} raycast={()=>{}}><planeGeometry args={[scale,scale]}/></mesh>
}
