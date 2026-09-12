import { useMemo } from 'react'
import * as THREE from 'three'
import { brassDarkMat } from './Props'
import { AssetLantern } from './Assets'
import { BeamIvy } from './Plants'
import { pbrMaps, SETS, plasterMaterial, timberMaterial, stoneMaterial } from './pbr'
import { WALL_PANELS, CLOSED_DOOR, WINDOW_GLAZING, BALCONY_PORTAL, BALCONY_PORTAL_FRAME, ROOF_ANGLE, ROOF_LENGTH, createGableGeometry, createRoofGeometry } from './roomEnvelope'

/* Complete cabin shell, with a deliberate glazed opening onto the sunlit balcony. */

const roofMat = timberMaterial(6, 1.2)
roofMat.color.set('#6e5136')

function Wall({
  size,
  position,
}: {
  size: [number, number, number]
  position: [number, number, number]
}) {
  const [width, height, depth] = size
  // plaster repeat follows the largest face so texel density stays even
  const mat = useMemo(
    () => plasterMaterial(Math.max(width, depth), height),
    [width, height, depth],
  )
  return (
    <mesh material={mat} position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

function Timber({
  size,
  position,
  rotation = [0, 0, 0],
}: {
  size: [number, number, number]
  position: [number, number, number]
  rotation?: [number, number, number]
}) {
  const [width, height, depth] = size
  const mat = useMemo(
    () => timberMaterial(Math.max(width, depth) / 1.4, height / 0.6),
    [width, height, depth],
  )
  return (
    <mesh material={mat} position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

/* plank floor: one textured slab (deck texture carries the plank seams) */
function Floor() {
  const floorMat = useMemo(() => {
    // dark_wooden_planks is neutral gray-brown — tints cleanly to warm oak
    const maps = pbrMaps(SETS.darkPlanks, 2.4, 2.0)
    for (const t of [maps.map, maps.roughnessMap, maps.normalMap]) {
      if (!t) continue
      t.center.set(0.5, 0.5)
      t.rotation = Math.PI / 2 // run the planks toward the window
    }
    return new THREE.MeshStandardMaterial({
      ...maps,
      color: '#d8ad7c',
      roughness: 1,
      normalScale: new THREE.Vector2(0.8, 0.8),
      envMapIntensity: 0.55,
    })
  }, [])
  const foundationMat = useMemo(() => stoneMaterial(4, 0.6), [])
  return (
    <group>
      <mesh material={floorMat} position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[12, 0.08, 10]} />
      </mesh>
      {/* stone foundation */}
      <mesh material={foundationMat} position={[0, -0.88, 0]}>
        <boxGeometry args={[12.7, 1.64, 10.7]} />
      </mesh>
    </group>
  )
}

/* Sliding glazed doors leave a level, unobstructed passage between two side windows. */
function WindowFrame() {
  return (
    <group position={[0, 0, BALCONY_PORTAL.wallZ]}>
      {WINDOW_GLAZING.map((pane, i) => (
        <mesh key={i} position={[pane.position[0], pane.position[1], 0]}>
          <boxGeometry args={pane.size} />
          <meshPhysicalMaterial color="#d6e5dd" metalness={0} roughness={0.12}
            transparent opacity={0.13} depthWrite={false} envMapIntensity={0.7} />
        </mesh>
      ))}
      {/* The head is above the walk-through aperture; no sill or rail crosses it. */}
      {BALCONY_PORTAL_FRAME.map((panel, i) => (
        <Timber key={i} size={panel.size} position={[panel.position[0], panel.position[1], 0]} />
      ))}
      <Timber size={[0.16, 2.32, 0.3]} position={[-2.67, 2.0, 0]} />
      <Timber size={[0.16, 2.32, 0.3]} position={[2.67, 2.0, 0]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Timber size={[1.64, 0.16, 0.34]} position={[side * 1.88, 0.92, 0]} />
          <Timber size={[1.48, 0.06, 0.12]} position={[side * 1.88, 2.46, 0]} />
          {/* Retracted glazed leaf and its brass handle, entirely beside the passage. */}
          <Timber size={[0.055, 2.1, 0.08]} position={[side * 2.22, 1.95, -0.09]} />
          <mesh material={brassDarkMat} position={[side * 1.25, 1.45, 0.19]}>
            <boxGeometry args={[0.025, 0.24, 0.055]} />
          </mesh>
        </group>
      ))}
      <mesh material={brassDarkMat} position={[0, 3.01, 0.18]}>
        <boxGeometry args={[5.24, 0.018, 0.05]} />
      </mesh>
    </group>
  )
}

/* Both gables close the spaces above the side walls under the pitched roof. */
function Gables() {
  const geo = useMemo(() => createGableGeometry(), [])
  const mat = useMemo(() => plasterMaterial(10, 1.5), [])
  return (
    <group>
      {[-6.125, 5.875].map((x) => (
        <mesh key={x} geometry={geo} material={mat} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      ))}
    </group>
  )
}

function Roof() {
  const geometry = useMemo(() => createRoofGeometry(), [])
  const rafterX = [-5.4, -2.7, 0, 2.7, 5.4]
  return (
    <group>
      <Timber size={[12.7, 0.18, 0.18]} position={[0, 4.7, 0]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh geometry={geometry} material={roofMat} position={[0, 3.95, side * 2.5]} rotation={[side * ROOF_ANGLE, 0, 0]} castShadow receiveShadow />
          {rafterX.map((x) => (
            <Timber key={x} size={[0.14, 0.2, ROOF_LENGTH]} position={[x, 3.81, side * 2.5]} rotation={[side * ROOF_ANGLE, 0, 0]} />
          ))}
          <Timber size={[12.5, 0.14, 0.14]} position={[0, 3.15, side * 4.9]} />
        </group>
      ))}
      <BeamIvy position={[-2.8, 4.55, 0]} length={4.5} seed={11} drops={2} />
      <BeamIvy position={[-3.8, 3.12, -4.95]} length={4} seed={23} drops={3} />
      <BeamIvy position={[3.8, 3.12, -4.95]} length={4} seed={37} drops={3} />
    </group>
  )
}

/* door + porch + steps at front-right */
function Doorway() {
  const stepMat = useMemo(() => stoneMaterial(1.2, 0.5), [])
  const step2Mat = useMemo(() => stoneMaterial(1.4, 0.6), [])
  return (
    <group>
      {/* frame posts */}
      <Timber size={[0.2, 2.5, 0.28]} position={[3.0, 1.25, 5]} />
      <Timber size={[0.2, 2.5, 0.28]} position={[4.3, 1.25, 5]} />
      <Timber size={[1.5, 0.2, 0.28]} position={[3.65, 2.6, 5]} />
      {/* Closed leaf: world travel is triggered from inside with E / the door marker. */}
      <Timber size={CLOSED_DOOR.size} position={CLOSED_DOOR.position} />
      <mesh material={plasterMaterial(0.9, 1.9)} position={[3.65, 1.25, 4.928]}>
        <boxGeometry args={[0.9, 1.9, 0.02]} />
      </mesh>
      <mesh material={brassDarkMat} position={[3.2, 1.15, 4.89]}>
        <torusGeometry args={[0.06, 0.012, 8, 16]} />
      </mesh>
      {/* porch deck + stone steps outside */}
      <Timber size={[2.4, 0.1, 1.5]} position={[3.65, -0.03, 5.7]} />
      <mesh material={stepMat} position={[3.65, -0.18, 6.55]}>
        <boxGeometry args={[2.2, 0.22, 0.5]} />
      </mesh>
      <mesh material={step2Mat} position={[3.65, -0.4, 6.95]}>
        <boxGeometry args={[2.4, 0.24, 0.6]} />
      </mesh>
      {/* porch lanterns flanking the door, hanging from brass hooks */}
      {[2.85, 4.45].map((x) => (
        <group key={x}>
          <mesh material={brassDarkMat} position={[x, 2.42, 5.06]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
          </mesh>
          <AssetLantern position={[x, 2.05, 5.2]} height={0.36} />
        </group>
      ))}
    </group>
  )
}

export default function Room() {
  return (
    <group>
      <Floor />

      {WALL_PANELS.map((wall, i) => <Wall key={i} size={wall.size} position={wall.position} />)}
      <Gables />
      <WindowFrame />

      {/* ===== timber posts & plates ===== */}
      {(
        [
          [-6, -5],
          [6, -5],
          [-6, 5],
          [6, 5],
          [-6, -0.5],
          [6, -1],
        ] as const
      ).map(([x, z]) => (
        <Timber key={`${x},${z}`} size={[0.34, 3.2, 0.34]} position={[x, 1.6, z]} />
      ))}
      {/* top plates */}
      <Timber size={[0.3, 0.22, 10]} position={[-6, 3.1, 0]} />
      <Timber size={[0.3, 0.22, 10]} position={[6, 3.1, 0]} />
      {/* wall studs on back wall */}
      {[-5.2, -3.4, 3.4, 5.2].map((x) => (
        <Timber key={x} size={[0.18, 3.2, 0.3]} position={[x, 1.6, -5]} />
      ))}

      <Roof />
      <Doorway />

      {/* wall lanterns flanking the window (hung from brass wall hooks) */}
      {(
        [
          [-3.1, 2.02, -4.72, 0],
          [3.1, 2.02, -4.72, 0],
          [-5.75, 1.85, -0.3, Math.PI / 2],
          [5.75, 1.85, 0.4, -Math.PI / 2],
        ] as const
      ).map(([x, y, z, ry]) => (
        <group key={`${x}${z}`} position={[x, y, z]} rotation={[0, ry, 0]}>
          <mesh material={brassDarkMat} position={[0, 0.42, -0.09]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
          </mesh>
          <AssetLantern position={[0, 0, 0]} height={0.34} />
        </group>
      ))}
    </group>
  )
}
