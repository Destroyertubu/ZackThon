import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { MIRROR_MOON_POSITION, MIRROR_SUN_POSITION, mirrorRandom, type MirrorMode } from './MirrorGeometry'
import type { TideSignal } from './atmosphereMotion'
import { MIRROR_SKY_GLSL } from './waterSky'

export type MirrorSkyProps = { mode: MirrorMode; compactTextures?: boolean; skyTop?: string; skyBottom?: string; sunColor?: string; signal: TideSignal; sunPosition?: [number, number, number] }

function NightStars({ src, celestialPosition = MIRROR_MOON_POSITION }: { src: string; celestialPosition?: [number, number, number] }) {
  const source = useTexture(src)
  const [moonX, moonY, moonZ] = celestialPosition
  const resources = useMemo(() => {
    const texture = source.clone(); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.needsUpdate = true
    const milkyWay = new THREE.ShaderMaterial({
      uniforms: { sky: { value: texture } }, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.9998;}`,
      fragmentShader: `uniform sampler2D sky;varying vec2 vUv;void main(){vec3 c=texture2D(sky,vec2(fract(vUv.x-.07),vUv.y)).rgb;
        float h=smoothstep(.50,.65,vUv.y);gl_FragColor=vec4(c*vec3(.48,.57,.76),h*.42);
        #include <colorspace_fragment>
      }`,
    })
    const random = mirrorRandom(431), vertices: number[] = [], colors: number[] = []
    for (let i = 0; i < 6800; i++) {
      const a = random() * Math.PI * 2, y = .16 + random() * .83, r = Math.sqrt(1 - y * y)
      vertices.push(Math.cos(a) * r * 145, y * 145, Math.sin(a) * r * 145)
      const brightness = .28 + Math.pow(random(), 5) * 1.25
      colors.push(brightness * .87, brightness * .92, brightness)
    }
    const stars = new THREE.BufferGeometry()
    stars.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); stars.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const starMaterial = new THREE.ShaderMaterial({
      vertexColors: true, transparent: true, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vColor;void main(){vColor=color;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.9997;gl_PointSize=1.25+min(1.2,color.r);}`,
      fragmentShader: `varying vec3 vColor;void main(){float a=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(vColor,a);
        #include <colorspace_fragment>
      }`,
    })
    const moon = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, fog: false,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.9996;}`,
      fragmentShader: `varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);
        float disc=1.-smoothstep(.65,.69,r),shade=smoothstep(.65,.69,length(p-vec2(.23,.08)));
        float crescent=disc*shade,earthshine=disc*.012,halo=exp(-r*r*5.)*.025;
        gl_FragColor=vec4(vec3(.64,.75,1.)*(.7+crescent*.4),crescent*.92+earthshine+halo);}`,
    })
    const position = new THREE.Vector3(moonX, moonY, moonZ).normalize().multiplyScalar(165)
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().negate().normalize())
    return { texture, milkyWay, stars, starMaterial, moon, position, rotation }
  }, [source, moonX, moonY, moonZ])
  useEffect(() => () => { resources.texture.dispose(); resources.milkyWay.dispose(); resources.stars.dispose(); resources.starMaterial.dispose(); resources.moon.dispose() }, [resources])
  return <group name="mirror-sea-stars">
    <mesh material={resources.milkyWay} renderOrder={-29}><sphereGeometry args={[230, 56, 28]} /></mesh>
    <points geometry={resources.stars} material={resources.starMaterial} renderOrder={-28} />
    <mesh name="crescent-moon" position={resources.position} quaternion={resources.rotation} material={resources.moon} renderOrder={-27}><planeGeometry args={[9, 9]} /></mesh>
  </group>
}

export default function MirrorSky({ mode, compactTextures = false, skyTop, skyBottom, sunColor, signal, sunPosition }: MirrorSkyProps) {
  const position = sunPosition ?? (mode === 'night' ? MIRROR_MOON_POSITION : MIRROR_SUN_POSITION)
  const [sunX, sunY, sunZ] = position
  const sky = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      time: signal.time, pulse: signal.pulse,
      top: { value: new THREE.Color(skyTop ?? (mode === 'night' ? '#071226' : '#7487a6')) },
      bottom: { value: new THREE.Color(skyBottom ?? (mode === 'night' ? '#6d7188' : '#efc4ab')) },
      sunlight: { value: new THREE.Color(sunColor ?? (mode === 'night' ? '#bbcfff' : '#ffd8a0')) },
      sunDirection: { value: new THREE.Vector3(sunX, sunY, sunZ).normalize() }, night: { value: mode === 'night' ? 1 : 0 },
    },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDirection;void main(){vDirection=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.9999;}`,
    fragmentShader: `uniform vec3 top,bottom,sunlight,sunDirection;uniform float night,time,pulse;varying vec3 vDirection;
      ${MIRROR_SKY_GLSL}
      void main(){gl_FragColor=vec4(sampleMirrorSky(vDirection),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [mode, skyTop, skyBottom, sunColor, signal, sunX, sunY, sunZ])
  useEffect(() => () => sky.dispose(), [sky])
  return <group name={`mirror-sea-${mode}-sky`}>
    <mesh material={sky} renderOrder={-30}><sphereGeometry args={[230, 56, 28]} /></mesh>
    {mode === 'night' && <NightStars src={compactTextures ? '/models/garden/journey-textures/milkyway-nasa-4k.webp' : '/scenery/star-garden/milkyway-nasa-4k.jpg'} celestialPosition={position} />}
  </group>
}
