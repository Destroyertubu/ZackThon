/**
 * 场域用的 canvas 贴图 —— 全部本地绘制，离线可用，不加载任何外部资源。
 */
import * as THREE from 'three'

const GOLD = '#c9973f'
const CREAM = '#e8dcc0'
const MUTE = '#8a8f9c'
const SERIF = '"Songti SC", "Noto Serif SC", "STSong", "SimSun", serif'

function makeTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** 圆角矩形路径（不依赖 ctx.roundRect） */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 逐字贪心换行（CJK 无空格），超行数时末行以 … 收尾 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = []
  let line = ''
  let truncated = false
  for (const ch of text) {
    if (lines.length >= maxLines) {
      truncated = true
      break
    }
    if (ch === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  else if (line) truncated = true
  if (truncated && lines.length > 0) {
    const last = [...lines[lines.length - 1]]
    lines[lines.length - 1] = `${last.slice(0, -1).join('')}…`
  }
  return lines
}

/** 文字碑：深色石板 + 金框 + 段序 + 米白正文。aspect 供 plane 定高 */
export function steleTexture(text: string, index: number): { tex: THREE.CanvasTexture; aspect: number } {
  const W = 512
  const pad = 40
  const bodyFont = `400 30px ${SERIF}`
  let lines: string[] = [text]
  const meas = document.createElement('canvas').getContext('2d')
  if (meas) {
    meas.font = bodyFont
    lines = wrapLines(meas, text, W - pad * 2, 10)
  }
  const lh = 47
  const headH = 84
  const H = headH + lines.length * lh + 30
  const tex = makeTexture(W, H, (ctx) => {
    rr(ctx, 3, 3, W - 6, H - 6, 18)
    ctx.fillStyle = 'rgba(9, 11, 16, 0.88)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(201, 151, 63, 0.85)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    rr(ctx, 11, 11, W - 22, H - 22, 13)
    ctx.strokeStyle = 'rgba(201, 151, 63, 0.28)'
    ctx.lineWidth = 1
    ctx.stroke()
    // 段序
    ctx.font = `600 32px ${SERIF}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = GOLD
    ctx.fillText(`§ ${String(index + 1).padStart(2, '0')}`, pad, 52)
    ctx.strokeStyle = 'rgba(201, 151, 63, 0.4)'
    ctx.beginPath()
    ctx.moveTo(pad, headH - 12)
    ctx.lineTo(W - pad, headH - 12)
    ctx.stroke()
    // 正文
    ctx.font = bodyFont
    ctx.fillStyle = CREAM
    lines.forEach((ln, i) => ctx.fillText(ln, pad, headH + 34 + i * lh))
  })
  return { tex, aspect: H / W }
}

/** 入口牌坊匾额：场域名 + 作品标题 + 执笔人 */
export function archTexture(title: string, authorName: string): { tex: THREE.CanvasTexture; aspect: number } {
  const W = 1024
  const H = 448
  const tex = makeTexture(W, H, (ctx) => {
    rr(ctx, 4, 4, W - 8, H - 8, 26)
    ctx.fillStyle = 'rgba(7, 9, 13, 0.8)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(201, 151, 63, 0.9)'
    ctx.lineWidth = 3
    ctx.stroke()
    rr(ctx, 16, 16, W - 32, H - 32, 18)
    ctx.strokeStyle = 'rgba(201, 151, 63, 0.3)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = MUTE
    ctx.font = `400 26px ${SERIF}`
    ctx.fillText('叙 事 场 域', W / 2, 66)

    ctx.font = `600 64px ${SERIF}`
    const lines = wrapLines(ctx, title || '未命名之作', W - 220, 2)
    ctx.fillStyle = GOLD
    const ty = lines.length > 1 ? 168 : 198
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2, ty + i * 84))

    // 饰纹：细线 + 菱形
    const dy = 316
    ctx.strokeStyle = 'rgba(201, 151, 63, 0.75)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(W / 2 - 180, dy)
    ctx.lineTo(W / 2 - 18, dy)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(W / 2 + 18, dy)
    ctx.lineTo(W / 2 + 180, dy)
    ctx.stroke()
    ctx.save()
    ctx.translate(W / 2, dy)
    ctx.rotate(Math.PI / 4)
    ctx.strokeRect(-7, -7, 14, 14)
    ctx.restore()

    ctx.fillStyle = CREAM
    ctx.font = `400 30px ${SERIF}`
    ctx.fillText(`执笔 · ${authorName || '佚名'}`, W / 2, 384)
  })
  return { tex, aspect: H / W }
}

/** 归途之门的小字牌（透明底，悬浮发光字） */
export function gateLabelTexture(): THREE.CanvasTexture {
  return makeTexture(384, 128, (ctx) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = GOLD
    ctx.font = `600 52px ${SERIF}`
    ctx.shadowColor = 'rgba(201, 151, 63, 0.8)'
    ctx.shadowBlur = 18
    ctx.fillText('归 途 之 门', 192, 62)
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(232, 220, 192, 0.75)'
    ctx.font = `400 22px ${SERIF}`
    ctx.fillText('F · 返 回 大 世 界', 192, 104)
  })
}

/** 径向光晕（宝珠 / 门环的辉光 sprite） */
export function haloTexture(): THREE.CanvasTexture {
  return makeTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(255, 255, 255, 1)')
    g.addColorStop(0.28, 'rgba(255, 255, 255, 0.42)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  })
}

/** 柔光点（星尘粒子） */
export function dotTexture(): THREE.CanvasTexture {
  return makeTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255, 255, 255, 1)')
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
}

/** 主题色域天幕：纵向渐变，贴 backside 大球内壁 */
export function skyTexture(hue: number): THREE.CanvasTexture {
  return makeTexture(64, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, `hsl(${hue}, 42%, 15%)`)
    g.addColorStop(0.5, `hsl(${hue}, 52%, 7%)`)
    g.addColorStop(1, '#04050a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 512)
  })
}
