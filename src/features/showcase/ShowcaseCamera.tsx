import { useProgress } from '@react-three/drei'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PerspectiveCamera, Vector3 } from 'three'
import { isShowcase, registerShowcaseAdapter } from './runtime'

type Pose = { position: [number, number, number]; target: [number, number, number]; fov?: number }
type Move = { from: Pose; to: Pose; start: number; duration: number }
export default function ShowcaseCamera({ sceneName }: { sceneName: string }) {
  const { camera, gl } = useThree()
  const pose = useRef<Pose | null>(null), move = useRef<Move | null>(null)
  const metrics = useRef({ frames: 0, elapsed: 0, slowFrames: 0, maxFrameMs: 0 })
  const target = useRef(new Vector3()), settledSince = useRef(0)
  useEffect(() => {
    if (!isShowcase()) return
    return registerShowcaseAdapter('camera', {
      getState: () => ({ scene: sceneName, position: camera.position.toArray(), ready: metrics.current.frames > 4 && !useProgress.getState().active && settledSince.current > 0 && performance.now() - settledSince.current > 900,
        assetsLoading: useProgress.getState().active,
        ...metrics.current, fps: metrics.current.frames / Math.max(.001, metrics.current.elapsed),
        width: gl.domElement.width, height: gl.domElement.height,
        calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures }),
      execute: (action, payload = {}) => {
        if (action === 'capture') return new Promise<string>(resolve => {
          const unsubscribe = addAfterEffect(() => {
            const image = gl.domElement.toDataURL('image/png')
            unsubscribe(); resolve(image)
          })
        })
        if (action === 'pose') {
          const next = payload as unknown as Pose
          if (!Array.isArray(next.position) || !Array.isArray(next.target)) throw new Error('镜头位置或目标缺失')
          move.current = null; pose.current = next
          return true
        }
        if (action === 'move') {
          const next = payload as unknown as { to: Pose; duration: number }
          if (!pose.current) throw new Error('请先设置镜头起点')
          move.current = { from: pose.current, to: next.to, start: performance.now(), duration: next.duration * 1000 }
          return true
        }
        throw new Error(`未知镜头动作：${action}`)
      },
    })
  }, [camera, gl, sceneName])
  useFrame((_, delta) => {
    if (!isShowcase()) return
    if (useProgress.getState().active) settledSince.current = 0
    else if (!settledSince.current) settledSince.current = performance.now()
    const data = metrics.current
    data.frames++; data.elapsed += delta; data.slowFrames += Number(delta > 1 / 30); data.maxFrameMs = Math.max(data.maxFrameMs, delta * 1000)
    let current = pose.current
    const active = move.current
    if (active) {
      const t = Math.min(1, Math.max(0, (performance.now() - active.start) / active.duration))
      const p = t * t * (3 - 2 * t)
      current = { position: active.from.position.map((v, i) => v + (active.to.position[i] - v) * p) as Pose['position'],
        target: active.from.target.map((v, i) => v + (active.to.target[i] - v) * p) as Pose['target'],
        fov: active.to.fov ?? active.from.fov }
      if (t === 1) { pose.current = current; move.current = null }
    }
    if (!current) return
    camera.position.set(...current.position)
    target.current.set(...current.target); camera.lookAt(target.current)
    if (camera instanceof PerspectiveCamera && current.fov && camera.fov !== current.fov) { camera.setFocalLength(camera.getFilmHeight() / (2 * Math.tan(current.fov * Math.PI / 360))) }
  }, -0.1)
  return null
}
