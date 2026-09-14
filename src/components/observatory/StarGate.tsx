import SpatialWords from '@/features/typography/SpatialWords'
import { useEffect, useMemo } from 'react'
import { Html, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { ObservatoryMaterials } from './materials'
import { GALAXY_GATE_POSITION } from './layout'
import { AssetLantern } from '../scene/Assets'
import { advanceUniform } from './animation'
import { portalFragmentShader, portalHaloFragmentShader, portalStarFragmentShader, portalStarVertexShader, portalVertexShader } from './portalShaders'

const PORTAL_RADIUS = 2.48
const PORTAL_CENTER_Y = 2.71
const FOOT_X = 2.25

function archPoint(t: number, side: number, winding = 0): THREE.Vector3 {
  const a = -0.82 + t * (Math.PI / 2 + 0.82)
  const circle = new THREE.Vector3(side * Math.cos(a) * 2.70, PORTAL_CENTER_Y + Math.sin(a) * 2.70, 0)
  if (t < 0.14) circle.lerp(new THREE.Vector3(side * FOOT_X, 0.2, 0), (0.14 - t) / 0.14)
  circle.x += Math.sin(t * 15.0) * winding
  circle.z = Math.sin(t * 11.0) * winding
  return circle
}

function buildBranches() {
  const trunks: THREE.BufferGeometry[] = [], vines: THREE.BufferGeometry[] = []
  const leaves: THREE.BufferGeometry[] = [], veins: THREE.BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 42 }, (_, i) => archPoint(i / 41, side, .025)))
    trunks.push(new THREE.TubeGeometry(path, 100, .12, 10, false))
    for (const offset of [0, Math.PI]) {
      const winding = new THREE.CatmullRomCurve3(Array.from({ length: 100 }, (_, i) => {
        const t = i / 99, p = archPoint(t, side)
        return p.add(new THREE.Vector3(Math.sin(t * 37 + offset) * .16, Math.cos(t * 37 + offset) * .055, Math.cos(t * 37 + offset) * .15))
      }))
      vines.push(new THREE.TubeGeometry(winding, 140, .029, 6, false))
    }
    const lightPath = new THREE.CatmullRomCurve3(Array.from({ length: 70 }, (_, i) => {
      const p = archPoint(i / 69, side)
      p.x *= .964; p.z += .065
      return p
    }))
    veins.push(new THREE.TubeGeometry(lightPath, 100, .009, 5, false))
    for (let i = 0; i < 16; i++) {
      const t = .085 + i * .056, p = archPoint(t, side)
      const tip = p.clone().add(new THREE.Vector3(side * (.12 + (i % 3) * .08), .10 + (i % 2) * .10, .08))
      const twig = new THREE.CatmullRomCurve3([p, p.clone().lerp(tip, .5).add(new THREE.Vector3(0, .07, .04)), tip])
      vines.push(new THREE.TubeGeometry(twig, 9, .016, 5, false))
      const leaf = new THREE.SphereGeometry(1, 10, 6)
      leaf.scale(.065, .14 + (i % 3) * .021, .022)
      leaf.rotateZ(-side * (.6 + (i % 3) * .16)); leaf.translate(...tip.toArray())
      leaves.push(leaf)
    }
  }
  const groups = [trunks, vines, leaves, veins]
  const merged = groups.map(group => mergeGeometries(group)!)
  groups.flat().forEach(geometry => geometry.dispose())
  return merged
}

/** A concave bowl physically recesses the nucleus; the open bottom never becomes a collision step. */
function buildOpening() {
  const vertices: number[] = [], uv: number[] = [], indices: number[] = []
  const rings = 20, segments = 96
  for (let ring = 0; ring <= rings; ring++) {
    const radius = ring / rings
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
      vertices.push(x * PORTAL_RADIUS, y * PORTAL_RADIUS, -.12 - .72 * (1 - radius * radius))
      uv.push(x * .5 + .5, y * .5 + .5)
      if (ring > 0 && segment > 0) {
        const a = ring * (segments + 1) + segment, b = a - segments - 1
        indices.push(a - 1, b - 1, a, b - 1, b, a)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

function buildStars() {
  const positions: number[] = [], colours: number[] = [], sizes: number[] = [], phases: number[] = [], orbits: number[] = []
  const palette = ['#a8ceff', '#dbc1ff', '#a6e5ed', '#f4a5c8', '#ffdb9b'].map(value => new THREE.Color(value))
  let state = 27051984
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
  // One GPU point batch: 900 inner stars and 90 bright particles circulating around the rim.
  for (let i = 0; i < 990; i++) {
    const rim = i >= 900
    const r = rim ? 2.61 + (random() - .5) * .07 : Math.sqrt(random()) * 2.29
    const a = rim ? random() * Math.PI * 2 : i * 2.399963 + r * 1.1
    positions.push(Math.cos(a) * r, Math.sin(a) * r, rim ? .14 : .03 + random() * .55)
    const c = palette[rim ? 4 : i % palette.length]
    colours.push(c.r, c.g, c.b)
    sizes.push(rim ? .12 + random() * .11 : .035 + Math.pow(random(), 5) * .16)
    phases.push(random() * Math.PI * 2)
    orbits.push(rim ? .24 : .065 + random() * .055)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('starColour', new THREE.Float32BufferAttribute(colours, 3))
  geometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute('orbit', new THREE.Float32BufferAttribute(orbits, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.9)
  return geometry
}

/** The visible M51 is credited source artwork; activation still opens the user's existing world. */
export default function StarGate({ materials: m, reducedMotion, onActivate, showLabel = true }: {
  materials: ObservatoryMaterials; reducedMotion: boolean; onActivate: () => void; showLabel?: boolean
}) {
  const image = useTexture('/textures/portal/m51-hubble-2048.jpg')
  const galaxy = useMemo(() => {
    const texture = image.clone()
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4
    texture.needsUpdate = true
    return texture
  }, [image])
  const branches = useMemo(() => buildBranches(), [])
  const opening = useMemo(() => buildOpening(), [])
  const stars = useMemo(() => buildStars(), [])
  const brass = useMemo(() => {
    const material = m.brass.clone()
    material.color.set('#bda06a'); material.roughness = .29; material.envMapIntensity = 1.6
    return material
  }, [m.brass])
  const effects = useMemo(() => {
    const time = { value: 0 }
    const portal = new THREE.ShaderMaterial({
      uniforms: { time, galaxy: { value: galaxy } }, vertexShader: portalVertexShader, fragmentShader: portalFragmentShader,
      side: THREE.DoubleSide,
    })
    const halo = new THREE.ShaderMaterial({
      uniforms: { time }, vertexShader: portalVertexShader, fragmentShader: portalHaloFragmentShader,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })
    const starlight = new THREE.ShaderMaterial({
      uniforms: { time }, vertexShader: portalStarVertexShader, fragmentShader: portalStarFragmentShader,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    return { time, portal, halo, starlight }
  }, [galaxy])
  useEffect(() => () => {
    effects.portal.dispose(); effects.halo.dispose(); effects.starlight.dispose()
    branches.forEach(geometry => geometry.dispose()); opening.dispose(); stars.dispose(); galaxy.dispose(); brass.dispose()
  }, [effects, branches, opening, stars, galaxy, brass])
  useFrame((_, delta) => { if (!reducedMotion) advanceUniform(effects.time, delta) })

  return <group name="living-galaxy-gateway" position={GALAXY_GATE_POSITION}
    onClick={event => { if (event.delta > 5) return; event.stopPropagation(); onActivate() }}>
    <mesh geometry={branches[0]} material={brass} castShadow receiveShadow />
    <mesh geometry={branches[1]} material={m.brightBrass} castShadow />
    <mesh geometry={branches[2]} material={m.brightBrass} />
    <mesh geometry={branches[3]}><meshBasicMaterial color="#dcb272" toneMapped={false} /></mesh>
    <group position={[0, PORTAL_CENTER_Y, 0]}>
      <mesh geometry={opening} material={effects.portal} />
      <mesh position={[0, 0, .02]} material={effects.halo}>
        <planeGeometry args={[5.95, 5.95]} />
      </mesh>
      <points geometry={stars} material={effects.starlight} />
    </group>
    <mesh position={[0, .012, .28]} rotation={[-Math.PI / 2, 0, 0]} material={m.brass}>
      <ringGeometry args={[2.23, 2.265, 80, 1, 0, Math.PI]} />
    </mesh>
    {[-FOOT_X, FOOT_X].map(x => <group key={x} position={[x, 0, 0]}>
      <mesh position={[0, .19, 0]} material={m.walnut} castShadow><cylinderGeometry args={[.31, .37, .38, 16]} /></mesh>
      <mesh position={[0, .39, 0]} material={m.brightBrass}><cylinderGeometry args={[.33, .33, .045, 20]} /></mesh>
      <AssetLantern position={[0, .415, .02]} height={.47} />
    </group>)}
    <pointLight position={[0, 2.5, .85]} color="#9cbafa" intensity={7} distance={8} decay={2} />
    <pointLight position={[0, 4.4, .32]} color="#ffc976" intensity={4} distance={5} decay={2} />
    {showLabel && <SpatialWords text="进入星系" position={[0, 1.4, .72]} width={2.8} distance={9} onActivate={onActivate}/>}
    <Html position={[0, -.02, .55]} center distanceFactor={8} zIndexRange={[9, 0]}>
      <div style={{ width: 330, padding: '5px 8px', fontSize: 9, lineHeight: 1.45, color: '#c6c1ac', background: 'transparent', border: 'none', borderRadius: 3, textAlign: 'center', pointerEvents: 'auto' }}>
        <a href="https://esahubble.org/images/heic0506a/" target="_blank" rel="noreferrer" style={{ color: '#e2c995', textDecoration: 'none' }} onClick={event => event.stopPropagation()}>M51 · NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)</a>
        <span style={{ display: 'block', fontSize: 8 }}>旋转与色彩为艺术演绎 · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" style={{ color: '#b2bed2' }} onClick={event => event.stopPropagation()}>CC BY 4.0</a></span>
      </div>
    </Html>
  </group>
}
