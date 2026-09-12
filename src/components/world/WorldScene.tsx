import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useGameStore } from '@/state/gameStore'
import ArticleRealm from '@/components/realm/ArticleRealm'
import TopicNodeView from './TopicNodeView'
import QuoteCards from './QuoteCards'
import SeedLinks from './SeedLinks'

interface PickInfo {
  kind: 'node' | 'quote'
  label: string
  workId?: string
}

const ORIGIN_2D = new THREE.Vector2(0, 0)
const tmpVec = new THREE.Vector3()

const PROXIMITY_IN = 12
const PROXIMITY_OUT = 18
const PROXIMITY_INTERVAL = 0.2
const RAYCAST_INTERVAL = 0.12

/** 每 2 秒记录一次探索轨迹点 */
function TrailRecorder() {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const id = setInterval(() => {
      const s = useGameStore.getState()
      if (s.realmWorkId !== null) return
      s.addTrailPoint(camera.position.toArray() as [number, number, number], s.contextWord ?? undefined)
    }, 2000)
    return () => clearInterval(id)
  }, [camera])
  return null
}

/**
 * 词云大世界主场景：节点群岛 + 金句卡片 + 中心连线。
 * 负责靠近检测（展开词云 / 浮现金句）与准星 raycast 聚焦。
 * realmWorkId 非空时隐藏主世界并挂载文章场域，同时停用自身交互。
 */
export default function WorldScene() {
  const nodes = useGameStore((s) => s.nodes)
  const realmWorkId = useGameStore((s) => s.realmWorkId)
  const groupRef = useRef<THREE.Group>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const proximityAcc = useRef(0)
  const rayAcc = useRef(0)
  const lastPickKey = useRef('')
  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster()
    r.far = 160
    return r
  }, [])
  const pickables = useMemo(() => [] as THREE.Object3D[], [])

  useFrame(({ camera }, delta) => {
    const s = useGameStore.getState()

    proximityAcc.current += delta
    if (proximityAcc.current >= PROXIMITY_INTERVAL) {
      proximityAcc.current = 0
      if (activeId) {
        const cur = nodes.find((n) => n.id === activeId)
        if (!cur || tmpVec.set(...cur.position).distanceTo(camera.position) > PROXIMITY_OUT) {
          setActiveId(null)
          if (s.contextWord !== null) s.setContextWord(null)
        }
      } else {
        let best: (typeof nodes)[number] | undefined
        let bestDist = Infinity
        for (const n of nodes) {
          const d = tmpVec.set(...n.position).distanceTo(camera.position)
          if (d < bestDist) {
            bestDist = d
            best = n
          }
        }
        if (best && bestDist < PROXIMITY_IN) {
          setActiveId(best.id)
          s.markVisited(best.word)
          if (s.contextWord !== best.word) s.setContextWord(best.word)
          if (!best.expanded) s.expandTopic(best.id)
        }
      }
    }

    if (realmWorkId !== null) {
      if (lastPickKey.current !== '') {
        lastPickKey.current = ''
        if (s.focusTarget !== null) s.setFocusTarget(null)
      }
      return
    }

    rayAcc.current += delta
    if (rayAcc.current >= RAYCAST_INTERVAL) {
      rayAcc.current = 0
      const group = groupRef.current
      if (!group) return
      pickables.length = 0
      group.traverse((o) => {
        if (o.userData.pick) pickables.push(o)
      })
      raycaster.setFromCamera(ORIGIN_2D, camera)
      const hits = raycaster.intersectObjects(pickables, false)
      const pick = (hits.length > 0 ? (hits[0].object.userData.pick as PickInfo) : null)
      const key = pick ? `${pick.kind}|${pick.label}` : ''
      if (key !== lastPickKey.current) {
        lastPickKey.current = key
        s.setFocusTarget(pick ? { kind: pick.kind, label: pick.label, workId: pick.workId } : null)
      }
    }
  })

  const activeNode = activeId ? nodes.find((n) => n.id === activeId) : undefined
  const inRealm = realmWorkId !== null

  return (
    <>
      <group ref={groupRef} visible={!inRealm}>
        {nodes.map((n) => (
          <TopicNodeView key={n.id} node={n} />
        ))}
        {activeNode && <QuoteCards node={activeNode} />}
        <SeedLinks nodes={nodes} />
      </group>
      {inRealm && <ArticleRealm />}
      <TrailRecorder />
    </>
  )
}
