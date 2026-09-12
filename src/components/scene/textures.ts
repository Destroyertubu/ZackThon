import * as THREE from 'three'

/** Create a canvas texture from a draw callback. */
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

const GOLD = '#c9973f'
const DEEP_GREEN = '#1e4634'

/** Round rug: deep green field, gold ring borders, center medallion. */
export function roundRugTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, (ctx) => {
    const c = 256
    ctx.fillStyle = DEEP_GREEN
    ctx.fillRect(0, 0, 512, 512)
    // subtle mottling
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 250
      ctx.fillStyle = `rgba(${20 + Math.random() * 30},${70 + Math.random() * 40},${50 + Math.random() * 30},0.25)`
      ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 3, 3)
    }
    // gold rings
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.arc(c, c, 240, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(c, c, 224, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(c, c, 96, 0, Math.PI * 2)
    ctx.stroke()
    // border leaf dashes
    ctx.lineWidth = 3
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(c + Math.cos(a) * 226, c + Math.sin(a) * 226)
      ctx.lineTo(c + Math.cos(a) * 238, c + Math.sin(a) * 238)
      ctx.stroke()
    }
    // center medallion: stylized leaf emblem
    ctx.save()
    ctx.translate(c, c)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, 70)
    ctx.quadraticCurveTo(46, 10, 0, -70)
    ctx.quadraticCurveTo(-46, 10, 0, 70)
    ctx.stroke()
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const y = 40 - i * 36
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.quadraticCurveTo(s * 30, y - 8, s * 40, y - 26)
        ctx.stroke()
      }
    }
    ctx.restore()
  })
}

/** Rectangular red patterned rug (door / armchair). */
export function rectRugTexture(): THREE.CanvasTexture {
  return makeTexture(512, 384, (ctx) => {
    ctx.fillStyle = '#6e2f24'
    ctx.fillRect(0, 0, 512, 384)
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(${100 + Math.random() * 60},${40 + Math.random() * 30},${30 + Math.random() * 20},0.2)`
      ctx.fillRect(Math.random() * 512, Math.random() * 384, 3, 3)
    }
    ctx.strokeStyle = '#d8a04c'
    ctx.lineWidth = 10
    ctx.strokeRect(18, 18, 476, 348)
    ctx.lineWidth = 3
    ctx.strokeRect(40, 40, 432, 304)
    // diamond lattice
    ctx.strokeStyle = 'rgba(216,160,76,0.55)'
    ctx.lineWidth = 2
    for (let x = -384; x < 512; x += 64) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + 384, 384)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + 384, 0)
      ctx.lineTo(x, 384)
      ctx.stroke()
    }
    // center medallion
    ctx.save()
    ctx.translate(256, 192)
    ctx.strokeStyle = '#d8a04c'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, -70)
    ctx.lineTo(56, 0)
    ctx.lineTo(0, 70)
    ctx.lineTo(-56, 0)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, -34)
    ctx.lineTo(28, 0)
    ctx.lineTo(0, 34)
    ctx.lineTo(-28, 0)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  })
}

/** Banner: deep green field with gold botanical emblem, pointed bottom handled by geometry. */
export function bannerTexture(): THREE.CanvasTexture {
  return makeTexture(256, 384, (ctx) => {
    ctx.fillStyle = '#173b2b'
    ctx.fillRect(0, 0, 256, 384)
    // fabric shading
    const grad = ctx.createLinearGradient(0, 0, 256, 0)
    grad.addColorStop(0, 'rgba(0,0,0,0.25)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.06)')
    grad.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 384)
    // gold border
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 5
    ctx.strokeRect(14, 14, 228, 356)
    // emblem: elongated leaf with branching veins
    ctx.save()
    ctx.translate(128, 185)
    ctx.strokeStyle = GOLD
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(0, 110)
    ctx.quadraticCurveTo(62, 20, 0, -120)
    ctx.quadraticCurveTo(-62, 20, 0, 110)
    ctx.stroke()
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(0, 110)
    ctx.lineTo(0, -110)
    ctx.stroke()
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const y = 70 - i * 42
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.quadraticCurveTo(s * 26, y - 10, s * 38, y - 34)
        ctx.stroke()
      }
    }
    ctx.restore()
  })
}

/** Framed mountain sketch (sepia ink on aged paper). */
export function sketchTexture(): THREE.CanvasTexture {
  return makeTexture(384, 288, (ctx) => {
    ctx.fillStyle = '#d9c9a3'
    ctx.fillRect(0, 0, 384, 288)
    // aging blotches
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(150,120,70,${Math.random() * 0.12})`
      ctx.beginPath()
      ctx.arc(Math.random() * 384, Math.random() * 288, 10 + Math.random() * 30, 0, Math.PI * 2)
      ctx.fill()
    }
    const ink = 'rgba(70,50,32,0.85)'
    ctx.strokeStyle = ink
    // mountain silhouettes
    const ridge = (baseY: number, peaks: number[], alpha: number) => {
      ctx.strokeStyle = `rgba(70,50,32,${alpha})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(10, baseY)
      peaks.forEach((px, i) => {
        const x = 10 + (i + 0.5) * (364 / peaks.length)
        ctx.lineTo(x, baseY - px)
        ctx.lineTo(10 + (i + 1) * (364 / peaks.length), baseY - px * 0.25)
      })
      ctx.stroke()
    }
    ridge(150, [110, 70, 95], 0.9)
    ridge(190, [50, 80, 40, 60], 0.6)
    ridge(225, [30, 45, 28, 38, 24], 0.4)
    // pine trees along the bottom
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.6
    for (let i = 0; i < 14; i++) {
      const x = 20 + i * 26 + Math.random() * 8
      const h = 22 + Math.random() * 18
      const y = 262
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y - h)
      for (let b = 0; b < 4; b++) {
        const by = y - h * (0.25 + b * 0.2)
        const bw = (h / 4) * (1 - b * 0.18)
        ctx.moveTo(x, by)
        ctx.lineTo(x - bw, by + 7)
        ctx.moveTo(x, by)
        ctx.lineTo(x + bw, by + 7)
      }
      ctx.stroke()
    }
    // compass rose top-right
    ctx.save()
    ctx.translate(340, 42)
    ctx.strokeStyle = ink
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(0, 0, 18, 0, Math.PI * 2)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const len = i % 2 === 0 ? 16 : 9
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
      ctx.stroke()
    }
    ctx.restore()
  })
}

/** Round table top: aged green with brass etched rings and rune ticks. */
export function tableTopTexture(): THREE.CanvasTexture {
  return makeTexture(512, 512, (ctx) => {
    const c = 256
    ctx.fillStyle = '#234139'
    ctx.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 1200; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 252
      ctx.fillStyle = `rgba(${30 + Math.random() * 40},${70 + Math.random() * 35},${55 + Math.random() * 30},0.2)`
      ctx.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 3, 3)
    }
    ctx.strokeStyle = '#d8b25e'
    for (const [r, w] of [
      [248, 8],
      [236, 2.5],
      [150, 4],
      [140, 2],
      [86, 3],
    ] as const) {
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.arc(c, c, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    // radial spokes between rings
    ctx.lineWidth = 2
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(c + Math.cos(a) * 152, c + Math.sin(a) * 152)
      ctx.lineTo(c + Math.cos(a) * 234, c + Math.sin(a) * 234)
      ctx.stroke()
    }
    // rune ticks in inner ring
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(c + Math.cos(a) * 88, c + Math.sin(a) * 88)
      ctx.lineTo(c + Math.cos(a + 0.05) * 138, c + Math.sin(a + 0.05) * 138)
      ctx.stroke()
    }
  })
}

/** Simple aged-paper map texture for cabinet blueprints / scrolls. */
export function paperTexture(): THREE.CanvasTexture {
  return makeTexture(128, 160, (ctx) => {
    ctx.fillStyle = '#d3c096'
    ctx.fillRect(0, 0, 128, 160)
    ctx.strokeStyle = 'rgba(80,58,36,0.8)'
    ctx.lineWidth = 1.5
    // geometric diagram
    ctx.beginPath()
    ctx.arc(64, 70, 40, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(64, 30)
    ctx.lineTo(99, 90)
    ctx.lineTo(29, 90)
    ctx.closePath()
    ctx.stroke()
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.moveTo(20, 125 + i * 7)
      ctx.lineTo(108, 125 + i * 7)
      ctx.stroke()
    }
  })
}
