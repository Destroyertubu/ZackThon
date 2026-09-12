import { memo, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { leatherBookMaterial } from './pbr'

/* ---------- deterministic RNG ---------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- palette ---------- */
export const COLORS = {
  brass: '#c9973f',
  brassDark: '#8a6526',
  woodDark: '#4a3423',
} as const

const BOOK_SPINES = ['#1e4634', '#5a3a28', '#6e2436', '#22354f', '#3d2f4f', '#716032', '#274b57']

/* ---------- shared materials (created once) ---------- */
const brassMat = new THREE.MeshStandardMaterial({
  color: '#c9973f',
  metalness: 1,
  roughness: 0.28,
  envMapIntensity: 1.2,
})
const brassDarkMat = new THREE.MeshStandardMaterial({
  color: '#8a6526',
  metalness: 1,
  roughness: 0.42,
  envMapIntensity: 1.0,
})
const waxMat = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.55, envMapIntensity: 0.4 })
const paperMat = new THREE.MeshStandardMaterial({ color: '#d9c9a3', roughness: 0.9 })
const lanternGlowMat = new THREE.MeshBasicMaterial({ color: '#ffb45e', toneMapped: false })
lanternGlowMat.color.multiplyScalar(1.8)
export { brassMat, brassDarkMat, waxMat, paperMat, lanternGlowMat }

/* ---------- flame (isolated perpetual animation) ---------- */
const flameGeo = new THREE.SphereGeometry(0.032, 10, 10)
flameGeo.scale(0.8, 1.8, 0.8)
const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb254', toneMapped: false })
flameMat.color.multiplyScalar(2.2) // push into HDR so Bloom picks it up
const flameCoreMat = new THREE.MeshBasicMaterial({ color: '#fff3cf', toneMapped: false })
flameCoreMat.color.multiplyScalar(3.0)

export const Flame = memo(function Flame({ scale = 1 }: { scale?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const offset = useMemo(() => Math.random() * 10, [])
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m) return
    const t = clock.elapsedTime * 9 + offset
    m.scale.setScalar(scale * (1 + Math.sin(t) * 0.12 + Math.sin(t * 1.7) * 0.06))
  })
  return (
    <mesh ref={ref} geometry={flameGeo} material={flameMat}>
      <mesh geometry={flameGeo} material={flameCoreMat} scale={0.45} position={[0, -0.01, 0]} />
    </mesh>
  )
})

/* ---------- candle: lathe-turned brass holder + wax + flame ---------- */
const candleHolderGeo = new THREE.LatheGeometry(
  [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.06, 0),
    new THREE.Vector2(0.066, 0.01),
    new THREE.Vector2(0.052, 0.02),
    new THREE.Vector2(0.02, 0.026),
    new THREE.Vector2(0.016, 0.05),
    new THREE.Vector2(0.026, 0.062),
    new THREE.Vector2(0.034, 0.07),
    new THREE.Vector2(0.03, 0.082),
    new THREE.Vector2(0.024, 0.085),
  ],
  24,
)

export function Candle({
  height = 0.16,
  position = [0, 0, 0],
  holder = true,
}: {
  height?: number
  position?: [number, number, number]
  holder?: boolean
}) {
  return (
    <group position={position}>
      {holder && <mesh geometry={candleHolderGeo} material={brassMat} castShadow />}
      <mesh position={[0, (holder ? 0.085 : 0) + height / 2, 0]} material={waxMat} castShadow>
        <cylinderGeometry args={[0.024, 0.026, height, 12]} />
      </mesh>
      <group position={[0, (holder ? 0.085 : 0) + height + 0.045, 0]}>
        <Flame scale={0.9} />
      </group>
    </group>
  )
}

/* ---------- lantern (hanging / standing) ---------- */
export function Lantern({
  position = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number]
  scale?: number
}) {
  return (
    <group position={position} scale={scale}>
      {/* frame */}
      <mesh material={brassDarkMat} position={[0, 0, 0]}>
        <boxGeometry args={[0.11, 0.02, 0.11]} />
      </mesh>
      <mesh material={brassDarkMat} position={[0, 0.17, 0]}>
        <boxGeometry args={[0.11, 0.02, 0.11]} />
      </mesh>
      {([
        [-0.05, -0.05],
        [0.05, -0.05],
        [-0.05, 0.05],
        [0.05, 0.05],
      ] as const).map(([x, z]) => (
        <mesh key={`${x}${z}`} material={brassDarkMat} position={[x, 0.085, z]}>
          <boxGeometry args={[0.012, 0.15, 0.012]} />
        </mesh>
      ))}
      {/* glowing core (HDR emissive so Bloom blooms it) */}
      <mesh position={[0, 0.085, 0]} material={lanternGlowMat}>
        <boxGeometry args={[0.075, 0.13, 0.075]} />
      </mesh>
      {/* cap + ring */}
      <mesh material={brassDarkMat} position={[0, 0.2, 0]}>
        <coneGeometry args={[0.075, 0.06, 4]} />
      </mesh>
      <mesh material={brassDarkMat} position={[0, 0.245, 0]}>
        <torusGeometry args={[0.02, 0.006, 6, 12]} />
      </mesh>
    </group>
  )
}

/* ---------- single book ---------- */
export function Book({
  size = [0.16, 0.045, 0.23],
  color = '#1e4634',
  position = [0, 0, 0],
  rotation = 0,
}: {
  size?: [number, number, number]
  color?: string
  position?: [number, number, number]
  rotation?: number
}) {
  const mat = useMemo(() => leatherBookMaterial(color), [color])
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={mat} castShadow>
        <boxGeometry args={size} />
      </mesh>
      {/* pages */}
      <mesh material={paperMat} position={[0, 0, size[2] * 0.06]} scale={[0.9, 0.82, 0.86]}>
        <boxGeometry args={size} />
      </mesh>
      {/* gold band on spine */}
      <mesh material={brassMat} position={[0, 0, -size[2] / 2 - 0.001]} scale={[1, 0.18, 0.05]}>
        <boxGeometry args={size} />
      </mesh>
    </group>
  )
}

/* ---------- stack of books ---------- */
export function BookStack({
  count = 3,
  position = [0, 0, 0],
  seed = 1,
  scale = 1,
}: {
  count?: number
  position?: [number, number, number]
  seed?: number
  scale?: number
}) {
  const books = useMemo(() => {
    const rng = mulberry32(seed)
    let y = 0
    return Array.from({ length: count }, () => {
      const h = 0.035 + rng() * 0.03
      const w = 0.2 + rng() * 0.1
      const d = 0.28 + rng() * 0.1
      const item = {
        y: y + h / 2,
        h,
        w,
        d,
        color: BOOK_SPINES[Math.floor(rng() * BOOK_SPINES.length)],
        rot: (rng() - 0.5) * 0.5,
      }
      y += h
      return item
    })
  }, [count, seed])
  return (
    <group position={position} scale={scale}>
      {books.map((b, i) => (
        <Book
          key={i}
          size={[b.w, b.h, b.d]}
          color={b.color}
          position={[0, b.y, 0]}
          rotation={b.rot}
        />
      ))}
    </group>
  )
}

/* ---------- open book ---------- */
export function OpenBook({
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
}: {
  position?: [number, number, number]
  rotation?: number
  scale?: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[-0.105, 0.012, 0]} rotation={[0, 0, 0.1]} material={paperMat} castShadow>
        <boxGeometry args={[0.21, 0.022, 0.3]} />
      </mesh>
      <mesh position={[0.105, 0.012, 0]} rotation={[0, 0, -0.1]} material={paperMat} castShadow>
        <boxGeometry args={[0.21, 0.022, 0.3]} />
      </mesh>
      <mesh position={[0, 0.004, 0]}>
        <boxGeometry args={[0.44, 0.01, 0.32]} />
        <meshStandardMaterial color="#5a3a28" roughness={0.8} />
      </mesh>
    </group>
  )
}

/* ---------- scroll (rolled parchment) ---------- */
export function Scroll({
  position = [0, 0, 0],
  rotation = 0,
  length = 0.3,
}: {
  position?: [number, number, number]
  rotation?: number
  length?: number
}) {
  return (
    <group position={position} rotation={[0, rotation, Math.PI / 2]}>
      <mesh material={paperMat} castShadow>
        <cylinderGeometry args={[0.03, 0.03, length, 12]} />
      </mesh>
      <mesh material={brassDarkMat} position={[0, length / 2 - 0.02, 0]}>
        <torusGeometry args={[0.032, 0.006, 6, 14]} />
      </mesh>
    </group>
  )
}

/* ---------- mug ---------- */
export function Mug({
  position = [0, 0, 0],
  color = '#1e4634',
}: {
  position?: [number, number, number]
  color?: string
}) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.5 }), [color])
  return (
    <group position={position}>
      <mesh material={mat} position={[0, 0.055, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.04, 0.11, 16]} />
      </mesh>
      <mesh material={mat} position={[0.055, 0.055, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.032, 0.009, 8, 16, Math.PI]} />
      </mesh>
    </group>
  )
}

/* ---------- armillary sphere (brass rings) ---------- */
export function Armillary({
  position = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number]
  scale?: number
}) {
  return (
    <group position={position} scale={scale}>
      <mesh material={brassMat} position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.04, 16]} />
      </mesh>
      <mesh material={brassMat} position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.12, 8]} />
      </mesh>
      <group position={[0, 0.28, 0]}>
        <mesh material={brassMat}>
          <torusGeometry args={[0.14, 0.008, 8, 32]} />
        </mesh>
        <mesh material={brassMat} rotation={[Math.PI / 2.4, 0, 0]}>
          <torusGeometry args={[0.13, 0.007, 8, 32]} />
        </mesh>
        <mesh material={brassMat} rotation={[Math.PI / 2, 0, Math.PI / 3]}>
          <torusGeometry args={[0.12, 0.006, 8, 32]} />
        </mesh>
        <mesh material={brassMat}>
          <sphereGeometry args={[0.035, 12, 12]} />
        </mesh>
      </group>
    </group>
  )
}

/* ---------- crystal cluster ---------- */
export function CrystalCluster({
  position = [0, 0, 0],
  scale = 1,
  color = '#35e0b8',
}: {
  position?: [number, number, number]
  scale?: number
  color?: string
}) {
  /* transmissive gemstone: light bends through with teal attenuation */
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#b8fff0',
        transmission: 0.9,
        thickness: 0.9,
        roughness: 0.08,
        ior: 1.5,
        attenuationColor: color,
        attenuationDistance: 0.9,
        emissive: color,
        emissiveIntensity: 0.22,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        envMapIntensity: 1.4,
        flatShading: true,
      }),
    [color],
  )
  const shards = useMemo(() => {
    const rng = mulberry32(Math.floor(scale * 100) + 7)
    const big = [
      { r: 0.34, h: 0.85, x: 0, z: 0, tilt: 0, rot: rng() * Math.PI },
      { r: 0.18, h: 0.5, x: 0.3, z: 0.12, tilt: 0.35, rot: rng() * Math.PI },
      { r: 0.15, h: 0.42, x: -0.28, z: 0.15, tilt: -0.3, rot: rng() * Math.PI },
      { r: 0.12, h: 0.34, x: 0.05, z: -0.3, tilt: 0.2, rot: rng() * Math.PI },
      { r: 0.1, h: 0.26, x: -0.18, z: -0.2, tilt: -0.45, rot: rng() * Math.PI },
    ]
    // small satellite shards scattered at the base
    const n = Math.max(3, Math.round(6 * Math.min(scale, 1)))
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2
      const d = 0.34 + rng() * 0.18
      big.push({
        r: 0.05 + rng() * 0.045,
        h: 0.14 + rng() * 0.14,
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        tilt: (rng() - 0.5) * 0.7,
        rot: rng() * Math.PI,
      })
    }
    return big
  }, [scale])
  /* hot inner core so the gem reads as self-luminous even where
     transmission falls back to opaque on weak GPUs */
  const coreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.6,
        roughness: 0.3,
        toneMapped: true,
      }),
    [color],
  )
  return (
    <group position={position} scale={scale}>
      {shards.map((s, i) => (
        <mesh
          key={i}
          material={mat}
          position={[s.x, s.h / 2 - 0.05, s.z]}
          rotation={[s.tilt, s.rot, s.tilt * 0.6]}
          castShadow
        >
          <coneGeometry args={[s.r, s.h, 6]} />
          {i === 0 && (
            <mesh material={coreMat} scale={0.55}>
              <coneGeometry args={[s.r, s.h * 0.85, 6]} />
            </mesh>
          )}
        </mesh>
      ))}
    </group>
  )
}

/* ---------- hourglass ---------- */
export function Hourglass({
  position = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number]
  scale?: number
}) {
  return (
    <group position={position} scale={scale}>
      <mesh material={brassDarkMat} position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
      </mesh>
      <mesh material={brassDarkMat} position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <coneGeometry args={[0.036, 0.06, 12]} />
        <meshStandardMaterial color="#cfe8e0" transparent opacity={0.45} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.036, 0.06, 12]} />
        <meshStandardMaterial color="#cfe8e0" transparent opacity={0.45} roughness={0.1} />
      </mesh>
    </group>
  )
}

/* ---------- magnifier ---------- */
export function Magnifier({
  position = [0, 0, 0],
  rotation = 0,
}: {
  position?: [number, number, number]
  rotation?: number
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh material={brassMat} position={[0, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.01, 8, 24]} />
      </mesh>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.008, 24]} />
        <meshStandardMaterial color="#bfe0d8" transparent opacity={0.35} roughness={0.05} />
      </mesh>
      <mesh material={brassDarkMat} position={[0.11, 0.015, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.014, 0.12, 8]} />
      </mesh>
    </group>
  )
}

/* ---------- brass compass ---------- */
export function Compass({
  position = [0, 0, 0],
}: {
  position?: [number, number, number]
}) {
  return (
    <group position={position}>
      <mesh material={brassMat} position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.03, 20]} />
      </mesh>
      <mesh position={[0, 0.031, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.004, 20]} />
        <meshStandardMaterial color="#e8dcc0" roughness={0.6} />
      </mesh>
      <mesh material={brassDarkMat} position={[0, 0.034, 0]} rotation={[0, 0.6, 0]}>
        <boxGeometry args={[0.008, 0.004, 0.09]} />
      </mesh>
    </group>
  )
}

/* ---------- ink bottle ---------- */
export function InkBottle({
  position = [0, 0, 0],
}: {
  position?: [number, number, number]
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.035, 0]} castShadow>
        <boxGeometry args={[0.06, 0.07, 0.06]} />
        <meshStandardMaterial color="#1a2a24" roughness={0.15} />
      </mesh>
      <mesh material={brassMat} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.025, 10]} />
      </mesh>
    </group>
  )
}
