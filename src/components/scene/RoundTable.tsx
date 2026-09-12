import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { tableTopTexture } from './textures'
import { pbrMaps, SETS } from './pbr'
import { brassMat, Armillary, CrystalCluster, InkBottle, Magnifier, Scroll } from './Props'
import { walnutMaterial, darkPlankMaterial } from './pbr'
import { AssetBook, AssetBookStack, AssetCandle, AssetModel } from './Assets'
import { PottedPlant } from './Plants'

const woodMat = walnutMaterial(2, 1)
const woodDarkMat = darkPlankMaterial(3, 1, '#9a7852')

/* base cabinet door decoration arranged radially */
function BaseDoors({ radius }: { radius: number }) {
  const doors = useMemo(() => [0, 1, 2, 3, 4, 5], [])
  return (
    <group>
      {doors.map((i) => {
        const a = (i / doors.length) * Math.PI * 2
        const x = Math.cos(a) * radius
        const z = Math.sin(a) * radius
        return (
          <group key={i} position={[x, 0.42, z]} rotation={[0, -a + Math.PI / 2, 0]}>
            <RoundedBox args={[0.5, 0.55, 0.04]} radius={0.015} material={woodDarkMat} />
            <mesh material={brassMat} position={[0, 0, -0.025]}>
              <torusGeometry args={[0.05, 0.01, 6, 14]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export default function RoundTable() {
  const topTex = useMemo(() => tableTopTexture(), [])
  const topBump = useMemo(() => pbrMaps(SETS.fabric, 3, 3), [])
  return (
    <group position={[0, 0, 0]}>
      {/* pedestal base (bespoke centerpiece — kept) */}
      <mesh material={woodMat} position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.15, 0.84, 32]} />
      </mesh>
      <mesh material={woodDarkMat} position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.2, 1.25, 0.1, 32]} />
      </mesh>
      <BaseDoors radius={1.07} />
      {/* table top */}
      <mesh position={[0, 0.93, 0]} receiveShadow>
        <cylinderGeometry args={[1.72, 1.72, 0.07, 64]} />
        <meshStandardMaterial
          map={topTex}
          normalMap={topBump.normalMap}
          roughness={0.55}
          envMapIntensity={0.6}
          normalScale={new THREE.Vector2(0.35, 0.35)}
        />
      </mesh>
      {/* brass rim */}
      <mesh material={brassMat} position={[0, 0.93, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.72, 0.025, 10, 72]} />
      </mesh>
      {/* crystal dais */}
      <mesh material={brassMat} position={[0, 0.99, 0]}>
        <cylinderGeometry args={[0.62, 0.68, 0.06, 40]} />
      </mesh>
      <CrystalCluster position={[0, 1.0, 0]} scale={1} />

      {/* ==== props arranged around the crystal (radius ~1.1-1.5) ==== */}
      {/* scanned candle holders, mixed brass + turned wood */}
      <AssetCandle variant="brass1" position={[Math.cos(0.35) * 1.35, 0.965, Math.sin(0.35) * 1.35]} height={0.24} rotation={0.6} />
      <AssetCandle variant="wood" position={[Math.cos(1.5) * 1.38, 0.965, Math.sin(1.5) * 1.38]} height={0.17} />
      <AssetCandle variant="brass3" position={[Math.cos(2.6) * 1.28, 0.965, Math.sin(2.6) * 1.28]} height={0.34} rotation={-0.5} />
      <AssetCandle variant="brass1" position={[Math.cos(3.7) * 1.35, 0.965, Math.sin(3.7) * 1.35]} height={0.19} rotation={2.1} />
      <AssetCandle variant="wood" position={[Math.cos(4.8) * 1.38, 0.965, Math.sin(4.8) * 1.38]} height={0.21} />
      <AssetCandle variant="brass1" position={[Math.cos(5.7) * 1.35, 0.965, Math.sin(5.7) * 1.35]} height={0.26} rotation={4.0} />
      {/* books & open tomes */}
      <AssetBookStack position={[1.15, 0.965, 0.55]} seed={5} count={3} scale={0.9} />
      {/* open leather journal */}
      <AssetModel asset="notebook" node="binder_notebook" maxDim={0.38} position={[-1.2, 0.968, 0.5]} rotation={[0, 0.5, 0]} />
      <AssetModel asset="notebook" node="binder_notebook_closed" maxDim={0.26} position={[0.4, 0.968, -1.35]} rotation={[0, -2.2, 0]} />
      <AssetBook
        index={12}
        height={0.26}
        position={[-0.7, 0.985, -1.15]}
        rotation={[0, 1.1, Math.PI / 2]}
      />
      {/* scrolls */}
      <Scroll position={[-1.45, 0.995, -0.35]} rotation={0.4} />
      <Scroll position={[1.5, 0.995, -0.5]} rotation={-0.9} length={0.34} />
      {/* instruments (kept: bespoke brass reads well) */}
      <Armillary position={[-1.05, 0.965, 1.05]} scale={0.75} />
      <Magnifier position={[0.95, 0.965, -0.95]} rotation={0.8} />
      <InkBottle position={[-0.35, 0.965, 1.4]} />
      {/* small potted green on the table */}
      <PottedPlant type="bush" position={[0.65, 0.965, 1.25]} scale={0.6} seed={71} />

      {/* scanned dark-wood armchairs around the table */}
      <AssetModel asset="chineseChair" height={1.06} position={[2.45, 0, 0.6]} rotation={[0, -Math.PI / 2 - 0.3, 0]} />
      <AssetModel asset="chineseChair" height={1.06} position={[-2.4, 0, 0.9]} rotation={[0, Math.PI / 2 + 0.4, 0]} />
      <AssetModel asset="chineseChair" height={1.06} position={[0.4, 0, -2.45]} rotation={[0, Math.PI - 0.15, 0]} />
    </group>
  )
}
