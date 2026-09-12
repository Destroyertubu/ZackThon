import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Clone, useGLTF } from '@react-three/drei'
import { Flame, mulberry32 } from './Props'

/* ================= Poly Haven asset registry ================= */
export const PH = {
  armchair: 'ArmChair_01/ArmChair_01_2k',
  greenChair: 'GreenChair_01/GreenChair_01_1k',
  chineseChair: 'chinese_armchair/chinese_armchair_1k',
  chandelier: 'lantern_chandelier_01/lantern_chandelier_01_2k',
  stormLantern: 'Lantern_01/Lantern_01_1k',
  oilLamp: 'vintage_oil_lamp/vintage_oil_lamp_1k',
  encyclopedia: 'book_encyclopedia_set_01/book_encyclopedia_set_01_1k',
  notebook: 'binder_notebook/binder_notebook_1k',
  candleholders: 'brass_candleholders/brass_candleholders_1k',
  woodCandle: 'wooden_candlestick/wooden_candlestick_1k',
  bookshelf: 'wooden_bookshelf_worn/wooden_bookshelf_worn_2k',
  cabinet: 'vintage_cabinet_01/vintage_cabinet_01_2k',
  plantBig: 'potted_plant_01/potted_plant_01_1k',
  plantMid: 'potted_plant_02/potted_plant_02_1k',
  plantSmall: 'potted_plant_04/potted_plant_04_1k',
  sideTable: 'side_table_tall_01/side_table_tall_01_1k',
  compass: 'seadogs_compass/seadogs_compass_1k',
  binocular: 'vintage_binocular/vintage_binocular_1k',
  chest: 'treasure_chest/treasure_chest_1k',
  crate: 'wooden_crate_01/wooden_crate_01_1k',
  vase: 'antique_ceramic_vase_01/antique_ceramic_vase_01_1k',
  painting: 'fancy_picture_frame_01/fancy_picture_frame_01_1k',
} as const

export type AssetKey = keyof typeof PH
const urlOf = (key: AssetKey) => `/models/${PH[key]}.gltf`

/* ================= measurement cache ================= */
interface Measure {
  size: THREE.Vector3
  min: THREE.Vector3
  max: THREE.Vector3
  center: THREE.Vector3
}
const measureCache = new Map<string, Measure>()

function measure(obj: THREE.Object3D, cacheKey: string): Measure {
  const hit = measureCache.get(cacheKey)
  if (hit) return hit
  obj.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const m = { size, min: box.min.clone(), max: box.max.clone(), center }
  measureCache.set(cacheKey, m)
  return m
}

/* ================= material tweaking ================= */
type MatTweak = (mat: THREE.Material) => void

/** shared per-asset material adjustments (materials are shared across clones, so run once) */
const tweaked = new Set<string>()
function tweakMaterials(key: AssetKey, root: THREE.Object3D, extra?: MatTweak) {
  if (tweaked.has(key)) return
  tweaked.add(key)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial
      if ('envMapIntensity' in std) std.envMapIntensity = 0.75
      /* emissive light sources so Bloom picks them up */
      if (/_lamp|_flame/i.test(std.name)) {
        std.emissive = new THREE.Color('#ffb254')
        if (std.map) std.emissiveMap = std.map
        std.emissiveIntensity = 2.6
        std.toneMapped = false
      }
      if (/glass/i.test(std.name)) {
        std.transparent = true
        std.opacity = 0.22
        std.roughness = 0.08
        std.depthWrite = false
        std.side = THREE.DoubleSide
      }
      /* warm the gray-washed shelf wood + cool gray chair fabric */
      if (key === 'bookshelf') std.color.multiply(new THREE.Color('#caa272'))
      if (key === 'armchair') std.color.multiply(new THREE.Color('#e6cdb2'))
      if (key === 'plantSmall') std.color.multiply(new THREE.Color('#d8b894'))
      extra?.(m)
    }
  })
}

/* ================= core component ================= */
interface AssetProps {
  asset: AssetKey
  /** pick a single named node out of the gltf scene */
  node?: string
  /** normalize: fit bounding box to this height (meters) */
  height?: number
  /** normalize: fit the largest bbox dimension instead of height */
  maxDim?: number
  /** extra uniform scale applied after normalization */
  scale?: number
  /** anchor the bbox top (instead of bottom) at local y=0 — for hanging lamps */
  hangTop?: boolean
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** Expensive shadow casting is opt-in for small decor (books/plants disable it). */
  castShadow?: boolean
  receiveShadow?: boolean
  matTweak?: MatTweak
  children?: React.ReactNode
}

export function AssetModel({
  asset,
  node,
  height,
  maxDim,
  scale = 1,
  hangTop = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  castShadow = true,
  receiveShadow = true,
  matTweak,
  children,
}: AssetProps) {
  const { scene } = useGLTF(urlOf(asset))
  const ref = useRef<THREE.Group>(null)

  const target = useMemo(() => {
    const t = node ? scene.getObjectByName(node) : scene
    if (!t) throw new Error(`node ${node} not found in ${asset}`)
    return t
  }, [scene, node, asset])

  const { s, offset } = useMemo(() => {
    const m = measure(target, `${asset}:${node ?? '*'}`)
    const base = height ? height / m.size.y : maxDim ? maxDim / Math.max(m.size.x, m.size.y, m.size.z) : 1
    const s = base * scale
    const yAnchor = hangTop ? m.max.y : m.min.y
    return { s, offset: new THREE.Vector3(-m.center.x, -yAnchor, -m.center.z) }
  }, [target, asset, node, height, maxDim, scale, hangTop])

  useLayoutEffect(() => {
    if (ref.current) tweakMaterials(asset, ref.current, matTweak)
  }, [asset, matTweak])

  return (
    <group position={position} rotation={rotation}>
      <group ref={ref} scale={s} position={offset.clone().multiplyScalar(s)}>
        <Clone object={target} castShadow={castShadow} receiveShadow={receiveShadow} />
      </group>
      {children}
    </group>
  )
}

/* ================= candles with live flames ================= */
type CandleVariant = 'brass1' | 'brass3' | 'brass5' | 'wood'
const CANDLE_NATIVE_H: Record<CandleVariant, number> = {
  brass1: 0.366,
  brass3: 0.401,
  brass5: 0.835,
  wood: 0.22,
}
const CANDLE_NODE: Record<CandleVariant, { asset: AssetKey; node?: string }> = {
  brass1: { asset: 'candleholders', node: 'brass_candleholder_01' },
  brass3: { asset: 'candleholders', node: 'brass_candleholder_02' },
  brass5: { asset: 'candleholders', node: 'brass_candleholder_03' },
  wood: { asset: 'woodCandle' },
}

export function AssetCandle({
  variant = 'brass1',
  height,
  position = [0, 0, 0],
  rotation = 0,
}: {
  variant?: CandleVariant
  height?: number
  position?: [number, number, number]
  rotation?: number
}) {
  const h = height ?? CANDLE_NATIVE_H[variant]
  const { asset, node } = CANDLE_NODE[variant]
  const single = variant === 'brass1' || variant === 'wood'
  return (
    <AssetModel asset={asset} node={node} height={h} position={position} rotation={[0, rotation, 0]}>
      {/* live animated flame on single-candle sticks; multi-arm candelabras
          rely on their baked flame meshes (boosted to HDR emissive) */}
      {single && (
        <group position={[0, h + 0.012, 0]}>
          <Flame scale={0.85} />
        </group>
      )}
    </AssetModel>
  )
}

/* ================= books ================= */
/** native widths of the 20 encyclopedia volumes (measured from the gltf) */
const BOOK_W = [
  0.039, 0.028, 0.023, 0.025, 0.019, 0.018, 0.024, 0.022, 0.022, 0.022, 0.018, 0.023, 0.037, 0.033,
  0.035, 0.025, 0.036, 0.022, 0.019, 0.024,
]
const BOOK_NATIVE_H = 0.237

const pad = (n: number) => String(n).padStart(2, '0')

/** one encyclopedia volume, bbox-normalized so the base sits at local y=0 */
export function AssetBook({
  index,
  height = 0.24,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  index: number
  height?: number
  position?: [number, number, number]
  rotation?: [number, number, number]
}) {
  const i = ((index % 20) + 20) % 20
  return (
    <AssetModel
      asset="encyclopedia"
      node={`book_encyclopedia_set_01_book${pad(i + 1)}`}
      height={height}
      position={position}
      rotation={rotation}
      castShadow={false}
    />
  )
}

/** a row of upright encyclopedia volumes filling `width` along local x,
 *  with an occasional short horizontal stack mixed in */
export function AssetBookRow({
  width,
  seed,
  position = [0, 0, 0],
  bookHeight = 0.24,
}: {
  width: number
  seed: number
  position?: [number, number, number]
  bookHeight?: number
}) {
  const items = useMemo(() => {
    const rng = mulberry32(seed)
    const k = bookHeight / BOOK_NATIVE_H
    const arr: {
      x: number
      idx: number
      tilt: number
      lying: boolean
      rotY: number
    }[] = []
    let x = -width / 2
    let previousIdx = -1
    while (x < width / 2 - 0.05) {
      // Avoid visually obvious repeated scan books while preserving the
      // deterministic layout generated from the shelf seed.
      let idx = Math.floor(rng() * 20)
      if (idx === previousIdx) idx = (idx + 1 + Math.floor(rng() * 19)) % 20
      previousIdx = idx
      const w = BOOK_W[idx] * k
      const lying = rng() < 0.14 && x + 0.24 < width / 2
      arr.push({
        x: x + (lying ? 0.11 : w / 2),
        idx,
        tilt: rng() < 0.25 ? (rng() - 0.5) * 0.4 : 0,
        lying,
        rotY: (rng() - 0.5) * 0.5,
      })
      x += (lying ? 0.23 : w) + 0.005
    }
    return { list: arr, k }
  }, [width, seed, bookHeight])
  return (
    <group position={position}>
      {items.list.map((b, i) =>
        b.lying ? (
          /* two books lying flat, stacked: rotate about z so the spine width
             becomes the vertical thickness, then yaw for a casual look */
          <group key={i} position={[b.x, 0, 0]}>
            {[0, 1].map((j) => {
              const idx = (b.idx + j * 7) % 20
              const w = BOOK_W[idx] * items.k
              return (
                <AssetBook
                  key={j}
                  index={idx}
                  height={bookHeight * 0.94}
                  position={[j * 0.012, w / 2 + (j === 1 ? BOOK_W[b.idx % 20] * items.k : 0), 0]}
                  rotation={[0, b.rotY + (j - 0.5) * 0.35, Math.PI / 2]}
                />
              )
            })}
          </group>
        ) : (
          <AssetBook
            key={i}
            index={b.idx}
            height={bookHeight * (0.92 + ((i * 37) % 13) / 100)}
            position={[b.x, 0, 0]}
            rotation={[0, 0, b.tilt]}
          />
        ),
      )}
    </group>
  )
}

/** horizontal stack of books (table / cabinet decor) */
export function AssetBookStack({
  count = 3,
  seed = 1,
  position = [0, 0, 0],
  scale = 1,
}: {
  count?: number
  seed?: number
  position?: [number, number, number]
  scale?: number
}) {
  const books = useMemo(() => {
    const rng = mulberry32(seed)
    const raw = Array.from({ length: count }, (_, i) => {
      const idx = Math.floor(rng() * 20)
      const h = 0.24 * scale * (i % 2 ? 0.9 : 1)
      const w = BOOK_W[idx] * (h / BOOK_NATIVE_H) // vertical thickness when lying
      return { idx, rot: (rng() - 0.5) * 0.6, w, h }
    })
    return raw.map((book, i) => ({
      idx: book.idx,
      rot: book.rot,
      h: book.h,
      y: raw.slice(0, i).reduce((sum, previous) => sum + previous.w + 0.002, 0) + book.w / 2,
    }))
  }, [count, seed, scale])
  return (
    <group position={position}>
      {books.map((b, i) => (
        <AssetBook
          key={i}
          index={b.idx}
          height={b.h}
          position={[0, b.y, 0]}
          rotation={[0, b.rot, Math.PI / 2]}
        />
      ))}
    </group>
  )
}

/** storm lantern with a live flame glowing inside the glass */
export function AssetLantern({
  position = [0, 0, 0],
  rotation = 0,
  height = 0.32,
}: {
  position?: [number, number, number]
  rotation?: number
  height?: number
}) {
  const k = height / 0.294
  return (
    <AssetModel asset="stormLantern" height={height} position={position} rotation={[0, rotation, 0]}>
      <group position={[0, 0.105 * k, 0]} scale={0.62}>
        <Flame scale={0.8} />
      </group>
    </AssetModel>
  )
}

/* ================= preloads ================= */
for (const key of Object.keys(PH) as AssetKey[]) {
  useGLTF.preload(urlOf(key))
}
