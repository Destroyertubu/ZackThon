import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'

const read=relative=>fs.readFileSync(relative)
const readGlb=file=>{const bytes=read(file),size=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(8),bytes.length);return{bytes,document:JSON.parse(bytes.subarray(20,20+size)),binary:bytes.subarray(28+size)}}
const directory=path.resolve('public/models/garden/draco')+'/'
const module={exports:{}}
new Function('module','exports','require','__dirname',read(directory+'draco_wasm_wrapper.js').toString())(module,module.exports,createRequire(import.meta.url),directory)
const draco=await module.exports({wasmBinary:read(directory+'draco_decoder.wasm')})
const source=JSON.parse(read('public/models/potted_plant_01/potted_plant_01_1k.gltf'))
const model=readGlb('public/models/garden/optimized/potted-plant-01.glb')
let triangles=0,maxBoundError=0
for(const node of model.document.nodes){
  const original=source.nodes.find(item=>item.name===node.name)
  assert.ok(original,`named plant part retained: ${node.name}`)
  for(const property of ['translation','rotation','scale','matrix'])assert.deepEqual(node[property],original[property],`${node.name} transform unchanged`)
  const expected={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}
  let expectedTriangles=0
  for(const primitive of source.meshes[original.mesh].primitives){
    expectedTriangles+=source.accessors[primitive.indices].count/3
    const position=source.accessors[primitive.attributes.POSITION]
    for(let axis=0;axis<3;axis++){expected.min[axis]=Math.min(expected.min[axis],position.min[axis]);expected.max[axis]=Math.max(expected.max[axis],position.max[axis])}
  }
  const actual={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}
  let partTriangles=0
  for(const primitive of model.document.meshes[node.mesh].primitives){
    const extension=primitive.extensions.KHR_draco_mesh_compression,view=model.document.bufferViews[extension.bufferView]
    const bytes=model.binary.subarray(view.byteOffset,view.byteOffset+view.byteLength)
    const decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),mesh=new draco.Mesh()
    buffer.Init(bytes,bytes.length);assert.ok(decoder.DecodeBufferToMesh(buffer,mesh).ok())
    partTriangles+=mesh.num_faces()
    const attribute=decoder.GetAttributeByUniqueId(mesh,extension.attributes.POSITION),values=new draco.DracoFloat32Array()
    assert.ok(decoder.GetAttributeFloatForAllPoints(mesh,attribute,values))
    for(let i=0;i<mesh.num_points();i++)for(let axis=0;axis<3;axis++){const value=values.GetValue(i*3+axis);assert.ok(Number.isFinite(value));actual.min[axis]=Math.min(actual.min[axis],value);actual.max[axis]=Math.max(actual.max[axis],value)}
    draco.destroy(values);draco.destroy(mesh);draco.destroy(buffer);draco.destroy(decoder)
  }
  assert.equal(partTriangles,expectedTriangles,`${node.name} faces retained`)
  for(const side of ['min','max'])for(let axis=0;axis<3;axis++){const error=Math.abs(actual[side][axis]-expected[side][axis]);maxBoundError=Math.max(error,maxBoundError);assert.ok(error<.0002,`${node.name} bound error ${error}m`)}
  triangles+=partTriangles
}
assert.equal(triangles,176226)
for(const [sourceFile,targetFile] of [['public/models/garden/details/brass-lantern.glb','public/models/garden/optimized/brass-lantern.glb'],['public/models/garden/flowers.glb','public/models/garden/optimized/flowers.glb']]){
  const a=readGlb(sourceFile),b=readGlb(targetFile)
  for(const key of ['nodes','meshes','materials','accessors','scenes','scene'])assert.deepEqual(a.document[key],b.document[key],`${targetFile} ${key} remains exact`)
  const images=new Set(a.document.images.map(i=>i.bufferView))
  a.document.bufferViews.forEach((view,index)=>{if(images.has(index))return;const other=b.document.bufferViews[index];assert.ok(a.binary.subarray(view.byteOffset,view.byteOffset+view.byteLength).equals(b.binary.subarray(other.byteOffset,other.byteOffset+other.byteLength)),`${targetFile} geometry bytes ${index}`)})
  assert.ok(b.bytes.length<a.bytes.length)
}
const report={passed:true,plantTriangles:triangles,plantNodeTransformsExact:true,maxDecodedBoundsErrorMeters:maxBoundError,lanternAndFlowersGeometryByteIdentical:true,images:'Full native resolution and decoded-pixel equality verified by prepare-observatory-runtime.py'}
fs.writeFileSync('artifacts/star-tide-upgrade/optimized-assets-validation.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
