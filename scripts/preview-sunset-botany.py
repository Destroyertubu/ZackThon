"""Neutral-light visual verification of the FINAL compressed web GLBs.

/Applications/Blender.app/Contents/MacOS/Blender --background --threads 2 --python scripts/preview-sunset-botany.py
Only renders artifact previews. Does not modify any scene source or asset file.
"""
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/star-tide-upgrade/botany'
for name in (['fern'] if '--only-fern' in sys.argv else ['street-tree', 'rooted-shrub', 'fern']):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'public/models/sunset-boulevard/botany/{name}.glb'))
    plants = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    coords = [obj.matrix_world @ vertex.co for obj in plants for vertex in obj.data.vertices]
    minimum = Vector(tuple(min(point[axis] for point in coords) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in coords) for axis in range(3)))
    centre = (minimum + maximum) * .5
    size = max(maximum - minimum)
    height = maximum.z - minimum.z
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('neutral daylight')
    scene.world.color = (.22, .25, .3)
    bpy.ops.mesh.primitive_plane_add(size=size * 5, location=(centre.x, centre.y, -.003 * size))
    ground = bpy.context.object
    material = bpy.data.materials.new('neutral warm ground')
    material.diffuse_color = (.39, .37, .33, 1)
    ground.data.materials.append(material)
    for position, power, color, lamp_size in [((-2, -2, 3), 180, (1, .87, .72), 2), ((2, 1, 1.8), 120, (.73, .84, 1), 1.5)]:
        bpy.ops.object.light_add(type='AREA', location=centre + Vector(position) * size)
        lamp = bpy.context.object
        lamp.data.energy = power * size * size
        lamp.data.color = color
        lamp.data.shape = 'DISK'
        lamp.data.size = lamp_size * size
        lamp.rotation_euler = (centre - lamp.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = size * 1.22
    scene.camera = camera
    for suffix, direction in [('front', (0, -2.5, .5)), ('side', (2.5, -.2, .5))]:
        if suffix == 'side' and '--front-only' in sys.argv:
            continue
        camera.location = centre + Vector(direction) * size
        camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(OUT / f'{name}-{suffix}.png')
        bpy.ops.render.render(write_still=True)
