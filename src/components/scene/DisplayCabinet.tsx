import { useMemo } from 'react'
import * as THREE from 'three'
import { paperTexture } from './textures'
import { Armillary, CrystalCluster, Scroll, brassDarkMat } from './Props'
import { BookRow } from './DeskArea'
import { HangingVine, PottedPlant } from './Plants'
import { AssetBookStack, AssetCandle, AssetLantern, AssetModel } from './Assets'

/* warm glow dot on a shelf (emissive only, no real light) */
const glowDotMat = new THREE.MeshBasicMaterial({ color: '#ffcf8e', toneMapped: false })
glowDotMat.color.multiplyScalar(2.2)
function GlowDot({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} material={glowDotMat}>
      <sphereGeometry args={[0.03, 10, 10]} />
    </mesh>
  )
}

/* parchment blueprint pinned inside */
function Blueprint({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const tex = useMemo(() => paperTexture(), [])
  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[0.22, 0.28]} />
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  )
}

/*
 * Victorian glass-door display cabinet (Poly Haven scan).
 * Native 2.02w × 2.23h × 0.67d — normalized to 2.45m tall (k ≈ 1.096).
 *   lower wooden doors   y ≈ 0.16 – 0.91
 *   open counter niche   y ≈ 1.04 – 1.46  (front z ≈ 0.43)
 *   glass cabinet        y ≈ 1.46 – 2.29  (recessed, front z ≈ 0.18, interior z ≈ [-0.3, 0.15])
 * The original shelf contents + glow lights are transplanted into the scan.
 */
function Cabinet({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <AssetModel asset="cabinet" height={2.45} />

      {/* ==== inside the glass cabinet (z recessed behind the doors) ==== */}
      {/* fake shelf lights tucked under the glass top + mid shelf */}
      <GlowDot position={[-0.6, 2.2, -0.1]} />
      <GlowDot position={[0.6, 2.2, -0.1]} />
      <GlowDot position={[0, 1.82, -0.1]} />
      {/* lower glass shelf: crystals + blueprints */}
      <CrystalCluster position={[-0.55, 1.48, -0.05]} scale={0.4} />
      <CrystalCluster position={[0.1, 1.48, 0]} scale={0.32} color="#7fe8d0" />
      <AssetModel asset="vase" height={0.34} position={[0.62, 1.48, -0.05]} />
      <Blueprint position={[-0.15, 1.75, -0.28]} scale={0.9} />
      {/* upper glass shelf: armillary + upright books */}
      <Armillary position={[-0.62, 1.87, -0.02]} scale={0.75} />
      <BookRow width={0.85} seed={71} position={[0.35, 1.87, -0.02]} />
      <Blueprint position={[0.75, 2.1, -0.28]} scale={0.8} />

      {/* ==== open counter niche ==== */}
      <AssetBookStack position={[-0.62, 1.06, 0.05]} seed={61} count={3} scale={0.8} />
      <AssetCandle variant="brass3" position={[0.05, 1.06, 0.05]} height={0.34} />
      <AssetBookStack position={[0.68, 1.06, 0.08]} seed={62} count={2} scale={0.75} />
      <AssetModel asset="compass" maxDim={0.12} position={[0.42, 1.06, 0.18]} rotation={[0, -0.4, 0]} />

      {/* ==== on top ==== */}
      <AssetCandle variant="brass5" position={[0, 2.45, 0]} height={0.52} />
      <PottedPlant type="bush" position={[-0.8, 2.45, 0]} scale={0.85} seed={21} />
      <PottedPlant type="fern" position={[0.75, 2.45, 0]} scale={0.7} seed={22} />
      <HangingVine position={[-1.05, 2.47, 0.2]} length={1.6} seed={31} />
      <HangingVine position={[1.05, 2.47, 0.15]} length={1.2} seed={32} />
    </group>
  )
}

/* scroll tube with rolled parchments (kept — reads well already) */
function ScrollTube({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh material={brassDarkMat} position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.6, 14]} />
      </mesh>
      {(
        [
          [0.04, 0.68, 0.02, 0.35],
          [-0.05, 0.62, -0.03, 0.28],
          [0, 0.72, -0.05, 0.4],
        ] as const
      ).map(([x, y, z, len], i) => (
        <mesh key={i} position={[x, y, z]} rotation={[0.08 * (i - 1), 0, 0.06 * (i - 1)]}>
          <cylinderGeometry args={[0.035, 0.035, len, 10]} />
          <meshStandardMaterial color="#d9c9a3" roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

export default function DisplayCabinet() {
  return (
    <group>
      {/* cabinet stands against the back-right wall, glass doors facing the room/front */}
      <Cabinet position={[4.3, 0, -4.45]} rotation={0} />
      {/* beside the door: scanned travel chest + wooden crate stacked */}
      <AssetModel asset="chest" height={0.56} position={[5.3, 0, 1.3]} rotation={[0, -Math.PI / 2 + 0.15, 0]} />
      <AssetModel asset="crate" height={0.3} position={[5.25, 0.52, 1.28]} rotation={[0, -Math.PI / 2 - 0.12, 0]} />
      <ScrollTube position={[5.5, 0, 2.3]} />
      <Scroll position={[5.35, 0.72, 2.5]} rotation={0.4} />
      {/* standing storm lantern by the door, flame glowing inside */}
      <AssetLantern height={0.55} position={[5.5, 0, 3.2]} />
      <PottedPlant type="monstera" position={[5.7, 0, -2.9]} scale={1.3} seed={41} />
      {/* candle on the crate */}
      <AssetCandle variant="wood" position={[5.3, 0.84, 1.28]} height={0.16} />
    </group>
  )
}
