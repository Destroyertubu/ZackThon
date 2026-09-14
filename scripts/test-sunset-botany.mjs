import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'

const read = file => fs.readFileSync(file)
const readGlb = file => {
  const data = read(file), size = data.readUInt32LE(12)
  assert.equal(data.readUInt32LE(8), data.length)
  return {document: JSON.parse(data.subarray(20, 20 + size)), binary: data.subarray(28 + size), bytes: data.length}
}
const manifest = JSON.parse(read('public/models/sunset-boulevard/botany/manifest.json'))
const directory = path.resolve('public/models/garden/draco') + '/'
const module = {exports: {}}
new Function('module', 'exports', 'require', '__dirname', read(directory + 'draco_wasm_wrapper.js').toString())(module, module.exports, createRequire(import.meta.url), directory)
const draco = await module.exports({wasmBinary: read(directory + 'draco_decoder.wasm')})
const sourceTree = readGlb('public/models/garden/tree-small-02-cards.glb')
const sourceShrub = {
  document: JSON.parse(read('assets/source/sunset-botany/shrub-01/shrub_01_1k.gltf')),
  binary: read('assets/source/sunset-botany/shrub-01/shrub_01.bin'),
}
const sourceFern = readGlb('public/models/garden/fern-02.glb')
const tolerance = .0002
const key = (x, y, z) => `${x},${y},${z}`
function sourcePoints(source, node, anchor, select) {
  const positions = [], translation = node.translation ?? [0, 0, 0], scale = node.scale ?? [1, 1, 1]
  for (const primitive of source.document.meshes[node.mesh].primitives) {
    const accessor = source.document.accessors[primitive.attributes.POSITION]
    const view = source.document.bufferViews[accessor.bufferView]
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? 12
    for (let index = 0; index < accessor.count; index++) {
      const point = [0, 1, 2].map(axis => source.binary.readFloatLE(offset + index * stride + axis * 4))
      if (select && !select(point)) continue
      positions.push(point.map((value, axis) => value * scale[axis] + translation[axis] - anchor[axis]))
    }
  }
  return positions
}
const reports = []
for (const asset of manifest.assets.filter(asset => !process.argv.includes('--only-fern') || asset.name === 'fern')) {
  const model = readGlb(asset.file)
  assert.equal(model.bytes, asset.bytes)
  assert.equal(model.document.animations?.length ?? 0, 0)
  assert.equal(model.document.cameras?.length ?? 0, 0)
  assert.ok(model.document.extensionsRequired.includes('KHR_draco_mesh_compression'))
  assert.ok(model.document.extensionsRequired.includes('EXT_texture_webp'))
  assert.equal(model.document.meshes.length, asset.name === 'street-tree' ? 3 : 1)
  assert.ok(model.bytes <= (asset.name === 'street-tree' ? 3_000_000 : 1_100_000))
  let triangles = 0, checkedVertices = 0, maxError = 0
  for (const node of model.document.nodes) {
    for (const field of ['matrix', 'translation', 'rotation', 'scale']) assert.equal(node[field], undefined, `${node.name}: static baked transform`)
    const source = asset.name === 'street-tree' ? sourceTree : asset.name === 'fern' ? sourceFern : sourceShrub
    const originalNode = asset.name === 'street-tree' ? source.document.nodes.find(row => row.name === node.name) : source.document.nodes[0]
    assert.ok(originalNode)
    const expected = sourcePoints(source, originalNode, asset.rootAnchorInSourceWorldYUp,
      asset.selection ? point => point[0] < asset.selection.sourceLocalXLessThan : undefined)
    const grid = new Map()
    for (const point of expected) {
      const cell = key(...point.map(value => Math.floor(value / tolerance)))
      if (!grid.has(cell)) grid.set(cell, [])
      grid.get(cell).push(point)
    }
    let partTriangles = 0
    for (const primitive of model.document.meshes[node.mesh].primitives) {
      const extension = primitive.extensions.KHR_draco_mesh_compression
      const view = model.document.bufferViews[extension.bufferView]
      const encoded = model.binary.subarray(view.byteOffset, view.byteOffset + view.byteLength)
      const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), mesh = new draco.Mesh()
      buffer.Init(encoded, encoded.length)
      assert.ok(decoder.DecodeBufferToMesh(buffer, mesh).ok())
      partTriangles += mesh.num_faces()
      const attribute = decoder.GetAttributeByUniqueId(mesh, extension.attributes.POSITION)
      const values = new draco.DracoFloat32Array()
      assert.ok(decoder.GetAttributeFloatForAllPoints(mesh, attribute, values))
      for (let index = 0; index < mesh.num_points(); index++) {
        const point = [0, 1, 2].map(axis => values.GetValue(index * 3 + axis))
        assert.ok(point.every(Number.isFinite))
        const cell = point.map(value => Math.floor(value / tolerance))
        let nearest = Infinity
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
          for (const original of grid.get(key(cell[0] + x, cell[1] + y, cell[2] + z)) ?? []) {
            nearest = Math.min(nearest, Math.hypot(...point.map((value, axis) => value - original[axis])))
          }
        }
        assert.ok(nearest < tolerance, `${node.name}: unexpected displaced vertex ${point}, error=${nearest}`)
        maxError = Math.max(maxError, nearest)
        checkedVertices++
      }
      draco.destroy(values); draco.destroy(mesh); draco.destroy(buffer); draco.destroy(decoder)
    }
    const expectedPart = asset.parts.find(part => part.name === node.name)
    assert.equal(partTriangles, expectedPart.triangles)
    triangles += partTriangles
  }
  assert.equal(triangles, asset.selectedTriangles)
  const leaf = model.document.materials.find(material => material.name.includes('leaves') || material.name === 'shrub_01' || material.name === 'fern_02')
  assert.equal(leaf.alphaMode, 'MASK')
  assert.equal(leaf.doubleSided, true)
  assert.ok(leaf.normalTexture && leaf.pbrMetallicRoughness.baseColorTexture)
  assert.ok(asset.images.every(image => image.dimensions[0] === 1024 && image.dimensions[1] === 1024))
  assert.ok(asset.images.some(image => image.alphaPixelExact && image.alphaExtrema[0] === 0 && image.alphaExtrema[1] === 255))
  reports.push({file: asset.file, bytes: asset.bytes, triangles, checkedVertices,
    maxVertexPositionErrorMeters: maxError, rootMinimumY: asset.boundsYUp.min[1], noAnimations: true,
    staticNodeTransforms: true, native1KAlphaNormalMaps: true})
}
const report = {passed: true, toleranceMeters: tolerance, assets: reports,
  verification: 'Every decoded vertex lies within 0.2mm of an original selected vertex after only its original transform and a single shared root translation. All original selected triangle counts retained. Alpha pixel equality checked during packing.'}
fs.writeFileSync(`artifacts/star-tide-upgrade/botany/validation${process.argv.includes('--only-fern') ? '-fern' : ''}.json`, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
