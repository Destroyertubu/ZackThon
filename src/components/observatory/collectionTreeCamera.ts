import * as THREE from 'three'
import type { ScenePose } from '@/features/personal/types'

export const COLLECTION_TREE_CAMERA_POSITION: [number, number, number] = [2.8, 2.15, 6.3]
export const COLLECTION_TREE_LOOK_AT: [number, number, number] = [-2, 3.5, -2]

/** A temporary reading camera must never replace the player's walking pose. */
export interface CollectionTreeCameraView {
  originalPosition: THREE.Vector3
  originalQuaternion: THREE.Quaternion
  targetPosition: THREE.Vector3
  targetQuaternion: THREE.Quaternion
}

export function beginCollectionTreeView(camera: THREE.Camera): CollectionTreeCameraView {
  const target = new THREE.Camera()
  target.position.set(...COLLECTION_TREE_CAMERA_POSITION)
  target.lookAt(...COLLECTION_TREE_LOOK_AT)
  return {
    originalPosition: camera.position.clone(),
    originalQuaternion: camera.quaternion.clone(),
    targetPosition: target.position.clone(),
    targetQuaternion: target.quaternion.clone(),
  }
}

export function advanceCollectionTreeView(camera: THREE.Camera, reading: CollectionTreeCameraView, delta: number, reducedMotion: boolean): void {
  if (reducedMotion) {
    camera.position.copy(reading.targetPosition)
    camera.quaternion.copy(reading.targetQuaternion)
    return
  }
  const amount = 1 - Math.exp(-Math.max(0, Math.min(delta, .05)) * 5)
  camera.position.lerp(reading.targetPosition, amount)
  camera.quaternion.slerp(reading.targetQuaternion, amount)
}

export function restoreCollectionTreeView(camera: THREE.Camera, reading: CollectionTreeCameraView, view: THREE.Euler): void {
  camera.position.copy(reading.originalPosition)
  camera.quaternion.copy(reading.originalQuaternion)
  view.setFromQuaternion(camera.quaternion, 'YXZ')
}

/** Always derives heading from the real quaternion, including a mid-frame capture. */
export function captureObservatoryPose(camera: THREE.Camera, reading: CollectionTreeCameraView | null = null, workshopQuaternion?: THREE.Quaternion): ScenePose {
  const position = reading?.originalPosition ?? camera.position
  const orientation = new THREE.Euler().setFromQuaternion(reading?.originalQuaternion ?? workshopQuaternion ?? camera.quaternion, 'YXZ')
  return { position: [position.x, position.y, position.z], yaw: orientation.y, pitch: orientation.x }
}
