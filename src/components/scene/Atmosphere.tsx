import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mulberry32 } from './Props'

/*
 * Window light shafts + drifting dust motes.
 * Two additive, depth-write-off cones mimic volumetric sun rays entering
 * from the mountain window; ~200 dust particles drift slowly inside them.
 */

/* soft god-ray: crossed planes with a canvas gradient (bright near the
 * window, dissolving toward the floor) — additive, no hard silhouette */
function shaftGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, 'rgba(255,202,122,0.55)')
  grad.addColorStop(0.45, 'rgba(255,190,110,0.22)')
  grad.addColorStop(1, 'rgba(255,180,100,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 256)
  // horizontal soft edges
  const side = ctx.createLinearGradient(0, 0, 128, 0)
  side.addColorStop(0, 'rgba(0,0,0,1)')
  side.addColorStop(0.25, 'rgba(0,0,0,0)')
  side.addColorStop(0.75, 'rgba(0,0,0,0)')
  side.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = side
  ctx.fillRect(0, 0, 128, 256)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const shaftTex = shaftGradientTexture()
const shaftMat = new THREE.MeshBasicMaterial({
  map: shaftTex,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  fog: false,
  toneMapped: false,
})

function Shaft({
  position,
  rotation,
  width,
  length,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
  length: number
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* two crossed planes so the beam survives orbit angles */}
      {[0, Math.PI / 2.5].map((ry) => (
        <mesh key={ry} material={shaftMat} rotation={[0, ry, 0]}>
          <planeGeometry args={[width, length]} />
        </mesh>
      ))}
    </group>
  )
}

function LightShafts() {
  // +y end of each plane sits at the window; the beam leans toward +z (into the room)
  const tilt = -(Math.PI / 2 - Math.atan2(2.2, 5.6))
  return (
    <group>
      <Shaft position={[0.7, 1.5, -1.8]} rotation={[tilt, 0.12, 0]} width={1.6} length={6.0} />
      <Shaft position={[-1.2, 1.45, -2.1]} rotation={[tilt + 0.06, -0.1, 0]} width={1.0} length={5.2} />
    </group>
  )
}

const DUST_COUNT = 200

// Points without a sprite are hard squares; the edge must dissolve even close to the lens.
const dustSprite = (() => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
})()

function DustMotes() {
  const ref = useRef<THREE.Points>(null)
  const { geo, base, seeds } = useMemo(() => {
    const rng = mulberry32(777)
    const base = new Float32Array(DUST_COUNT * 3)
    const positions = new Float32Array(DUST_COUNT * 3)
    const seeds = new Float32Array(DUST_COUNT * 2)
    for (let i = 0; i < DUST_COUNT; i++) {
      // scatter inside a tilted slab roughly matching the shaft volume
      base[i * 3] = (rng() - 0.5) * 4.4 + 0.2
      base[i * 3 + 1] = 0.4 + rng() * 2.6
      base[i * 3 + 2] = -4.6 + rng() * 3.8
      positions.set(base.slice(i * 3, i * 3 + 3), i * 3)
      seeds[i * 2] = rng() * Math.PI * 2
      seeds[i * 2 + 1] = 0.3 + rng() * 0.7
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(DUST_COUNT * 3).fill(1), 3))
    return { geo, base, seeds }
  }, [])

  useFrame(({ clock, camera }) => {
    const points = ref.current
    if (!points) return
    const t = clock.elapsedTime
    const pos = points.geometry.attributes.position as THREE.BufferAttribute
    const colors = points.geometry.attributes.color as THREE.BufferAttribute
    for (let i = 0; i < DUST_COUNT; i++) {
      const s1 = seeds[i * 2]
      const s2 = seeds[i * 2 + 1]
      const bx = base[i * 3]
      const by = base[i * 3 + 1]
      const bz = base[i * 3 + 2]
      // slow vertical sink (wraps) + gentle sideways sway around the base
      const drop = (t * 0.05 * s2 + i * 0.37) % 2.6
      const x = bx + Math.sin(t * 0.35 + s1) * 0.08 * s2
      const y = 0.4 + ((by - 0.4 - drop + 2.6) % 2.6)
      const z = bz + Math.cos(t * 0.28 + s1 * 1.7) * 0.07 * s2
      pos.setXYZ(i, x, y, z)
      const distanceSq = (x - camera.position.x) ** 2 + (y - camera.position.y) ** 2 + (z - camera.position.z) ** 2
      const fade = THREE.MathUtils.smoothstep(distanceSq, 0.35 ** 2, 1.1 ** 2)
      colors.setXYZ(i, fade, fade, fade)
    }
    pos.needsUpdate = true
    colors.needsUpdate = true
  })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        map={dustSprite}
        vertexColors
        alphaTest={0.01}
        color="#ffd9a0"
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}

export default function Atmosphere() {
  return (
    <group>
      <LightShafts />
      <DustMotes />
    </group>
  )
}
