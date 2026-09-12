import * as THREE from 'three'

export interface TextTexture {
  texture: THREE.CanvasTexture
  /** width / height，用于保持 sprite 比例 */
  aspect: number
}

const SERIF = '"Songti SC", "Noto Serif SC", "STSong", serif'

/** 话题词发光贴图：canvas 离屏渲染，避免运行时联网加载字体 */
export function makeWordTexture(word: string, color: string): TextTexture {
  const fontSize = 96
  const font = `600 ${fontSize}px ${SERIF}`
  const pad = 72
  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')!
  ctx.font = font
  const textW = ctx.measureText(word).width
  canvas.width = Math.ceil(textW + pad * 2)
  canvas.height = fontSize + pad * 2
  ctx = canvas.getContext('2d')!
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = canvas.width / 2
  const cy = canvas.height / 2
  ctx.shadowColor = color
  ctx.shadowBlur = 30
  ctx.fillStyle = color
  ctx.fillText(word, cx, cy)
  ctx.fillText(word, cx, cy)
  ctx.shadowBlur = 6
  ctx.globalAlpha = 0.55
  ctx.fillStyle = '#fdf6e3'
  ctx.fillText(word, cx, cy)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: canvas.width / canvas.height }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/** 金句卡片贴图：暗夜底 + 描金边 + 米白 serif 文字，自动换行截断 */
export function makeQuoteTexture(text: string): TextTexture {
  const W = 640
  const H = 320
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  roundRectPath(ctx, 8, 8, W - 16, H - 16, 22)
  ctx.fillStyle = 'rgba(10, 12, 16, 0.78)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(201, 151, 63, 0.7)'
  ctx.lineWidth = 3
  ctx.stroke()

  const fontSize = 34
  ctx.font = `${fontSize}px ${SERIF}`
  ctx.fillStyle = '#e8dcc0'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  const body = `「${text}」`
  const maxW = W - 72
  const lines: string[] = []
  let line = ''
  for (const ch of body) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  const lineHeight = 46
  const maxLines = 4
  const shown = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    shown[maxLines - 1] = shown[maxLines - 1].replace(/.{0,2}」?$/, '…')
  }
  const blockH = shown.length * lineHeight
  let y = (H - blockH) / 2
  for (const l of shown) {
    ctx.fillText(l, 36, y)
    y += lineHeight
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { texture, aspect: W / H }
}
