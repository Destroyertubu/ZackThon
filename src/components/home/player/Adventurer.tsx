import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { AnimationMixer, Box3, Group, MathUtils, Mesh, Vector3 } from 'three'
import type { Material } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

export type Locomotion = 'idle' | 'walk' | 'run'
const CLIPS: Record<Locomotion, string> = { idle: 'Idle', walk: 'Walking_A', run: 'Running_A' }
const MODEL_URL = '/models/kaykit-mage/Mage.glb'
interface AvatarMaterial { material: Material; opacity: number; transparent: boolean; depthWrite: boolean }

// These are privately owned Three.js materials, outside React's immutable state.
function applyOpacity(materials: AvatarMaterial[], alpha: number) {
  for (const original of materials) {
    const transparent = original.transparent || alpha < 0.999
    if (original.material.transparent !== transparent) {
      original.material.transparent = transparent
      original.material.needsUpdate = true
    }
    original.material.opacity = original.opacity * alpha
    original.material.depthWrite = original.depthWrite
  }
}

/** SkeletonUtils gives this player its own bones; cached GLTF geometry stays shared. */
export default function Adventurer({ locomotion, heading, opacity }: {
  locomotion: MutableRefObject<Locomotion>
  heading: MutableRefObject<number>
  opacity: MutableRefObject<number>
}) {
  const gltf = useGLTF(MODEL_URL)
  const pivot = useRef<Group>(null)
  const last = useRef<Locomotion | null>(null)
  const { model, scale, offset, mixer, actions, materials } = useMemo(() => {
    const model = clone(gltf.scene)
    // Skeleton clones still share GLTF materials. Give only this avatar its own
    // instances so close-camera fading cannot alter another cached model.
    const copies = new Map<Material, Material>()
    const copyMaterial = (source: Material) => {
      let material = copies.get(source)
      if (!material) { material = source.clone(); copies.set(source, material) }
      return material
    }
    model.traverse((object) => {
      if (/^(Spellbook|Spellbook_open|1H_Wand|2H_Staff)$/.test(object.name)) object.visible = false
      if (object instanceof Mesh) {
        object.material = Array.isArray(object.material) ? object.material.map(copyMaterial) : copyMaterial(object.material)
        object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false
      }
    })
    const materials = [...copies.values()].map((material) => ({
      material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite,
    }))
    // Apply the neutral pose before measuring (the source contains weapon attachments).
    const mixer = new AnimationMixer(model)
    const actions = {
      idle: mixer.clipAction(gltf.animations.find((a) => a.name === CLIPS.idle)!),
      walk: mixer.clipAction(gltf.animations.find((a) => a.name === CLIPS.walk)!),
      run: mixer.clipAction(gltf.animations.find((a) => a.name === CLIPS.run)!),
    }
    actions.idle.play()
    mixer.update(0)
    model.updateMatrixWorld(true)
    const bounds = new Box3()
    model.traverse((object) => {
      if (object instanceof Mesh && object.visible) bounds.expandByObject(object, true)
    })
    const scale = 1.65 / bounds.getSize(new Vector3()).y
    return { model, mixer, actions, scale, offset: -bounds.min.y * scale, materials }
  }, [gltf])

  useEffect(() => () => {
    mixer.stopAllAction(); mixer.uncacheRoot(model)
    for (const { material } of materials) material.dispose()
  }, [mixer, model, materials])
  useFrame((_, delta) => {
    const alpha = opacity.current
    applyOpacity(materials, alpha)
    const state = locomotion.current
    if (last.current !== state) {
      if (last.current) actions[last.current].fadeOut(0.18)
      actions[state].reset().fadeIn(0.18).play()
      last.current = state
    }
    mixer.update(Math.min(delta, 0.05))
    if (pivot.current) {
      pivot.current.visible = alpha > 0.01
      const difference = MathUtils.euclideanModulo(heading.current - pivot.current.rotation.y + Math.PI, Math.PI * 2) - Math.PI
      pivot.current.rotation.y += difference * (1 - Math.exp(-16 * Math.min(delta, 0.05)))
    }
  })
  return (
    <group ref={pivot} rotation={[0, heading.current, 0]}>
      <primitive object={model} scale={scale} position={[0, offset, 0]} dispose={null} />
    </group>
  )
}
