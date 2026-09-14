import { advanceShader, setUniform, setAlpha, uploadGlyphs } from './vfxAnimation'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useReducedMotion } from './useReducedMotion'
import NearbySceneContent from '@/features/presentation/NearbySceneContent'

type Point = [number, number, number]
interface Props {
  text: string
  position: Point
  rotation?: Point
  width?: number
  color?: string
  distance?: number
  material?: boolean
  billboard?: boolean
  onActivate?: () => void
}

/** Alpha-only glyphs share the world's depth buffer. One point batch gathers into their strokes. */
export default function SpatialWords(props: Props) {
  return <NearbySceneContent position={props.position} rotation={props.rotation} distance={props.distance ?? 2.6}>
    <VisibleSpatialWords {...props} position={[0, 0, 0]} rotation={undefined}/>
  </NearbySceneContent>
}

function VisibleSpatialWords({ text, position, rotation, width = 1.7, color = '#f6d29a', distance = 2.6, material = false, billboard = false, onActivate }: Props) {
  const group = useRef<THREE.Group>(null)
  const reduced = useReducedMotion()
  const hovered = useRef(false)
  const reveal = useRef(0)
  const resources = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(256, Math.min(2048, Array.from(text).length * 128 + 80)); canvas.height = 192
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const glyph = new THREE.MeshBasicMaterial({ map: texture, color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    const geometry = new THREE.BufferGeometry()
    const dust = new THREE.ShaderMaterial({
      uniforms: { reveal: { value: 0 }, time: { value: 0 }, tint: { value: new THREE.Color(color) } },
      vertexShader: `attribute vec3 scatter; attribute float seed; uniform float reveal; uniform float time; varying float alpha;
        void main(){float p=smoothstep(0.,1.,reveal);vec3 at=mix(scatter,position,p);at.y+=sin(time*.8+seed*20.)*.035*(1.-p);
        vec4 mv=modelViewMatrix*vec4(at,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(25./max(1.,-mv.z),1.1,4.);
        alpha=sin(p*3.14159)*(.45+.55*seed);}`,
      fragmentShader: `uniform vec3 tint; varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(tint,alpha*smoothstep(.5,.05,d));}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    return { canvas, texture, glyph, geometry, dust, point: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
  }, [color,text])
  useEffect(() => {
    let alive = true
    const draw = () => {
      if (!alive) return
      const { canvas, texture, geometry } = resources
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = '500 140px "Wanderwise Galaxy CJK", "Songti SC", serif'
      ctx.fillText(text, canvas.width / 2, 96, canvas.width - 64)
      uploadGlyphs(texture)
      const pixels = ctx.getImageData(0, 0, canvas.width, 192).data
      const positions: number[] = [], scatter: number[] = [], seeds: number[] = []
      for (let y = 12; y < 180; y += 7) for (let x = 24; x < canvas.width - 24; x += 7) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 100) continue
        const seed = ((x * 73 + y * 137) % 997) / 997
        const px = (x / canvas.width - .5) * width, py = (.5 - y / 192) * width * 192 / canvas.width
        positions.push(px, py, .012)
        scatter.push(px + Math.sin(seed * 45) * width * .45, py + Math.cos(seed * 21) * .75, seed * .9)
        seeds.push(seed)
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('scatter', new THREE.Float32BufferAttribute(scatter, 3))
      geometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1))
      geometry.computeBoundingSphere()
    }
    draw()
    void document.fonts.load('500 104px "Wanderwise Galaxy CJK"', text).then(draw).catch(() => {})
    return () => { alive = false }
  }, [resources, text, width])
  useEffect(() => () => { resources.texture.dispose(); resources.glyph.dispose(); resources.geometry.dispose(); resources.dust.dispose() }, [resources])
  useFrame(({ camera }, delta) => {
    if (!group.current) return
    group.current.getWorldPosition(resources.point)
    const cameraDistance = camera.position.distanceTo(resources.point)
    const near = cameraDistance < distance
    reveal.current = reduced ? 1 : THREE.MathUtils.damp(reveal.current, near || hovered.current ? 1 : .16, 2.8, Math.min(delta, .05))
    setAlpha(resources.glyph, ((material ? .08 : .25) + reveal.current * (material ? .82 : .75)) * THREE.MathUtils.smoothstep(cameraDistance, .6, 1.25))
    setUniform(resources.dust, 'reveal', reduced || material || cameraDistance < 1.25 ? 1 : reveal.current)
    if (!reduced) advanceShader(resources.dust, delta)
    if (billboard) {
      group.current.parent?.getWorldQuaternion(resources.quaternion)
      group.current.quaternion.copy(resources.quaternion.invert().multiply(camera.quaternion))
    }
  })
  return <group ref={group} name={`spatial-words-${text}`} position={position} rotation={rotation}>
    <mesh material={resources.glyph} onPointerOver={() => { hovered.current = true }} onPointerOut={() => { hovered.current = false }} onClick={event => { if (onActivate && event.delta < 5) { event.stopPropagation(); onActivate() } }}>
      <planeGeometry args={[width, width * 192 / resources.canvas.width]}/>
    </mesh>
    {!material && <points geometry={resources.geometry} material={resources.dust} frustumCulled={false} raycast={() => {}}/>}
    {onActivate && <Html center occlude zIndexRange={[8, 0]} position={[0, -width * 110 / resources.canvas.width, .025]}>
      <button type="button" className="ww-spatial-action" onClick={event => { event.stopPropagation(); onActivate() }} aria-label={text}>触碰 · {text}</button>
    </Html>}
  </group>
}
