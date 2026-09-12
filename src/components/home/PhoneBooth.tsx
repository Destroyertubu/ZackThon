import { useMemo } from 'react'
import * as THREE from 'three'
import { brassMat, brassDarkMat } from '@/components/scene/Props'

/*
 * 同频电话亭 —— 程序化复古英式电话亭（K6 风格）
 * 深红木质框架 + 格窗玻璃 + 穹顶 + 「TELEPHONE」拱形小牌。
 * 立足面 y=0，与小屋地板顶面齐平。
 */

const redWoodMat = new THREE.MeshStandardMaterial({
  color: '#7a2a26',
  roughness: 0.52,
  envMapIntensity: 0.7,
})
const redWoodDarkMat = new THREE.MeshStandardMaterial({
  color: '#5e201d',
  roughness: 0.62,
  envMapIntensity: 0.5,
})
const glassMat = new THREE.MeshPhysicalMaterial({
  color: '#d9ece7',
  transmission: 0.92,
  roughness: 0.08,
  thickness: 0.02,
  ior: 1.45,
  envMapIntensity: 1.0,
})
const phoneUnitMat = new THREE.MeshStandardMaterial({
  color: '#2a2320',
  roughness: 0.5,
  metalness: 0.35,
  envMapIntensity: 0.8,
})
const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false })
bulbMat.color.multiplyScalar(2.4) // HDR，让 Bloom 拾起灯晕

/* footprint / vertical layout */
const W = 0.98 // 外沿见方
const POST = 0.09
const WALL_INNER = W - 2 * POST // 0.8
const GLASS_BOTTOM = 0.78
const GLASS_TOP = 2.12
const WALL_TOP = 2.18

/* 「TELEPHONE」拱形小牌贴图（canvas 绘制，避免运行时加载字体） */
function useSignTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 224
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 512, 224)
    // 拱形轮廓：平底 + 椭圆拱顶
    ctx.beginPath()
    ctx.moveTo(30, 200)
    ctx.ellipse(256, 200, 226, 156, 0, Math.PI, 0, true)
    ctx.closePath()
    ctx.fillStyle = '#e8dcc0'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#c9973f'
    ctx.stroke()
    ctx.fillStyle = '#7a2a26'
    ctx.font = '600 46px Georgia, "Times New Roman", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('T E L E P H O N E', 256, 168)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [])
}

/* 单面墙（局部 xy 平面，面朝 +z）：下部实木嵌板 + 上部 3×6 格玻璃窗 */
function BoothWall({ door = false }: { door?: boolean }) {
  const w = WALL_INNER
  const gh = GLASS_TOP - GLASS_BOTTOM
  const gy = (GLASS_BOTTOM + GLASS_TOP) / 2
  const hBars = [1, 2, 3, 4, 5].map((k) => GLASS_BOTTOM + (k * gh) / 6)
  return (
    <group>
      {/* 下部实木板 + 内嵌饰板 */}
      <mesh material={redWoodMat} position={[0, 0.41, 0]} castShadow>
        <boxGeometry args={[w, 0.62, 0.05]} />
      </mesh>
      <mesh material={redWoodDarkMat} position={[0, 0.41, 0.032]}>
        <boxGeometry args={[w - 0.18, 0.42, 0.015]} />
      </mesh>
      {/* 腰轨与顶轨 */}
      <mesh material={redWoodMat} position={[0, 0.75, 0]}>
        <boxGeometry args={[w, 0.07, 0.06]} />
      </mesh>
      <mesh material={redWoodMat} position={[0, (GLASS_TOP + WALL_TOP) / 2, 0]}>
        <boxGeometry args={[w, WALL_TOP - GLASS_TOP, 0.06]} />
      </mesh>
      {/* 整片玻璃（在棂条之后） */}
      <mesh material={glassMat} position={[0, gy, 0]}>
        <planeGeometry args={[w - 0.02, gh - 0.02]} />
      </mesh>
      {/* 棂条：2 竖 + 5 横 */}
      {[-w / 6, w / 6].map((x) => (
        <mesh key={`v${x}`} material={redWoodMat} position={[x, gy, 0]}>
          <boxGeometry args={[0.035, gh, 0.05]} />
        </mesh>
      ))}
      {hBars.map((y) => (
        <mesh key={`h${y}`} material={redWoodMat} position={[0, y, 0]}>
          <boxGeometry args={[w, 0.035, 0.05]} />
        </mesh>
      ))}
      {/* 门面：黄铜拉手 + 铰链 */}
      {door && (
        <group>
          <mesh material={brassMat} position={[0.28, 1.08, 0.055]}>
            <cylinderGeometry args={[0.014, 0.014, 0.16, 10]} />
          </mesh>
          {[0.6, 1.7].map((y) => (
            <mesh key={y} material={brassDarkMat} position={[-w / 2 + 0.02, y, 0.045]}>
              <boxGeometry args={[0.03, 0.09, 0.02]} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

/* 亭内：壁挂式电话机 + 搁板 + 顶部暖灯 */
function Interior() {
  return (
    <group>
      {/* 后壁电话机 */}
      <group position={[0, 0, -WALL_INNER / 2 + 0.02]}>
        <mesh material={phoneUnitMat} position={[0, 1.42, 0.07]} castShadow>
          <boxGeometry args={[0.32, 0.42, 0.12]} />
        </mesh>
        {/* 拨号盘 */}
        <mesh material={brassDarkMat} position={[0, 1.4, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.015, 20]} />
        </mesh>
        <mesh material={brassMat} position={[0, 1.4, 0.145]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.012, 12]} />
        </mesh>
        {/* 听筒 */}
        <mesh material={phoneUnitMat} position={[0.2, 1.44, 0.08]}>
          <boxGeometry args={[0.05, 0.22, 0.06]} />
        </mesh>
        {/* 搁板 */}
        <mesh material={redWoodDarkMat} position={[0, 1.12, 0.1]}>
          <boxGeometry args={[0.5, 0.03, 0.2]} />
        </mesh>
      </group>
      {/* 顶灯 */}
      <mesh material={brassDarkMat} position={[0, 2.12, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.04, 14]} />
      </mesh>
      <mesh material={bulbMat} position={[0, 2.06, 0]}>
        <sphereGeometry args={[0.045, 14, 14]} />
      </mesh>
      <pointLight color="#ffc27a" intensity={3.2} distance={3} decay={1.6} position={[0, 1.95, 0]} />
    </group>
  )
}

export default function PhoneBooth({
  position = [0, 0, 0],
  rotation = 0,
}: {
  position?: [number, number, number]
  rotation?: number
}) {
  const signTex = useSignTexture()
  const signMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: signTex,
        transparent: true,
        roughness: 0.6,
        envMapIntensity: 0.5,
      }),
    [signTex],
  )
  const postX = W / 2 - POST / 2
  const wallOff = W / 2 - POST / 2
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* 底足 + 亭身地板，与地面接触自然 */}
      <mesh material={redWoodDarkMat} position={[0, 0.03, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.06, 0.06, 1.06]} />
      </mesh>
      <mesh material={redWoodMat} position={[0, 0.09, 0]} receiveShadow>
        <boxGeometry args={[W, 0.06, W]} />
      </mesh>

      {/* 四角立柱 */}
      {(
        [
          [-postX, -postX],
          [postX, -postX],
          [-postX, postX],
          [postX, postX],
        ] as const
      ).map(([x, z]) => (
        <mesh key={`${x},${z}`} material={redWoodMat} position={[x, (0.12 + WALL_TOP) / 2, z]} castShadow>
          <boxGeometry args={[POST, WALL_TOP - 0.12, POST]} />
        </mesh>
      ))}

      {/* 四面墙：前（+z）为门 */}
      <group position={[0, 0, wallOff]}>
        <BoothWall door />
      </group>
      <group position={[0, 0, -wallOff]} rotation={[0, Math.PI, 0]}>
        <BoothWall />
      </group>
      <group position={[-wallOff, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <BoothWall />
      </group>
      <group position={[wallOff, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <BoothWall />
      </group>

      {/* 招牌带 + 檐口 + 穹顶 + 顶饰 */}
      <mesh material={redWoodDarkMat} position={[0, 2.3, 0]} castShadow>
        <boxGeometry args={[1.06, 0.24, 1.06]} />
      </mesh>
      <mesh material={redWoodMat} position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[1.14, 0.08, 1.14]} />
      </mesh>
      <mesh material={redWoodMat} position={[0, 2.49, 0]} scale={[1, 0.42, 1]} castShadow>
        <sphereGeometry args={[0.64, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh material={brassMat} position={[0, 2.8, 0]}>
        <sphereGeometry args={[0.045, 12, 12]} />
      </mesh>

      {/* 四面「TELEPHONE」拱形小牌 */}
      {(
        [
          [0, 0.545, 0],
          [0, -0.545, Math.PI],
          [-0.545, 0, -Math.PI / 2],
          [0.545, 0, Math.PI / 2],
        ] as const
      ).map(([x, z, ry], i) => (
        <mesh key={i} material={signMat} position={[x, 2.29, z]} rotation={[0, ry, 0]}>
          <planeGeometry args={[0.74, 0.32]} />
        </mesh>
      ))}

      <Interior />
    </group>
  )
}
