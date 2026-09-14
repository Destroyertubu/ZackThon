import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { GARDEN_PERIMETER_BEDS, GARDEN_PERIMETER_COLUMNS, GARDEN_PERIMETER_LAMPS, GARDEN_PERIMETER_PERGOLAS, perimeterPoint } from './gardenPerimeterLayout'

export type PerimeterMaterial = 'walnut' | 'stone' | 'brass' | 'soil' | 'contact' | 'stem'
export type PerimeterPlant = { matrix: THREE.Matrix4; color: THREE.Color }
export type PerimeterLamp = { position: [number, number, number]; hanging: boolean }

/** Bevelled, continuous curved joinery. Cross-section points are radial offset / height. */
function sweepArc(start: number, end: number, radius: number, profile: readonly [number, number][]) {
  const steps = Math.max(8, Math.ceil((end - start) * radius * 3.4)), n = profile.length
  const vertices: number[] = [], uvs: number[] = [], indices: number[] = []
  for (let step = 0; step <= steps; step++) {
    const a = start + (end - start) * step / steps
    for (let j = 0; j < n; j++) {
      vertices.push(...perimeterPoint(a, radius + profile[j][0], profile[j][1]))
      uvs.push((a - start) * radius / 2.4, j / (n - 1))
      if (step < steps) {
        const k = step * n + j, next = step * n + (j + 1) % n
        indices.push(k, k + n, next, next, k + n, next + n)
      }
    }
  }
  // Convex profile end caps. Separate ends remain visibly finished at every sea opening.
  for (let j = 1; j < n - 1; j++) {
    indices.push(0, j, j + 1)
    const b = steps * n; indices.push(b, b + j + 1, b + j)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  return geometry
}

function bevelProfile(width: number, bottom: number, top: number, bevel = .025): [number, number][] {
  const half = width / 2, b = Math.min(bevel, width / 4, (top - bottom) / 4)
  return [[-half + b, bottom], [half - b, bottom], [half, bottom + b], [half, top - b],
    [half - b, top], [-half + b, top], [-half, top - b], [-half, bottom + b]]
}

function merge(parts: THREE.BufferGeometry[]) {
  const flat = parts.map(p => p.index ? p.toNonIndexed() : p)
  const merged = mergeGeometries(flat, false)!
  const output = mergeVertices(merged, .00001)
  new Set([...parts, ...flat, merged]).forEach(p => p.dispose()); output.computeBoundingSphere()
  return output
}

function seeded(seed: number) {
  let state = seed
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
}

/** Sculpted folded leaf: six triangles, true curved silhouette without large alpha cards. */
export function perimeterLeafGeometry(wide = false) {
  const w = wide ? .34 : .14
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -w, .30, -.016, 0, .38, .08, w, .30, -.016,
    -w * .7, .68, .004, 0, 1, .025, w * .7, .68, .004,
  ], 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([.5, 0, 0, .3, .5, .38, 1, .3, .15, .68, .5, 1, .85, .68], 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3, 1, 4, 2, 4, 5, 2, 2, 5, 6, 2, 6, 3])
  geometry.computeVertexNormals(); return geometry
}

/** The same editable builder supplies the live courtyard and the exported GLB. No baked screenshot mesh. */
export function createGardenPerimeter(detail: 'fine' | 'smooth' = 'fine') {
  const parts: Record<PerimeterMaterial, THREE.BufferGeometry[]> = { walnut: [], stone: [], brass: [], soil: [], contact: [], stem: [] }
  const random = seeded(14092026), transform = new THREE.Object3D()
  const leaves: PerimeterPlant[] = [], fernLeaves: PerimeterPlant[] = [], petals: PerimeterPlant[] = []
  const addPlant = (collection: PerimeterPlant[], p: THREE.Vector3, rotation: [number, number, number], scale: [number, number, number], color: string) => {
    transform.position.copy(p); transform.rotation.set(...rotation); transform.scale.set(...scale); transform.updateMatrix()
    collection.push({ matrix: transform.matrix.clone(), color: new THREE.Color(color).multiplyScalar(.76 + random() * .3) })
  }
  const addBranch = (points: THREE.Vector3[], radius = .009, segments = 10) => {
    parts.stem.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 4, false))
  }
  const addBox = (key: PerimeterMaterial, p: [number, number, number], dimensions: [number, number, number], yaw = 0, bevel = .025) => {
    const g = bevel <= .005 ? new THREE.BoxGeometry(...dimensions) : new RoundedBoxGeometry(...dimensions, 1, bevel)
    g.rotateY(yaw); g.translate(...p); parts[key].push(g)
  }
  for (const arc of GARDEN_PERIMETER_BEDS) {
    const { start, end, inner, outer, height } = arc, mid = (inner + outer) / 2
    parts.contact.push(sweepArc(start - .004, end + .004, mid, bevelProfile(outer - inner + .26, .002, .008, .001)))
    parts.soil.push(sweepArc(start, end, mid, bevelProfile(outer - inner - .1, .07, height - .09)))
    for (const radius of [inner + .065, outer - .065]) {
      parts.walnut.push(sweepArc(start, end, radius, bevelProfile(.13, .06, height - .03)))
      parts.stone.push(sweepArc(start - .004, end + .004, radius, bevelProfile(.23, height - .04, height + .045)))
      parts.brass.push(sweepArc(start, end, radius - .121, bevelProfile(.016, height - .04, height - .012, .004)))
      const staves = Math.ceil((end - start) * radius / .35)
      for (let i = 1; i < staves; i++) {
        const a = start + (end - start) * i / staves
        addBox('brass', perimeterPoint(a, radius + (radius < mid ? -.07 : .07), height / 2), [.012, height - .13, .012], a, .002)
      }
    }
    for (const a of [start, end]) addBox('walnut', perimeterPoint(a, mid, height / 2), [.14, height, outer - inner], a)

    // Layer 1: low fern crowns along the inside lip. Every pinnate leaf is a small folded surface.
    const fernCount = Math.ceil((end - start) * mid / (detail === 'fine' ? .69 : .96))
    for (let i = 0; i < fernCount; i++) {
      const a = start + .02 + (end - start - .04) * (i + random() * .3) / fernCount
      const base = new THREE.Vector3(...perimeterPoint(a, inner + .27 + random() * .13, height - .07))
      for (let frond = 0; frond < 5; frond++) {
        const yaw = frond * 2.399 + a, length = .44 + random() * .3
        const tip = base.clone().add(new THREE.Vector3(Math.cos(yaw) * length * .82, length * .7, Math.sin(yaw) * length * .82))
        const curve = new THREE.CatmullRomCurve3([base, base.clone().lerp(tip, .5).add(new THREE.Vector3(0, .17, 0)), tip])
        parts.stem.push(new THREE.TubeGeometry(curve, 4, .0045, 3))
        for (let j = 1; j <= 7; j++) for (const side of [-1, 1]) {
          const t = j / 8, p = curve.getPoint(t), size = Math.sin(t * Math.PI) * .15 + .028
          addPlant(fernLeaves, p, [.40 + t * .3, -yaw + Math.PI / 2, side * (.9 - t * .15)], [size, size * 1.65, size], i % 3 ? '#77945b' : '#536d4b')
        }
      }
    }

    // Layer 2: staggered woody shrubs, with offset branch forks instead of repeated crown spheres.
    const shrubCount = Math.ceil((end - start) * mid / (detail === 'fine' ? 1.0 : 1.35))
    for (let i = 0; i < shrubCount; i++) {
      const a = start + .045 + (end - start - .09) * (i + .4 + random() * .3) / shrubCount
      const base = new THREE.Vector3(...perimeterPoint(a, mid + .1 + random() * .25, height - .1))
      const tall = arc.id === 'home-garden' ? .87 + random() * .90 : .65 + random() * .75
      for (let branch = 0; branch < 5; branch++) {
        const yaw = branch * 2.39996 + a, tip = base.clone().add(new THREE.Vector3(Math.cos(yaw) * .41, tall * (.55 + random() * .45), Math.sin(yaw) * .41))
        addBranch([base, base.clone().lerp(tip, .42).add(new THREE.Vector3(0, .16, 0)), tip], .011, 5)
        const count = detail === 'fine' ? 13 : 9
        for (let j = 0; j < count; j++) {
          const t = .3 + .7 * j / count, p = base.clone().lerp(tip, t)
          p.x += (random() - .5) * .31; p.y += random() * .15; p.z += (random() - .5) * .31
          const size = .14 + random() * .14
          addPlant(leaves, p, [.4 + random() * 1.2, yaw + random() * 1.4, (random() - .5) * 1.9], [size, size, size], i % 5 ? '#617b51' : '#7b6788')
        }
        if ((i + branch) % 3 === 0) for (let flower = 0; flower < 3; flower++) {
          const centre = tip.clone().add(new THREE.Vector3((random() - .5) * .2, random() * .13, (random() - .5) * .2))
          for (let petal = 0; petal < 5; petal++) addPlant(petals, centre, [.85, petal * Math.PI * 2 / 5, .6], [.115, .12, .12], i % 4 ? '#c7b8e0' : '#eee9d8')
        }
      }
    }
  }

  for (const arc of GARDEN_PERIMETER_PERGOLAS) {
    for (const radius of [arc.inner, arc.outer]) {
      parts.walnut.push(sweepArc(arc.start - .014, arc.end + .014, radius, bevelProfile(.17, arc.height - .12, arc.height + .13)))
      parts.brass.push(sweepArc(arc.start - .013, arc.end + .013, radius - .089, bevelProfile(.012, arc.height - .06, arc.height - .035, .003)))
    }
    const rafters = Math.ceil((arc.end - arc.start) * 10.5 / .6)
    for (let i = 0; i <= rafters; i++) {
      const a = arc.start + (arc.end - arc.start) * i / rafters
      const points = Array.from({ length: 7 }, (_, j) => new THREE.Vector3(...perimeterPoint(a, arc.inner - .14 + (arc.outer - arc.inner + .28) * j / 6, arc.height + .12 + Math.sin(j / 6 * Math.PI) * .12)))
      parts.walnut.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, .059, 4, false))
    }
    // Layer 3: vines drape around the joinery; hanging racemes break up the sky silhouette.
    const vines = Math.ceil((arc.end - arc.start) * 10.4 / (detail === 'fine' ? .46 : .70))
    for (let i = 0; i < vines; i++) {
      const a = arc.start + .018 + (arc.end - arc.start - .036) * (i + .3) / vines
      const top = new THREE.Vector3(...perimeterPoint(a, arc.inner + .12, arc.height + .15))
      const drop = .4 + random() * .63
      const end = top.clone().add(new THREE.Vector3(.08 * Math.sin(a), -drop, .07 * Math.cos(a)))
      addBranch([top, top.clone().lerp(end, .5).add(new THREE.Vector3(.055, 0, .025)), end], .007, 7)
      for (let j = 0; j < 12; j++) {
        const p = top.clone().lerp(end, j / 12), radius = (.125 - j * .007)
        for (let k = 0; k < 4; k++) {
          const angle = k * Math.PI / 2 + j * 1.3, size = .09 - j * .0025
          const q = p.clone().add(new THREE.Vector3(Math.cos(angle) * radius, (random() - .5) * .04, Math.sin(angle) * radius))
          addPlant(petals, q, [2.5, angle, (random() - .5) * .4], [size * 1.1, size, size], i % 5 ? '#b49bc8' : '#ebe1ea')
        }
      }
      // Small overlapping leaves soften both faces of the beam instead of a row of oversized cards.
      for (let j = 0; j < 24; j++) {
        const p = top.clone().add(new THREE.Vector3((random() - .5) * .38, random() * .13, (random() - .5) * .32))
        const size = .11 + random() * .07
        addPlant(leaves, p, [.35 + random() * 1.25, random() * Math.PI * 2, random() * 1.4], [size, size, size], j % 5 ? '#647c51' : '#8a9768')
      }
    }
  }

  for (const position of GARDEN_PERIMETER_COLUMNS) {
    const a = Math.atan2(position[0], position[2])
    addBox('stone', [position[0], .15, position[2]], [.4, .3, .4], a, .045)
    addBox('walnut', [position[0], 1.96, position[2]], [.18, 3.62, .18], a, .022)
    for (const y of [.39, 3.4]) addBox('brass', [position[0], y, position[2]], [.205, .09, .205], a, .012)
    // Carved, sweeping corbels follow the bay tangent and support the curved beam.
    for (const side of [-1, 1]) {
      const p0 = new THREE.Vector3(position[0], 2.9, position[2])
      const p1 = p0.clone().add(new THREE.Vector3(side * Math.cos(a) * .24, .15, -side * Math.sin(a) * .24))
      const p2 = p0.clone().add(new THREE.Vector3(side * Math.cos(a) * .62, .80, -side * Math.sin(a) * .62))
      parts.walnut.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), 14, .055, 6))
    }
    // Two thin climbing stems tie the lower planting to the overhead canopy.
    // Leaves stay close to the column, safely inside its raised bed footprint.
    for (let vine = 0; vine < 2; vine++) {
      const points = Array.from({ length: 18 }, (_, j) => {
        const t = j / 17, turn = t * Math.PI * 3.4 + vine * Math.PI + a
        return new THREE.Vector3(position[0] + Math.sin(turn) * .135, .56 + t * 3.38, position[2] + Math.cos(turn) * .135)
      })
      const curve = new THREE.CatmullRomCurve3(points)
      parts.stem.push(new THREE.TubeGeometry(curve, 28, .007, 4))
      const count = detail === 'fine' ? 51 : 35
      for (let j = 0; j < count; j++) {
        const t = (j + random() * .6) / count, p = curve.getPoint(t), turn = t * Math.PI * 3.4 + vine * Math.PI + a
        const size = .11 + random() * .08
        addPlant(leaves, p, [.55 + random() * .5, -turn, (j % 2 ? -.8 : .8)], [size, size, size], j % 4 ? '#637b52' : '#a2a579')
      }
    }
  }
  // A curved connector physically joins the old bar roof to the new woodland arcade.
  const connector = new THREE.CatmullRomCurve3([new THREE.Vector3(-8.7, 3.69, -1.1), new THREE.Vector3(-9.34, 3.81, -.66), new THREE.Vector3(...perimeterPoint(4.70, 9.84, 3.82))])
  parts.walnut.push(new THREE.TubeGeometry(connector, 20, .11, 8))
  return {
    geometry: Object.fromEntries(Object.entries(parts).map(([name, list]) => [name, merge(list)])) as Record<PerimeterMaterial, THREE.BufferGeometry>,
    leaves, fernLeaves, petals, lamps: GARDEN_PERIMETER_LAMPS as PerimeterLamp[],
  }
}
