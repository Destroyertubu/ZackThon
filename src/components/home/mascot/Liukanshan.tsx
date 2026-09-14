import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sampleLiukanshanPose, type LiukanshanPose, type LiukanshanState, type MascotPoint } from './liukanshanAnimation'

const MODEL_URL = '/models/liukanshan/liukanshan.glb'

export interface LiukanshanProps {
  position: MascotPoint
  rotation?: MascotPoint
  state: LiukanshanState
  animated: boolean
}

type Joint = { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion }
type MascotResources = {
  object: THREE.Object3D; materials: THREE.Material[]; joints: Record<string, Joint>
  euler: THREE.Euler; quaternion: THREE.Quaternion
}

/** Imperative Three state is deliberately isolated from React render state. */
function applyMascotPose(resources: MascotResources, pose: LiukanshanPose, blend: number) {
  const rotate = (name: string, value: MascotPoint) => {
    const joint = resources.joints[name]
    resources.euler.set(...value)
    resources.quaternion.setFromEuler(resources.euler).premultiply(joint.quaternion)
    joint.object.quaternion.slerp(resources.quaternion, blend)
  }
  const moveY = (name: string, amount: number) => {
    const joint = resources.joints[name]
    joint.object.position.y = THREE.MathUtils.lerp(joint.object.position.y, joint.position.y + amount, blend)
  }
  moveY('liukanshan_root', pose.rootY)
  moveY('body_joint', pose.bodyY)
  moveY('mascot_laptop', pose.laptopY)
  for (const name of ['arm_L_joint', 'arm_R_joint']) {
    const joint = resources.joints[name]
    joint.object.position.z = THREE.MathUtils.lerp(joint.object.position.z, joint.position.z + pose.armsForward, blend)
  }
  rotate('body_joint', pose.body)
  rotate('arm_L_joint', pose.armL); rotate('arm_R_joint', pose.armR)
  rotate('forearm_L_joint', pose.forearmL); rotate('forearm_R_joint', pose.forearmR)
  rotate('leg_L_joint', pose.legL); rotate('leg_R_joint', pose.legR)
  rotate('tail_joint', pose.tail)
  resources.joints.eye_L_joint.object.scale.y = pose.eyeY
  resources.joints.eye_R_joint.object.scale.y = pose.eyeY
  resources.joints.mascot_laptop.object.visible = pose.laptopVisible
}

/** White, black-nosed volumetric companion, 0.823 m tall, front +Z, floor Y=0.
 * The cached GLB owns geometry. Only private material clones are disposed here.
 */
export function Liukanshan({ position, rotation = [0, 0, 0], state, animated }: LiukanshanProps) {
  const { scene } = useGLTF(MODEL_URL)
  const elapsed = useRef(0)
  const initialized = useRef<THREE.Object3D | null>(null)
  const owned = useMemo(() => {
    const object = scene.clone(true)
    const materials: THREE.Material[] = []
    object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return
      const clone = (material: THREE.Material) => {
        const copy = material.clone() as THREE.MeshStandardMaterial
        copy.envMapIntensity = /black|nose|eyes/i.test(copy.name) ? .55 : .45
        materials.push(copy)
        return copy
      }
      child.material = Array.isArray(child.material) ? child.material.map(clone) : clone(child.material)
      child.castShadow = true
      child.receiveShadow = true
    })
    const joints: Record<string, Joint> = {}
    for (const name of ['liukanshan_root', 'body_joint', 'arm_L_joint', 'arm_R_joint', 'forearm_L_joint', 'forearm_R_joint',
      'leg_L_joint', 'leg_R_joint', 'tail_joint', 'eye_L_joint', 'eye_R_joint', 'mascot_laptop']) {
      const node = object.getObjectByName(name)
      if (!node) throw new Error(`Liukanshan model is missing joint: ${name}`)
      joints[name] = { object: node, position: node.position.clone(), quaternion: node.quaternion.clone() }
    }
    return { object, materials, joints, euler: new THREE.Euler(), quaternion: new THREE.Quaternion() }
  }, [scene])

  useLayoutEffect(() => {
    elapsed.current = 0
    if (initialized.current !== owned.object || !animated) {
      applyMascotPose(owned, sampleLiukanshanPose(state, 0, animated), 1)
    }
    initialized.current = owned.object
  }, [owned, state, animated])
  useEffect(() => () => owned.materials.forEach(material => material.dispose()), [owned])
  useFrame((_, delta) => {
    if (animated) elapsed.current += Math.min(delta, .05)
    applyMascotPose(owned, sampleLiukanshanPose(state, elapsed.current, animated), animated ? 1 - Math.exp(-delta * 12) : 1)
  })

  return <group name="liukanshan-companion" position={position} rotation={rotation}
    userData={{ character: '刘看山', state, animated, heightMeters: .823 }}>
    <primitive object={owned.object} dispose={null} />
  </group>
}

export default Liukanshan
