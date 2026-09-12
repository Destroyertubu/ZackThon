import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { TopicNode } from '@/types/game'
import { useGameStore } from '@/state/gameStore'
import { makeQuoteTexture } from './textures'

interface QuoteEntry {
  text: string
  workId: string
}

/** 取节点关联作品的金句：每部作品至多 2 条，合计 3~6 条；不足时用作品摘要补齐 */
function collectQuotes(node: TopicNode): QuoteEntry[] {
  const s = useGameStore.getState()
  const out: QuoteEntry[] = []
  for (const id of node.workIds) {
    const w = s.getWork(id)
    if (!w) continue
    for (const q of w.quotes.slice(0, 2)) {
      if (q && out.length < 6) out.push({ text: q, workId: id })
    }
    if (out.length >= 6) break
  }
  for (const id of node.workIds) {
    if (out.length >= 3) break
    const w = s.getWork(id)
    if (w && w.description) out.push({ text: w.description, workId: id })
  }
  return out.slice(0, 6)
}

function QuoteSprite({ entry, angle, radius, index, register }: {
  entry: QuoteEntry
  angle: number
  radius: number
  index: number
  register: (i: number, s: THREE.Sprite | null) => void
}) {
  const { texture, aspect } = useMemo(() => makeQuoteTexture(entry.text), [entry.text])
  useEffect(() => () => texture.dispose(), [texture])
  const w = 7.4
  const baseY = 0.4 + (index % 3) * 1.1
  return (
    <sprite
      ref={(s) => register(index, s)}
      position={[Math.cos(angle) * radius, baseY, Math.sin(angle) * radius]}
      scale={[w, w / aspect, 1]}
      userData={{ pick: { kind: 'quote', label: entry.text, workId: entry.workId }, baseY }}
    >
      <spriteMaterial map={texture} transparent depthWrite={false} fog={false} toneMapped={false} />
    </sprite>
  )
}

/** 环绕节点缓慢上下浮动的金句卡片环，随激活节点挂载/卸载（按需创建销毁） */
export default function QuoteCards({ node }: { node: TopicNode }) {
  const entries = useMemo(() => collectQuotes(node), [node])
  const sprites = useRef<Array<THREE.Sprite | null>>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < sprites.current.length; i++) {
      const sp = sprites.current[i]
      if (!sp) continue
      sp.position.y = (sp.userData.baseY as number) + Math.sin(t * 0.7 + i * 1.7) * 0.35
    }
  })

  const register = (i: number, s: THREE.Sprite | null) => {
    sprites.current[i] = s
  }

  const radius = 6.8
  return (
    <group position={node.position}>
      {entries.map((e, i) => (
        <QuoteSprite
          key={`${e.workId}-${i}`}
          entry={e}
          index={i}
          radius={radius}
          angle={(i / entries.length) * Math.PI * 2 + 0.5}
          register={register}
        />
      ))}
    </group>
  )
}
