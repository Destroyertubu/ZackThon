import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { AssetBookRow, AssetBookStack, AssetLantern, AssetModel } from '../scene/Assets'
import { BoxInstances, type Instance, type Point } from './Primitives'
import type { ObservatoryMaterials } from './materials'
import { KNOWLEDGE_INGREDIENTS, type KnowledgeId } from './gardenRecipes'
import { THOUGHT_BAR_POSITION, TREE_POSITION } from './layout'
import { FixtureScan } from './GardenFixtureDetails'
import { arcSlab, createFixtureFabric, createThrowGeometry, disposeFixtureFabric } from './GardenFixtureGeometry'

type FixturesProps = { materials: ObservatoryMaterials; reducedMotion: boolean }

function tube(points: Point[], radius: number, segments = 24) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 7, false)
}

/** Joining the separate strands keeps the woven chair and mouldings inexpensive. */
function join(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts, false)!
  parts.forEach(part => part.dispose())
  return result
}

function lathe(profile: [number, number][], segments = 32) {
  return new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), segments)
}

const BOTTLE_FACETS = [12, 16, 12, 16, 12]

function jewelLiquidColor(paletteColor: string) {
  const color = new THREE.Color(paletteColor)
  const hsl = color.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace)
  return color.setHSL(hsl.h, Math.min(hsl.s * 1.5, 1), hsl.l * 0.68, THREE.SRGBColorSpace)
}

function bottleProfile(index: number) {
  const bodies: [number, number][][] = [
    [[0.125, 0.035], [0.13, 0.07], [0.13, 0.34], [0.115, 0.395], [0.052, 0.425]],
    [[0.095, 0.035], [0.135, 0.12], [0.142, 0.265], [0.12, 0.345], [0.05, 0.42]],
    [[0.12, 0.035], [0.137, 0.11], [0.112, 0.22], [0.128, 0.335], [0.045, 0.445]],
    [[0.095, 0.035], [0.142, 0.15], [0.147, 0.28], [0.111, 0.38], [0.048, 0.435]],
    [[0.115, 0.035], [0.12, 0.065], [0.104, 0.29], [0.087, 0.37], [0.041, 0.455]],
  ]
  return bodies[index]
}

function cutCrystalBottle(index: number) {
  const outer: [number, number][] = [...bottleProfile(index), [0.044, 0.51], [0.053, 0.525], [0.053, 0.55]]
  const inner: [number, number][] = outer.slice().reverse().map(([r, y]) => [r - 0.01, y])
  return lathe([[0, 0.015], ...outer, ...inner, [0, 0.04]], BOTTLE_FACETS[index])
}

function bottleLiquid(index: number) {
  const body = bottleProfile(index), fill = [0.305, 0.28, 0.315, 0.33, 0.275][index]
  const surface: [number, number][] = [[0, 0.047]]
  for (let i = 0; i < body.length; i++) {
    const [radius, height] = body[i]
    if (height >= fill) {
      const [previousRadius, previousHeight] = body[i - 1]
      const fillRadius = THREE.MathUtils.lerp(previousRadius, radius, (fill - previousHeight) / (height - previousHeight))
      surface.push([fillRadius - 0.018, fill], [0, fill])
      break
    }
    surface.push([radius - 0.018, Math.max(height, 0.047)])
  }
  return lathe(surface, BOTTLE_FACETS[index])
}

function roundedCounter() {
  const s = new THREE.Shape()
  s.moveTo(-1.44, -0.54)
  s.lineTo(1.44, -0.54)
  s.quadraticCurveTo(1.53, -0.54, 1.53, -0.42)
  s.lineTo(1.48, 0.3)
  s.quadraticCurveTo(1.43, 0.67, 0.97, 0.72)
  s.quadraticCurveTo(0, 0.84, -0.97, 0.72)
  s.quadraticCurveTo(-1.43, 0.67, -1.48, 0.3)
  s.lineTo(-1.53, -0.42)
  s.quadraticCurveTo(-1.53, -0.54, -1.44, -0.54)
  const geometry = new THREE.ExtrudeGeometry(s, { depth: 0.065, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.018, bevelSegments: 3, curveSegments: 24, steps: 1 })
  // Shape coordinates are x/z; the underside anchors at bar height.
  geometry.rotateX(Math.PI / 2)
  return geometry
}

function labelTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#233936'; ctx.fillRect(0, 0, 1024, 256)
  ctx.strokeStyle = '#bda778'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, 996, 228)
  ctx.fillStyle = '#e1cc9d'; ctx.textAlign = 'center'
  ctx.font = '500 60px serif'; ctx.fillText('思想调酒台', 512, 110)
  ctx.font = '22px serif'; ctx.fillText('拾取星光 · 调和灵感', 512, 183)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makeBottleContents(id: KnowledgeId) {
  if (id === 'literature') return new THREE.BoxGeometry(0.024, 0.034, 0.003)
  if (id === 'photography') {
    // Tiny photographic frames, rather than undifferentiated glitter.
    return join([
      new THREE.BoxGeometry(0.038, 0.004, 0.003).translate(0, 0.015, 0),
      new THREE.BoxGeometry(0.038, 0.004, 0.003).translate(0, -0.015, 0),
      new THREE.BoxGeometry(0.004, 0.03, 0.003).translate(-0.017, 0, 0),
      new THREE.BoxGeometry(0.004, 0.03, 0.003).translate(0.017, 0, 0),
    ])
  }
  if (id === 'nature') return new THREE.OctahedronGeometry(0.022, 0).scale(0.6, 1.35, 0.3)
  if (id === 'music') {
    return join([
      new THREE.BoxGeometry(0.004, 0.041, 0.004).translate(0.009, 0.006, 0),
      new THREE.SphereGeometry(0.011, 8, 6).scale(1, 0.65, 0.38).translate(0, -0.013, 0),
      new THREE.BoxGeometry(0.019, 0.004, 0.003).translate(0.016, 0.025, 0),
    ])
  }
  return new THREE.OctahedronGeometry(0.023, 0)
}

function BottleThoughts({ index, reducedMotion }: { index: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const group = useRef<THREE.Group>(null)
  const ingredient = KNOWLEDGE_INGREDIENTS[index]
  const resources = useMemo(() => ({
    geometry: makeBottleContents(ingredient.id),
    material: new THREE.MeshStandardMaterial({ color: ingredient.color, emissive: ingredient.color, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.08 }),
  }), [ingredient])
  useLayoutEffect(() => {
    const transform = new THREE.Object3D()
    for (let i = 0; i < 17; i++) {
      const a = i * 2.399 + index, radius = 0.02 + ((i * 7) % 11) / 210
      transform.position.set(Math.cos(a) * radius, 0.105 + i / 17 * 0.21, Math.sin(a) * radius)
      transform.rotation.set(i * 1.7, i * 0.8, i * 0.5)
      transform.updateMatrix(); ref.current!.setMatrixAt(i, transform.matrix)
    }
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.computeBoundingSphere()
  }, [index])
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose() }, [resources])
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.14 + index) * 0.25
    group.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.7 + index) * 0.009
  })
  return <group ref={group}><instancedMesh ref={ref} args={[resources.geometry, resources.material, 17]} /></group>
}

/** A single, human-scale cabinet faces east towards the main garden path. */
export function ThoughtBar({ materials: m, reducedMotion, onActivate }: FixturesProps & { onActivate: () => void }) {
  const resources = useMemo(() => {
    const label = labelTexture()
    return {
      counter: roundedCounter(),
      bottles: KNOWLEDGE_INGREDIENTS.map((_, index) => cutCrystalBottle(index)),
      liquids: KNOWLEDGE_INGREDIENTS.map((_, index) => bottleLiquid(index)),
      stopper: lathe([[0, 0], [0.037, 0], [0.037, 0.055], [0.058, 0.062], [0.06, 0.1], [0.035, 0.133], [0, 0.139]], 8),
      coupe: lathe([[0, 0], [0.1, 0], [0.109, 0.007], [0.095, 0.018], [0.018, 0.024], [0.009, 0.04], [0.009, 0.165], [0.021, 0.177], [0.065, 0.184], [0.105, 0.207], [0.138, 0.25], [0.147, 0.269], [0.143, 0.272], [0.131, 0.253], [0.101, 0.213], [0.061, 0.191], [0.019, 0.184], [0, 0.184]], 40),
      jigger: lathe([[0.06, 0], [0.046, 0.008], [0.023, 0.08], [0.021, 0.085], [0.057, 0.185], [0.063, 0.188], [0.06, 0.181], [0.027, 0.083], [0.054, 0.005], [0.06, 0]], 24),
      moulding: tube([[-1.43, 0.975, 0.31], [-1.33, 0.975, 0.57], [-0.86, 0.975, 0.697], [0, 0.975, 0.737], [0.86, 0.975, 0.697], [1.33, 0.975, 0.57], [1.43, 0.975, 0.31]], 0.012, 56),
      glass: new THREE.MeshPhysicalMaterial({ color: '#c2d2ce', transparent: true, opacity: 0.2, roughness: 0.14, metalness: 0.015, clearcoat: 0.3, clearcoatRoughness: 0.16, envMapIntensity: 0.45, depthWrite: false }),
      // The lathe already contains inner and outer walls. FrontSide prevents four
      // glossy layers from accumulating into opaque white under the garden lights.
      bottleGlass: KNOWLEDGE_INGREDIENTS.map(ingredient => new THREE.MeshPhysicalMaterial({
        // Clear glass has almost no diffuse body color. Keeping this dark avoids
        // warm direct lights turning the transparent walls into a milky shell.
        color: new THREE.Color(ingredient.color).lerp(new THREE.Color('#bbc7bd'), 0.25).multiplyScalar(0.12),
        transparent: true, opacity: 0.15, roughness: 0.11, metalness: 0.025, flatShading: true,
        clearcoat: 0.24, clearcoatRoughness: 0.18, envMapIntensity: 0.25, depthWrite: false,
      })),
      // A low-reflection fill preserves the catalog hue under warm lanterns;
      // the clear headspace and visible thoughts keep these readable as bottles.
      liquidMaterials: KNOWLEDGE_INGREDIENTS.map(ingredient => {
        const color = jewelLiquidColor(ingredient.color)
        return new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.35,
          transparent: true, opacity: 0.6, roughness: 0.2, metalness: 0,
          envMapIntensity: 0.16, depthWrite: false,
        })
      }),
      crystal: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#9fb6ad').multiplyScalar(0.18), transparent: true, opacity: 0.18, roughness: 0.2, metalness: 0.06, clearcoat: 0.3, envMapIntensity: 0.5, depthWrite: false }),
      felt: new THREE.MeshStandardMaterial({ color: '#284944', roughness: 0.97 }),
      stoolCushion: createFixtureFabric('#d5bc99', [1.5, 1.5]),
      ink: new THREE.MeshStandardMaterial({ map: label, roughness: 0.6, metalness: 0.22 }),
      label,
    }
  }, [])
  useEffect(() => () => Object.values(resources).forEach(item => {
    if (Array.isArray(item)) item.forEach(material => material.dispose())
    else if (item === resources.stoolCushion) disposeFixtureFabric(item)
    else item.dispose()
  }), [resources])
  const cabinet = useMemo<Instance[]>(() => [
    { position: [0, 0.13, -0.015], scale: [2.73, 0.11, 0.92] },
    { position: [0, 0.88, -0.015], scale: [2.73, 0.07, 0.92] },
    { position: [0, 0.49, -0.015], scale: [2.61, 0.055, 0.83] },
    { position: [-1.34, 0.53, -0.015], scale: [0.09, 0.72, 0.92] },
    { position: [1.34, 0.53, -0.015], scale: [0.09, 0.72, 0.92] },
    { position: [0, 0.53, -0.43], scale: [2.61, 0.72, 0.045] },
    { position: [0, 0.53, 0], scale: [0.06, 0.72, 0.84] },
    ...[-1.22, 1.22].flatMap(x => [-0.34, 0.3].map(z => ({ position: [x, 0.055, z] as Point, scale: [0.085, 0.11, 0.085] as Point }))),
    ...[-1.4, 1.4].map(x => ({ position: [x, 1.55, -0.4] as Point, scale: [0.08, 1.38, 0.16] as Point })),
    { position: [0, 1.35, -0.39], scale: [2.8, 0.065, 0.39] },
    { position: [0, 2.19, -0.39], scale: [2.89, 0.09, 0.44] },
  ], [])
  const activate = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); if (event.delta <= 5) onActivate() }
  return <group name="thought-cocktail-garden-cabinet" position={THOUGHT_BAR_POSITION} rotation={[0, Math.PI / 2, 0]} onClick={activate}>
    <BoxInstances items={cabinet} material={m.walnut} />
    <mesh geometry={resources.counter} position={[0, 1.035, 0]} material={m.walnut} castShadow receiveShadow />
    <mesh geometry={resources.moulding} material={m.brightBrass} />
    {[-0.89, 0, 0.89].map((x, i) => <group key={x} position={[x, 0.425, 0.456]}>
      <RoundedBox args={[0.82, 0.48, 0.055]} radius={0.018} smoothness={2} material={m.wood} castShadow />
      <RoundedBox args={[0.675, 0.335, 0.025]} radius={0.013} smoothness={2} position={[0, 0, 0.035]} material={m.walnut} />
      <mesh position={[0.25, 0.1, 0.065]} material={m.brass}><torusGeometry args={[0.027, 0.007, 6, 16]} /></mesh>
      {[-0.15, 0.15].map(y => <mesh key={y} position={[-0.355, y, 0.04]} material={m.brass}><boxGeometry args={[0.028, 0.058, 0.014]} /></mesh>)}
      <RoundedBox args={[0.82, 0.185, 0.07]} radius={0.015} smoothness={2} position={[0, 0.363, 0.009]} material={m.walnut} castShadow />
      <mesh position={[0, 0.368, 0.069]} rotation={[0, 0, Math.PI / 2]} material={m.brightBrass}><torusGeometry args={[0.057, 0.009, 7, 20, Math.PI]} /></mesh>
      {[-0.053, 0.053].map(hx => <mesh key={hx} position={[hx, 0.368, 0.055]} material={m.brass}><sphereGeometry args={[0.015, 8, 6]} /></mesh>)}
      {i !== 0 && <mesh position={[-0.437, 0.09, 0.02]} material={m.brass}><boxGeometry args={[0.012, 0.61, 0.025]} /></mesh>}
    </group>)}
    <mesh position={[0, 1.264, -0.17]} material={m.brass}><boxGeometry args={[0.76, 0.15, 0.023]} /></mesh>
    <mesh position={[0, 1.264, -0.156]} material={resources.ink}><planeGeometry args={[0.72, 0.134]} /></mesh>
    <mesh position={[0, 0.125, 0.47]} material={m.brass}><boxGeometry args={[2.7, 0.035, 0.032]} /></mesh>
    <mesh position={[0, 1.395, -0.57]} material={m.brass}><boxGeometry args={[2.67, 0.025, 0.021]} /></mesh>
    {KNOWLEDGE_INGREDIENTS.map((ingredient, i) => <group key={ingredient.id} name={`knowledge-bottle-${ingredient.id}`} position={[(i - (KNOWLEDGE_INGREDIENTS.length - 1) / 2) * 0.47, 1.385, -0.38]} scale={[1, i % 2 ? 0.88 : 1, 1]}>
      <BottleThoughts index={i} reducedMotion={reducedMotion} />
      <mesh geometry={resources.liquids[i]} material={resources.liquidMaterials[i]} renderOrder={2} />
      <mesh geometry={resources.bottles[i]} material={resources.bottleGlass[i]} renderOrder={3} />
      <mesh position={[0, 0.545, 0]} geometry={resources.stopper} scale={[1.2, i === 2 ? 1.1 : 0.9, 1.2]} material={resources.crystal} renderOrder={4} />
      <mesh position={[0, 0.519, 0]} material={m.brass}><cylinderGeometry args={[0.054, 0.054, 0.028, 24, 1, true]} /></mesh>
      <mesh position={[0, 0.044, 0]} material={m.brass}><cylinderGeometry args={[0.126, 0.126, 0.012, 8, 1, true]} /></mesh>
    </group>)}
    <RoundedBox args={[0.85, 0.012, 0.46]} radius={0.006} smoothness={1} position={[0.3, 1.056, 0.29]} material={resources.felt} />
    <group position={[-0.96, 1.092, 0.91]}>
      <mesh geometry={resources.coupe} material={resources.glass} renderOrder={3} />
      <mesh position={[0, 0.223, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.111, 40]} /><meshStandardMaterial color="#d7b7bc" emissive="#ba718e" emissiveIntensity={0.5} transparent opacity={0.6} roughness={0.22} depthWrite={false} /></mesh>
    </group>
    <mesh geometry={resources.jigger} position={[0.6, 1.065, 0.24]} material={m.brightBrass} />
    <mesh position={[0.66, 1.078, 0.44]} rotation={[0, 0, Math.PI / 2]} material={m.brass}><cylinderGeometry args={[0.006, 0.006, 0.3, 8]} /></mesh>
    <AssetModel asset="notebook" maxDim={0.39} position={[-0.08, 1.056, 0.26]} rotation={[0, -0.16, 0]} castShadow={false} />
    <FixtureScan asset="brass-goblet" height={0.235} position={[1.08, 1.056, 0.22]} rotation={0.6} />
    <AssetBookRow width={0.67} position={[-0.85, 2.235, -0.39]} bookHeight={0.235} seed={19} />
    <AssetModel asset="plantSmall" height={0.43} position={[0.96, 2.235, -0.38]} castShadow={false} />
    <AssetBookStack count={2} seed={7} position={[0.29, 2.235, -0.39]} scale={0.72} />
    {/* The rounded operating wing is joined to the one cabinet, not a second table. */}
    <mesh position={[-0.88, 0.52, 0.64]} material={m.walnut} castShadow receiveShadow><cylinderGeometry args={[0.555, 0.52, 0.93, 48]} /></mesh>
    <mesh position={[-0.88, 1.017, 0.64]} material={m.walnut} castShadow><cylinderGeometry args={[0.63, 0.59, 0.095, 64]} /></mesh>
    {[0.08, 0.94, 1.024].map(y => <mesh key={y} position={[-0.88, y, 0.64]} rotation={[Math.PI / 2, 0, 0]} material={m.brass}><torusGeometry args={[y === 1.024 ? 0.63 : 0.552, 0.012, 7, 64]} /></mesh>)}
    <RoundedBox args={[0.69, 0.18, 0.045]} radius={0.018} smoothness={2} position={[-0.88, 0.793, 1.16]} material={m.walnut} castShadow />
    <mesh position={[-0.88, 0.798, 1.2]} material={m.brass}><torusGeometry args={[0.035, 0.008, 7, 20, Math.PI]} /></mesh>
    <mesh position={[-0.96, 1.079, 0.88]} material={m.brass}><cylinderGeometry args={[0.32, 0.31, 0.018, 48]} /></mesh>
    <mesh position={[-0.96, 1.092, 0.88]} rotation={[Math.PI / 2, 0, 0]} material={m.brightBrass}><torusGeometry args={[0.308, 0.008, 6, 48]} /></mesh>
    <FixtureScan asset="bar-stool" height={0.71} position={[-0.55, 0, 1.68]} rotation={0.14} />
    <mesh position={[-0.55, 0.744, 1.68]} material={resources.stoolCushion} castShadow><cylinderGeometry args={[0.242, 0.25, 0.075, 48]} /></mesh>
    <mesh position={[-0.55, 0.774, 1.68]} rotation={[Math.PI / 2, 0, 0]} material={resources.stoolCushion}><torusGeometry args={[0.229, 0.017, 8, 48]} /></mesh>
    <AssetLantern height={0.47} position={[-1.14, 1.056, 0.05]} rotation={0.2} />
    <AssetLantern height={0.32} position={[1.27, 1.056, -0.04]} rotation={0.2} />
    <pointLight position={[-1.12, 1.38, 0.04]} intensity={2.1} distance={3.6} decay={2} color="#ffcb80" />
    <pointLight position={[0.1, 1.85, -0.15]} intensity={0.65} distance={2.4} decay={2} color="#ffe3b1" />
  </group>
}

function benchResources() {
  const slats: Instance[] = [], legs: Instance[] = []
  const start = -0.85, end = 0.68, radius = 2.55
  for (let i = 0; i < 32; i++) {
    const angle = start + (end - start) * i / 31
    slats.push({ position: [Math.sin(angle) * radius, 0.48, Math.cos(angle) * radius], scale: [0.105, 0.07, 0.51], rotation: [0, angle, 0] })
    // Back on the tree side: the sitter faces the open garden, away from the trunk.
    slats.push({ position: [Math.sin(angle) * 2.31, 0.8, Math.cos(angle) * 2.31], scale: [0.105, 0.51, 0.045], rotation: [-0.16 * Math.cos(angle), angle, 0.16 * Math.sin(angle)] })
    slats.push({ position: [Math.sin(angle) * 2.775, 0.285, Math.cos(angle) * 2.775], scale: [0.117, 0.385, 0.04], rotation: [0, angle, 0] })
  }
  for (const angle of [-0.8, -0.3, 0.22, 0.63]) for (const r of [2.37, 2.72]) {
    legs.push({ position: [Math.sin(angle) * r, 0.22, Math.cos(angle) * r], scale: [0.09, 0.45, 0.09], rotation: [0, angle, 0] })
  }
  const curves: THREE.BufferGeometry[] = []
  for (const [r, y, thickness] of [[2.35, 0.39, 0.035], [2.75, 0.39, 0.035], [2.28, 1.06, 0.028]]) {
    const points: Point[] = Array.from({ length: 32 }, (_, i) => {
      const a = start + (end - start) * i / 31
      return [Math.sin(a) * r, y, Math.cos(a) * r]
    })
    curves.push(tube(points, thickness, 48))
  }
  for (const a of [start, end]) {
    curves.push(tube([[Math.sin(a) * 2.29, 0.96, Math.cos(a) * 2.29], [Math.sin(a) * 2.41, 0.78, Math.cos(a) * 2.41], [Math.sin(a) * 2.69, 0.76, Math.cos(a) * 2.69], [Math.sin(a) * 2.76, 0.48, Math.cos(a) * 2.76]], 0.035))
  }
  return {
    slats, legs, rails: join(curves),
    seat: arcSlab(2.27, 2.84, start - 0.018, end + 0.018, 0.09),
    cap: arcSlab(2.19, 2.39, start - 0.018, end + 0.018, 0.065),
    skirt: new THREE.CylinderGeometry(2.767, 2.767, 0.39, 64, 1, true, start, end - start),
    back: new THREE.CylinderGeometry(2.283, 2.283, 0.57, 64, 1, true, start, end - start),
    glowRail: tube(Array.from({ length: 40 }, (_, i) => {
      const a = start + (end - start) * i / 39
      return [Math.sin(a) * 2.785, 0.088, Math.cos(a) * 2.785] as Point
    }), 0.007, 48),
  }
}

function wovenChair() {
  const strands: THREE.BufferGeometry[] = [], rims: THREE.BufferGeometry[] = []
  // An open-front ovoid basket. Each real strand leaves sky visible between weaves.
  const surface = (u: number, v: number, offset = 0): Point => {
    const width = 0.57 * Math.sin(v)
    return [width * Math.sin(u), 1.04 + 0.82 * Math.cos(v), -0.09 - (0.45 + offset) * Math.sin(v) * Math.cos(u)]
  }
  for (let i = 0; i <= 24; i++) {
    const u = -1.77 + i / 24 * 3.54
    strands.push(tube(Array.from({ length: 24 }, (_, j) => surface(u, 0.16 + j / 23 * 2.47)), 0.009, 28))
  }
  for (let j = 0; j <= 23; j++) {
    const v = 0.21 + j / 23 * 2.4
    strands.push(tube(Array.from({ length: 29 }, (_, i) => surface(-1.77 + i / 28 * 3.54, v, 0.012)), 0.008, 32))
  }
  for (const u of [-1.77, 1.77]) rims.push(tube(Array.from({ length: 32 }, (_, j) => surface(u, 0.14 + j / 31 * 2.55)), 0.029, 36))
  rims.push(tube(Array.from({ length: 24 }, (_, i) => surface(-1.77 + i / 23 * 3.54, 2.63)), 0.024, 28))
  return { weave: join(strands), rim: join(rims) }
}

/** Curved root-side seating plus one independently supported woven swing. */
export function TreeSeating({ materials: m, reducedMotion }: FixturesProps) {
  const swing = useRef<THREE.Group>(null)
  const resources = useMemo(() => {
    const bench = benchResources(), chair = wovenChair(), blanket = createThrowGeometry()
    const support = join([
      tube([[-0.92, 0.04, -0.25], [-0.88, 1.05, -0.28], [-0.69, 2.35, -0.25], [-0.26, 3.18, -0.18], [0.1, 3.29, -0.15]], 0.074, 32),
      tube([[0.91, 0.04, -0.38], [0.82, 1.09, -0.34], [0.65, 2.45, -0.27], [0.25, 3.21, -0.17], [-0.04, 3.31, -0.15]], 0.068, 32),
      tube([[-1.14, 0.07, 0.48], [-0.97, 0.12, 0.04], [-0.87, 0.64, -0.26]], 0.055),
      tube([[1.15, 0.07, 0.39], [0.93, 0.15, -0.08], [0.84, 0.7, -0.34]], 0.051),
      tube([[-0.98, 0.07, -0.92], [-0.94, 0.16, -0.6], [-0.86, 0.65, -0.29]], 0.054),
      tube([[1.03, 0.07, -0.97], [0.91, 0.18, -0.63], [0.83, 0.62, -0.33]], 0.054),
    ])
    const ropes = join([
      tube([[-0.08, 3.13, -0.15], [-0.12, 2.56, -0.15], [-0.2, 1.8, -0.14]], 0.018),
      tube([[0.08, 3.13, -0.15], [0.12, 2.56, -0.15], [0.2, 1.8, -0.14]], 0.018),
    ])
    return {
      ...bench, ...chair, ...blanket, support, ropes,
      rattan: new THREE.MeshStandardMaterial({ color: '#dbc092', roughness: 0.83, envMapIntensity: 0.55 }),
      cord: new THREE.MeshStandardMaterial({ color: '#c6b797', roughness: 1 }),
      cream: createFixtureFabric('#e0cab0'),
      sage: createFixtureFabric('#638175'),
      throwMaterial: createFixtureFabric('#c5b4a7', [2.5, 4.5]),
      warmEdge: new THREE.MeshBasicMaterial({ color: '#9f662d', toneMapped: false }),
    }
  }, [])
  useEffect(() => () => {
    resources.rails.dispose(); resources.weave.dispose(); resources.rim.dispose(); resources.support.dispose(); resources.ropes.dispose()
    resources.seat.dispose(); resources.cap.dispose(); resources.skirt.dispose(); resources.back.dispose(); resources.glowRail.dispose()
    resources.cloth.dispose(); resources.fringe.dispose(); resources.warmEdge.dispose()
    resources.rattan.dispose(); resources.cord.dispose()
    disposeFixtureFabric(resources.cream); disposeFixtureFabric(resources.sage); disposeFixtureFabric(resources.throwMaterial)
  }, [resources])
  useFrame(({ clock }) => {
    if (swing.current) swing.current.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.43) * 0.018
  })
  return <group name="star-tree-garden-seating">
    <group position={TREE_POSITION}>
      <BoxInstances items={resources.slats} material={m.walnut} />
      <BoxInstances items={resources.legs} material={m.iron} />
      <mesh geometry={resources.rails} material={m.wood} castShadow />
      <mesh geometry={resources.seat} position={[0, 0.565, 0]} material={m.walnut} castShadow receiveShadow />
      <mesh geometry={resources.cap} position={[0, 1.108, 0]} material={m.walnut} castShadow receiveShadow />
      <mesh geometry={resources.skirt} position={[0, 0.285, 0]} material={m.walnut} receiveShadow />
      <mesh geometry={resources.back} position={[0, 0.795, 0]} material={m.walnut} receiveShadow />
      <mesh geometry={resources.glowRail} material={resources.warmEdge} />
      <group position={[Math.sin(-0.12) * 2.54, 0, Math.cos(-0.12) * 2.54]} rotation={[0, -0.12, 0]}>
        <mesh geometry={resources.cloth} material={resources.throwMaterial} castShadow receiveShadow />
        <mesh geometry={resources.fringe} material={resources.cord} />
      </group>
      {[-0.14, 0.13].map((angle, index) => <group key={angle} position={[Math.sin(angle) * 2.57, 0.615, Math.cos(angle) * 2.57]} rotation={[0, angle, 0]}>
        <RoundedBox args={[0.66, 0.075, 0.43]} radius={0.032} smoothness={3} material={index ? resources.sage : resources.cream} castShadow receiveShadow />
        <RoundedBox args={[0.49, index ? 0.38 : 0.42, 0.15]} radius={0.065} smoothness={4} position={[index ? -0.03 : 0.045, index ? 0.245 : 0.265, -0.18]} rotation={[index ? -0.14 : -0.22, index ? -0.08 : 0.06, index ? -0.12 : 0.22]} material={index ? resources.cream : resources.sage} castShadow />
      </group>)}
      <AssetLantern height={0.38} position={[Math.sin(-0.8) * 2.88, 0, Math.cos(-0.8) * 2.88]} rotation={0.2} />
      <AssetLantern height={0.42} position={[Math.sin(0.59) * 2.92, 0, Math.cos(0.59) * 2.92]} rotation={-0.2} />
      <pointLight position={[Math.sin(0.59) * 2.92, 0.27, Math.cos(0.59) * 2.92]} color="#ffb45f" intensity={1.8} distance={2.8} decay={2} />
    </group>
    <group name="woven-star-swing" position={[-5.2, 0, -4.8]} rotation={[0, 0.3, 0]}>
      <mesh geometry={resources.support} material={m.wood} castShadow receiveShadow />
      <mesh position={[0, 3.16, -0.15]} material={m.brass}><torusGeometry args={[0.075, 0.016, 8, 20]} /></mesh>
      <group ref={swing} position={[0, 3.13, -0.15]}>
        <group position={[0, -3.13, 0.15]}>
          <mesh geometry={resources.ropes} material={resources.cord} castShadow />
          <mesh geometry={resources.weave} material={resources.rattan} receiveShadow />
          <mesh geometry={resources.rim} material={resources.rattan} castShadow />
          <RoundedBox args={[0.88, 0.15, 0.61]} radius={0.073} smoothness={4} position={[0, 0.5, -0.05]} material={resources.cream} castShadow receiveShadow />
          <RoundedBox args={[0.49, 0.44, 0.15]} radius={0.07} smoothness={3} position={[-0.05, 0.8, -0.35]} rotation={[-0.3, 0, 0.15]} material={resources.sage} castShadow />
        </group>
      </group>
      <AssetLantern height={0.36} position={[0.59, 0, 0.21]} rotation={0.2} />
      <pointLight position={[0.52, 0.32, 0.18]} color="#ffc47a" intensity={1.25} distance={2.4} decay={2} />
    </group>
  </group>
}
