import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getQualityProfile, type QualityProfile } from '../../../state/gameStore'
import { MIRROR_MOON_POSITION, MIRROR_SUN_POSITION, advanceMirrorTime, type MirrorMode } from './MirrorGeometry'
import type { TideSignal } from './atmosphereMotion'
import { createWaterGeometry, createWaterShoreMap, WATER_WAVES, WATER_WAVE_GLSL, type WaterShore } from './waterSurface'
import { WaterReflection, clearWaterReflectionDiagnostics, publishWaterReflection } from './waterReflection'
import { MIRROR_SKY_GLSL } from './waterSky'

export type MirrorWaterProps = {
  mode: MirrorMode; reducedMotion?: boolean; waterLevel?: number; waterColor?: string
  skyTop?: string; skyBottom?: string; sunColor?: string; size?: number; signal?: TideSignal
  quality?: QualityProfile; sunPosition?: [number, number, number]
  shores?: readonly WaterShore[]; character?: 'pool' | 'bay' | 'ocean'
}
const EMPTY_SHORES: readonly WaterShore[] = []

/** One non-uniform mesh; only the optional planar reflection adds a render pass. */
export default function MirrorWater({ mode, reducedMotion = false, waterLevel = -1.1, waterColor,
  skyTop, skyBottom, sunColor, size = 400, signal, quality, sunPosition, shores = EMPTY_SHORES, character = 'ocean' }: MirrorWaterProps) {
  const profile = quality ?? getQualityProfile('auto')
  const { size: viewport, gl } = useThree(), mesh = useRef<THREE.Mesh>(null)
  const diagnosticsClock = useRef(0)
  const sun = sunPosition ?? (mode === 'night' ? MIRROR_MOON_POSITION : MIRROR_SUN_POSITION)
  const sunX = sun[0], sunY = sun[1], sunZ = sun[2]
  const geometry = useMemo(() => createWaterGeometry(size, profile.waterSegments), [size, profile.waterSegments])
  const shoreMap = useMemo(() => createWaterShoreMap(shores, size, 512), [shores, size])
  const reflection = useMemo(() => profile.reflectionHz > 0 ? new WaterReflection(waterLevel, profile.reflectionHz, 512, 288) : null, [waterLevel, profile.reflectionHz])
  useEffect(() => { reflection?.resize(Math.max(128, Math.round(viewport.width * profile.reflectionScale)), Math.max(128, Math.round(viewport.height * profile.reflectionScale))) }, [reflection, viewport.width, viewport.height, profile.reflectionScale])
  const material = useMemo(() => new THREE.ShaderMaterial({
    name: 'mirror-sea-gerstner-water', defines: { WAVE_COUNT: profile.waterWaves },
    uniforms: {
      time: signal?.time ?? { value: 0 }, pulse: signal?.pulse ?? { value: 0 }, age: signal?.age ?? { value: 100 }, origin: signal?.origin ?? { value: new THREE.Vector2() },
      responseColor: signal?.color ?? { value: new THREE.Color('#78c9c8') }, night: { value: mode === 'night' ? 1 : 0 },
      water: { value: new THREE.Color(waterColor ?? (mode === 'night' ? '#124951' : '#2c8c8c')) },
      top: { value: new THREE.Color(skyTop ?? (mode === 'night' ? '#071226' : '#7487a6')) },
      bottom: { value: new THREE.Color(skyBottom ?? (mode === 'night' ? '#6d7188' : '#efc4ab')) },
      sunlight: { value: new THREE.Color(sunColor ?? (mode === 'night' ? '#bbcfff' : '#ffd8a0')) },
      sunDirection: { value: new THREE.Vector3(sunX, sunY, sunZ).normalize() },
      seaSize: { value: size }, shoreMap: { value: shoreMap }, seaLevel: { value: waterLevel },
      waveScale: { value: character === 'pool' ? .09 : character === 'bay' ? .48 : 1 },
      waves: { value: WATER_WAVES.map(w => { const length = Math.hypot(...w.direction); return new THREE.Vector4(w.direction[0] / length, w.direction[1] / length, w.amplitude, 2 * Math.PI / w.length) }) },
      steepness: { value: WATER_WAVES.map(w => w.steepness) },
      reflectionMap: { value: reflection?.reflector.getRenderTarget().texture ?? shoreMap },
      reflectionMatrix: { value: reflection?.matrix ?? new THREE.Matrix4() }, reflectionReady: reflection?.ready ?? { value: 0 },
    },
    vertexShader: `uniform float time,seaSize,seaLevel,waveScale,pulse,age;uniform vec2 origin;uniform sampler2D shoreMap;
      varying vec3 vWorld,vNormal;varying float vCrest;varying vec2 vSurface;
      ${WATER_WAVE_GLSL}
      void main(){vec2 p=position.xz;vSurface=p;
        float shore=texture2D(shoreMap,p/seaSize+.5).r*64.-8.;
        float shelter=(.15+.85*smoothstep(0.,12.,shore))*waveScale;
        vec3 displaced,n;waveSurface(p,time,shelter,displaced,n);
        float d=distance(p,origin),front=d-age*2.2;
        float envelope=exp(-front*front/1.6)*exp(-d*.035)*pulse;
        displaced.y+=sin(front*8.)*envelope*.023;
        vCrest=displaced.y;vNormal=n;vWorld=vec3(displaced.x,displaced.y+seaLevel,displaced.z);
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
      }`,
    fragmentShader: `uniform float time,pulse,age,night,seaSize,seaLevel,waveScale,reflectionReady;
      uniform vec2 origin;uniform vec3 water,top,bottom,sunlight,sunDirection,responseColor;
      uniform sampler2D shoreMap,reflectionMap;uniform mat4 reflectionMatrix;
      varying vec3 vWorld,vNormal;varying vec2 vSurface;varying float vCrest;
      ${MIRROR_SKY_GLSL}
      void main(){vec2 p=vSurface;float shore=texture2D(shoreMap,p/seaSize+.5).r*64.-8.;
        float distanceToEye=length(cameraPosition-vWorld);
        float fineFade=1.-smoothstep(28.,135.,distanceToEye);
        float fineA=dot(p,vec2(5.8,2.7))-time*1.13,fineB=dot(p,vec2(-8.1,5.2))+time*.91;
        vec2 micro=vec2(cos(fineA)*.028-cos(fineB)*.019,cos(fineA)*.013+cos(fineB)*.012)*fineFade*(.25+.75*waveScale);
        vec3 n=normalize(vNormal+vec3(micro.x,0.,micro.y));
        float d=distance(p,origin),front=d-age*2.2;
        float ring=exp(-front*front/1.6)*exp(-d*.035)*pulse;
        vec2 radial=(p-origin)/max(d,.01);n=normalize(n+vec3(radial.x,0.,radial.y)*cos(front*8.)*ring*.09);
        vec3 view=normalize(cameraPosition-vWorld),reflected=reflect(-view,n);
        float fresnel=.02+.98*pow(1.-max(dot(view,n),0.),5.);
        vec3 environment=sampleMirrorSky(reflected);
        if(reflectionReady>.5){vec4 projected=reflectionMatrix*vec4(vWorld,1.);vec2 uv=projected.xy/max(projected.w,.0001);
          uv+=n.xz*.016/(1.+distanceToEye*.012);
          float edge=smoothstep(0.,.025,min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y)));
          if(projected.w>0.&&edge>0.)environment=mix(environment,texture2D(reflectionMap,clamp(uv,vec2(.001),vec2(.999))).rgb,edge);
        }
        float depth=clamp(.16+max(shore,0.)*.35,.08,18.);
        float shallow=exp(-depth*.7);
        vec3 transmission=exp(-vec3(.5,.11,.065)*depth);
        vec3 bed=mix(vec3(.075,.13,.105),water*vec3(.75,1.15,1.18),.62)*(.86+.14*mirrorNoise(p*.9));
        if(shallow>.1){
          vec2 flow=p*1.65+vec2(time*.073,-time*.097);
          vec2 warp=vec2(mirrorNoise(flow*.63+5.2),mirrorNoise(flow*.61-7.1))*1.8;
          float cellular=mirrorNoise(flow+warp);
          float caustic=smoothstep(.54,.64,cellular)*(1.-smoothstep(.66,.76,cellular));
          bed+=vec3(.025,.045,.038)*caustic*shallow*(1.-night*.82);
        }
        vec3 body=mix(water*.62,bed*transmission,shallow*.6);
        body+=water*vec3(.32,.45,.49)*(1.-transmission)*.5;
        environment*=vec3(.72,.91,1.03);
        float reflectionStrength=(.07+fresnel*.59)*(1.-shallow*.18);
        vec3 color=mix(body,environment,reflectionStrength);
        vec3 halfVector=normalize(sunDirection+view);
        float glint=pow(max(dot(n,halfVector),0.),240.);
        float broadGlint=pow(max(dot(n,halfVector),0.),38.);
        color+=sunlight*(glint*1.5+broadGlint*.045)*(1.-night*.53);
        float edgeNoise=mirrorNoise(p*1.2+vec2(time*.13,-time*.08));
        float tidePhase=time*.48+mirrorNoise(p*.09)*4.;
        float advancing=.5+.5*sin(tidePhase),retreatFade=smoothstep(-.15,.7,cos(tidePhase));
        float arrival=.15+advancing*.8+vCrest*.9;
        float swash=exp(-pow((shore-arrival-edgeNoise*.55)/.2,2.));
        float patches=smoothstep(.47,.7,mirrorNoise(p*.85+vec2(-time*.17,time*.11)));
        float fragments=smoothstep(.35,.69,mirrorNoise(p*6.7+vec2(-time*.43,time*.29)));
        float foam=swash*patches*fragments*retreatFade*smoothstep(-.35,.15,shore);
        color=mix(color,mix(vec3(.28,.43,.39),vec3(.13,.25,.31),night*.7),foam*.38);
        color+=responseColor*ring*.06;
        float haze=smoothstep(135.,225.,length(p));color=mix(color,bottom*.48,haze*.65);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.FrontSide, depthWrite: true, fog: false,
  }), [profile.waterWaves, signal, mode, waterColor, skyTop, skyBottom, sunColor, sunX, sunY, sunZ, size, shoreMap, waterLevel, character, reflection])
  useEffect(() => () => { material.dispose() }, [material])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => shoreMap.dispose(), [shoreMap])
  useEffect(() => () => reflection?.dispose(), [reflection])
  useEffect(() => { publishWaterReflection(gl.domElement, reflection, profile.reflectionScale); return () => clearWaterReflectionDiagnostics(gl.domElement) }, [gl, reflection, profile.reflectionScale])
  useFrame((_, delta) => {
    if (!reducedMotion && !signal) advanceMirrorTime(material.uniforms.time, delta)
    reflection?.advance(delta); diagnosticsClock.current += delta
    if (diagnosticsClock.current >= 1) { diagnosticsClock.current = 0; publishWaterReflection(gl.domElement, reflection, profile.reflectionScale) }
  })
  return <mesh ref={mesh} name="mirror-sea-water" geometry={geometry} material={material} renderOrder={5} frustumCulled={false}
    onBeforeRender={(_renderer, scene, camera) => { if (mesh.current) reflection?.capture(gl, scene, camera, mesh.current) }} />
}
