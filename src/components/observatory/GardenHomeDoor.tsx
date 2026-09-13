import { useEffect, useMemo, useState } from 'react'
import { Html, RoundedBox, useTexture } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { House } from 'lucide-react'
import * as THREE from 'three'
import type { ObservatoryMaterials } from './materials'
import { RETURN_GATE_POSITION } from './layout'
import '../scene/travel-gateway.css'

function archOutline(width: number, bottom: number, spring: number, top: number) {
  const shape = new THREE.Shape(), half = width / 2
  shape.moveTo(-half, bottom); shape.lineTo(half, bottom); shape.lineTo(half, spring)
  shape.quadraticCurveTo(half * 0.65, top, 0, top)
  shape.quadraticCurveTo(-half * 0.65, top, -half, spring)
  shape.closePath()
  return shape
}

function archHole(width: number, bottom: number, spring: number, top: number) {
  const hole = new THREE.Path(), half = width / 2
  hole.moveTo(-half, bottom); hole.lineTo(-half, spring)
  hole.quadraticCurveTo(-half * 0.65, top, 0, top)
  hole.quadraticCurveTo(half * 0.65, top, half, spring)
  hole.lineTo(half, bottom); hole.closePath()
  return hole
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.009) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 32, steps: 1 })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

function archTrim(width: number, bottom: number, spring: number, top: number, radius: number) {
  const shape = archOutline(width, bottom, spring, top)
  const points = shape.getSpacedPoints(256).slice(0, -1).map(p => new THREE.Vector3(p.x, p.y, 0))
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 384, radius, 7, true)
}

/** A solid freestanding timber door; its small inset window only hints at the cabin. */
export default function GardenHomeDoor({ materials: m, onActivate }: {
  materials: ObservatoryMaterials; onActivate: () => void
}) {
  const source = useTexture('/textures/travel/home-window.jpg')
  const [hovered, setHovered] = useState(false)
  const resources = useMemo(() => {
    const frame = archOutline(1.38, 0.075, 2.145, 2.40)
    frame.holes.push(archHole(1.10, 0.11, 2.085, 2.26))
    const leaf = archOutline(1.057, 0.135, 2.059, 2.226)
    const window = new THREE.Path()
    window.moveTo(-0.21, 1.645); window.lineTo(-0.21, 1.865); window.quadraticCurveTo(0, 2.00, 0.21, 1.865)
    window.lineTo(0.21, 1.645); window.closePath(); leaf.holes.push(window)
    const windowFrame = archOutline(0.49, 1.606, 1.879, 1.985)
    windowFrame.holes.push(archHole(0.424, 1.641, 1.862, 1.955))
    const preview = source.clone()
    preview.colorSpace = THREE.SRGBColorSpace; preview.anisotropy = 4; preview.needsUpdate = true
    const veneer = m.walnut.clone()
    veneer.color.set('#b18b5b'); veneer.roughness = 0.58; veneer.envMapIntensity = 0.6
    return {
      frame: extrude(frame, 0.28, 0.016), leaf: extrude(leaf, 0.13, 0.007),
      windowFrame: extrude(windowFrame, 0.04, 0.004),
      outsideBead: archTrim(1.307, 0.114, 2.128, 2.355, 0.015),
      insideBead: archTrim(1.124, 0.125, 2.090, 2.279, 0.008),
      lightSeam: archTrim(1.082, 0.128, 2.074, 2.248, 0.005),
      veneer, preview,
      windowMaterial: new THREE.MeshBasicMaterial({ map: preview, color: '#bdaa88', side: THREE.DoubleSide }),
      seamMaterial: new THREE.MeshBasicMaterial({ color: '#ffb765', toneMapped: false }),
    }
  }, [source, m.walnut])
  useEffect(() => () => Object.values(resources).forEach(item => item.dispose()), [resources])
  const activate = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (event.delta <= 5) onActivate()
  }
  return <group name="garden-home-timber-door" position={RETURN_GATE_POSITION} rotation={[0, -0.25, 0]}>
    <group onClick={activate} onPointerOver={event => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      {/* One extruded arch has a genuine opening, bevels and a visible rear jamb. */}
      <mesh geometry={resources.frame} material={m.wood} castShadow receiveShadow />
      <mesh geometry={resources.outsideBead} position={[0, 0, 0.166]} material={resources.veneer} castShadow />
      <mesh geometry={resources.insideBead} position={[0, 0, 0.156]} material={m.brass} />
      <mesh geometry={resources.outsideBead} position={[0, 0, -0.166]} material={m.walnut} castShadow />
      <mesh geometry={resources.leaf} material={resources.veneer} castShadow receiveShadow />
      <mesh geometry={resources.lightSeam} position={[0, 0, 0.029]} material={resources.seamMaterial} />
      {[-1, 1].map(side => <group key={side}>
        <RoundedBox args={[0.18, 0.20, 0.53]} radius={0.025} smoothness={3} position={[side * 0.617, 0.10, 0]} material={m.walnut} castShadow receiveShadow />
        <RoundedBox args={[0.26, 0.035, 0.70]} radius={0.014} smoothness={2} position={[side * 0.617, 0.03, 0]} material={m.iron} receiveShadow />
        <mesh position={[side * 0.617, 0.213, 0]} material={m.brass}><boxGeometry args={[0.19, 0.027, 0.31]} /></mesh>
        <mesh position={[side * 0.61, 1.91, 0.162]} material={m.brass}><sphereGeometry args={[0.018, 10, 8]} /></mesh>
      </group>)}
      <RoundedBox args={[1.52, 0.085, 0.55]} radius={0.018} smoothness={3} position={[0, 0.075, 0.018]} material={m.walnut} castShadow receiveShadow />
      <mesh position={[0, 0.124, 0.095]} material={m.brass}><boxGeometry args={[1.04, 0.014, 0.31]} /></mesh>
      {/* Recessed fields and raised mouldings show the door's joinery from both faces. */}
      {[-1, 1].map(face => <group key={face} position={[0, 0, face * 0.071]} rotation={[0, face < 0 ? Math.PI : 0, 0]}>
        {[-0.247, 0.247].map(x => <group key={x} position={[x, 0.854, 0]}>
          <RoundedBox args={[0.445, 1.30, 0.038]} radius={0.014} smoothness={2} material={m.wood} receiveShadow />
          <RoundedBox args={[0.365, 1.20, 0.024]} radius={0.011} smoothness={2} position={[0, 0, 0.026]} material={resources.veneer} castShadow receiveShadow />
          <mesh position={[0, -0.543, 0.044]} material={m.brass}><boxGeometry args={[0.29, 0.006, 0.003]} /></mesh>
        </group>)}
        <mesh position={[0, 1.53, 0.03]} material={m.walnut}><boxGeometry args={[0.98, 0.075, 0.07]} /></mesh>
        <mesh geometry={resources.windowFrame} position={[0, 0, 0.03]} material={m.brass} castShadow />
        <mesh position={[0, 1.79, -0.052]} material={resources.windowMaterial}><planeGeometry args={[0.423, 0.326]} /></mesh>
        <mesh position={[0, 1.79, 0.034]} material={m.brass}><boxGeometry args={[0.012, 0.30, 0.015]} /></mesh>
        <mesh position={[0, 1.783, 0.034]} material={m.brass}><boxGeometry args={[0.414, 0.01, 0.015]} /></mesh>
        <RoundedBox args={[0.074, 0.23, 0.016]} radius={0.015} smoothness={3} position={[0.388, 1.05, 0.049]} material={m.brass} castShadow />
        <mesh position={[0.388, 1.08, 0.088]} rotation={[Math.PI / 2, 0, 0]} material={m.brightBrass}><cylinderGeometry args={[0.018, 0.018, 0.065, 16]} /></mesh>
        <RoundedBox args={[0.157, 0.027, 0.025]} radius={0.01} smoothness={3} position={[0.331, 1.08, 0.117]} material={m.brightBrass} castShadow />
        <mesh position={[0.388, 0.996, 0.060]}><circleGeometry args={[0.008, 16]} /><meshBasicMaterial color="#2c231a" /></mesh>
      </group>)}
      {[0.41, 1.16, 1.89].map(y => <group key={y} position={[-0.528, y, 0.075]}>
        <mesh position={[-0.009, 0, 0.012]} material={m.brass} castShadow><cylinderGeometry args={[0.022, 0.022, 0.13, 16]} /></mesh>
        <mesh position={[0.028, 0, 0]} material={m.brass}><boxGeometry args={[0.066, 0.084, 0.012]} /></mesh>
        {[-0.025, 0.025].map(offset => <mesh key={offset} position={[0.036, offset, 0.009]} material={m.iron}><sphereGeometry args={[0.005, 8, 6]} /></mesh>)}
      </group>)}
      <mesh position={[0, 2.314, 0.159]} material={m.brass}><torusGeometry args={[0.037, 0.008, 7, 24]} /></mesh>
    </group>
    <Html position={[0, 2.62, 0.18]} center occlude distanceFactor={6} zIndexRange={[10, 0]}>
      <button type="button" className="travel-gateway-label to-home" onClick={event => { event.stopPropagation(); onActivate() }}
        style={{ minHeight: 37, padding: '6px 9px', gap: 7, fontSize: 12, borderColor: hovered ? '#e4c28b' : '#a98b5c99', background: '#30271feb' }}>
        <House size={15} strokeWidth={1.5} />
        <span>返回小屋<small style={{ marginTop: 3, fontSize: 8 }}>靠近 E · 点击归家</small></span>
      </button>
    </Html>
    <pointLight position={[0, 1.34, 0.23]} color="#ffbd70" intensity={hovered ? 1.4 : 1.1} distance={2.5} decay={2} />
  </group>
}
