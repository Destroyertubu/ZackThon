import { useMemo } from 'react'
import * as THREE from 'three'
import { AssetLantern, AssetModel } from './Assets'
import { BALCONY, BALCONY_RAILS } from './roomEnvelope'
import type { ShellPanel } from './roomEnvelope'
import { pbrMaps, SETS, timberMaterial } from './pbr'

/** Every rail is rendered from the same volume used by movement and camera collision. */
function Railing({ panel, material }: { panel: ShellPanel; material: THREE.Material }) {
  const alongX = panel.size[0] > panel.size[2]
  const length = Math.max(panel.size[0], panel.size[2])
  const posts = Math.max(2, Math.ceil(length / 0.62) + 1)
  return (
    <group position={[panel.position[0], 0, panel.position[2]]}>
      {[BALCONY.railHeight - 0.07, 0.22].map((y, i) => (
        <mesh key={y} material={material} position={[0, y, 0]} castShadow receiveShadow>
          <boxGeometry args={alongX ? [length, i ? 0.08 : 0.14, BALCONY.railThickness] : [BALCONY.railThickness, i ? 0.08 : 0.14, length]} />
        </mesh>
      ))}
      {Array.from({ length: posts }, (_, i) => {
        const offset = (i / (posts - 1) - 0.5) * (length - 0.14)
        const end = i === 0 || i === posts - 1
        return (
          <mesh key={i} material={material} position={[alongX ? offset : 0, BALCONY.railHeight / 2, alongX ? 0 : offset]} castShadow receiveShadow>
            <boxGeometry args={[end ? 0.14 : 0.06, BALCONY.railHeight, end ? 0.14 : 0.06]} />
          </mesh>
        )
      })}
    </group>
  )
}

export default function Balcony() {
  const materials = useMemo(() => ({
    deck: new THREE.MeshStandardMaterial({
      ...pbrMaps(SETS.floorDeck, 2.8, 1.6), color: '#cbb590', roughness: 0.9,
      normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 0.45,
    }),
    wood: timberMaterial(2, 0.5),
  }), [])
  const depth = BALCONY.nearZ - BALCONY.farZ
  const centerZ = (BALCONY.nearZ + BALCONY.farZ) / 2
  return (
    <group name="sunlit-balcony">
      {/* Deck top is exactly y=0, matching the cabin floor without a step or teleport. */}
      <mesh material={materials.deck} position={[0, -0.07, centerZ]} castShadow receiveShadow>
        <boxGeometry args={[BALCONY.halfWidth * 2, 0.14, depth]} />
      </mesh>
      <mesh material={materials.wood} position={[0, -0.2, BALCONY.farZ + 0.06]} castShadow receiveShadow>
        <boxGeometry args={[BALCONY.halfWidth * 2, 0.26, 0.15]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={materials.wood} position={[side * (BALCONY.halfWidth - 0.08), -0.2, centerZ]} castShadow receiveShadow>
            <boxGeometry args={[0.16, 0.26, depth]} />
          </mesh>
          <mesh material={materials.wood} position={[side * 2.82, -1.15, -7.95]} castShadow receiveShadow>
            <boxGeometry args={[0.24, 2.3, 0.24]} />
          </mesh>
          <AssetModel asset="plantMid" height={1.0} position={[side * 2.55, 0, -7.95]} rotation={[0, side * 0.7, 0]} />
        </group>
      ))}
      {BALCONY_RAILS.map((panel, i) => <Railing key={i} panel={panel} material={materials.wood} />)}

      {/* A narrow reading bench stays against the left railing, outside the main path. */}
      <group position={[-2.53, 0, -6.65]}>
        <mesh material={materials.deck} position={[0, 0.46, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.64, 0.1, 1.5]} />
        </mesh>
        {[-0.57, 0.57].map((z) => (
          <mesh key={z} material={materials.wood} position={[0, 0.22, z]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.44, 0.12]} />
          </mesh>
        ))}
        {[0.65, 0.8].map((y) => (
          <mesh key={y} material={materials.wood} position={[-0.3, y, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.08, 0.1, 1.5]} />
          </mesh>
        ))}
        <AssetLantern height={0.24} position={[0.02, 0.52, -0.52]} />
      </group>
    </group>
  )
}
