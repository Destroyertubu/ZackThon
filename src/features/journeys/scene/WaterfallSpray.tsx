import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { getWaterfallLandings } from './waterfallLandings'
import type { TideSignal } from './atmosphereMotion'

/** Two batches connect the waterfall ribbons with the sea: landing foam and sparse drifting spray. */
export default function WaterfallLandings({ signal, waterLevel, night }: { signal: TideSignal; waterLevel: number; night: boolean }) {
  const resources = useMemo(() => {
    const landings = getWaterfallLandings(waterLevel), wet = landings.filter(landing => landing.hitsWater)
    const geometry = new THREE.PlaneGeometry(1, 1, 8, 8)
    const phase = new Float32Array(wet.map(landing => landing.phase))
    geometry.setAttribute('landingPhase', new THREE.InstancedBufferAttribute(phase, 1))
    const foam = new THREE.ShaderMaterial({
      uniforms: { time: signal.time, tint: { value: new THREE.Color(night ? '#779da9' : '#c6d9cd') } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false,
      vertexShader: `uniform float time;attribute float landingPhase;varying vec2 vUv;varying float phase;
        void main(){vUv=uv;phase=landingPhase;vec4 p=modelMatrix*instanceMatrix*vec4(position,1.);
          p.y+=sin(p.x*.22+p.z*.14-time*.8)*.026;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader: `uniform float time;uniform vec3 tint;varying vec2 vUv;varying float phase;
        void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
          float churn=.5+.5*sin(p.x*22.+sin(p.y*17.-time*1.3)+phase)*sin(p.y*27.+time*1.1);
          float core=exp(-r*r*10.)*(.25+churn*.5);
          float t=fract(time*.22+phase),t2=fract(t+.5);
          float rings=exp(-pow((r-t)/.035,2.))*(1.-t)+exp(-pow((r-t2)/.04,2.))*(1.-t2);
          float broken=.42+.58*smoothstep(-.3,.7,sin(a*7.+r*12.+phase)+sin(a*11.-time*.2)*.35);
          float alpha=(core+rings*broken*.3)*(1.-smoothstep(.78,1.,r));
          if(alpha<.008)discard;gl_FragColor=vec4(tint,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    const mesh = new THREE.InstancedMesh(geometry, foam, wet.length), transform = new THREE.Object3D()
    wet.forEach((landing, index) => { transform.position.set(...landing.position); transform.rotation.x = -Math.PI / 2; transform.scale.setScalar(landing.radius * 2); transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix) })
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.renderOrder = 9; mesh.name = 'waterfall-landing-foam'
    const points: number[] = [], seeds: number[] = [], size: number[] = []
    for (const landing of landings) for (let index = 0; index < 10; index++) {
      points.push(...landing.position); seeds.push(index * .137 + landing.phase); size.push(landing.radius)
    }
    const particles = new THREE.BufferGeometry()
    particles.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); particles.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1)); particles.setAttribute('spraySize', new THREE.Float32BufferAttribute(size, 1))
    const mist = new THREE.ShaderMaterial({
      uniforms: { time: signal.time, tint: { value: new THREE.Color(night ? '#648598' : '#c5d4d9') } },
      transparent: true, depthWrite: false, fog: false,
      vertexShader: `uniform float time;attribute float seed,spraySize;varying float fade,phase;
        void main(){phase=seed;float life=fract(time*.15+seed);vec3 p=position;
          p.x+=sin(seed*21.7)*spraySize*.32+life*.75;p.z+=cos(seed*9.7)*spraySize*.25;
          p.y+=.18+life*1.35;fade=sin(life*3.14159)*.115;
          vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(spraySize*(.38+life*.8)*260./max(1.,-mv.z),1.,32.);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 tint;varying float fade,phase;
        void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=dot(p,p);
          float wisps=.72+.28*sin(p.x*8.+phase)*sin(p.y*7.-phase);float alpha=exp(-r*3.8)*(1.-smoothstep(.6,1.,r))*fade*wisps;
          if(alpha<.004)discard;gl_FragColor=vec4(tint,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    return { geometry, foam, mesh, particles, mist }
  }, [signal, waterLevel, night])
  useEffect(() => () => { resources.mesh.dispose(); resources.geometry.dispose(); resources.foam.dispose(); resources.particles.dispose(); resources.mist.dispose() }, [resources])
  return <group name="waterfall-landing-effects" userData={{ excludeWaterReflection: true }} dispose={null}>
    <primitive object={resources.mesh}/>
    <points geometry={resources.particles} material={resources.mist} renderOrder={10} frustumCulled={false}/>
  </group>
}
