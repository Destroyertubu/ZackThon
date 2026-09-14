import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { staticPlantBatches, type StaticPlantPlacement } from '../src/features/journeys/scene/staticPlantBatches'

const rootDirectory = fileURLToPath(new URL('..', import.meta.url))
const epsilon = 2e-6
function near(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${label}: ${actual} != ${expected}`)
}
function vectorNear(actual: THREE.Vector3, expected: THREE.Vector3, label: string) {
  near(actual.distanceTo(expected), 0, label)
}
function batches(root: THREE.Group) { return root.children as THREE.InstancedMesh[] }
function instance(mesh: THREE.InstancedMesh, index: number) {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix); return matrix
}
function allVertices(mesh: THREE.Mesh, matrix: THREE.Matrix4) {
  const positions = mesh.geometry.getAttribute('position')
  return Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix))
}

/** Rooted model with two differently rotated, nested branch-to-leaf attachments. */
function fixture() {
  const root = new THREE.Group()
  const color = new THREE.DataTexture(new Uint8Array([24, 82, 40, 0, 61, 120, 36, 255]), 2, 1)
  const normal = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1)
  const wood = new THREE.MeshStandardMaterial({ color: '#714d32', map: color, normalMap: normal, roughness: .9 })
  const leaf = new THREE.MeshStandardMaterial({ color: '#537b44', map: color, alphaTest: .42, transparent: true })
  const trunkGeometry = new THREE.CylinderGeometry(.12, .2, 3, 8).translate(0, 1.5, 0)
  const branchGeometry = new THREE.CylinderGeometry(.025, .06, 1.6, 8).translate(0, .8, 0)
  const leafGeometry = new THREE.BufferGeometry()
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .2, .24, .06, -.14, .33, -.03], 3))
  leafGeometry.computeVertexNormals()
  const trunk = new THREE.Mesh(trunkGeometry, [wood, wood]); trunk.name = 'trunk'; root.add(trunk)
  const attachments: { branch: THREE.Mesh; leaf: THREE.Mesh }[] = []
  for (let i = 0; i < 2; i++) {
    const joint = new THREE.Group()
    joint.position.set(i ? -.07 : .08, i ? 1.6 : 1.35, i ? .09 : -.06)
    joint.rotation.set(.17 + i * .15, -.4 + i * 1.1, i ? .48 : -.6)
    const twig = new THREE.Group(); twig.position.set(.03, .1, -.015); twig.rotation.set(.11, .27, -.08)
    joint.add(twig); root.add(joint)
    const branch = new THREE.Mesh(branchGeometry, wood); branch.name = `branch-${i}`; twig.add(branch)
    const leafJoint = new THREE.Group(); leafJoint.position.set(0, 1.6, 0); leafJoint.rotation.set(.43, .9, -.32)
    twig.add(leafJoint)
    const leafMesh = new THREE.Mesh(leafGeometry, leaf); leafMesh.name = `leaf-${i}`; leafJoint.add(leafMesh)
    attachments.push({ branch, leaf: leafMesh })
  }
  root.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []; root.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object) })
  return { root, meshes, attachments, geometries: [trunkGeometry, branchGeometry, leafGeometry], materials: [wood, leaf], textures: [color, normal], cleanup() {
    for (const geometry of this.geometries) geometry.dispose()
    for (const material of this.materials) material.dispose()
    for (const texture of this.textures) texture.dispose()
  } }
}

test('whole plants retain nested branch/leaf attachment and a shared root transform at every placement', () => {
  const source = fixture()
  const placements: StaticPlantPlacement[] = [
    { position: [8, .44, -4], yaw: Math.PI / 3, height: 6.3 },
    { position: [-3, 1.2, 9], yaw: -1.21, height: 2.1 },
  ]
  const result = staticPlantBatches(source.root, placements, 'test-plant')
  try {
    assert.equal(result.root.name, 'test-plant')
    const outputs = batches(result.root)
    assert.equal(outputs.length, source.meshes.length)
    for (const [i, placement] of placements.entries()) {
      let common: THREE.Matrix4 | undefined
      const placedVertices: THREE.Vector3[] = []
      for (const [j, original] of source.meshes.entries()) {
        const batch = outputs[j]
        assert.equal(batch.count, placements.length)
        assert.equal(batch.instanceMatrix.usage, THREE.StaticDrawUsage)
        const actual = instance(batch, i)
        const rootTransform = actual.clone().multiply(original.matrixWorld.clone().invert())
        if (common) rootTransform.elements.forEach((value, k) => near(value, common!.elements[k], `${original.name}: shared root matrix`))
        else common = rootTransform
        const scale = new THREE.Vector3(), position = new THREE.Vector3(), rotation = new THREE.Quaternion()
        rootTransform.decompose(position, rotation, scale)
        vectorNear(position, new THREE.Vector3(...placement.position), 'true source root is placed at the requested soil position')
        near(scale.x, scale.y, 'uniform xy scale'); near(scale.y, scale.z, 'uniform yz scale')
        assert.ok(scale.x > 0)
        vectorNear(new THREE.Vector3(1, 0, 0).applyQuaternion(rotation), new THREE.Vector3(Math.cos(placement.yaw), 0, -Math.sin(placement.yaw)), 'requested yaw')
        placedVertices.push(...allVertices(original, actual))
      }
      const bounds = new THREE.Box3().setFromPoints(placedVertices)
      near(bounds.min.y, placement.position[1], 'plant base rests on the soil')
      near(bounds.max.y - bounds.min.y, placement.height, 'uncapped whole plant height')
      for (const pair of source.attachments) {
        const branch = outputs[source.meshes.indexOf(pair.branch)], leaf = outputs[source.meshes.indexOf(pair.leaf)]
        const tip = new THREE.Vector3(0, 1.6, 0).applyMatrix4(instance(branch, i))
        vectorNear(new THREE.Vector3().applyMatrix4(instance(leaf, i)), tip, 'leaf stays attached to its supporting branch')
      }
    }
  } finally { result.dispose(); source.cleanup() }
})

test('maxRadius constrains the full crown around its true root with uniform scaling', () => {
  const source = fixture()
  const placements: StaticPlantPlacement[] = [
    { position: [12, .44, 8], yaw: .91, height: 5.5, maxRadius: .3 },
    { position: [-9, .6, -7], yaw: -2.21, height: 5.5, maxRadius: .24 },
  ]
  const result = staticPlantBatches(source.root, placements, 'radius-test')
  try {
    const outputs = batches(result.root)
    for (const [i, placement] of placements.entries()) {
      const vertices = source.meshes.flatMap((mesh, j) => allVertices(mesh, instance(outputs[j], i)))
      for (const vertex of vertices) assert.ok(Math.hypot(vertex.x - placement.position[0], vertex.z - placement.position[2]) <= placement.maxRadius! + epsilon, 'every branch/leaf vertex fits the root-centred envelope')
      const bounds = new THREE.Box3().setFromPoints(vertices)
      assert.ok(bounds.max.y - bounds.min.y < placement.height, 'tight radius limit must reduce height instead of flattening only the crown')
      near(bounds.min.y, placement.position[1], 'radius-limited roots remain on the soil')
      for (const [j, original] of source.meshes.entries()) {
        const rootTransform = instance(outputs[j], i).multiply(original.matrixWorld.clone().invert())
        const scale = new THREE.Vector3().setFromMatrixScale(rootTransform)
        near(scale.x, scale.y, 'capped xy scale'); near(scale.y, scale.z, 'capped yz scale')
      }
    }
  } finally { result.dispose(); source.cleanup() }
})

test('unmount releases owned batches and cloned materials while loader cache survives reuse', () => {
  const source = fixture()
  const counts = new Map<THREE.EventDispatcher, number>()
  const watch = (resource: THREE.EventDispatcher) => {
    counts.set(resource, 0)
    // All observed objects expose Three's standard dispose event.
    resource.addEventListener('dispose' as never, (() => counts.set(resource, counts.get(resource)! + 1)) as never)
  }
  const cached = [...source.geometries, ...source.materials, ...source.textures]
  cached.forEach(watch)
  const originalPositions = source.geometries.map(geometry => Array.from(geometry.getAttribute('position').array))
  const originalMaterial = source.materials.map(material => ({ alphaTest: material.alphaTest, transparent: material.transparent, depthWrite: material.depthWrite, env: material.envMapIntensity }))
  const placement: StaticPlantPlacement[] = [{ position: [1, .44, 2], yaw: .4, height: 3 }]
  const first = staticPlantBatches(source.root, placement, 'first')
  const second = staticPlantBatches(source.root, placement, 'second')
  const firstMaterials = new Set(batches(first.root).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
  const secondMaterials = new Set(batches(second.root).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
  const owned = [...batches(first.root), ...firstMaterials]; owned.forEach(watch)
  try {
    assert.equal(firstMaterials.size, source.materials.length, 'one material clone per original, including repeated material-array slots')
    for (const material of firstMaterials) { assert.ok(!source.materials.includes(material as THREE.MeshStandardMaterial)); assert.ok(!secondMaterials.has(material)) }
    for (const [i, batch] of batches(first.root).entries()) assert.equal(batch.geometry, source.meshes[i].geometry)
    first.dispose()
    for (const resource of owned) assert.equal(counts.get(resource), 1, 'owned GPU wrapper/material is released once')
    for (const resource of cached) assert.equal(counts.get(resource), 0, 'cached geometry/material/texture must not receive dispose')
    source.geometries.forEach((geometry, i) => assert.deepEqual(Array.from(geometry.getAttribute('position').array), originalPositions[i]))
    source.materials.forEach((material, i) => assert.deepEqual({ alphaTest: material.alphaTest, transparent: material.transparent, depthWrite: material.depthWrite, env: material.envMapIntensity }, originalMaterial[i]))
    for (const material of secondMaterials) {
      const m = material as THREE.MeshStandardMaterial
      assert.ok(source.textures.includes(m.map as THREE.DataTexture), 'cloned material can still read the loader-owned texture')
    }
    const revisited = staticPlantBatches(source.root, placement, 'revisited')
    try { batches(revisited.root).forEach((mesh, i) => assert.deepEqual(Array.from(instance(mesh, 0).elements), Array.from(instance(batches(second.root)[i], 0).elements))) }
    finally { revisited.dispose() }
    second.dispose()
    for (const resource of cached) assert.equal(counts.get(resource), 0, 'a later unmount still preserves the loader cache')
  } finally { source.cleanup() }
})

test('a zero-height source is rejected before a non-finite scale can enter an instance', () => {
  const source = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 0, 1), material = new THREE.MeshStandardMaterial()
  source.add(new THREE.Mesh(geometry, material))
  try { assert.throws(() => staticPlantBatches(source, [{ position: [0, 0, 0], yaw: 0, height: 1 }], 'flat'), /no physical height/) }
  finally { geometry.dispose(); material.dispose() }
})

interface Gltf {
  animations?: unknown[]; skins?: unknown[]
  nodes?: { skin?: number; weights?: number[] }[]
  meshes?: { weights?: number[]; primitives: { attributes?: Record<string, number>; targets?: unknown[] }[] }[]
  materials?: { name?: string; alphaMode?: string; alphaCutoff?: number; pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }[]
  textures?: { source?: number; extensions?: { EXT_texture_webp?: { source: number } } }[]
  images?: { name?: string; uri?: string; bufferView?: number; mimeType?: string }[]
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[]
  buffers?: { byteLength: number; uri?: string }[]
}
interface AssetManifest {
  assets: { name: string; file: string; bytes: number; sha256: string; animationCount: number; rootAnchorLocalYUp: number[];
    images: { name: string; bytes: number; dimensions: number[]; alphaPixelExact: boolean; alphaExtrema: number[] | null }[] }[]
}
function parseGlb(bytes: Buffer) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic')
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB version')
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'complete GLB length')
  let json: Gltf | undefined, binary: Buffer | undefined
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4)
    assert.ok(offset + 8 + length <= bytes.length, 'GLB chunk remains in bounds')
    const chunk = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8')) as Gltf
    if (type === 0x004e4942) binary = chunk
    offset += 8 + length
  }
  assert.ok(json && binary, 'JSON and embedded binary are present')
  return { json, binary }
}
function webpInfo(bytes: Buffer) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, 'complete WebP container')
  let alpha = false, width = 0, height = 0
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const tag = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8
    assert.ok(start + size <= bytes.length, 'WebP chunk remains in bounds')
    if (tag === 'VP8X') { alpha ||= !!(bytes[start] & 0x10); width = bytes.readUIntLE(start + 4, 3) + 1; height = bytes.readUIntLE(start + 7, 3) + 1 }
    if (tag === 'ALPH') alpha = true
    if (tag === 'VP8L') { const bits = bytes.readUInt32LE(start + 1); width ||= (bits & 0x3fff) + 1; height ||= ((bits >>> 14) & 0x3fff) + 1; alpha ||= !!(bits & 0x10000000) }
    if (tag === 'VP8 ') { width ||= bytes.readUInt16LE(start + 6) & 0x3fff; height ||= bytes.readUInt16LE(start + 8) & 0x3fff }
    offset = start + size + (size % 2)
  }
  assert.ok(width > 0 && height > 0, 'image dimensions are readable')
  return { alpha, width, height }
}

const manifestPath = resolve(rootDirectory, 'public/models/sunset-boulevard/botany/manifest.json')
test('final static botany assets have no rigs/morphs, retain leaf alpha, and account unique runtime bytes', { skip: !existsSync(manifestPath) && 'Final botany manifest is not present; mock transform/lifecycle tests still run' }, t => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetManifest
  assert.ok(manifest.assets.length >= 2, 'tree and rooted shrub are described')
  const resources = new Map<string, number>(), seenAssets = new Set<string>()
  let declaredGlbBytes = 0, embeddedImageBytes = 0, alphaMaterials = 0
  for (const asset of manifest.assets) {
    const path = resolve(rootDirectory, asset.file)
    assert.ok(!seenAssets.has(path), 'each model is listed once'); seenAssets.add(path)
    assert.ok(existsSync(path), `${asset.name}: the manifest cannot declare an absent final model`)
    const bytes = readFileSync(path)
    assert.equal(bytes.length, asset.bytes, `${asset.name}: manifest byte size`)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, `${asset.name}: manifest SHA-256`)
    resources.set(path, bytes.length); declaredGlbBytes += asset.bytes
    assert.equal(asset.animationCount, 0); assert.deepEqual(asset.rootAnchorLocalYUp, [0, 0, 0])
    const { json, binary } = parseGlb(bytes)
    assert.equal(json.animations?.length ?? 0, 0); assert.equal(json.skins?.length ?? 0, 0)
    for (const node of json.nodes ?? []) { assert.equal(node.skin, undefined); assert.equal(node.weights?.length ?? 0, 0) }
    for (const mesh of json.meshes ?? []) {
      assert.equal(mesh.weights?.length ?? 0, 0)
      for (const primitive of mesh.primitives) {
        assert.equal(primitive.targets?.length ?? 0, 0)
        assert.ok(Object.keys(primitive.attributes ?? {}).every(key => !/^(JOINTS|WEIGHTS)_/.test(key)), 'no skeletal vertex attributes')
      }
    }
    const loadUri = (uri: string) => {
      assert.ok(!/^[a-z][a-z\d+.-]*:/i.test(uri), 'runtime dependencies are local, not hidden remote/data requests')
      const dependency = resolve(dirname(path), decodeURIComponent(uri))
      const value = readFileSync(dependency); resources.set(dependency, value.length); return value
    }
    const buffers = (json.buffers ?? []).map(buffer => buffer.uri ? loadUri(buffer.uri) : binary)
    const imageInfo = (json.images ?? []).map(image => {
      let encoded: Buffer
      if (image.uri) encoded = loadUri(image.uri)
      else {
        assert.notEqual(image.bufferView, undefined)
        const view = json.bufferViews![image.bufferView!], offset = view.byteOffset ?? 0
        assert.ok(offset + view.byteLength <= buffers[view.buffer].length)
        encoded = buffers[view.buffer].subarray(offset, offset + view.byteLength)
        embeddedImageBytes += encoded.length
      }
      const record = asset.images.find(item => item.name === image.name)
      assert.ok(record, `${asset.name}: image has provenance metadata`)
      assert.equal(encoded.length, record.bytes)
      const info = webpInfo(encoded)
      assert.deepEqual([info.width, info.height], record.dimensions)
      return { ...info, record }
    })
    let maskedInAsset = 0
    for (const material of json.materials ?? []) if (material.alphaMode === 'MASK') {
      maskedInAsset++; alphaMaterials++
      const textureIndex = material.pbrMetallicRoughness?.baseColorTexture?.index
      assert.notEqual(textureIndex, undefined, 'masked plant uses a base-colour texture')
      const texture = json.textures![textureIndex!], imageIndex = texture.extensions?.EXT_texture_webp?.source ?? texture.source
      assert.notEqual(imageIndex, undefined)
      const info = imageInfo[imageIndex!]
      assert.ok(info.alpha, 'the material-bound WebP really contains alpha')
      assert.equal(info.record.alphaPixelExact, true, 'source-alpha audit is recorded')
      assert.ok(info.record.alphaExtrema && info.record.alphaExtrema[0] < info.record.alphaExtrema[1], 'alpha audit has non-constant coverage')
      assert.ok((material.alphaCutoff ?? .5) > 0 && (material.alphaCutoff ?? .5) < 1)
    }
    assert.ok(maskedInAsset > 0, `${asset.name}: foliage has a cutout material`)
  }
  const runtimeBytes = [...resources.values()].reduce((sum, bytes) => sum + bytes, 0)
  assert.ok(runtimeBytes >= declaredGlbBytes)
  t.diagnostic(JSON.stringify({ models: seenAssets.size, uniqueRuntimeFiles: resources.size, runtimeBytes, modelBytes: declaredGlbBytes,
    externalBytes: runtimeBytes - declaredGlbBytes, embeddedImageBytes, alphaMaterials,
    scope: 'Static local dependencies only; embedded images counted within GLB once. Container alpha checked; pixel-exact alpha relies on the asset audit, no image or Draco decode here.' }))
})
