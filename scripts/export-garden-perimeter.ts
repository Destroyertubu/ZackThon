import { mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { createGardenPerimeter, perimeterLeafGeometry } from '../src/components/observatory/gardenPerimeterGeometry'
import { GARDEN_PERIMETER_BEDS, GARDEN_PERIMETER_PERGOLAS } from '../src/components/observatory/gardenPerimeterLayout'

// GLTFExporter uses this small browser API for its output buffer; all source geometry stays editable TypeScript.
class ExportFileReader {
  result: ArrayBuffer | string | null = null
  onloadend?: () => void
  readAsArrayBuffer(blob: Blob) { void blob.arrayBuffer().then(buffer => { this.result = buffer; this.onloadend?.() }) }
  readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onloadend?.() }) }
}
Object.defineProperty(globalThis, 'FileReader', { value: ExportFileReader, configurable: true })

const output = path.resolve('public/models/garden/courtyard')
await mkdir(output, { recursive: true })
const colors = { walnut: '#765639', stone: '#c6c5b6', brass: '#bd9756', soil: '#34372b', contact: '#070d10', stem: '#667049' }
const reports = []
for (const detail of ['fine', 'smooth'] as const) {
  const model = createGardenPerimeter(detail), group = new THREE.Group()
  group.name = `Star_Tide_Courtyard_${detail}`
  group.userData = { units: 'metres', source: 'src/components/observatory/gardenPerimeterGeometry.ts', artDirection: 'pearl stone, walnut, brass, botanical crescent' }
  let staticTriangles = 0, plantTriangles = 0
  for (const [key, geometry] of Object.entries(model.geometry)) {
    const material = new THREE.MeshStandardMaterial({ name: key, color: colors[key as keyof typeof colors], roughness: key === 'brass' ? .43 : .7, metalness: key === 'brass' ? .83 : 0 })
    const mesh = new THREE.Mesh(geometry, material); mesh.name = key
    if (key === 'contact') { material.transparent = true; material.opacity = .25 }
    group.add(mesh); staticTriangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3
  }
  for (const [name, plants] of [['shrub_leaves', model.leaves], ['fern_pinnae', model.fernLeaves], ['wisteria_petals', model.petals]] as const) {
    const geometry = perimeterLeafGeometry(name !== 'fern_pinnae')
    const material = new THREE.MeshStandardMaterial({ name, color: '#ffffff', roughness: .75, side: THREE.DoubleSide })
    const mesh = new THREE.InstancedMesh(geometry, material, plants.length); mesh.name = name
    plants.forEach((plant, index) => { mesh.setMatrixAt(index, plant.matrix); mesh.setColorAt(index, plant.color) })
    mesh.instanceMatrix.needsUpdate = true; group.add(mesh); plantTriangles += plants.length * 6
  }
  const result = await new GLTFExporter().parseAsync(group, { binary: true, onlyVisible: true })
  const filename = `star-tide-courtyard-${detail}.glb`
  await writeFile(path.join(output, filename), Buffer.from(result as ArrayBuffer))
  reports.push({ tier: detail, file: filename, bytes: (await stat(path.join(output, filename))).size, staticTriangles, plantTriangles,
    shrubs: model.leaves.length, fernPinnae: model.fernLeaves.length, petals: model.petals.length, drawCalls: 12 })
  group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); if (!Array.isArray(object.material)) object.material.dispose() } })
}
await writeFile(path.join(output, 'provenance.json'), JSON.stringify({
  name: 'Star Tide Courtyard / 星潮庭院', created: '2026-09-14',
  author: 'Wanderwise project — authored for this implementation',
  source: ['src/components/observatory/gardenPerimeterGeometry.ts', 'src/components/observatory/gardenPerimeterLayout.ts', 'scripts/export-garden-perimeter.ts'],
  license: 'Project-authored geometry; no third-party geometry or textures are embedded in these GLB files.',
  runtime: 'The browser uses the same parameterized geometry builder, combined with the already-credited observatory PBR material library. Exported GLB is an editable exchange asset, not downloaded by the scene.',
  processing: 'Swept bevel profiles, carved tube corbels, small folded leaf instances, merged material batches. Export carries instanced geometry with EXT_mesh_gpu_instancing; no lights, cameras or videos are embedded.',
  beds: GARDEN_PERIMETER_BEDS, pergolas: GARDEN_PERIMETER_PERGOLAS, reports,
}, null, 2) + '\n')
console.log(JSON.stringify(reports, null, 2))
