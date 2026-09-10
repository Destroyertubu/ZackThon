"""Reproducible production-kit staging assets. Run in a NEW Blender process.
Only WW_PRODUCTION collection is owned; no user scene/data is cleared.
Blender coordinates (x,-z,y), runtime metres/Y-up. No downloaded code runs.
"""
import bpy,math,json,sys,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];DESIGN=ROOT/'design/home';OUT=ROOT/'frontend/assets/home/production';SRC=ROOT/'assets-source/room-production'
STAGE=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'graybox'
layout=json.loads((DESIGN/'room_layout.json').read_text());recipes=json.loads((DESIGN/'materials.json').read_text());catalog=json.loads((DESIGN/'asset_catalog.json').read_text());rig=json.loads((DESIGN/'light_rig.json').read_text())
for p in [OUT,SRC]:p.mkdir(parents=True,exist_ok=True)
collection=bpy.data.collections.get('WW_PRODUCTION')
if collection:
 for o in list(collection.objects):bpy.data.objects.remove(o,do_unlink=True)
else:
 collection=bpy.data.collections.new('WW_PRODUCTION');bpy.context.scene.collection.children.link(collection)
M={};root=None
lin=lambda v:v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
for spec in recipes:
 m=bpy.data.materials.new(spec['id']);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');hex=spec['base_color_srgb'];p.inputs['Base Color'].default_value=tuple(lin(int(hex[i:i+2],16)/255) for i in [1,3,5])+(1,);p.inputs['Roughness'].default_value=spec['roughness'];p.inputs['Metallic'].default_value=spec['metalness'];M[spec['id']]=m
 if spec['id']=='M16':p.inputs['Alpha'].default_value=.18
 if spec['id']=='M17':p.inputs['Transmission Weight'].default_value=.25;p.inputs['IOR'].default_value=1.46
 if spec['id']=='M19':p.inputs['Emission Color'].default_value=(1,.55,.16,1);p.inputs['Emission Strength'].default_value=1.4

def xyz(v):return (v[0],-v[2],v[1])
def own(o,name,material=None,parent=True):
 for c in list(o.users_collection):c.objects.unlink(o)
 collection.objects.link(o);o.name=name
 if material:o.data.materials.append(M[material])
 if parent and root:o.parent=root
 return o

def group(id):
 global root
 root=bpy.data.objects.new('WW_'+id,None);collection.objects.link(root);root['assetId']=id;return root

def empty(name,p=(0,0,0)):
 o=bpy.data.objects.new(name,None);collection.objects.link(o);o.location=xyz(p)
 if root:o.parent=root
 return o

def uv(o,tile=1):
 if not o.data.uv_layers:o.data.uv_layers.new()
 for f in o.data.polygons:
  axis=max(range(3),key=lambda i:abs(f.normal[i]));axes=([1,2],[0,2],[0,1])[axis]
  for li in f.loop_indices:
   co=o.data.vertices[o.data.loops[li].vertex_index].co;o.data.uv_layers.active.data[li].uv=(co[axes[0]]/tile,co[axes[1]]/tile)

def box(name,p,size,mat='M03',bevel=.002):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz((p[0],p[1]+size[1]/2,p[2])));o=bpy.context.object;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);uv(o)
 if bevel:
  m=o.modifiers.new('Measured edge bevel','BEVEL');m.width=min(bevel,min(size)/3);m.segments=1 if bevel<=.001 else 3;bpy.ops.object.modifier_apply(modifier=m.name);m=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=m.name)
 return own(o,name,mat)

def mesh(name,verts,faces,mat,smooth=False):
 me=bpy.data.meshes.new(name);me.from_pydata([xyz(v) for v in verts],[],faces);me.update();o=bpy.data.objects.new(name,me);own(o,name,mat);uv(o)
 for p in me.polygons:p.use_smooth=smooth
 return o

def lathe(name,profile,mat='M03',segments=32,p=(0,0,0)):
 verts=[(p[0]+r*math.cos(i*math.tau/segments),p[1]+h,p[2]+r*math.sin(i*math.tau/segments)) for r,h in profile for i in range(segments)];faces=[]
 for j in range(len(profile)-1):
  for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
 # Profile walks from bottom outward, upward and inward: reverse for outward normals.
 o=mesh(name,verts,[tuple(reversed(f)) for f in faces],mat,True)
 return o

def tube(name,pts,r,mat='M06',resolution=1):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=resolution;c.bevel_depth=r;c.bevel_resolution=1;s=c.splines.new('POLY');s.points.add(len(pts)-1)
 for p,co in zip(s.points,pts):p.co=(*xyz(co),1)
 o=bpy.data.objects.new(name,c);own(o,name,mat);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o

def col(name,p,size,player=True,camera=True,interaction=True):
 o=box('COL_'+name,p,size,None,0);o['player']=player;o['camera']=camera;o['interaction']=interaction;return o

def place(g,p,yaw=0):g.location=xyz(p);g.rotation_euler.z=yaw

def root_record(id):return next(r for r in layout['roots'] if r['id']==id)
def place_at(g,id):r=root_record(id);place(g,r['position_m'],r['yaw_rad'])

def architecture():
 group('A01');box('VIS_A01_floor',(0,-.14,0),(12,.14,10),'M05');col('A01_floor',(0,-.2,0),(12,.2,10),interaction=False)
 group('A03')
 for z,opening,height in [(-5,5.4,3.2),(5,1.8,2.6)]:
  w=(10.6-opening)/2
  for side in [-1,1]:
   p=(side*(opening/2+w/2),0,z);box('VIS_A03_wall',p,(w,3.4,.24),'M05');col('A03_wall',p,(w,3.4,.24))
  box('VIS_A03_lintel',(0,height,z),(opening,3.4-height,.24),'M05');col('A03_lintel',(0,height,z),(opening,3.4-height,.24))
 for x in [-6,6]:box('VIS_A03_side',(x,0,0),(.24,3.4,8.6),'M05');col('A03_side',(x,0,0),(.24,3.4,8.6))
 for x in [-1,1]:
  for z in [-1,1]:
   for name,mat in [('VIS_A03_chamfer','M05'),('COL_A03_chamfer',None)]:
    o=box(name,(x*5.65,0,z*4.65),(.99,3.4,.24),mat);o.rotation_euler.z=x*z*math.pi/4
 # Roof shell: collision slab above minimum eave leaves primary movement safe; exact roof in G07.
 group('A07');box('VIS_A07_gray_roof',(0,3.4,0),(12,.14,10),'M05');col('A07_roof',(0,3.4,0),(12,.14,10),interaction=False)
 group('A13');box('VIS_A13_terrace',(0,-.14,-6),(5.4,.14,2),'M04');col('A13_terrace',(0,-.2,-6),(5.4,.2,2),interaction=False)
 group('A14')
 for x,z,w,d in [(0,-7,5.4,.1),(-2.7,-6,.1,2),(2.7,-6,.1,2)]:
  box('VIS_A14_guard',(x,.45,z),(w,.55,d),'M03');col('A14_guard',(x,0,z),(w,1.1,d))
 group('A09');col('A09_exit_boundary',(0,0,5.4),(1.8,3,.1));box('VIS_A09_gray',(0,0,5.4),(1.8,2.6,.1),'M03')

# Catalog structure intentionally inspected rather than inferred.
def entries():return catalog if isinstance(catalog,list) else catalog.get('assets',[])
def spec(id):return next(a for a in entries() if a['id']==id)

def gray_furniture(skip=()):
 for r in layout['roots']:
  ids=r['asset_ids'];id=ids[0]
  if not id.startswith('F') or id in skip:continue
  a=spec(id);size=a.get('dimensions_m') or a.get('size_m')
  if not isinstance(size,list):raise ValueError(str(a))
  g=group(id);box('VIS_'+id+'_GRAYBOX_ONLY',(0,0,0),size,'M05');col(id,(0,0,0),size);place_at(g,r['id'])

def side_table():
 g=group('F02')
 lathe('VIS_F02.01_02_top',[(0,.55),(.308,.55),(.319,.554),(.32,.580),(.318,.588),(.31,.59),(0,.59)],'M04',48)
 lathe('VIS_F02.04_lower',[(0,0),(.27,0),(.28,.007),(.28,.035),(.265,.047),(0,.047)],'M04',40)
 for i in range(20):
  a=i*math.tau/20;o=box('VIS_F02.03_slat',(math.cos(a)*.255,.042,math.sin(a)*.255),(.026,.51,.035),'M04',.002);o.rotation_euler.z=-a
 lathe('VIS_F02.05_support',[(0,.046),(.035,.046),(.035,.55),(0,.55)],'M04',16)
 col('F02_proxy',(0,0,0),(.64,.59,.64));empty('SOCKET_F02_table_top',(0,.59,0));return g

def calibration():
 group('CAL');box('VIS_CAL_floor',(0,-.1,0),(8,.1,8),'M05');col('floor',(0,-.2,0),(8,.2,8),interaction=False)
 for x,z,w,d in [(-4,0,.1,8),(4,0,.1,8),(0,-4,8,.1),(0,4,8,.1)]:col('boundary',(x,0,z),(w,3,d))
 box('VIS_CAL_1_meter',(-1,0,-1),(.04,1,.04),'M06');tube('VIS_CAL_positive_Z',[(0,.02,0),(0,.02,1)],.015,'M06');mesh('VIS_CAL_arrow',[(0,.02,1.2),(-.1,.02,1),(.1,.02,1)],[(0,1,2)],'M06')
 for i in range(11):box('VIS_CAL_decimetre',(-1,.1*i,-1),(.09,.006,.04),'M07')
 place(side_table(),(0,0,0))

def material_textures():
 import numpy as np
 n=512;y,x=np.mgrid[0:n,0:n];u=x/n;v=y/n;rng=np.random.default_rng(731);noise=rng.random((n,n))-.5
 def image(name,data,color=False):
  im=bpy.data.images.new(name,width=n,height=n,alpha=False);im.colorspace_settings.name='sRGB' if color else 'Non-Color';rgba=np.ones((n,n,4),dtype=np.float32);rgba[:,:,:3]=data if data.ndim==3 else data[:,:,None];im.pixels.foreach_set(rgba.ravel());im.pack();return im
 for spec in recipes:
  id=spec['id'];wood=id in ['M01','M02','M03','M04'];fabric=id in ['M08','M09','M10','M11','M28'];fine=id in ['M05','M12','M13','M14','M27']
  if not (wood or fabric or fine or id=='M06'):continue
  c=np.array([int(spec['base_color_srgb'][i:i+2],16)/255 for i in [1,3,5]])
  if wood:
   warped=u+.010*np.sin(v*math.tau*2)+.006*np.sin(v*math.tau*7);grain=(np.sin(warped*math.tau*62)+.4*np.sin(warped*math.tau*163))*.007;variation=grain+noise*.012+.013*np.sin(warped*math.tau*5)
   if id=='M01':
    joints=(np.mod(u*8,1)<.008)|(np.mod(v*2+np.floor(u*8)*.347,1)<.003);variation=np.where(joints,-.12,variation)
   height=grain*.2+noise*.012
  elif fabric:
   variation=.008*np.sin(x*math.pi)+.008*np.sin(y*math.pi)+noise*.018;height=.04*np.sin(x*math.pi/2)+.04*np.sin(y*math.pi/2)
  else:variation=noise*(.012 if id=='M06' else .025);height=noise*.014
  data=np.clip(c[None,None,:]+variation[:,:,None],.005,.99);m=M[id];p=m.node_tree.nodes.get('Principled BSDF');ns=m.node_tree.nodes;links=m.node_tree.links
  im=image(id+'_baseColor',data,True);tex=ns.new('ShaderNodeTexImage');tex.image=im;links.new(tex.outputs['Color'],p.inputs['Base Color']);p.inputs['Base Color'].default_value=(1,1,1,1)
  dy,dx=np.gradient(height);norm=np.stack((-dx*3,-dy*3,np.ones_like(dx)),axis=2);norm/=np.linalg.norm(norm,axis=2)[:,:,None]
  im=image(id+'_normal',norm*.5+.5);tex=ns.new('ShaderNodeTexImage');tex.image=im;nm=ns.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.4 if fabric else .6;links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
  im=image(id+'_roughness',np.clip(spec['roughness']+noise*.075,0,1));tex=ns.new('ShaderNodeTexImage');tex.image=im;links.new(tex.outputs['Color'],p.inputs['Roughness'])


def materials_scene():
 group('CAL');box('VIS_CAL_material_floor',(0,-.1,0),(12,.1,8),'M05');col('floor',(0,-.2,0),(12,.2,8),interaction=False)
 for x,z,w,d in [(-6,0,.1,8),(6,0,.1,8),(0,-4,12,.1),(0,4,12,.1)]:col('edge',(x,0,z),(w,2,d))
 for i,spec in enumerate(recipes):
  x=(i%11-5)*.82;z=(i//11-1)*1.35
  bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=.29,location=xyz((x,.40,z)));o=bpy.context.object;own(o,'VIS_sample_'+spec['id'],spec['id'])
  for f in o.data.polygons:f.use_smooth=True
  box('VIS_sample_base_'+spec['id'],(x,0,z),(.65,.09,.65),'M05');empty('SOCKET_sample_'+spec['id'],(x,.8,z))


exec(compile((ROOT/'tools/production-corner.py').read_text(),str(ROOT/'tools/production-corner.py'),'exec'))
if STAGE not in ['graybox','calibration']:material_textures()
if STAGE=='full':
 for module in ['shell','east','synthesis','study','dressing','luggage','lighting','vines','props']:
  file=ROOT/('tools/production-'+module+'.py')
  if file.exists():exec(compile(file.read_text(),str(file),'exec'))
 for name in ['shell','reading','east','synthesis','study','dressing']:
  print('BUILD',name,flush=True);globals()['build_'+name]()
 if 'build_luggage' in globals():build_luggage()
 if 'build_lighting' in globals():build_lighting()
 if 'build_vines' in globals():build_vines()
 if 'build_props' in globals():build_props()
elif STAGE=='corner':corner()
elif STAGE=='materials':materials_scene()
elif STAGE=='calibration':calibration()
elif STAGE=='graybox':architecture();gray_furniture()
else:raise ValueError(STAGE)
root=None
empty('SPAWN_home',layout['spawn']['position']);empty('SPAWN_safe',(0,0,3.65))
for id,p in {'door':(0,1.3,4.65),'cabinet':(4.95,1.3,-1.45),'synthesis':(1.4,1.05,0),'journal':(-4.05,1.2,1.25),'phone':(4.25,1.5,3.45)}.items():empty('INTERACT_'+id,p)
# Only selection in our collection is exported. Default Blender camera/cube never enter output.
bpy.ops.object.select_all(action='DESELECT')
for o in collection.objects:o.select_set(True)
bpy.context.scene.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
stats=[]
for o in collection.objects:
 if o.type=='MESH':
  o.data.calc_loop_triangles();stats.append({'name':o.name,'root':o.parent.name if o.parent else None,'triangles':len(o.data.loop_triangles),'dimensions':list(o.dimensions),'materials':[m.name for m in o.data.materials]})
(SRC/(STAGE+'-stats.json')).write_text(json.dumps(stats,indent=2))
print('SAVE',STAGE,len(stats),flush=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/(STAGE+'.blend')))
# Preserve editable per-component source above; merge only static visual siblings for runtime.
# Colliders, sockets and facility semantics remain separate and are never merged.
if STAGE in ['corner','full']:
 for o in list(collection.objects):
  if o.type=='MESH' and o.name.startswith('VIS_'):
   bpy.context.view_layer.objects.active=o
   for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 for parent in [o for o in collection.objects if o.name.startswith('WW_')]:
  objects=[o for o in collection.objects if o.type=='MESH' and o.parent==parent and o.name.startswith('VIS_')]
  if not objects:continue
  parts=[o.name for o in objects];bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();merged=bpy.context.object;merged.name='VIS_'+parent.name[3:];merged['componentParts']=parts
 bpy.ops.object.select_all(action='DESELECT')
 for o in collection.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/(STAGE+'.glb')),use_selection=True,export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_tangents=True)
config={'schemaVersion':1,'stage':'production-'+STAGE,'model':'/static/assets/home/production/'+STAGE+'.glb','bounds':{'minX':-5.88,'maxX':5.88,'minZ':-6.95,'maxZ':5.3},'camera':{'yaw':0,'pitch':.15,'distance':3.2,'fov':58},'requiredFacilities':['door','cabinet','synthesis','journal','phone'],'lightRig':rig}
(OUT/(STAGE+'.json')).write_text(json.dumps(config,ensure_ascii=False,indent=2))
