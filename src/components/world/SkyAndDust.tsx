import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

function makePoints(count: number, gen: (rnd: () => number) => [number, number, number]) {
  const arr = new Float32Array(count * 3)
  const rnd = Math.random
  for (let i = 0; i < count; i++) {
    const [x, y, z] = gen(rnd)
    arr[i * 3] = x
    arr[i * 3 + 1] = y
    arr[i * 3 + 2] = z
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  return g
}

/* 圆形软点贴图，避免 Points 近景呈方块 */
let dotTex: THREE.CanvasTexture | null = null
function getDotTexture(): THREE.CanvasTexture {
  if (!dotTex) {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.4)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    dotTex = new THREE.CanvasTexture(c)
  }
  return dotTex
}

/** 远景星空球壳 + 近景缓慢漂浮的金色尘埃光点 */
export default function SkyAndDust() {
  const starGeo = useMemo(
    () =>
      makePoints(1600, (rnd) => {
        const r = 300 + rnd() * 220
        const theta = rnd() * Math.PI * 2
        const phi = Math.acos(2 * rnd() - 1)
        return [r * Math.sin(phi) * Math.cos(theta), Math.abs(r * Math.cos(phi)) * 0.8 - 40, r * Math.sin(phi) * Math.sin(theta)]
      }),
    []
  )
  const dustGeo = useMemo(
    () =>
      makePoints(240, (rnd) => {
        const r = 20 + rnd() * 90
        const a = rnd() * Math.PI * 2
        return [Math.cos(a) * r, rnd() * 55 - 5, Math.sin(a) * r]
      }),
    []
  )
  useEffect(() => () => { starGeo.dispose(); dustGeo.dispose() }, [starGeo, dustGeo])

  const starsRef = useRef<THREE.Points>(null)
  const dustRef = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (starsRef.current) starsRef.current.rotation.y = t * 0.004
    if (dustRef.current) {
      dustRef.current.rotation.y = t * 0.02
      dustRef.current.position.y = Math.sin(t * 0.15) * 2
    }
  })

  return (
    <>
      <points ref={starsRef} geometry={starGeo}>
        <pointsMaterial size={1.6} sizeAttenuation={false} map={getDotTexture()} color="#cdd6e4" transparent opacity={0.85} fog={false} />
      </points>
      <group ref={dustRef}>
        <points geometry={dustGeo}>
          <pointsMaterial
            size={1.1}
            map={getDotTexture()}
            color="#d8b46a"
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fog={false}
          />
        </points>
      </group>
    </>
  )
}
