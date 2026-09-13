import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = relative => fs.readFileSync(path.join(root, relative))
const report = JSON.parse(read('artifacts/garden-assets/jacaranda-report.json'))
const measurements = JSON.parse(read('src/components/observatory/jacarandaMeasurements.json'))
const model = read('public/models/garden/jacaranda-mature.glb')
assert.equal(model.readUInt32LE(0), 0x46546c67)
assert.equal(model.readUInt32LE(8), model.length)
assert.ok(model.length < 16 * 1024 * 1024, 'runtime tree stays below 16 MiB')
const jsonLength = model.readUInt32LE(12)
const document = JSON.parse(model.subarray(20, 20 + jsonLength))
const binary = model.subarray(28 + jsonLength)
assert.equal(document.buffers[0].byteLength, binary.length)
const wasmModule = { exports: {} }
const decoderDirectory = path.join(root, 'public/models/garden/draco/')
new Function('module', 'exports', 'require', '__dirname', read('public/models/garden/draco/draco_wasm_wrapper.js').toString())(
  wasmModule, wasmModule.exports, createRequire(import.meta.url), decoderDirectory,
)
const draco = await wasmModule.exports({ wasmBinary: read('public/models/garden/draco/draco_decoder.wasm') })
const meshes = []
let triangles = 0
for (const mesh of document.meshes) {
  for (const primitive of mesh.primitives) {
    const extension = primitive.extensions.KHR_draco_mesh_compression
    const view = document.bufferViews[extension.bufferView]
    const bytes = binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)
    const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), decoded = new draco.Mesh()
    buffer.Init(bytes, bytes.length)
    const status = decoder.DecodeBufferToMesh(buffer, decoded)
    assert.ok(status.ok(), `local decoder can read ${mesh.name}`)
    assert.equal(decoded.num_faces() * 3, document.accessors[primitive.indices].count)
    const attributes = {}
    for (const name of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
      const attribute = decoder.GetAttributeByUniqueId(decoded, extension.attributes[name])
      const values = new draco.DracoFloat32Array()
      decoder.GetAttributeFloatForAllPoints(decoded, attribute, values)
      attributes[name] = Float32Array.from({ length: values.size() }, (_, index) => values.GetValue(index))
      assert.ok(attributes[name].every(Number.isFinite), `${mesh.name} ${name} is finite`)
      draco.destroy(values)
    }
    const material = document.materials[primitive.material]
    meshes.push({ name: material.name, positions: attributes.POSITION, triangles: decoded.num_faces() })
    triangles += decoded.num_faces()
    draco.destroy(decoded); draco.destroy(buffer); draco.destroy(decoder)
  }
}
assert.equal(triangles, report.totalTriangles)
assert.ok(triangles <= 500000)
const leaf = meshes.find(mesh => /leaves/.test(mesh.name))
assert.equal(leaf.triangles, 268168)
assert.equal(report.leafIslandsRetained, 116084)
assert.equal(report.leafIslandsRetained, report.leafIslands)
const leafMaterial = document.materials.find(material => /leaves/.test(material.name))
assert.equal(leafMaterial.alphaMode, 'MASK')
assert.equal(leafMaterial.doubleSided, true)
assert.equal(document.images[document.textures[leafMaterial.pbrMetallicRoughness.baseColorTexture.index].source].mimeType, 'image/png')
assert.equal(report.images.filter(image => image.size[0] === 2048 && /trunk/.test(image.name)).length, 3)
let minimumY = Infinity, maximumY = -Infinity, rootRadius = 0, lowWoodRadius = 0
for (const mesh of meshes) {
  for (let index = 0; index < mesh.positions.length; index += 3) {
    const [x, y, z] = mesh.positions.subarray(index, index + 3)
    minimumY = Math.min(minimumY, y); maximumY = Math.max(maximumY, y)
    if (!/leaves/.test(mesh.name)) {
      if (y < .1) rootRadius = Math.max(rootRadius, Math.hypot(x, z))
      if (y < 1.65) lowWoodRadius = Math.max(lowWoodRadius, Math.hypot(x, z))
    }
  }
}
assert.ok(Math.abs(minimumY) < .005, 'root touches soil instead of floating')
assert.ok(Math.abs(maximumY - 7.85) < .005, 'tree keeps 7.85 m height')
assert.ok(rootRadius < 2.12, 'all roots fit inside the fixed planter')
assert.ok(lowWoodRadius < 2.12, 'low wood stays inside the existing navigation obstacle')
function closestVertex(point, allowed) {
  let distanceSquared = Infinity
  for (const mesh of allowed) {
    const p = mesh.positions
    for (let index = 0; index < p.length; index += 3) {
      const next = (p[index] - point[0]) ** 2 + (p[index + 1] - point[1]) ** 2 + (p[index + 2] - point[2]) ** 2
      if (next < distanceSquared) distanceSquared = next
    }
  }
  return Math.sqrt(distanceSquared)
}
const wood = meshes.filter(mesh => !/leaves/.test(mesh.name))
assert.equal(measurements.hangingAnchors.length, 9)
const lampDistances = measurements.hangingAnchors.map(point => closestVertex(point, wood))
assert.ok(lampDistances.every(distance => distance < .003), 'all lamp roots touch decoded wood')
const trunk = meshes.filter(mesh => /trunk/.test(mesh.name))
assert.equal(measurements.jewelryPaths.length, 2)
const vineDistances = measurements.jewelryPaths.flatMap(route => route.map(point => closestVertex(point, trunk)))
assert.ok(vineDistances.every(distance => distance < .022), 'all vine samples remain within 22 mm of decoded bark')
for (const route of measurements.jewelryPaths) {
  assert.ok(route.length > 20, 'vine follows a measured route')
  for (let index = 1; index < route.length; index++) {
    assert.ok(Math.hypot(...route[index].map((value, axis) => value - route[index - 1][axis])) < .18, 'vine cannot jump between open forks')
  }
}
console.log(JSON.stringify({ result: 'passed', triangles, bytes: model.length, minimumY, maximumY, rootRadius, lowWoodRadius, maxLampSurfaceError: Math.max(...lampDistances), maxVineSurfaceDistance: Math.max(...vineDistances), vineSamples: vineDistances.length }, null, 2))
