import { RoundedBox } from '@react-three/drei'
import { Hourglass, Mug, brassMat, brassDarkMat } from './Props'
import { HangingVine, PottedPlant } from './Plants'
import { walnutMaterial, darkPlankMaterial, velvetMaterial } from './pbr'
import { AssetBookRow, AssetBookStack, AssetCandle, AssetModel } from './Assets'

const woodMat = walnutMaterial(2, 1)
const woodDarkMat = darkPlankMaterial(2, 1, '#96765a')
const cushionMat = velvetMaterial('#cfc3a0', 2, 2)
const throwMat = velvetMaterial('#2a5a40', 2.5, 2.5)

/* a row of upright scanned books filling `width` along local x
   (kept under the old name — DisplayCabinet imports it) */
export function BookRow({
  width,
  seed,
  position = [0, 0, 0],
}: {
  width: number
  seed: number
  position?: [number, number, number]
}) {
  return <AssetBookRow width={width} seed={seed} position={position} bookHeight={0.27} />
}

/* heavy wooden desk with drawers (bespoke — no suitable scan available) */
function Desk({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* top */}
      <RoundedBox
        args={[2.3, 0.07, 1.0]}
        radius={0.02}
        material={woodMat}
        position={[0, 0.76, 0]}
        castShadow
        receiveShadow
      />
      {/* side pedestals with drawers */}
      {[-0.85, 0.85].map((x) => (
        <group key={x} position={[x, 0.37, 0]}>
          <RoundedBox args={[0.55, 0.72, 0.9]} radius={0.025} material={woodDarkMat} castShadow />
          {[0.18, -0.05, -0.26].map((y) => (
            <group key={y}>
              <RoundedBox args={[0.45, 0.16, 0.02]} radius={0.008} material={woodMat} position={[0, y, 0.46]} />
              <mesh material={brassMat} position={[0, y, 0.48]}>
                <boxGeometry args={[0.12, 0.02, 0.02]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* back panel */}
      <mesh material={woodDarkMat} position={[0, 0.45, -0.42]}>
        <boxGeometry args={[1.2, 0.6, 0.04]} />
      </mesh>

      {/* === desktop props === */}
      {/* brass oil lamp with a real glass chimney (flame mesh is HDR-emissive) */}
      <AssetModel asset="oilLamp" height={0.48} position={[-0.85, 0.795, -0.2]} rotation={[0, 0.4, 0]} />
      {/* open leather journal */}
      <AssetModel asset="notebook" node="binder_notebook" maxDim={0.42} position={[0.12, 0.8, 0.14]} rotation={[0, -0.2, 0]} />
      <AssetBookStack position={[-0.38, 0.795, -0.28]} seed={21} count={4} scale={0.95} />
      <AssetBookStack position={[0.95, 0.795, -0.3]} seed={33} count={2} scale={0.85} />
      {/* brass pocket compass + binoculars */}
      <AssetModel asset="compass" maxDim={0.14} position={[0.58, 0.795, 0.32]} rotation={[0, 0.5, 0]} />
      <AssetModel asset="binocular" maxDim={0.2} position={[0.42, 0.82, -0.38]} rotation={[0, -0.7, 0]} />
      <Mug position={[0.78, 0.795, 0.05]} />
      {/* pen holder */}
      <mesh material={brassDarkMat} position={[-0.15, 0.85, -0.35]}>
        <cylinderGeometry args={[0.045, 0.04, 0.11, 12]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={woodMat} position={[-0.16 + i * 0.02, 0.93, -0.35]} rotation={[0.15 * (i - 1), 0, 0.1 * (i - 1)]}>
          <cylinderGeometry args={[0.005, 0.005, 0.14, 6]} />
        </mesh>
      ))}
      <AssetCandle variant="wood" position={[-0.58, 0.795, 0.3]} height={0.15} />
      {/* small green on the desk */}
      <PottedPlant type="bush" position={[-1.0, 0.795, 0.25]} scale={0.55} seed={17} />
    </group>
  )
}

/* scanned French bergère armchair, still wearing the procedural pillow + throw */
function Armchair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <AssetModel asset="armchair" height={1.02} />
      {/* pillow */}
      <RoundedBox
        args={[0.36, 0.34, 0.13]}
        radius={0.06}
        material={cushionMat}
        position={[-0.1, 0.58, -0.14]}
        rotation={[0.3, 0.2, 0.15]}
        castShadow
      />
      {/* throw over right arm */}
      <RoundedBox
        args={[0.2, 0.4, 0.48]}
        radius={0.03}
        material={throwMat}
        position={[0.38, 0.56, 0.1]}
        rotation={[0, 0, 0.05]}
      />
      <RoundedBox
        args={[0.2, 0.44, 0.05]}
        radius={0.022}
        material={throwMat}
        position={[0.38, 0.74, 0.1]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  )
}

/* tall dark-wood pedestal side table + candle + teacup */
function SideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <AssetModel asset="sideTable" height={0.66} />
      <AssetCandle variant="brass1" position={[-0.08, 0.66, 0.04]} height={0.2} />
      {/* teacup */}
      <mesh position={[0.1, 0.685, -0.07]} castShadow>
        <cylinderGeometry args={[0.04, 0.03, 0.05, 12]} />
        <meshStandardMaterial color="#d9c9a3" roughness={0.5} />
      </mesh>
    </group>
  )
}

/* big worn-wood bookshelf (scan) against the left wall, filled with encyclopedias */
function Bookshelf({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  const H = 2.4
  /* shelf boards sit at these height fractions of the carcass */
  const shelfF = [0.065, 0.25, 0.425, 0.6, 0.785]
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <AssetModel asset="bookshelf" height={H} />
      {/* book rows on the five shelf boards */}
      {shelfF.map((f, i) =>
        i === 3 ? (
          /* leave room on this shelf for a candle + small pot */
          <AssetBookRow key={f} width={0.95} seed={100 + i * 17} position={[-0.2, f * H, 0.02]} bookHeight={0.28} />
        ) : (
          <AssetBookRow key={f} width={1.35} seed={100 + i * 17} position={[0, f * H, 0.02]} bookHeight={0.28} />
        ),
      )}
      <AssetCandle variant="brass1" position={[0.48, shelfF[3] * H, 0.05]} height={0.18} />
      <PottedPlant type="bush" position={[0.68, shelfF[3] * H, 0.03]} scale={0.5} seed={14} />
      {/* top: mixed decor */}
      <AssetBookRow width={0.75} seed={555} position={[-0.42, H + 0.02, 0.02]} bookHeight={0.24} />
      <PottedPlant type="fern" position={[0.5, H + 0.02, 0.05]} scale={0.7} seed={9} />
      <Hourglass position={[0.05, H + 0.02, 0.05]} scale={0.9} />
      {/* vines spilling off the top */}
      <HangingVine position={[-0.75, H + 0.05, 0.15]} length={1.4} seed={3} />
      <HangingVine position={[0.8, H + 0.05, 0.1]} length={0.9} seed={8} />
    </group>
  )
}

export default function DeskArea() {
  return (
    <group>
      {/* desk + chair in the front-left quarter */}
      <Desk position={[-4.2, 0, 1.7]} rotation={0.35} />
      {/* scanned green salon chair at the desk */}
      <AssetModel asset="greenChair" height={1.0} position={[-3.85, 0, 2.62]} rotation={[0, 0.35 + Math.PI, 0]} />
      {/* armchair corner, rear-left */}
      <Armchair position={[-4.1, 0, -2.5]} rotation={0.7} />
      <SideTable position={[-5.15, 0, -1.55]} />
      {/* bookshelf on the left wall */}
      <Bookshelf position={[-5.58, 0, -2.4]} rotation={Math.PI / 2} />
      {/* gilt oil paintings on the left wall */}
      <AssetModel asset="painting" height={0.72} position={[-5.85, 1.72, -0.4]} rotation={[0, Math.PI / 2, 0]} />
      <AssetModel asset="painting" height={0.5} position={[-5.85, 1.62, 0.62]} rotation={[0, Math.PI / 2, 0.04]} />
      {/* plants around the corner */}
      <PottedPlant type="monstera" position={[-5.3, 0, -4.2]} scale={1.5} seed={4} />
      <PottedPlant type="fern" position={[-5.45, 0, 0.6]} scale={1.1} seed={6} />
      {/* a book dropped on the rug */}
      <AssetBookStack position={[-3.3, 0.02, -1.6]} seed={77} count={1} scale={0.9} />
    </group>
  )
}
