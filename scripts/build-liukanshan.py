#!/usr/bin/env python3
"""Build the volumetric Liukanshan mascot from the user's supplied turnarounds.

Run: /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/build-liukanshan.py
Optional: -- --no-render skips the four studio verification renders.
The lofts, rounded ears and muzzle are voxel fused into one continuous white surface.
Named pivot nodes are animated by src/components/home/mascot/Liukanshan.tsx.
This is a character adaptation of user-provided reference material, NOT a CC0 asset.
"""
from pathlib import Path
import hashlib
import json
import math
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source/liukanshan'
OUTPUT = ROOT / 'public/models/liukanshan'
RENDERS = SOURCE / 'renders'
for directory in [SOURCE, OUTPUT, RENDERS]:
    directory.mkdir(parents=True, exist_ok=True)

# Authoring uses x=right, y=up, z=forward; Blender receives x,-z,y.
def xyz(point):
    return Vector((point[0], -point[2], point[1]))


def material(name, color, roughness):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['IOR'].default_value = 1.42
    result.diffuse_color = (*color, 1)
    return result


def mesh_object(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name + '_surface')
    data.from_pydata([xyz(p) for p in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def loft(name, sections, mat, sides=64):
    """Horizontal oval sections, then Catmull-Clark: no stacked spherical body parts."""
    vertices, faces = [], []
    for y, rx, front, back, center in sections:
        for i in range(sides):
            a = i / sides * math.tau
            depth = front if math.cos(a) >= 0 else back
            vertices.append((math.sin(a) * rx, y, center + math.cos(a) * depth))
    for j in range(len(sections) - 1):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces += [tuple(reversed(range(sides))), tuple((len(sections) - 1) * sides + i for i in range(sides))]
    obj = mesh_object(name, vertices, faces, mat)
    modifier = obj.modifiers.new('Continuous silhouette subdivision', 'SUBSURF')
    modifier.levels = 2
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def ellipsoid(name, center, radius, mat, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=xyz(center))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (radius[0], radius[2], radius[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def sweep(name, points, radii, mat, sides=20, resolution=7):
    path = [Vector(p) for p in points]
    vertices, faces = [], []
    samples = []
    for j in range(len(path) - 1):
        p0, p1, p2, p3 = path[max(0, j - 1)], path[j], path[j + 1], path[min(len(path) - 1, j + 2)]
        for k in range(resolution):
            t = k / resolution
            p = .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
            r = radii[j] * (1 - t) + radii[j + 1] * t
            samples.append((p, r))
    samples.append((path[-1], radii[-1]))
    for j, (point, radius) in enumerate(samples):
        tangent = (samples[min(len(samples) - 1, j + 1)][0] - samples[max(0, j - 1)][0]).normalized()
        normal = tangent.cross(Vector((0, 0, 1))).normalized()
        if normal.length < .1:
            normal = tangent.cross(Vector((1, 0, 0))).normalized()
        binormal = tangent.cross(normal).normalized()
        for i in range(sides):
            angle = i / sides * math.tau
            vertices.append(tuple(point + radius * (normal * math.cos(angle) + binormal * math.sin(angle))))
    for j in range(len(samples) - 1):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces += [tuple(reversed(range(sides))), tuple((len(samples) - 1) * sides + i for i in range(sides))]
    return mesh_object(name, vertices, faces, mat)


def fuse(name, objects, voxel, target, smooth=4):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = objects[0]
    obj.name = name
    modifier = obj.modifiers.new('Watertight sculpt union', 'REMESH')
    modifier.mode = 'VOXEL'; modifier.voxel_size = voxel
    modifier.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new('Relax sculpt junctions', 'SMOOTH')
    modifier.factor = .72; modifier.iterations = smooth
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.calc_loop_triangles()
    count = len(obj.data.loop_triangles)
    if count > target:
        modifier = obj.modifiers.new('Preserve web silhouette', 'DECIMATE')
        modifier.ratio = target / count
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def pivot(name, point, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = 'SPHERE'; obj.empty_display_size = .025
    obj.location = xyz(point)
    if parent:
        parent_preserve(obj, parent)
    return obj


def parent_preserve(obj, parent):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix


def bevel_box(name, center, size, bevel, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(center))
    obj = bpy.context.object; obj.name = name
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        modifier.width = bevel; modifier.segments = 3
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    return obj


bpy.ops.wm.read_factory_settings(use_empty=True)
white = material('Liukanshan warm white satin', (.91, .905, .88), .65)
black = material('Liukanshan black soft paws', (.012, .014, .017), .52)
nose_material = material('Liukanshan large black nose', (.008, .010, .013), .36)
eye_material = material('Liukanshan polished black eyes', (.006, .008, .009), .22)
root = pivot('liukanshan_root', (0, 0, 0))
body_joint = pivot('body_joint', (0, .29, 0), root)

body = loft('White silhouette loft', [
    (.171, .024, .024, .024, .0), (.178, .083, .062, .062, .0),
    (.190, .140, .106, .106, .0), (.218, .178, .137, .134, .0),
    (.262, .198, .158, .149, .0), (.325, .202, .161, .156, .0),
    (.410, .195, .152, .156, -.002), (.505, .184, .130, .153, -.005),
    (.552, .180, .160, .147, -.007), (.580, .178, .213, .144, -.008),
    (.620, .175, .260, .139, -.010), (.667, .170, .272, .132, -.012),
    (.701, .164, .262, .122, -.016), (.724, .151, .219, .103, -.017),
    (.737, .124, .148, .077, -.019), (.741, .060, .058, .035, -.019),
], white)
ears = []
for side in [-1, 1]:
    ear = loft('Rounded ear', [
        (.665, .050, .042, .034, -.030), (.704, .057, .051, .040, -.038),
        (.748, .053, .053, .045, -.047), (.786, .039, .041, .036, -.057),
        (.814, .021, .024, .020, -.063), (.824, .006, .007, .006, -.064),
    ], white, sides=40)
    for vertex in ear.data.vertices:
        vertex.co.x += side * .105
    ears.append(ear)

# The muzzle is part of the body section loft itself, not an intersecting mask.
body = fuse('liukanshan_white_body', [body, *ears], .0025, 21500, smooth=22)
parent_preserve(body, body_joint)

nose = ellipsoid('liukanshan_nose', (0, .638, .270), (.089, .082, .063), nose_material)
parent_preserve(nose, body_joint)
for side, label in [(-1, 'R'), (1, 'L')]:
    from mathutils.bvhtree import BVHTree
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    hit, normal, _, _ = bvh.ray_cast(xyz((side * .145, .645, .60)), xyz((0, 0, -1)))
    assert hit is not None
    center = hit + normal * .002
    eye_point = (center.x, center.z, -center.y)
    eye_joint = pivot('eye_' + label + '_joint', eye_point, body_joint)
    eye = ellipsoid('liukanshan_eye_' + label, eye_point, (.0105, .016, .0068), eye_material, 28, 16)
    # Raycast placement makes each small eye sit on the real cheek surface.
    eye.rotation_euler = xyz((0, 0, 1)).rotation_difference(normal).to_euler()
    parent_preserve(eye, eye_joint)
    shoulder = (side * .180, .455, -.002)
    elbow = (side * .225, .337, .002)
    arm_joint = pivot('arm_' + label + '_joint', shoulder, body_joint)
    forearm_joint = pivot('forearm_' + label + '_joint', elbow, arm_joint)
    upper = sweep('liukanshan_upper_arm_' + label,
                  [shoulder, (side * .205, .413, -.003), (side * .225, .362, -.002), elbow],
                  [.021, .024, .022, .021], black)
    upper = fuse(upper.name, [upper, ellipsoid('Smooth shoulder', shoulder, (.021, .025, .021), black)], .0023, 1500, 3)
    parent_preserve(upper, arm_joint)
    palm = sweep('liukanshan_hand_' + label,
                 [elbow, (side * .234, .309, .008), (side * .237, .267, .016), (side * .235, .247, .022)],
                 [.021, .021, .024, .021], black)
    digits = []
    for index, offset in enumerate([-.014, .007]):
        finger = sweep('Rounded finger', [(side * (.235 + offset), .254, .026),
                       (side * (.239 + offset), .232 - index * .007, .031),
                       (side * (.235 + offset), .222 - index * .006, .032)],
                       [.013, .012, .005], black, sides=16, resolution=6)
        digits.append(finger)
    digits.append(sweep('Short thumb', [(side * .226, .271, .021), (side * .211, .258, .043),
                                       (side * .207, .246, .043)], [.014, .011, .005], black, sides=16))
    elbow_cap = ellipsoid('Soft elbow', elbow, (.021, .021, .021), black, 24, 16)
    palm = fuse(palm.name, [palm, *digits, elbow_cap], .0018, 2200, 9)
    parent_preserve(palm, forearm_joint)
    hip = (side * .081, .198, .001)
    leg_joint = pivot('leg_' + label + '_joint', hip, root)
    leg = sweep('Black shin', [hip, (side * .081, .126, .001), (side * .081, .041, .006)], [.029, .028, .029], black)
    paw = ellipsoid('Rounded forward paw', (side * .081, .032, .024), (.046, .032, .070), black)
    leg = fuse('liukanshan_leg_' + label, [leg, paw], .0022, 2200, 3)
    parent_preserve(leg, leg_joint)

tail_joint = pivot('tail_joint', (0, .283, -.136), body_joint)
tail = ellipsoid('liukanshan_round_tail', (0, .285, -.178), (.065, .065, .071), white)
parent_preserve(tail, tail_joint)

# An actual miniature laptop, shown only in the computer/searching state.
laptop = pivot('mascot_laptop', (0, .246, .255), root)
metal = material('Laptop soft graphite aluminum', (.145, .165, .18), .40)
metal.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = .58
keyboard = material('Laptop keycaps', (.025, .029, .033), .66)
screen = material('Laptop quiet blue screen', (.033, .086, .103), .49)
logo = material('Laptop white fish inlay', (.72, .77, .75), .64)
parts = [bevel_box('laptop_base', (0, .246, .255), (.325, .012, .206), .007, metal)]
parts.append(bevel_box('keyboard_inset', (0, .254, .267), (.27, .002, .102), .005, keyboard))
for row in range(4):
    for column in range(10):
        parts.append(bevel_box('key', ((column - 4.5) * .024, .256, .235 + row * .022), (.019, .003, .015), .002, metal))
parts.append(bevel_box('touchpad', (0, .254, .191), (.084, .001, .044), .003, keyboard))
lid_joint = pivot('laptop_lid', (0, .253, .350), laptop)
lid_parts = [bevel_box('laptop_lid_body', (0, .362, .350), (.325, .218, .012), .007, metal),
             bevel_box('laptop_display', (0, .363, .3425), (.296, .184, .001), .003, screen)]
for row in range(5):
    lid_parts.append(bevel_box('screen_line', (-.018 + (row % 2) * .02, .405 - row * .027, .341), (.18 - (row % 3) * .028, .004, .0008), .001, logo))
# A small white fish silhouette as shallow geometry, following the computer GIF.
fish = ellipsoid('fish_inlay', (-.008, .365, .357), (.023, .010, .0012), logo, 24, 12)
lid_parts.append(fish)
lid_parts.append(mesh_object('fish_tail', [(.01, .365, .358), (.027, .377, .358), (.027, .353, .358)], [(0, 1, 2)], logo))
for obj in parts:
    parent_preserve(obj, laptop)
for obj in lid_parts:
    parent_preserve(obj, lid_joint)
# Merge static laptop subparts by material. Keycaps remain physical geometry
# but do not create forty separate draw calls in the cabin.
for prefix, objects, parent in [('laptop_base', parts, laptop), ('laptop_lid', lid_parts, lid_joint)]:
    groups = {}
    for obj in objects:
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for index, meshes in enumerate(groups.values()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
        meshes[0].name = prefix + '_surface_' + str(index)
lid_joint.rotation_euler.x = -.16
laptop.hide_render = True

# Keep the GLB pivots and all render surfaces, while excluding studio lights/cameras.
bpy.context.view_layer.update()
model_objects = list(bpy.context.scene.objects)
for obj in model_objects:
    obj['source'] = 'User-provided Liukanshan turnaround and animated reference archives; not CC0'
root['heightMeters'] = .82
root['frontDirection'] = '+Z in glTF'
root['states'] = 'idle, greeting/wave, searching/computer, reading/doze, collected/nod'
bpy.ops.object.select_all(action='DESELECT')
for obj in model_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'liukanshan.glb'), export_format='GLB', use_selection=True,
                          export_yup=True, export_apply=True, export_extras=True,
                          export_animations=False, export_cameras=False, export_lights=False,
                          export_materials='EXPORT')

body_vertices = [obj.matrix_world @ vertex.co for obj in model_objects if obj.type == 'MESH' and not obj.name.startswith(('laptop', 'key', 'touchpad', 'screen', 'fish')) for vertex in obj.data.vertices]
low = [min(vertex[axis] for vertex in body_vertices) for axis in range(3)]
high = [max(vertex[axis] for vertex in body_vertices) for axis in range(3)]
triangles = 0
for obj in model_objects:
    if obj.type == 'MESH':
        obj.data.calc_loop_triangles(); triangles += len(obj.data.loop_triangles)
report = {
    'file': 'liukanshan.glb', 'bytes': (OUTPUT / 'liukanshan.glb').stat().st_size,
    'sha256': hashlib.sha256((OUTPUT / 'liukanshan.glb').read_bytes()).hexdigest(),
    'triangles': triangles, 'meshCount': sum(obj.type == 'MESH' for obj in model_objects),
    'boundsYUp': {'min': [low[0], low[2], -high[1]], 'max': [high[0], high[2], -low[1]]},
    'joints': [obj.name for obj in model_objects if obj.type == 'EMPTY'],
    'source': 'User-provided 看山三视图.zip and 刘看山动态.zip',
    'license': 'Character/reference rights belong to their original owners; user-provided material, NOT CC0.',
    'animations': 'R3F named joint poses: idle, greeting/wave, searching/computer, reading/doze, collected/nod.',
    'geometry': 'Section-loft body, smoothly fused rounded ears and tapered muzzle; swept limbs with rounded fingers; physical eyes/nose/tail/laptop.',
}
assert triangles < 50000, triangles
assert report['bytes'] < 5000000, report['bytes']
(OUTPUT / 'asset-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(json.dumps(report, indent=2, ensure_ascii=False))

# A small neutral studio stays in the editable blend; the laptop begins hidden.
for obj in laptop.children_recursive:
    obj.hide_render = True
floor_material = material('Studio warm gray', (.20, .22, .225), .8)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.002))
bpy.context.object.name = 'Studio seamless ground'
bpy.context.object.data.materials.append(floor_material)
world = bpy.data.worlds.new('Neutral studio world')
bpy.context.scene.world = world; world.use_nodes = True
world.node_tree.nodes.get('Background').inputs[0].default_value = (.45, .48, .52, 1)
world.node_tree.nodes.get('Background').inputs[1].default_value = .3


def area(name, position, energy, size, color):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = size; data.color = color
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj); obj.location = xyz(position)
    direction = xyz((0, .4, 0)) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


area('Large softbox', (-1.1, 1.7, 1.7), 85, 1.6, (1, .93, .84))
area('Cool gentle fill', (1.3, 1.0, .4), 35, 1.5, (.81, .89, 1))
area('Soft rim', (.35, 1.5, -1.3), 90, 1.4, (1, 1, 1))
data = bpy.data.cameras.new('Review camera'); camera = bpy.data.objects.new('Review camera', data)
bpy.context.collection.objects.link(camera); bpy.context.scene.camera = camera
data.type = 'ORTHO'; data.ortho_scale = 1.05
scene = bpy.context.scene; scene.render.engine = 'CYCLES'; scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1024; scene.render.resolution_y = 1024; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'


def render(name, position, ortho=1.05):
    camera.location = xyz(position); direction = xyz((0, .414, .025)) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler(); data.ortho_scale = ortho
    scene.render.filepath = str(RENDERS / (name + '.png'))
    bpy.ops.render.render(write_still=True)


camera.location = xyz((1.25, .88, 2.5)); camera.rotation_euler = (xyz((0, .414, .025)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'liukanshan.blend'))
if '--no-render' not in sys.argv:
    render('front', (0, .47, 3.0))
    render('side', (3.0, .47, .025))
    render('back', (0, .47, -3.0))
    render('hero', (1.25, .88, 2.5))
