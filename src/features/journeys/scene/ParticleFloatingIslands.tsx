import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PARTICLE_ISLANDS, createParticleIsland, type ParticleIsland } from './particleIslands'
import type { TideSignal } from './atmosphereMotion'
import type { MirrorMode } from './MirrorGeometry'

function Island({ island, fine, signal, mode }: { island: ParticleIsland; fine: boolean; signal: TideSignal; mode: MirrorMode }) {
  const { gl } = useThree(), focus = useRef(0)
  const resources = useMemo(() => {
    const geometry = createParticleIsland(island, fine)
    const material = new THREE.ShaderMaterial({
      name: 'star-tide-floating-island', vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false,
      uniforms: { time: signal.time, pulse: signal.pulse, age: signal.age, origin: signal.origin,
        response: signal.color, focus: { value: 0 }, viewportHeight: { value: 720 },
        islandCenter: { value: new THREE.Vector3(...island.center) }, phase: { value: island.seed },
        daylight: { value: mode === 'night' ? 0 : 1 } },
      vertexShader: `uniform float time,phase,pulse,age,focus,viewportHeight;uniform vec2 origin;
        uniform vec3 islandCenter;attribute vec4 starData;attribute vec2 starMotion;
        varying vec3 vColor;varying float vAlpha,vSpark,vResponse;
        void main(){
          vec3 p=position;float kind=starData.x,seed=starData.y,flow=starMotion.y;
          float clock=time*.22;float fade=1.;
          if(kind>1.5&&kind<2.5){
            float life=fract(time*.085+seed);p.y-=life*starMotion.x;
            p.x+=sin(life*5.+flow)*life*1.15;p.z+=cos(life*4.+flow)*life*.65;
            fade=smoothstep(0.,.08,life)*(1.-smoothstep(.62,1.,life));
          }else if(kind>.5&&kind<1.5){
            float a=clock*.13;p.x=position.x*cos(a)-position.z*sin(a);
            p.z=position.x*sin(a)+position.z*cos(a);p.y+=sin(clock+flow)*.65;
          }else{
            p.y+=sin(p.x*.27+p.z*.18-clock)*.12;
          }
          p.y+=sin(time*.12+phase)*.58;
          float distanceToPulse=length(islandCenter.xz-origin);
          float wave=exp(-pow((distanceToPulse-age*20.)/24.,2.))*pulse;
          float breathe=.78+.22*sin(clock*.8+phase+p.x*.09);
          float current=pow(.5+.5*sin(atan(position.z,position.x)*2.-clock*.7+phase),9.);
          vResponse=wave*.8+focus*.35;
          vColor=color*(1.15+current*.6+vResponse);
          vAlpha=starData.w*fade*breathe*(.7+seed*.5);
          vSpark=step(.965,seed)*step(.5,kind);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          float pixels=starData.z*viewportHeight*projectionMatrix[1][1]/max(1.,-mv.z);
          gl_PointSize=clamp(pixels*(1.+vResponse*.3),1.25,9.);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: `uniform vec3 response;uniform float daylight;varying vec3 vColor;varying float vAlpha,vSpark,vResponse;
        void main(){vec2 p=gl_PointCoord*2.-1.;float r2=dot(p,p);if(r2>1.)discard;
          float core=exp(-r2*14.),halo=exp(-r2*3.5)*(1.-smoothstep(.5,1.,r2));
          float rays=(exp(-abs(p.x)*35.)+exp(-abs(p.y)*35.))*exp(-r2*5.)*vSpark*.3;
          float alpha=(core*.8+halo*.32+rays)*vAlpha;
          gl_FragColor=vec4(vColor+response*vResponse*.25,alpha*(1.+daylight*.28));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    return { geometry, material, direction: new THREE.Vector3(), toIsland: new THREE.Vector3(), viewport: new THREE.Vector4() }
  }, [island, fine, signal, mode])
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose() }, [resources])
  useFrame(({ camera }, delta) => {
    // Gaze works with natural mouse look and touch, without stealing clicks from the garden.
    camera.getWorldDirection(resources.direction)
    resources.toIsland.set(...island.center).sub(camera.position).normalize()
    const target = THREE.MathUtils.smoothstep(resources.direction.dot(resources.toIsland), .97, .998)
    focus.current = THREE.MathUtils.damp(focus.current, target, 2, Math.min(.05, delta))
    resources.material.uniforms.focus.value = focus.current
  })
  return <points name={`particle-island-${island.id}`} position={island.center} geometry={resources.geometry}
    material={resources.material} dispose={null} renderOrder={11} userData={{ reflectInWater: true }}
    onBeforeRender={() => {
      // The reflection has its own viewport; use its height so reflected stars retain their scale.
      gl.getCurrentViewport(resources.viewport)
      resources.material.uniforms.viewportHeight.value = resources.viewport.w
    }}/>
}

export default function ParticleFloatingIslands({ signal, mode, fine }: { signal: TideSignal; mode: MirrorMode; fine: boolean }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.domElement.dataset.landscape = 'particle-floating-islands'
    gl.domElement.dataset.islandCount = String(PARTICLE_ISLANDS.length)
    return () => { delete gl.domElement.dataset.landscape; delete gl.domElement.dataset.islandCount }
  }, [gl])
  return <group name="particle-floating-archipelago">
    {PARTICLE_ISLANDS.map(island => <Island key={island.id} island={island} fine={fine} signal={signal} mode={mode}/>)}
  </group>
}
