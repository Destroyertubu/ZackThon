import { BoxGeometry, ExtrudeGeometry, Shape, Vector3 } from 'three'

/** Shared dimensions for the visible shell, camera confinement and regression tests. */
export const ROOM = { halfWidth: 6, halfDepth: 5, eave: 3.2, ridge: 4.7, wall: 0.25 } as const
export const ROOF_SLOPE = (ROOM.ridge - ROOM.eave) / ROOM.halfDepth
export const ROOF_ANGLE = Math.atan(ROOF_SLOPE)
export const ROOF_LENGTH = Math.hypot(ROOM.halfDepth, ROOM.ridge - ROOM.eave) + 0.3
export const CAMERA_INSET = 0.35

export const BALCONY = {
  halfWidth: 3.2, nearZ: -4.95, farZ: -8.6,
  railX: 3.12, railZ: -8.52, railHeight: 1.12, railThickness: 0.14,
} as const
export const BALCONY_PORTAL = { halfWidth: 1.05, height: 3, wallZ: -5, frameWidth: 0.12 } as const

export interface ShellPanel { size: [number, number, number]; position: [number, number, number] }
export interface FloorObstacle { x: number; z: number; halfX: number; halfZ: number; height: number; yaw: number }
export const WALL_PANELS: ShellPanel[] = [
  { size: [3.4, 3.2, 0.25], position: [-4.3, 1.6, -5] },
  { size: [3.4, 3.2, 0.25], position: [4.3, 1.6, -5] },
  // The sunlit window becomes two fixed panes around a floor-level balcony opening.
  { size: [1.55, 0.9, 0.25], position: [-1.825, 0.45, -5] },
  { size: [1.55, 0.9, 0.25], position: [1.825, 0.45, -5] },
  { size: [5.2, 0.2, 0.25], position: [0, 3.1, -5] },
  { size: [0.25, 3.2, 10], position: [-6, 1.6, 0] },
  { size: [0.25, 3.2, 10], position: [6, 1.6, 0] },
  // Full entrance wall with a closed door, including the lintel above it.
  { size: [9.05, 3.2, 0.25], position: [-1.475, 1.6, 5] },
  { size: [1.75, 3.2, 0.25], position: [5.125, 1.6, 5] },
  { size: [1.3, 0.7, 0.25], position: [3.65, 2.85, 5] },
]
export const CLOSED_DOOR: ShellPanel = { size: [1.3, 2.52, 0.12], position: [3.65, 1.25, 5] }
export const WINDOW_GLAZING: ShellPanel[] = [-1, 1].map((side) => ({
  size: [1.55, 2.1, 0.08], position: [side * 1.825, 1.95, -5],
}))
export const BALCONY_PORTAL_FRAME: ShellPanel[] = [
  { size: [0.12, 3.08, 0.3], position: [-1.11, 1.54, -5] },
  { size: [0.12, 3.08, 0.3], position: [1.11, 1.54, -5] },
  { size: [5.5, 0.16, 0.3], position: [0, 3.08, -5] },
]

/** Railing envelopes include the gaps between balusters so nobody can leave the deck. */
const railNearZ = BALCONY_PORTAL.wallZ - 0.05
const railDepth = railNearZ - BALCONY.railZ
const returnWidth = BALCONY.railX - BALCONY_PORTAL.halfWidth
export const BALCONY_RAILS: ShellPanel[] = [
  { size: [BALCONY.railX * 2 + BALCONY.railThickness, BALCONY.railHeight, BALCONY.railThickness], position: [0, BALCONY.railHeight / 2, BALCONY.railZ] },
  ...[-1, 1].flatMap((side): ShellPanel[] => [
    { size: [BALCONY.railThickness, BALCONY.railHeight, railDepth], position: [side * BALCONY.railX, BALCONY.railHeight / 2, (railNearZ + BALCONY.railZ) / 2] },
    { size: [returnWidth, BALCONY.railHeight, BALCONY.railThickness], position: [side * (BALCONY_PORTAL.halfWidth + returnWidth / 2), BALCONY.railHeight / 2, railNearZ] },
  ]),
]
export const BALCONY_OBSTACLES: FloorObstacle[] = [
  { x: -2.53, z: -6.65, halfX: 0.36, halfZ: 0.76, height: 0.85, yaw: 0 },
  ...[-1, 1].map((side) => ({ x: side * 2.55, z: -7.95, halfX: 0.28, halfZ: 0.28, height: 1, yaw: 0 })),
]

/** Ridge runs along X, so the triangular end walls belong on the LEFT and RIGHT. */
export function createGableGeometry() {
  const shape = new Shape()
  shape.moveTo(-ROOM.halfDepth, ROOM.eave)
  shape.lineTo(ROOM.halfDepth, ROOM.eave)
  shape.lineTo(0, ROOM.ridge)
  shape.closePath()
  return new ExtrudeGeometry(shape, { depth: ROOM.wall, bevelEnabled: false })
}
export function createRoofGeometry() { return new BoxGeometry(12.5, 0.16, ROOF_LENGTH) }

/** Convex half-spaces n·p <= limit, inset enough to contain the camera near plane. */
const planes = [
  [1, 0, 0, ROOM.halfWidth - CAMERA_INSET], [-1, 0, 0, ROOM.halfWidth - CAMERA_INSET],
  [0, 0, 1, ROOM.halfDepth - CAMERA_INSET], [0, 0, -1, ROOM.halfDepth - CAMERA_INSET],
  [0, -1, 0, -CAMERA_INSET],
  [0, 1, ROOF_SLOPE, ROOM.ridge - CAMERA_INSET],
  [0, 1, -ROOF_SLOPE, ROOM.ridge - CAMERA_INSET],
] as const

export function isCameraInsideRoom(p: Vector3): boolean {
  return planes.every(([x, y, z, limit]) => x * p.x + y * p.y + z * p.z <= limit + 1e-7)
}

export function clampToRoom(p: Vector3): Vector3 {
  p.x = Math.max(-ROOM.halfWidth + CAMERA_INSET, Math.min(ROOM.halfWidth - CAMERA_INSET, p.x))
  p.z = Math.max(-ROOM.halfDepth + CAMERA_INSET, Math.min(ROOM.halfDepth - CAMERA_INSET, p.z))
  p.y = Math.max(CAMERA_INSET, Math.min(ROOM.ridge - CAMERA_INSET - ROOF_SLOPE * Math.abs(p.z), p.y))
  return p
}

/** Clip the entire camera boom to the room, even across doors/windows or above the eaves. */
export function roomCameraDistance(origin: Vector3, direction: Vector3, requested: number): number {
  let distance = requested
  for (const [x, y, z, limit] of planes) {
    const outward = x * direction.x + y * direction.y + z * direction.z
    if (outward > 1e-8) distance = Math.min(distance, Math.max(0, (limit - x * origin.x - y * origin.y - z * origin.z) / outward))
  }
  return distance
}

type Plane = readonly [number, number, number, number]
type CameraRegion = readonly Plane[]
const balconyCameraX = BALCONY.railX - BALCONY.railThickness / 2 - CAMERA_INSET
const balconyCameraFarZ = BALCONY.railZ + BALCONY.railThickness / 2 + CAMERA_INSET
const balconyCameraNearZ = railNearZ - BALCONY.railThickness / 2 - CAMERA_INSET
const portalCameraX = BALCONY_PORTAL.halfWidth - CAMERA_INSET
const roomCameraBackZ = -ROOM.halfDepth + CAMERA_INSET

// These touching convex volumes form a non-convex home. The narrow bridge is the
// only camera passage through the back wall; being inside either endpoint alone
// is insufficient, because a boom can cut across a solid side pane between them.
const homeCameraRegions: readonly CameraRegion[] = [
  planes,
  [
    [1, 0, 0, portalCameraX], [-1, 0, 0, portalCameraX],
    [0, 0, 1, roomCameraBackZ], [0, 0, -1, -balconyCameraNearZ],
    [0, -1, 0, -CAMERA_INSET], [0, 1, 0, BALCONY_PORTAL.height - CAMERA_INSET],
  ],
  [
    [1, 0, 0, balconyCameraX], [-1, 0, 0, balconyCameraX],
    [0, 0, 1, balconyCameraNearZ], [0, 0, -1, -balconyCameraFarZ],
    [0, -1, 0, -CAMERA_INSET],
  ],
]

export function isCameraInsideHome(p: Vector3): boolean {
  return homeCameraRegions.some((region) => region.every(([x, y, z, limit]) => x * p.x + y * p.y + z * p.z <= limit + 1e-7))
}

/** Nearest valid camera point; never pull a balcony target back into the cabin. */
export function clampToHome(p: Vector3): Vector3 {
  if (isCameraInsideHome(p)) return p
  const room = clampToRoom(p.clone())
  const portal = new Vector3(
    Math.max(-portalCameraX, Math.min(portalCameraX, p.x)),
    Math.max(CAMERA_INSET, Math.min(BALCONY_PORTAL.height - CAMERA_INSET, p.y)),
    Math.max(balconyCameraNearZ, Math.min(roomCameraBackZ, p.z)),
  )
  const balcony = new Vector3(
    Math.max(-balconyCameraX, Math.min(balconyCameraX, p.x)),
    Math.max(CAMERA_INSET, p.y),
    Math.max(balconyCameraFarZ, Math.min(balconyCameraNearZ, p.z)),
  )
  let nearest = room
  for (const candidate of [portal, balcony]) if (candidate.distanceToSquared(p) < nearest.distanceToSquared(p)) nearest = candidate
  return p.copy(nearest)
}

/** Analytically clip every part of a camera boom, including re-entry into a region. */
export function homeCameraDistance(origin: Vector3, direction: Vector3, requested: number): number {
  if (requested <= 0 || !isCameraInsideHome(origin)) return 0
  const intervals: [number, number][] = []
  for (const region of homeCameraRegions) {
    let enter = 0, leave = requested
    for (const [x, y, z, limit] of region) {
      const outward = x * direction.x + y * direction.y + z * direction.z
      const clearance = limit - x * origin.x - y * origin.y - z * origin.z
      if (Math.abs(outward) < 1e-10) {
        if (clearance < -1e-7) { leave = -1; break }
      } else if (outward > 0) leave = Math.min(leave, clearance / outward)
      else enter = Math.max(enter, clearance / outward)
    }
    if (enter <= leave + 1e-7 && leave >= 0) intervals.push([Math.max(0, enter), Math.max(0, leave)])
  }
  intervals.sort((a, b) => a[0] - b[0])
  let distance = 0
  for (const [enter, leave] of intervals) {
    if (enter > distance + 1e-7) break
    distance = Math.max(distance, leave)
  }
  return Math.min(requested, distance)
}

/** Mutates target. Keep damped shoulder tracking on the player's side of a jamb. */
export function followHomeTarget(target: Vector3, goal: Vector3, alpha: number): Vector3 {
  const shoulder = clampToHome(goal.clone())
  const damped = clampToHome(target.clone().lerp(shoulder, alpha))
  const direction = damped.sub(shoulder)
  const requested = direction.length()
  if (requested < 1e-8) return target.copy(shoulder)
  direction.divideScalar(requested)
  return target.copy(shoulder).addScaledVector(direction, homeCameraDistance(shoulder, direction, requested))
}

/**
 * Mutates desired. Large orbit drags must not jump a camera through a window.
 * When available, retract along the current valid boom until both its entire
 * length and the movement from the preceding frame are unobstructed. If the
 * player has just rounded a jamb, use the doorway's visible approach point as
 * a temporary look target while the camera rounds the same corner. This avoids
 * either freezing the camera behind the wall or snapping straight through it.
 */
export function constrainHomeCamera(previous: Vector3, desired: Vector3, target?: Vector3, maxTravel = Infinity): Vector3 {
  clampToHome(desired)
  const direction = desired.clone().sub(previous)
  const requested = direction.length()
  if (requested < 1e-8 || !isCameraInsideHome(previous)) return desired
  direction.divideScalar(requested)
  const permitted = homeCameraDistance(previous, direction, requested)
  if (permitted >= requested - 1e-7) return desired

  if (target && isCameraInsideHome(target)) {
    const toTarget = target.clone().sub(previous)
    const targetDistance = toTarget.length()
    const seesTarget = targetDistance < 1e-8 || homeCameraDistance(previous, toTarget.divideScalar(targetDistance), targetDistance) >= targetDistance - 1e-7
    if (seesTarget) {
      const boom = desired.clone().sub(target)
      let low = 0, high = 1
      const candidate = new Vector3()
      for (let i = 0; i < 14; i++) {
        const fraction = (low + high) / 2
        candidate.copy(target).addScaledVector(boom, fraction).sub(previous)
        const length = candidate.length()
        const visible = length < 1e-8 || homeCameraDistance(previous, candidate.divideScalar(length), length) >= length - 1e-7
        if (visible) low = fraction
        else high = fraction
      }
      return desired.copy(target).addScaledVector(boom, low)
    }

    const approachY = Math.max(CAMERA_INSET + 0.1, Math.min(BALCONY_PORTAL.height - CAMERA_INSET - 0.1, target.y))
    const approaches = [
      new Vector3(0, approachY, roomCameraBackZ + 0.1),
      new Vector3(0, approachY, balconyCameraNearZ - 0.1),
    ]
    let waypoint: Vector3 | undefined
    let bestCost = Infinity
    for (const candidate of approaches) {
      const step = candidate.clone().sub(previous)
      const length = step.length()
      if (length > 1e-8 && homeCameraDistance(previous, step.divideScalar(length), length) < length - 1e-7) continue
      const cost = length + candidate.distanceTo(target)
      if (cost < bestCost) { waypoint = candidate; bestCost = cost }
    }
    if (waypoint) {
      const travel = previous.distanceTo(waypoint)
      target.copy(waypoint)
      return desired.copy(previous).lerp(waypoint, travel < 1e-8 ? 1 : Math.min(1, maxTravel / travel))
    }
  }
  return desired.copy(previous).addScaledVector(direction, Math.max(0, permitted - 1e-6))
}
