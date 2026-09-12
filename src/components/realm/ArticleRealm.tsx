/**
 * 叙事场域 —— 把一篇文章变成可飞行阅读的 3D 子地图。
 * 渲染在世界 Canvas 内部：realmWorkId 有效时挂载（此时世界侧交互已禁用，场域交互自理）：
 * 准星对准金句宝珠按 E 收纳；对准归途之门按 F 或点击返回大世界。
 * 场域几何以入口牌坊为原点一带：牌坊在 z≈6.5 面朝 +Z，路径向 -Z 蜿蜒上升，
 * 建议入场传送点见 layout.spawn（约为 (0, 3, 13) 望向 -Z）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { DoorOpen, Footprints, Sparkles } from 'lucide-react'
import { useGameStore } from '@/state/gameStore'
import { hashString, seededRandom } from '@/lib/worldGen'
import type { WorkItem } from '@/types/game'
import { buildRealmLayout } from './layout'
import type { RealmLayout, SteleSpot } from './layout'
import {
  archTexture,
  dotTexture,
  gateLabelTexture,
  haloTexture,
  skyTexture,
  steleTexture,
} from './textures'

type Focus = { kind: 'quote'; index: number } | { kind: 'gate' } | null
type RegisterFn = (key: string, kind: 'quote' | 'gate', index: number) => (obj: THREE.Object3D | null) => void

const focusKey = (f: Focus) => (f ? `${f.kind}:${f.kind === 'quote' ? f.index : 0}` : '')

export default function ArticleRealm() {
  const realmWorkId = useGameStore((s) => s.realmWorkId)
  const work = useGameStore((s) => (realmWorkId ? s.getWork(realmWorkId) : undefined))
  if (!realmWorkId || !work) return null
  return <RealmScene key={work.workId} work={work} />
}

/* ---------- 场景 ---------- */

function RealmScene({ work }: { work: WorkItem }) {
  const layout = useMemo(() => buildRealmLayout(work), [work])
  const showToast = useGameStore((s) => s.showToast)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  const [focus, setFocus] = useState<Focus>(null)
  const [progress, setProgress] = useState(1)
  const focusRef = useRef<Focus>(null)
  const interactives = useRef<THREE.Object3D[]>([])
  const acc = useRef(0)
  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster()
    r.far = 90
    return r
  }, [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])

  // 稳定的 ref 回调：避免重渲染时重复注册命中代理
  const register = useMemo<RegisterFn>(() => {
    const cache = new Map<string, (obj: THREE.Object3D | null) => void>()
    return (key, kind, index) => {
      let cb = cache.get(key)
      if (!cb) {
        cb = (obj) => {
          if (!obj) return
          obj.userData.realmKind = kind
          obj.userData.realmIndex = index
          interactives.current.push(obj)
        }
        cache.set(key, cb)
      }
      return cb
    }
  }, [])

  useEffect(() => {
    showToast(`踏入《${work.title}》的叙事场域`)
  }, [showToast, work.title])

  // 每帧节流（~8Hz）的准星 raycast + 阅读进度推算
  useFrame((_, delta) => {
    acc.current += delta
    if (acc.current < 0.12) return
    acc.current = 0
    raycaster.setFromCamera(center, camera)
    const hit = raycaster.intersectObjects(interactives.current, false)[0]?.object
    const kind = hit?.userData.realmKind as 'quote' | 'gate' | undefined
    const next: Focus = !hit
      ? null
      : kind === 'quote'
        ? { kind: 'quote', index: hit.userData.realmIndex as number }
        : kind === 'gate'
          ? { kind: 'gate' }
          : null
    if (focusKey(next) !== focusKey(focusRef.current)) {
      focusRef.current = next
      setFocus(next)
    }
    let best = 1
    let bd = Infinity
    layout.steles.forEach((s, i) => {
      const d = camera.position.distanceToSquared(s.pos)
      if (d < bd) {
        bd = d
        best = i + 1
      }
    })
    setProgress((p) => (p === best ? p : best))
  })

  // 键盘 / 点击交互：组件仅在 realmWorkId 非空时挂载，监听器随卸载自动移除
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const s = useGameStore.getState()
      if (!s.realmWorkId) return
      const f = focusRef.current
      const k = e.key.toLowerCase()
      if (k === 'e' && f?.kind === 'quote') {
        const text = layout.quotes[f.index]
        if (text) {
          s.collect({
            workId: work.workId,
            kind: work.kind,
            title: work.title,
            text,
            topicWord: undefined,
          })
        }
      } else if (k === 'f' && f?.kind === 'gate') {
        s.exitRealm()
      }
    }
    const onClick = () => {
      const s = useGameStore.getState()
      if (s.realmWorkId && focusRef.current?.kind === 'gate') s.exitRealm()
    }
    window.addEventListener('keydown', onKey)
    gl.domElement.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      gl.domElement.removeEventListener('click', onClick)
    }
  }, [gl, layout, work])

  return (
    <group>
      <ThemeSky hue={layout.hue} accent={layout.accent} />
      <StarDust hue={layout.hue} center={layout.center} />
      <hemisphereLight args={[layout.accent, '#0a0c10', 0.45]} />
      <pointLight position={[layout.archPos.x, 5.5, 9]} intensity={26} distance={42} decay={2} color="#c9973f" />

      {/* 思路金线：沿曲线的导引光带 */}
      <mesh>
        <tubeGeometry args={[layout.curve, 160, 0.035, 8, false]} />
        <meshBasicMaterial color="#c9973f" transparent opacity={0.5} toneMapped={false} />
      </mesh>

      <EntranceArch work={work} layout={layout} />
      <ReturnGate layout={layout} register={register} focused={focus?.kind === 'gate'} />
      {layout.paragraphs.map((text, i) => (
        <Stele key={i} text={text} index={i} spot={layout.steles[i]} />
      ))}
      <QuoteOrbs layout={layout} register={register} focusedIndex={focus?.kind === 'quote' ? focus.index : -1} />

      <Html fullscreen zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="pointer-events-none absolute inset-x-0 bottom-9 flex flex-col items-center gap-2.5 px-6">
          {focus?.kind === 'quote' && layout.quotes[focus.index] && (
            <div className="max-w-md rounded-xl border border-[#c9973f]/30 bg-black/60 px-5 py-3 text-center backdrop-blur-md">
              <p className="line-clamp-2 font-serif text-sm leading-relaxed tracking-wider text-[#e8dcc0]">
                {layout.quotes[focus.index]}
              </p>
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] tracking-[0.25em] text-[#c9973f]">
                <Sparkles size={12} />
                E · 收纳此句
              </p>
            </div>
          )}
          {focus?.kind === 'gate' && (
            <div className="flex items-center gap-2 rounded-full border border-[#c9973f]/40 bg-black/60 px-4 py-1.5 text-[11px] tracking-[0.25em] text-[#e8dcc0] backdrop-blur-md">
              <DoorOpen size={12} className="text-[#c9973f]" />
              F / 点击 · 返回大世界
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-[#c9973f]/30 bg-black/60 px-5 py-2 text-[11px] tracking-[0.2em] text-[#b9ac8d] backdrop-blur-md">
            <Footprints size={12} className="text-[#c9973f]" />
            <span>
              段落 {progress} / {layout.paragraphs.length}
            </span>
            <span className="text-[#c9973f]/60">·</span>
            <span>F 对准归途之门返回</span>
          </div>
        </div>
      </Html>
    </group>
  )
}

/* ---------- 部件 ---------- */

function ThemeSky({ hue, accent }: { hue: number; accent: string }) {
  const tex = useMemo(() => skyTexture(hue), [hue])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group>
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[160, 32, 24]} />
        <meshBasicMaterial map={tex} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      {/* 近域色雾，增强包裹感 */}
      <mesh renderOrder={-9} frustumCulled={false}>
        <sphereGeometry args={[80, 24, 18]} />
        <meshBasicMaterial
          color={accent}
          side={THREE.BackSide}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
        />
      </mesh>
    </group>
  )
}

function StarDust({ hue, center }: { hue: number; center: THREE.Vector3 }) {
  const dot = useMemo(() => dotTexture(), [])
  useEffect(() => () => dot.dispose(), [dot])
  const data = useMemo(() => {
    const rnd = seededRandom(hashString(`dust-${hue}`))
    const n = 680
    const positions = new Float32Array(n * 3)
    const colors = new Float32Array(n * 3)
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      positions[i * 3] = (rnd() - 0.5) * 170
      positions[i * 3 + 1] = -14 + rnd() * 72
      positions[i * 3 + 2] = (rnd() - 0.5) * 170
      // 45% 主题色，55% 暖金，亮度参差
      if (rnd() < 0.45) c.set(`hsl(${hue}, 70%, ${58 + Math.floor(rnd() * 20)}%)`)
      else c.set(`hsl(42, 62%, ${58 + Math.floor(rnd() * 24)}%)`)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, colors }
  }, [hue])
  const ref = useRef<THREE.Points>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.005
  })
  return (
    <points ref={ref} position={[center.x, 0, center.z]} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.55}
        map={dot}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

function EntranceArch({ work, layout }: { work: WorkItem; layout: RealmLayout }) {
  const data = useMemo(() => archTexture(work.title, work.authorName), [work.title, work.authorName])
  useEffect(() => () => data.tex.dispose(), [data])
  const p = layout.archPos
  const w = 6.8
  const h = w * data.aspect
  return (
    <group position={[p.x, 0, p.z]}>
      {/* 浮空石台 */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[4.4, 1.6, 1.4, 18]} />
        <meshStandardMaterial color="#14181f" roughness={0.95} metalness={0.05} />
      </mesh>
      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 2.4, 0]}>
            <cylinderGeometry args={[0.14, 0.2, 4.8, 10]} />
            <meshStandardMaterial color="#241a10" roughness={0.8} metalness={0.15} />
          </mesh>
          <mesh position={[0, 4.95, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#2a1f14" emissive="#c9973f" emissiveIntensity={1.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.34, 0.42, 0.24, 10]} />
            <meshStandardMaterial color="#1c1410" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* 匾额：作品标题 + 执笔人 */}
      <mesh position={[0, 3.5, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={data.tex} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function ReturnGate({
  layout,
  register,
  focused,
}: {
  layout: RealmLayout
  register: RegisterFn
  focused: boolean
}) {
  const halo = useMemo(() => haloTexture(), [])
  const label = useMemo(() => gateLabelTexture(), [])
  useEffect(
    () => () => {
      halo.dispose()
      label.dispose()
    },
    [halo, label],
  )
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const ring = ringRef.current
    if (!ring) return
    ring.rotation.z = t * 0.25
    ring.rotation.y = Math.sin(t * 0.5) * 0.12
    ring.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04 + (focused ? 0.12 : 0))
  })
  const p = layout.gatePos
  return (
    <group position={[p.x, p.y, p.z]}>
      {/* 命中代理（粗环，不可见但可被 raycast） */}
      <mesh visible={false} ref={register('gate', 'gate', 0)}>
        <torusGeometry args={[1.5, 0.55, 8, 32]} />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.5, 0.07, 16, 96]} />
        <meshStandardMaterial
          color="#1a140b"
          emissive="#c9973f"
          emissiveIntensity={focused ? 3.4 : 2.2}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
      {/* 门内微光 */}
      <mesh>
        <circleGeometry args={[1.38, 48]} />
        <meshBasicMaterial
          color={layout.accent}
          transparent
          opacity={focused ? 0.22 : 0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <sprite scale={[6, 6, 1]} position={[0, 0, -0.4]}>
        <spriteMaterial
          map={halo}
          color="#c9973f"
          transparent
          opacity={focused ? 0.5 : 0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      <mesh position={[0, 2.15, 0]}>
        <planeGeometry args={[2.4, 0.8]} />
        <meshBasicMaterial map={label} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Stele({ text, index, spot }: { text: string; index: number; spot: SteleSpot }) {
  const data = useMemo(() => steleTexture(text, index), [text, index])
  useEffect(() => () => data.tex.dispose(), [data])
  const w = 3.6
  const h = w * data.aspect
  return (
    <group position={spot.pos} quaternion={spot.quat}>
      {/* 碑后背光晕 */}
      <mesh position={[0, 0, -0.03]}>
        <planeGeometry args={[w + 0.3, h + 0.3]} />
        <meshBasicMaterial color="#c9973f" transparent opacity={0.08} toneMapped={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={data.tex} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function QuoteOrbs({
  layout,
  register,
  focusedIndex,
}: {
  layout: RealmLayout
  register: RegisterFn
  focusedIndex: number
}) {
  const halo = useMemo(() => haloTexture(), [])
  useEffect(() => () => halo.dispose(), [halo])
  const groupRef = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const g = groupRef.current
    if (!g) return
    for (let i = 0; i < g.children.length; i++) {
      const orb = layout.orbs[i]
      const child = g.children[i]
      if (orb && child) child.position.y = orb.pos.y + Math.sin(t * 0.9 + orb.phase) * 0.22
    }
  })
  return (
    <group ref={groupRef}>
      {layout.orbs.map((orb, i) => {
        const focused = i === focusedIndex
        const s = orb.scale * (focused ? 1.35 : 1)
        return (
          <group key={i} position={[orb.pos.x, orb.pos.y, orb.pos.z]}>
            {/* 命中代理（大球，不可见但可被 raycast） */}
            <mesh visible={false} ref={register(`orb-${i}`, 'quote', i)}>
              <sphereGeometry args={[0.6 * orb.scale, 8, 8]} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.2 * s, 24, 24]} />
              <meshStandardMaterial
                color="#14100c"
                emissive={layout.accent}
                emissiveIntensity={focused ? 3.6 : 2.1}
                roughness={0.4}
                metalness={0.1}
              />
            </mesh>
            <sprite scale={[1.6 * s, 1.6 * s, 1]}>
              <spriteMaterial
                map={halo}
                color={layout.accent}
                transparent
                opacity={focused ? 0.85 : 0.5}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
            {/* 金核 */}
            <mesh>
              <sphereGeometry args={[0.07 * s, 12, 12]} />
              <meshBasicMaterial color="#ffe9b8" toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
