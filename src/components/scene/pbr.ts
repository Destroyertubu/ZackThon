import * as THREE from 'three'

/*
 * PBR texture sets downloaded from Poly Haven (CC0), served from /textures.
 * All maps share one THREE.Texture source per URL; clones only carry
 * different repeat/offset so GPU memory stays at one copy per file.
 */

const BASE = '/textures/'
const loader = new THREE.TextureLoader()

const sourceCache = new Map<string, THREE.Texture>()

function source(file: string, srgb: boolean): THREE.Texture {
  const key = file + (srgb ? '|s' : '|l')
  let t = sourceCache.get(key)
  if (!t) {
    t = loader.load(BASE + file)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    sourceCache.set(key, t)
  }
  return t
}

function repeatClone(t: THREE.Texture, rx: number, ry: number): THREE.Texture {
  const c = t.clone()
  c.repeat.set(rx, ry)
  c.needsUpdate = true
  return c
}

export interface PbrMaps {
  map?: THREE.Texture
  roughnessMap?: THREE.Texture
  normalMap?: THREE.Texture
}

interface SetFiles {
  diff?: string
  rough?: string
  nor?: string
}

/** Build a map set with a given tiling. */
export function pbrMaps(files: SetFiles, rx = 1, ry = 1): PbrMaps {
  const out: PbrMaps = {}
  if (files.diff) out.map = repeatClone(source(files.diff, true), rx, ry)
  if (files.rough) out.roughnessMap = repeatClone(source(files.rough, false), rx, ry)
  if (files.nor) out.normalMap = repeatClone(source(files.nor, false), rx, ry)
  return out
}

/* ------- named texture sets ------- */
export const SETS = {
  floorDeck: {
    diff: 'wood_floor_deck_diff_1k.jpg',
    rough: 'wood_floor_deck_rough_1k.jpg',
    nor: 'wood_floor_deck_nor_gl_1k.jpg',
  },
  darkPlanks: {
    diff: 'dark_wooden_planks_diff_1k.jpg',
    rough: 'dark_wooden_planks_rough_1k.jpg',
    nor: 'dark_wooden_planks_nor_gl_1k.jpg',
  },
  walnut: {
    diff: 'wood_table_001_diff_1k.jpg',
    rough: 'wood_table_001_rough_1k.jpg',
    nor: 'wood_table_001_nor_gl_1k.jpg',
  },
  plaster: {
    diff: 'plastered_wall_04_diff_1k.jpg',
    rough: 'plastered_wall_04_rough_1k.jpg',
    nor: 'plastered_wall_04_nor_gl_1k.jpg',
  },
  rock: {
    diff: 'rock_face_diff_1k.jpg',
    rough: 'rock_face_rough_1k.jpg',
    nor: 'rock_face_nor_gl_1k.jpg',
  },
  leather: {
    diff: 'leather_red_02_coll1_1k.jpg',
    rough: 'leather_red_02_rough_1k.jpg',
    nor: 'leather_red_02_nor_gl_1k.jpg',
  },
  fabric: {
    rough: 'fabric_pattern_07_rough_1k.jpg',
    nor: 'fabric_pattern_07_nor_gl_1k.jpg',
  },
} as const

/** Warm plaster wall material; repeat scales with wall size so texel density stays even. */
export function plasterMaterial(w: number, h: number): THREE.MeshStandardMaterial {
  const m = pbrMaps(SETS.plaster, Math.max(1, w / 2.2), Math.max(1, h / 2.2))
  return new THREE.MeshStandardMaterial({
    ...m,
    color: '#c4a87e', // warm beige tint over the neutral plaster
    roughness: 1,
    normalScale: new THREE.Vector2(0.6, 0.6),
  })
}

/** Dark stained structural timber (beams, posts, frames). */
export function timberMaterial(w = 1, h = 1): THREE.MeshStandardMaterial {
  const m = pbrMaps(SETS.walnut, w, h)
  return new THREE.MeshStandardMaterial({
    ...m,
    color: '#a37e55',
    roughness: 1,
    normalScale: new THREE.Vector2(0.7, 0.7),
    envMapIntensity: 0.55,
  })
}

/** Fine furniture walnut (desk tops, cabinet frames, chairs). */
export function walnutMaterial(rx = 1, ry = 1, tint = '#c6a077'): THREE.MeshStandardMaterial {
  const m = pbrMaps(SETS.walnut, rx, ry)
  return new THREE.MeshStandardMaterial({
    ...m,
    color: tint,
    roughness: 1,
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 0.7,
  })
}

/** Dark plank panels (cabinet carcass, chests, pedestal). */
export function darkPlankMaterial(rx = 1, ry = 1, tint = '#9a7c58'): THREE.MeshStandardMaterial {
  const m = pbrMaps(SETS.darkPlanks, rx, ry)
  return new THREE.MeshStandardMaterial({
    ...m,
    color: tint,
    roughness: 1,
    normalScale: new THREE.Vector2(0.8, 0.8),
    envMapIntensity: 0.5,
  })
}

/** Green velvet — fabric weave comes from the bump maps, color stays deep green. */
export function velvetMaterial(color = '#1e4634', rx = 1, ry = 1): THREE.MeshStandardMaterial {
  const m = pbrMaps(SETS.fabric, rx, ry)
  return new THREE.MeshStandardMaterial({
    ...m,
    color,
    roughness: 1,
    normalScale: new THREE.Vector2(0.45, 0.45),
    envMapIntensity: 0.35,
  })
}

/** Leather-bound book cover. Tint is brightened so dark spines stay readable. */
export function leatherBookMaterial(color: string): THREE.MeshStandardMaterial {
  const m = pbrMaps(SETS.leather, 1.5, 1.5)
  const c = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35)
  return new THREE.MeshStandardMaterial({
    ...m,
    color: c,
    roughness: 1,
    normalScale: new THREE.Vector2(0.5, 0.5),
    envMapIntensity: 0.6,
  })
}

/** Rough stone (foundation, porch steps). */
export function stoneMaterial(rx = 1, ry = 1): THREE.MeshStandardMaterial {
  const m = pbrMaps(SETS.rock, rx, ry)
  return new THREE.MeshStandardMaterial({
    ...m,
    color: '#8d8478',
    roughness: 1,
    normalScale: new THREE.Vector2(0.8, 0.8),
  })
}
