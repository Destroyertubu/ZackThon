import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { advanceUniform } from './animation'

/** The same photographed valley as the cabin, graded in the shader for blue hour. */
export default function NightLandscape({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [panorama, stars] = useTexture(['/scenery/kiara-valley-4k.jpg', '/scenery/star-garden/milkyway-nasa-4k.jpg'])
  const resources = useMemo(() => {
    const texture = panorama.clone()
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    const starTexture = stars.clone()
    starTexture.colorSpace = THREE.SRGBColorSpace; starTexture.wrapS = THREE.RepeatWrapping; starTexture.needsUpdate = true
    const sky = new THREE.ShaderMaterial({
      uniforms: { panorama: { value: texture }, milkyWay: { value: starTexture } },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D panorama; uniform sampler2D milkyWay; varying vec2 vUv;
        void main() {
          vec3 photographed = texture2D(panorama, vUv).rgb;
          vec3 valley = photographed * vec3(0.075, 0.12, 0.235);
          vec3 night = mix(vec3(0.017, 0.035, 0.088), vec3(0.003, 0.008, 0.025), smoothstep(0.49, .9, vUv.y));
          vec3 skyStars = texture2D(milkyWay, vec2(fract(vUv.x-.07),vUv.y)).rgb;
          night += skyStars*vec3(.38,.48,.72)*smoothstep(.5,.62,vUv.y);
          float sunset=exp(-pow((vUv.y-.515)*26.,2.))*pow(.5+.5*cos((vUv.x-.08)*6.283185),12.);
          night += sunset*vec3(.17,.066,.03);
          vec3 color = mix(valley, night, smoothstep(0.49, 0.64, vUv.y));
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false,
    })
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 32
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.15, 'rgba(255,255,255,.8)')
    gradient.addColorStop(0.5, 'rgba(255,255,255,.12)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32)
    const sprite = new THREE.CanvasTexture(canvas)
    const geometry = new THREE.BufferGeometry()
    const positions: number[] = [], colors: number[] = []
    let seed = 431
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let i = 0; i < 10500; i++) {
      const a = random() * Math.PI * 2, y = 0.16 + random() * 0.83, r = Math.sqrt(1 - y * y)
      positions.push(Math.cos(a) * r * 155, y * 155, Math.sin(a) * r * 155)
      const brightness = 0.32 + Math.pow(random(), 5) * 1.4
      colors.push(brightness * 0.87, brightness * 0.92, brightness)
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const mist = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float time; varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        void main(){vec2 p=vec2(vUv.x*14.+time*.006,vUv.y*3.);
          float cloud=noise(p)*.55+noise(p*2.3)*.27+noise(p*5.1)*.12;
          float edge=sin(vUv.y*3.14159)*smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);
          float alpha=smoothstep(.27,.71,cloud)*edge*.32;
          gl_FragColor=vec4(.19,.28,.44,alpha);
          #include <colorspace_fragment>
        }`,
    })
    const moon = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);
        float disc=1.-smoothstep(.65,.69,r);float shade=smoothstep(.65,.69,length(p-vec2(.23,.08)));
        float crescent=disc*shade;float earthshine=disc*.012;float halo=exp(-r*r*5.)*.025;
        gl_FragColor=vec4(vec3(.64,.75,1.)*(.7+crescent*.4),crescent*.92+earthshine+halo);}`,
    })
    const moonPosition = new THREE.Vector3(48, 81, -140)
    const moonRotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),moonPosition.clone().negate().normalize())
    return { sky, texture, starTexture, geometry, sprite, mist, moon, moonPosition, moonRotation }
  }, [panorama, stars])
  useEffect(() => () => {
    resources.sky.dispose(); resources.texture.dispose(); resources.starTexture.dispose(); resources.geometry.dispose(); resources.sprite.dispose(); resources.mist.dispose(); resources.moon.dispose()
  }, [resources])
  useFrame((_, delta) => { if (!reducedMotion) advanceUniform(resources.mist.uniforms.time, delta) })
  return <group name="kiara-blue-hour-valley">
    <mesh rotation={[0, 0.53, 0]} material={resources.sky} renderOrder={-20}>
      <sphereGeometry args={[190, 64, 32]} />
    </mesh>
    <points geometry={resources.geometry} renderOrder={-10}>
      <pointsMaterial map={resources.sprite} size={0.29} transparent vertexColors depthWrite={false} toneMapped={false} fog={false} />
    </points>
    {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => <group key={angle} rotation={[0, angle, 0]}>
      <mesh position={[0, -2.5 - (i % 2), -45]} material={resources.mist} renderOrder={-5}><planeGeometry args={[120, 9]} /></mesh>
      <mesh position={[13, 1.5, -85]} material={resources.mist} renderOrder={-6}><planeGeometry args={[165, 14]} /></mesh>
    </group>)}
    <mesh name="crescent-moon" position={resources.moonPosition} quaternion={resources.moonRotation} material={resources.moon}>
      <planeGeometry args={[9, 9]} />
    </mesh>
  </group>
}
