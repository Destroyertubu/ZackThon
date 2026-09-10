"""Re-export editable full.blend after integrating the final independent asset modules.
Development convenience only; build-production-room.py -- full reproduces all assets.
"""
from pathlib import Path
root_path=Path(__file__).resolve().parents[1]
source=(root_path/'tools/build-production-room.py').read_text()
exec(compile(source[source.index('import bpy'):source.index('collection=bpy')],str(root_path/'tools/build-production-room.py'),'exec'))
bpy.ops.wm.open_mainfile(filepath=str(SRC/'full.blend'))
collection=bpy.data.collections['WW_PRODUCTION']
material_source=source[source.index('M={};root=None'):source.index('def xyz')].replace("for spec in recipes:","for spec in recipes:\n if bpy.data.materials.get(spec['id']):M[spec['id']]=bpy.data.materials[spec['id']];continue")
exec(compile(material_source,'shared-materials','exec'))
exec(compile(source[source.index('def xyz'):source.index("exec(compile((ROOT/'tools/production-corner.py')")],str(root_path/'tools/build-production-room.py'),'exec'))
for module in ['corner','study','lighting','luggage','vines','props']:
 p=ROOT/('tools/production-'+module+'.py');exec(compile(p.read_text(),str(p),'exec'))
# Correct the original shell proxy-copy timing: rotations must be evaluated before
# taking matrix_local, and opaque architecture must block interaction rays.
bpy.context.view_layer.update()
for c in collection.objects:
 if c.name.startswith('COL_A'):
  visual=collection.objects.get('VIS_'+c.name[4:])
  if visual:c.matrix_local=visual.matrix_local.copy()
  if c.name.startswith(('COL_A03','COL_A04','COL_A05','COL_A09','COL_A10','COL_A12','COL_A14')):c['interaction']=True
# A single global framing correction: retain mountain root/footprint, lower the
# authored height to fit the north opening from the fixed entrance cameras.
for o in collection.objects:
 if o.name.startswith('VIS_E01_ridges') and not o.get('framingRevision'):
  for v in o.data.vertices:v.co.z*=.32
  for face in o.data.polygons:face.use_smooth=True
  o['framingRevision']='CR-006'
# Replace the west desk with the corrected outward page surfaces.
for o in [o for o in collection.objects if o.name=='WW_F05' and '--patch-only' not in sys.argv]:
 if o:
  for child in list(o.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
  bpy.data.objects.remove(o,do_unlink=True)
if '--patch-only' not in sys.argv:study_desk()
if not any(o.name=='WW_L01' for o in collection.objects):build_lighting()
if not any(o.name.startswith('WW_F15') for o in collection.objects):build_luggage()
if not any(o.name=='WW_V03_east' for o in collection.objects):build_vines()
if not any(o.name.endswith('_props') for o in collection.objects):build_props()
for o in list(collection.objects):
 if o.name.startswith(('SPAWN_','INTERACT_')):bpy.data.objects.remove(o,do_unlink=True)
exec(compile(source[source.index("root=None\nempty('SPAWN_home'"):],str(root_path/'tools/build-production-room.py'),'exec'))
