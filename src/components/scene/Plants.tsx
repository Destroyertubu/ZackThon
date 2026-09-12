import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mulberry32 } from './Props'
import { AssetModel, type AssetKey } from './Assets'

/* leaf material: white base, per-instance green gradient via instanceColor */
const leafMat = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  roughness: 0.62,
  side: THREE.DoubleSide,
  envMapIntensity: 0.45,
})

/**
 * Bent, tapered leaf: plane with a center fold, a backward curl,
 * and edges pinched toward the tip. Base sits at local origin, tip at +y.
 */
function makeLeafGeometry(width: number, length: number, curl: number, fold: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(width, length, 3, 6)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const t = (y + length / 2) / length // 0 base → 1 tip
    // taper: widest at ~40%, pinched at both ends
    const w = Math.sin(Math.PI * (0.15 + t * 0.85)) * (1 - 0.25 * t)
    pos.setX(i, x * w)
    // center fold (v-cross-section) + backward curl toward the tip
    const z = Math.abs(x) * fold + curl * t * t * length * 0.6
    pos.setZ(i, z)
    // shift so the base is at y=0
    pos.setY(i, y + length / 2)
  }
  g.computeVertexNormals()
  return g
}

const ivyLeafGeo = makeLeafGeometry(0.09, 0.12, 0.3, 0.5) // vines / beam ivy

interface LeafInstance {
  pos: [number, number, number]
  rot: [number, number, number]
  scale: number
  shade: number // 0 dark → 1 light
}

/* one draw call per plant: instanced leaves with a deep-green gradient */
function LeafInstances({ leaves, geo }: { leaves: LeafInstance[]; geo: THREE.PlaneGeometry }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const mat4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const dark = new THREE.Color('#1c4a28')
    const light = new THREE.Color('#4d9157')
    const c = new THREE.Color()
    leaves.forEach((l, i) => {
      e.set(l.rot[0], l.rot[1], l.rot[2])
      q.setFromEuler(e)
      s.setScalar(l.scale)
      p.set(l.pos[0], l.pos[1], l.pos[2])
      mat4.compose(p, q, s)
      m.setMatrixAt(i, mat4)
      c.lerpColors(dark, light, l.shade)
      m.setColorAt(i, c)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [leaves])
  // Foliage is densely instanced; receiving light is useful, casting every
  // leaf into the cabin shadow map is not. Keep it out of the shadow pass.
  return <instancedMesh ref={ref} args={[geo, leafMat, leaves.length]} receiveShadow={false} castShadow={false} frustumCulled={false} />
}

type PlantType = 'monstera' | 'fern' | 'bush'

/* real scans from Poly Haven replace the old procedural pots:
   monstera → tall terracotta urn, fern → low terracotta bowl, bush → small desk pot */
const PLANT_ASSET: Record<PlantType, { asset: AssetKey; heightPerScale: number }> = {
  monstera: { asset: 'plantBig', heightPerScale: 0.95 },
  fern: { asset: 'plantMid', heightPerScale: 0.72 },
  bush: { asset: 'plantSmall', heightPerScale: 0.34 },
}

export function PottedPlant({
  type = 'bush',
  position = [0, 0, 0],
  scale = 1,
  seed = 1,
}: {
  type?: PlantType
  position?: [number, number, number]
  scale?: number
  seed?: number
  brassPot?: boolean
}) {
  const { asset, heightPerScale } = PLANT_ASSET[type]
  const rotY = useMemo(() => mulberry32(seed)() * Math.PI * 2, [seed])
  return (
    <AssetModel
      asset={asset}
      height={heightPerScale * scale}
      position={position}
      rotation={[0, rotY, 0]}
      castShadow={false}
    />
  )
}

/** Hanging vine: drooping chain of small leaves (instanced). */
export function HangingVine({
  position = [0, 0, 0],
  length = 1.2,
  seed = 1,
}: {
  position?: [number, number, number]
  length?: number
  seed?: number
}) {
  const leaves = useMemo(() => {
    const rng = mulberry32(seed)
    const n = Math.floor(length * 12)
    return Array.from({ length: n }, (_, i): LeafInstance => {
      const y = -i * 0.085
      return {
        pos: [Math.sin(i * 0.7 + seed) * 0.05, y, Math.cos(i * 0.5 + seed) * 0.05],
        rot: [0.6 + rng() * 0.8, rng() * Math.PI * 2, (rng() - 0.5) * 0.6],
        scale: 0.55 + rng() * 0.5,
        shade: 0.1 + rng() * 0.9,
      }
    })
  }, [length, seed])
  return (
    <group position={position}>
      <LeafInstances leaves={leaves} geo={ivyLeafGeo} />
    </group>
  )
}

/** Ivy trailing along a horizontal beam (children positioned along local x). */
export function BeamIvy({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  length = 2,
  seed = 1,
  drops = 3,
}: {
  position?: [number, number, number]
  rotation?: [number, number, number]
  length?: number
  seed?: number
  drops?: number
}) {
  const leaves = useMemo(() => {
    const rng = mulberry32(seed)
    const n = Math.floor(length * 9)
    return Array.from({ length: n }, (_, i): LeafInstance => ({
      pos: [-length / 2 + (i / n) * length, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.12],
      rot: [0.5 + rng() * 0.7, rng() * Math.PI * 2, (rng() - 0.5) * 0.5],
      scale: 0.5 + rng() * 0.55,
      shade: 0.1 + rng() * 0.9,
    }))
  }, [length, seed])
  const vines = useMemo(() => {
    const rng = mulberry32(seed + 99)
    return Array.from({ length: drops }, () => ({
      x: (rng() - 0.5) * length * 0.85,
      len: 0.4 + rng() * 0.9,
    }))
  }, [drops, length, seed])
  return (
    <group position={position} rotation={rotation}>
      <LeafInstances leaves={leaves} geo={ivyLeafGeo} />
      {vines.map((v, i) => (
        <HangingVine key={`v${i}`} position={[v.x, -0.05, 0]} length={v.len} seed={seed + i * 13} />
      ))}
    </group>
  )
}
