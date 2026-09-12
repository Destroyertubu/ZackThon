import { Box3, MathUtils, Ray, Vector3 } from 'three'
import { PLAYER_RADIUS } from './config'
import { BALCONY, BALCONY_OBSTACLES, BALCONY_PORTAL, BALCONY_RAILS, homeCameraDistance } from '../../scene/roomEnvelope'
import type { FloorObstacle } from '../../scene/roomEnvelope'

/** Simple, deliberately stable proxies for static furniture; never raycast the scans. */
type BoxObstacle = FloorObstacle
const box = (x: number, z: number, halfX: number, halfZ: number, height: number, yaw = 0): BoxObstacle =>
  ({ x, z, halfX, halfZ, height, yaw })
export const FURNITURE = [
  box(-4.2, 1.7, 1.17, 0.52, 0.95, 0.35), // desk
  box(-3.85, 2.62, 0.36, 0.38, 1, 0.35),
  box(-4.1, -2.5, 0.58, 0.54, 1.05, 0.7),
  box(-5.15, -1.55, 0.3, 0.3, 0.9),
  box(-5.58, -2.4, 0.32, 0.9, 2.5), // bookshelf
  box(4.3, -4.45, 1.12, 0.38, 2.55),
  box(4.75, -0.7, 0.51, 0.51, 2.6, -1.32),
  box(5.3, 1.3, 0.42, 0.58, 0.9),
  box(2.45, 0.6, 0.36, 0.4, 1.06, -Math.PI / 2 - 0.3),
  box(-2.4, 0.9, 0.36, 0.4, 1.06, Math.PI / 2 + 0.4),
  box(0.4, -2.45, 0.36, 0.4, 1.06, Math.PI - 0.15),
  box(-5.3, -4.2, 0.38, 0.38, 1.3),
  box(-5.45, 0.6, 0.3, 0.3, 0.8),
  box(-3.15, -4.25, 0.36, 0.36, 1.2),
  box(2.25, -4.3, 0.36, 0.36, 1.2),
  box(2.6, -3.3, 0.25, 0.25, 0.7),
  box(5.7, -2.9, 0.32, 0.32, 1.2),
  box(2.3, 4.6, 0.3, 0.3, 0.8),
  box(5.5, 2.3, 0.22, 0.22, 0.8),
  box(5.5, 3.2, 0.24, 0.24, 0.65),
  ...BALCONY_OBSTACLES,
]

const balconyPlayerX = BALCONY.railX - BALCONY.railThickness / 2 - PLAYER_RADIUS
const balconyPlayerFarZ = BALCONY.railZ + BALCONY.railThickness / 2 + PLAYER_RADIUS
const balconyPlayerNearZ = BALCONY_RAILS[2].position[2] - BALCONY.railThickness / 2 - PLAYER_RADIUS
const roomPlayerBackZ = BALCONY_PORTAL.wallZ + 0.15 + PLAYER_RADIUS
const portalPlayerX = BALCONY_PORTAL.halfWidth - PLAYER_RADIUS

export function canStandAt(x: number, z: number): boolean {
  const inRoom = Math.abs(x) <= 5.55 && z >= roomPlayerBackZ && z <= 4.55
  const inPortal = Math.abs(x) <= portalPlayerX && z >= balconyPlayerNearZ && z <= roomPlayerBackZ
  const onBalcony = Math.abs(x) <= balconyPlayerX && z >= balconyPlayerFarZ && z <= balconyPlayerNearZ
  if (!inRoom && !inPortal && !onBalcony) return false
  if (Math.hypot(x, z) < 1.75 + PLAYER_RADIUS) return false
  for (const b of FURNITURE) {
    const dx = x - b.x, dz = z - b.z
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw)
    const localX = c * dx - s * dz, localZ = s * dx + c * dz
    const nearestX = MathUtils.clamp(localX, -b.halfX, b.halfX)
    const nearestZ = MathUtils.clamp(localZ, -b.halfZ, b.halfZ)
    if (Math.hypot(localX - nearestX, localZ - nearestZ) < PLAYER_RADIUS) return false
  }
  return true
}

/** Substeps prevent tunnelling; separate axes allow sliding along furniture. */
export function moveOnFloor(position: Vector3, dx: number, dz: number): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.07))
  for (let i = 0; i < steps; i++) {
    if (canStandAt(position.x + dx / steps, position.z)) position.x += dx / steps
    if (canStandAt(position.x, position.z + dz / steps)) position.z += dz / steps
  }
}

function cameraBox(b: BoxObstacle): Box3 {
  const c = Math.abs(Math.cos(b.yaw)), s = Math.abs(Math.sin(b.yaw))
  const x = c * b.halfX + s * b.halfZ, z = s * b.halfX + c * b.halfZ
  return new Box3(new Vector3(b.x - x, 0, b.z - z), new Vector3(b.x + x, b.height, b.z + z))
}
const cameraBoxes = [
  ...FURNITURE.map(cameraBox),
  cameraBox(box(0, 0, 1.72, 1.72, 1.0)),
].map((b) => b.expandByScalar(0.15))
const cameraRay = new Ray()
const hit = new Vector3()
const direction = new Vector3()

/** Retract the camera before an obstacle, including a margin for its near plane. */
export function cameraSafeDistance(target: Vector3, desired: Vector3): number {
  direction.copy(desired).sub(target)
  const requested = direction.length()
  direction.normalize()
  let distance = homeCameraDistance(target, direction, requested)
  cameraRay.set(target, direction)
  for (const b of cameraBoxes) {
    if (b.containsPoint(target)) continue
    if (cameraRay.intersectBox(b, hit)) distance = Math.min(distance, Math.max(0.2, target.distanceTo(hit) - 0.08))
  }
  return distance
}

export const HOME_INTERACTIONS = [
  { id: 'synth', label: '思维合成台', x: 0, z: 0, radius: 2.7 },
  { id: 'cabinet', label: '想法收纳柜', x: 4.3, z: -4.1, radius: 1.9 },
  { id: 'journal', label: '漫行者日志', x: -4.2, z: 1.7, radius: 2.0 },
  { id: 'phone', label: '同频电话亭', x: 4.75, z: -0.7, radius: 1.7 },
  { id: 'world', label: '启程探索', x: 3.65, z: 5, radius: 1.45 },
] as const
export type HomeInteraction = (typeof HOME_INTERACTIONS)[number]
export function nearestInteraction(position: Vector3): HomeInteraction | null {
  let best: HomeInteraction | null = null
  let bestDistance = Infinity
  for (const spot of HOME_INTERACTIONS) {
    const distance = Math.hypot(position.x - spot.x, position.z - spot.z)
    if (distance < spot.radius && distance < bestDistance) { best = spot; bestDistance = distance }
  }
  return best
}
