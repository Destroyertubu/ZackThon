import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Point = [number, number, number]
export type IvyLeaf = { position: THREE.Vector3; rotation: THREE.Euler; size: number; color: THREE.Color }

/** Six photographed green leaves occupy the first two rows of LeafSet029. */
export function makeIvyLeaf(variant: number): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = []
  const column = variant % 3, row = Math.floor(variant / 3)
  // Atlas leaves point right. Rotate their UV mapping so the botanical stem
  // attaches at (0,0,0), while the pointed tip grows along local +Y.
  for (const y of [-.19, .81]) for (const x of [-.5, 0, .5]) {
    positions.push(x, y, x === 0 ? .055 : -.035)
    uv.push(column / 3 + (y + .19) * .313 + .010,
      1 - (row / 3 + (x + .5) * .314 + .01))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex([0, 1, 3, 1, 4, 3, 1, 2, 4, 2, 5, 4])
  geometry.computeVertexNormals()
  return geometry
}

export function makeGardenIvy(doorPosition: Point) {
  const leaves: IvyLeaf[][] = Array.from({ length: 6 }, () => [])
  const vines: THREE.BufferGeometry[] = []
  let state = 927411
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 }
  const add = (points: Point[], count: number, yaw: number, roll: number, radius = .009, leafSize = .23) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)))
    const length = curve.getLength()
    vines.push(new THREE.TubeGeometry(curve, Math.max(10, Math.ceil(length * 13)), radius, 5, false))
    for (let index = 0; index < count; index++) {
      const t = (index + random() * .7) / count
      const position = curve.getPoint(t)
      position.x += (random() - .5) * .035; position.z += (random() - .5) * .05
      leaves[index % 6].push({
        position,
        rotation: new THREE.Euler((random() - .5) * 1.0, yaw + (random() - .5) * .8,
          roll + (index % 2 ? -.85 : .85) + (random() - .5) * .5),
        size: leafSize * (.75 + random() * .48),
        color: new THREE.Color().setRGB(.76 + random() * .24, .82 + random() * .18, .64 + random() * .25),
      })
    }
  }

  // Two overlapping ribbons let leaves sit above and below the beam instead
  // of forming a flat curtain. Short tendrils below create a broken silhouette.
  for (let layer = 0; layer < 2; layer++) {
    const y = 3.77 + layer * .13, z = 3.92 - layer * .07
    add([[-8.7, y, z], [-7.65, y + .07, z + .05], [-6.5, y - .04, z], [-5.45, y + .05, z - .03], [-4.56, y, z]], 150, 0, layer ? 0 : Math.PI, .012, .255)
    add([[-4.56, y, -1.10], [-4.50, y + .04, .2], [-4.58, y - .05, 1.4], [-4.49, y + .05, 2.7], [-4.56, y, 3.95]], 170, Math.PI / 2, layer ? 0 : Math.PI, .011, .25)
  }
  for (const x of [-8.65, -4.58]) {
    add([[x, .26, 4.03], [x + .11, 1.1, 4.00], [x - .10, 2.0, 4.04], [x + .08, 2.95, 4.02], [x, 3.83, 3.98]], 140, 0, .05, .011, .255)
  }
  for (let index = 0; index < 5; index++) {
    const x = -8.27 + index * .83, drop = [.74, .42, .62, .96, .53][index]
    add([[x, 3.83, 3.94], [x + .1, 3.55, 4.02], [x - .05, 3.83 - drop, 4.06]], 40, .12, Math.PI, .0045, .19)
  }
  for (let index = 0; index < 4; index++) {
    const z = -.66 + index * 1.13, drop = [.56, .77, .45, .63][index]
    add([[-4.52, 3.82, z], [-4.44, 3.5, z + .06], [-4.38, 3.82 - drop, z - .08]], 34, Math.PI / 2, Math.PI, .0045, .18)
  }

  const doorYaw = -.25
  const door = (x: number, y: number, z: number): Point => [
    doorPosition[0] + Math.cos(doorYaw) * x + Math.sin(doorYaw) * z,
    doorPosition[1] + y,
    doorPosition[2] - Math.sin(doorYaw) * x + Math.cos(doorYaw) * z,
  ]
  // Leaves point outward from the 1.5 m door frame. Their small basal lobes
  // stop at ±0.70 m, beyond the central opening and the interaction label.
  for (const side of [-1, 1]) {
    add([door(side * .80, .15, .08), door(side * .82, .78, .10), door(side * .79, 1.5, .07), door(side * .83, 2.17, .08), door(side * .78, 2.47, .02)],
      72, doorYaw, -side * Math.PI / 2, .008, .17)
  }
  add([door(-.79, 2.47, .03), door(-.42, 2.57, .04), door(0, 2.60, .02), door(.43, 2.56, .04), door(.79, 2.47, .03)], 90, doorYaw, .08, .009, .19)

  const branches = mergeGeometries(vines, false)!
  vines.forEach(geometry => geometry.dispose())
  const leafCount = leaves.reduce((count, items) => count + items.length, 0)
  const branchTriangles = branches.index!.count / 3
  return { branches, leaves, leafCount, branchTriangles, triangles: branchTriangles + leafCount * 4 }
}
