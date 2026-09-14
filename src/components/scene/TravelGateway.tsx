import SpatialWords from '@/features/typography/SpatialWords'
import { useEffect, useMemo, useState } from 'react'
import { Clone, useGLTF, useTexture } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { PH } from './Assets'
import { pbrMaps, SETS } from './pbr'
import './travel-gateway.css'

/** Both ends use the cabin's scanned gilt frame, with its painting node omitted.
 * Destination photographs are captured from the actual local scenes, without HUD.
 * The open center is an interaction surface, not a solid navigation obstacle.
 */
export default function TravelGateway({ destination, position, rotation = 0, onActivate }: {
  destination: 'home' | 'observatory'
  position: [number, number, number]
  rotation?: number
  onActivate: () => void
}) {
  const { nodes } = useGLTF(`/models/${PH.painting}.gltf`)
  const source = useTexture(`/textures/travel/${destination}-window.jpg`)
  const [hovered, setHovered] = useState(false)
  const home = destination === 'home'
  const label = home ? '返回小屋' : '前往观星台'
  const materials = useMemo(() => {
    const preview = source.clone()
    preview.colorSpace = THREE.SRGBColorSpace
    preview.anisotropy = 4
    preview.needsUpdate = true
    const woodMaps = pbrMaps(SETS.walnut, 1, 2)
    return {
      preview,
      woodMaps,
      wood: new THREE.MeshStandardMaterial({ ...woodMaps, color: '#74583a', roughness: 0.62, envMapIntensity: 0.5 }),
      brass: new THREE.MeshStandardMaterial({ color: '#c6a165', roughness: 0.32, metalness: 0.7 }),
    }
  }, [source])
  useEffect(() => () => {
    materials.preview.dispose(); materials.wood.dispose(); materials.brass.dispose()
    Object.values(materials.woodMaps).forEach(texture => texture.dispose())
  }, [materials])

  // The original scan is 0.60303 m wide. Turn it upright and center it on the sill.
  const frameScale = 2.05 / 0.60303
  const centerY = 1.135
  const activate = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    // Dragging the camera across the frame must not accidentally travel.
    if (event.delta <= 5) onActivate()
  }
  return <group name={`travel-gateway-to-${destination}`} position={position} rotation={[0, rotation, 0]}>
    <group onClick={activate} onPointerOver={e => { e.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      {/* A substantial timber jamb and low sill give the thin scanned ornament depth. */}
      {[-1, 1].map(side => <mesh key={side} position={[side * 0.751, centerY, -0.06]} material={materials.wood} castShadow receiveShadow>
        <boxGeometry args={[0.08, 2.04, 0.2]} />
      </mesh>)}
      <mesh position={[0, 2.12, -0.06]} material={materials.wood} castShadow receiveShadow><boxGeometry args={[1.58, 0.08, 0.2]} /></mesh>
      <mesh position={[0, 0.055, 0]} material={materials.wood} castShadow receiveShadow><boxGeometry args={[1.7, 0.11, 0.48]} /></mesh>
      <mesh position={[0, 0.117, 0.13]} material={materials.brass}><boxGeometry args={[1.47, 0.015, 0.2]} /></mesh>
      <group position={[0, centerY, 0]} rotation={[0, 0, Math.PI / 2]} scale={frameScale}>
        <Clone object={nodes.fancy_picture_frame_01} castShadow receiveShadow />
      </group>
      <group position={[0, centerY, -0.11]} rotation={[0, Math.PI, Math.PI / 2]} scale={frameScale}>
        <Clone object={nodes.fancy_picture_frame_01} castShadow receiveShadow />
      </group>
      {[0, Math.PI].map(angle => <group key={angle} position={[0, centerY, angle ? -0.11 : 0]} rotation={[0, angle, 0]}>
        <mesh position={[0, 0, 0.023]}>
          <planeGeometry args={[1.365, 1.85]} />
          <meshBasicMaterial map={materials.preview} color={hovered ? '#ffffff' : '#dad9cd'} toneMapped={false} />
        </mesh>
        {[-1, 1].map(side => <mesh key={side} position={[side * 0.675, 0, 0.03]}>
          <boxGeometry args={[0.009, 1.83, 0.009]} />
          <meshBasicMaterial color={home ? '#ffcc81' : '#b7dbe4'} toneMapped={false} />
        </mesh>)}
      </group>)}
    </group>
    <SpatialWords text={label} position={[0, 1.92, .16]} width={1.45} onActivate={onActivate}/>

    <pointLight position={[0, 1.4, 0.4]} color={home ? '#ffd09a' : '#b7d8ea'} intensity={0.65} distance={2.2} decay={2} />
  </group>
}
