import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { TopicNode } from '@/types/game'
import { hashString, seededRandom } from '@/lib/worldGen'
import { makeWordTexture } from './textures'

/* 全岛共享的低多边形几何与材质，避免逐节点重复创建 */
const rockGeo = new THREE.ConeGeometry(1, 1, 7, 2)
const grassGeo = new THREE.CylinderGeometry(1, 0.9, 0.32, 9)
const rockMat = new THREE.MeshStandardMaterial({
  color: '#7a6a52',
  roughness: 0.9,
  flatShading: true,
  emissive: '#17120a',
})
const grassMat = new THREE.MeshStandardMaterial({
  color: '#4a7a4e',
  roughness: 0.85,
  flatShading: true,
  emissive: '#0a140b',
})

/* 共享的径向光晕贴图（只创建一次），按节点色调着色 */
let glowTex: THREE.CanvasTexture | null = null
function getGlowTexture(): THREE.CanvasTexture {
  if (!glowTex) {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
    g.addColorStop(0, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.28)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    glowTex = new THREE.CanvasTexture(c)
    glowTex.colorSpace = THREE.SRGBColorSpace
  }
  return glowTex
}

const glowMats: Record<'seed' | 'ext', THREE.SpriteMaterial> = {
  seed: new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color: '#c9973f',
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }),
  ext: new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color: '#7fd4c1',
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }),
}

export default function TopicNodeView({ node }: { node: TopicNode }) {
  const color = node.isSeed ? '#c9973f' : '#7fd4c1'
  const { texture, aspect } = useMemo(() => makeWordTexture(node.word, color), [node.word, color])
  useEffect(() => () => texture.dispose(), [texture])

  const rotY = useMemo(() => seededRandom(hashString(node.id))() * Math.PI * 2, [node.id])

  const wordH = node.isSeed ? 3.2 + node.weight * 1.4 : 1.9 + node.weight * 1.0
  const wordW = wordH * aspect
  const glowSize = wordH * (node.isSeed ? 3.0 : 2.4)
  const rockR = (node.isSeed ? 2.4 : 1.5) + node.weight * (node.isSeed ? 1.8 : 1.1)
  const rockH = rockR * 1.7

  return (
    <group position={node.position}>
      <sprite scale={[glowSize, glowSize, 1]} material={glowMats[node.isSeed ? 'seed' : 'ext']} />
      <sprite
        scale={[wordW, wordH, 1]}
        renderOrder={1}
        userData={{ pick: { kind: 'node', label: node.word, workId: node.workIds[0] } }}
      >
        <spriteMaterial map={texture} transparent depthWrite={false} fog={false} toneMapped={false} />
      </sprite>
      <mesh
        geometry={rockGeo}
        material={rockMat}
        position={[0, -1.1 - rockH / 2, 0]}
        rotation={[Math.PI, rotY, 0]}
        scale={[rockR, rockH, rockR]}
      />
      <mesh
        geometry={grassGeo}
        material={grassMat}
        position={[0, -0.92, 0]}
        rotation={[0, rotY, 0]}
        scale={[rockR * 1.04, 1, rockR * 1.04]}
      />
    </group>
  )
}
