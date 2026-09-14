"""CC0 Poly Haven Coast Rocks 01: crop a genuine shore section, decimate, export GLB.
Run: Blender --background --python scripts/prepare-coast-sample.py
Original download hashes recorded in assets/source/star-tide/coast/download-manifest.json.
"""
import bpy, bmesh
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/source/star-tide/coast/coast_rocks_01.gltf'))
for obj in list(bpy.context.scene.objects):
 if obj.type!='MESH':continue
 bpy.context.view_layer.objects.active=obj
 obj.select_set(True)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 coords=[v.co.copy() for v in obj.data.vertices]
 print('BOUNDS',obj.name,[min(v[a] for v in coords) for a in range(3)],[max(v[a] for v in coords) for a in range(3)],len(obj.data.polygons))
 # Retain the central third of the surveyed coast, preserving its authored UV coordinates.
 centre=(min(v.x for v in coords)+max(v.x for v in coords))*.5
 bm=bmesh.new();bm.from_mesh(obj.data)
 remove=[v for v in bm.verts if abs(v.co.x-centre)>9.5]
 bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(obj.data);bm.free()
 obj.location.x=-centre
 dec=obj.modifiers.new('Web shore 24k budget','DECIMATE');dec.ratio=min(1,24000/max(1,len(obj.data.polygons)));dec.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=dec.name)
 print('RETAINED',len(obj.data.polygons))
for image in bpy.data.images:
 if image.size[0]>1024:image.scale(1024,1024)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/source/star-tide/coast/coast-cropped.blend'))
out=ROOT/'public/models/star-tide';out.mkdir(exist_ok=True,parents=True)
bpy.ops.export_scene.gltf(filepath=str(out/'coast-cropped.glb'),export_format='GLB',export_apply=True,export_image_format='JPEG',export_jpeg_quality=82,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
