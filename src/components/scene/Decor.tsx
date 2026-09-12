import { memo, useMemo } from 'react'
import * as THREE from 'three'
import { bannerTexture, rectRugTexture, roundRugTexture } from './textures'
import { brassMat } from './Props'
import { PottedPlant } from './Plants'
import { pbrMaps, SETS } from './pbr'
import { AssetCandle, AssetModel } from './Assets'

/* ---------- banner with pointed bottom + gold emblem ----------
 * Cloth plane: subdivided, bottom folded to a point, gentle frozen wave. */
function Banner({
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}) {
  const tex = useMemo(() => bannerTexture(), [])
  const bump = useMemo(() => pbrMaps(SETS.fabric, 2, 2.5), [])
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.8, 1.12, 12, 18)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      let y = pos.getY(i)
      // fold the lower triangle into the pointed bottom (plane y in [-0.56, -0.29])
      if (y < -0.29) {
        const f = (y + 0.56) / 0.27 // 1 at y=-0.29 → 0 at the tip
        pos.setX(i, x * f)
      }
      // frozen cloth wave, stronger toward the free bottom
      const sway = THREE.MathUtils.clamp((-y + 0.2) / 1.0, 0, 1)
      const z = Math.sin(x * 7.5 + y * 2.0) * 0.028 * sway + Math.sin(x * 3.1) * 0.014 * sway
      pos.setZ(i, z)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* wooden rod */}
      <mesh material={brassMat} position={[0, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 1.0, 8]} />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} material={brassMat} position={[x, 0.02, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
        </mesh>
      ))}
      <mesh geometry={geo} position={[0, -0.59, 0]} castShadow>
        <meshStandardMaterial
          map={tex}
          normalMap={bump.normalMap}
          roughnessMap={bump.roughnessMap}
          side={THREE.DoubleSide}
          roughness={1}
          normalScale={new THREE.Vector2(0.5, 0.5)}
        />
      </mesh>
    </group>
  )
}

/* ---------- chandelier: ornate bronze lantern pendant (scan), hung from the ridge ---------- */
function Chandelier() {
  return (
    <group>
      {/* short chain from the ridge beam to the pendant's ceiling rose */}
      <mesh material={brassMat} position={[0, 4.62, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.18, 8]} />
      </mesh>
      {/* pendant hangs from its top anchor; the bulb mesh is HDR-emissive */}
      <AssetModel asset="chandelier" height={1.5} hangTop position={[0, 4.56, 0]} />
    </group>
  )
}

/* ---------- rugs ---------- */
function Rugs() {
  const roundTex = useMemo(() => roundRugTexture(), [])
  const rectTex = useMemo(() => rectRugTexture(), [])
  const weave = useMemo(() => pbrMaps(SETS.fabric, 5, 5), [])
  const roundMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: roundTex,
        normalMap: weave.normalMap,
        roughnessMap: weave.roughnessMap,
        roughness: 1,
        normalScale: new THREE.Vector2(0.4, 0.4),
      }),
    [roundTex, weave],
  )
  const rectMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: rectTex,
        normalMap: weave.normalMap,
        roughnessMap: weave.roughnessMap,
        roughness: 1,
        normalScale: new THREE.Vector2(0.4, 0.4),
      }),
    [rectTex, weave],
  )
  return (
    <group>
      {/* big round rug under the table */}
      <mesh material={roundMat} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[2.75, 48]} />
      </mesh>
      {/* red rug at the door */}
      <mesh material={rectMat} position={[3.65, 0.006, 3.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.0, 1.5]} />
      </mesh>
      {/* red rug under the armchair */}
      <mesh material={rectMat} position={[-4.0, 0.006, -2.2]} rotation={[-Math.PI / 2, 0, 0.7]} receiveShadow>
        <planeGeometry args={[2.1, 1.6]} />
      </mesh>
      {/* runner in front of the desk */}
      <mesh material={rectMat} position={[-3.6, 0.006, 2.6]} rotation={[-Math.PI / 2, 0, 0.35]} receiveShadow>
        <planeGeometry args={[1.9, 1.1]} />
      </mesh>
    </group>
  )
}

/* ---------- flicker-free static candle clusters (scanned brass / wood holders) ---------- */
const CandleCluster = memo(function CandleCluster() {
  return (
    <group>
      {/* window sill candles */}
      <AssetCandle variant="wood" position={[-2.2, 0.92, -4.75]} height={0.2} />
      <AssetCandle variant="brass1" position={[2.25, 0.92, -4.75]} height={0.24} />
    </group>
  )
})

export default function Decor() {
  return (
    <group>
      <Chandelier />
      <Rugs />
      <CandleCluster />
      {/* banners: back wall left of window + right wall pair */}
      <Banner position={[-3.9, 2.95, -4.82]} scale={1.15} />
      <Banner position={[5.85, 2.8, -2.4]} rotation={[0, -Math.PI / 2, 0]} />
      <Banner position={[5.85, 2.8, 2.6]} rotation={[0, -Math.PI / 2, 0]} />
      {/* big potted plants flanking the window / cabinet */}
      <PottedPlant type="monstera" position={[-3.15, 0, -4.25]} scale={1.45} seed={51} brassPot />
      <PottedPlant type="monstera" position={[2.25, 0, -4.3]} scale={1.35} seed={52} brassPot />
      <PottedPlant type="fern" position={[2.6, 0, -3.3]} scale={0.9} seed={53} />
      {/* porch greenery */}
      <PottedPlant type="bush" position={[2.3, 0, 4.6]} scale={1.0} seed={54} />
    </group>
  )
}
