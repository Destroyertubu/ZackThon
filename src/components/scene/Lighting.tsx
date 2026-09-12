import { useMemo } from 'react'
import { Object3D } from 'three'

/**
 * Lighting plan (8 real lights total) — warm "golden hour through the window" mood:
 *  1. low warm ambient  2. hemisphere fill  3. golden sunlight (4096 shadows)
 *  4. crystal point (teal, shadows)  5. chandelier point  6. desk lamp point
 *  7. display-cabinet interior point  8. display-cabinet front fill
 * All other flames / lanterns are HDR-emissive + Bloom.
 */
export default function Lighting({ shadowMapSize = 2048, crystalShadow = true }: { shadowMapSize?: 1024 | 2048; crystalShadow?: boolean }) {
  // A real scene target keeps the sun aimed through the glazing at floor level.
  const sunlightTarget = useMemo(() => new Object3D(), [])
  return (
    <group>
      <primitive object={sunlightTarget} />
      <ambientLight color="#c49b72" intensity={1.0} />
      <hemisphereLight color="#ffe4b8" groundColor="#6b4c2c" intensity={0.9} />

      {/* golden afternoon sun streaming in from the mountain window */}
      <directionalLight
        color="#ffd09a"
        intensity={6.5}
        position={[3.5, 6.5, -11]}
        target={sunlightTarget}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-8.5}
        shadow-camera-right={8.5}
        shadow-camera-top={8.5}
        shadow-camera-bottom={-8.5}
        shadow-camera-near={2}
        shadow-camera-far={26}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-radius={shadowMapSize === 1024 ? 2 : 4}
      />

      {/* crystal — teal focal light */}
      <pointLight
        color="#4fe8c0"
        intensity={7.5}
        distance={9}
        decay={1.6}
        position={[0, 1.7, 0]}
        castShadow={crystalShadow}
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.001}
        shadow-normalBias={0.02}
      />

      {/* chandelier warm pool over the table */}
      <pointLight color="#ffb45e" intensity={14} distance={12} decay={1.5} position={[0, 2.75, 0]} />

      {/* desk lamp */}
      <pointLight color="#ffc06a" intensity={6} distance={6} decay={1.6} position={[-4.35, 1.5, 1.55]} />

      {/* display cabinet interior (inside the carcass, lights the shelves) */}
      <pointLight color="#ffbe62" intensity={8} distance={5} decay={1.5} position={[4.3, 1.4, -4.35]} />

      {/* warm entrance fill stays inside the closed room */}
      <pointLight color="#ffd2a0" intensity={14} distance={20} decay={1.8} position={[0.5, 2.7, 3.9]} />
    </group>
  )
}
