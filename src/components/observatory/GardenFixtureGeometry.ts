import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { pbrMaps } from '../scene/pbr'

export function createFixtureFabric(color: string, repeat: [number, number] = [2, 2]) {
  return new THREE.MeshStandardMaterial({
    ...pbrMaps({ diff: 'garden-fixtures/poly_wool_herringbone_diff_1k.jpg', nor: 'garden-fixtures/poly_wool_herringbone_nor_gl_1k.jpg', rough: 'garden-fixtures/poly_wool_herringbone_rough_1k.jpg' }, ...repeat),
    color, roughness: 1, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.35, side: THREE.DoubleSide,
  })
}

export function disposeFixtureFabric(material: THREE.MeshStandardMaterial) {
  material.map?.dispose(); material.normalMap?.dispose(); material.roughnessMap?.dispose(); material.dispose()
}

/** A continuous drape follows the back, seat and drop over the front edge. */
export function createThrowGeometry() {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.96, -0.37), new THREE.Vector3(0, 1.14, -0.26),
    new THREE.Vector3(0, 0.80, -0.12), new THREE.Vector3(0, 0.586, 0.05),
    new THREE.Vector3(0, 0.579, 0.25), new THREE.Vector3(0, 0.49, 0.30), new THREE.Vector3(0, 0.2, 0.34),
  ])
  const width = 0.936, benchRadius = 2.54
  const aroundBench = (x: number, y: number, z: number) => {
    const angle = x / benchRadius, radius = benchRadius + z
    return new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius - benchRadius)
  }
  const w = 30, h = 64, positions: number[] = [], uvs: number[] = [], indices: number[] = []
  for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
    const u = i / w, v = j / h, center = path.getPoint(v), ripple = Math.sin(u * 35 + v * 2.7) * 0.015 + Math.sin(u * 19 - v * 8) * 0.006
    const point = aroundBench((u - 0.5) * width, center.y + ripple * (0.4 + v), center.z + Math.sin(u * 17) * 0.007)
    positions.push(point.x, point.y, point.z)
    uvs.push(u, v)
    if (i < w && j < h) { const a = j * (w + 1) + i; indices.push(a, a + 1, a + w + 1, a + 1, a + w + 2, a + w + 1) }
  }
  const cloth = new THREE.BufferGeometry()
  cloth.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); cloth.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); cloth.setIndex(indices); cloth.computeVertexNormals()
  const tassels: THREE.BufferGeometry[] = []
  for (let i = 0; i < 29; i++) {
    const x = (i / 28 - 0.5) * width, y = 0.2 + Math.sin(i * 1.2) * 0.018
    tassels.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      aroundBench(x, y, 0.34), aroundBench(x + Math.sin(i) * 0.012, y - 0.05, 0.344), aroundBench(x + Math.sin(i) * 0.008, y - 0.105, 0.347),
    ]), 6, 0.003, 4, false))
  }
  const fringe = mergeGeometries(tassels, false)!
  tassels.forEach(geometry => geometry.dispose())
  return { cloth, fringe }
}

export function arcSlab(inner: number, outer: number, start: number, end: number, depth: number) {
  const shape = new THREE.Shape(), segments = 64
  for (let i = 0; i <= segments; i++) {
    const a = start + (end - start) * i / segments, x = Math.sin(a) * outer, z = Math.cos(a) * outer
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z)
  }
  for (let i = segments; i >= 0; i--) { const a = start + (end - start) * i / segments; shape.lineTo(Math.sin(a) * inner, Math.cos(a) * inner) }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.018, bevelThickness: 0.012, steps: 1 })
  geometry.rotateX(Math.PI / 2)
  return geometry
}
