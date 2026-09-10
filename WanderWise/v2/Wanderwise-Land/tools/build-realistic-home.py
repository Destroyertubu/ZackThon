"""Poly Haven CC0 + bespoke architecture, reproducible Blender -> GLB.
Y-up metres at runtime; Blender Z-up. No baked illumination. UVs are metre-scaled.
Run Blender --background --python tools/build-realistic-home.py -- corner|full.
"""
import bpy, math, random, json, sys, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1];SRC=ROOT/'assets-source/polyhaven';OUT=ROOT/'frontend/assets/home'
STAGE=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'corner'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
random.seed(109);M={};imports=[]
def mat(name,c,r=.7,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=r;p.inputs['Metallic'].default_value=metal;M[name]=m;return m
for n,c,r,metal in [('oak',(.22,.12,.06),.65,0),('walnut',(.09,.045,.021),.6,0),('plaster',(.64,.57,.46),.95,0),('sage',(.115,.155,.12),.85,0),('teal',(.025,.066,.063),.65,0),('brass',(.48,.29,.10),.33,.85),('paper',(.72,.65,.5),.94,0),('ink',(.019,.022,.019),.75,0),('linen',(.46,.40,.30),.97,0),('ceramic',(.54,.59,.5),.26,0),('stone',(.12,.115,.10),.94,0),('leaf',(.05,.13,.055),.75,0),('lamp',(.8,.62,.37),.86,0),('sky',(.42,.53,.52),1,0)]:mat(n,c,r,metal)
M['lamp'].node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.6,.33,.12,1);M['lamp'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.4

def pbr(name,asset):
 m=M[name];ns=m.node_tree.nodes;links=m.node_tree.links;p=ns.get('Principled BSDF')
 for semantic in ['diff','nor_gl','arm']:
  path=next((SRC/asset/'textures').glob('*_'+semantic+'_1k.jpg'));node=ns.new('ShaderNodeTexImage');node.image=bpy.data.images.load(str(path),check_existing=True);node.image.colorspace_settings.name='sRGB' if semantic=='diff' else 'Non-Color'
  if semantic=='diff':links.new(node.outputs['Color'],p.inputs['Base Color'])
  elif semantic=='nor_gl':
   normal=ns.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.45 if name=='plaster' else .7;links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
  else:
   sep=ns.new('ShaderNodeSeparateColor');links.new(node.outputs['Color'],sep.inputs['Color']);links.new(sep.outputs['Green'],p.inputs['Roughness'])
 # Surface-only PBR: no AO/lightmap for architecture; downloaded source ARM retained.
pbr('oak','wood_floor');pbr('plaster','plastered_wall_02')
# Small original woven-fibre tangent normal map, not a baked lightmap.
weave=bpy.data.images.new('Wanderwise woven fibre normal',width=256,height=256,alpha=False)
weave.colorspace_settings.name='Non-Color';pixels=[]
for y in range(256):
 for x in range(256):
  nx=.12*math.sin(x*math.pi/2);ny=.12*math.sin(y*math.pi/2);nz=math.sqrt(1-nx*nx-ny*ny);pixels.extend((nx*.5+.5,ny*.5+.5,nz*.5+.5,1))
weave.pixels=pixels;weave.pack()
for name in ['linen','lamp']:
 m=M[name];n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=weave;normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.30;m.node_tree.links.new(n.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],m.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
# Desaturated, aged oak is shared across all commissioned joinery. Imported furniture retains its own authored maps.
def pos(x,y,z):return (x,-z,y)
def uvmetric(o,tile=2):
 if not o.data.uv_layers:o.data.uv_layers.new()
 uv=o.data.uv_layers.active
 for face in o.data.polygons:
  axis=max(range(3),key=lambda i:abs(face.normal[i]));axes=([1,2],[0,2],[0,1])[axis]
  for li in face.loop_indices:
   co=o.data.vertices[o.data.loops[li].vertex_index].co
   uv.data[li].uv=(co[axes[0]]/tile,co[axes[1]]/tile)
def own(o,name,material):
 o.name='VIS_'+name;o['owner']=name.split('__')[0]
 if material:o.data.materials.append(M[material])
 return o
def box(name,x,y,z,w,h,d,material='oak',bevel=.015):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos(x,y+h/2,z));o=bpy.context.object;o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 uvmetric(o)
 if bevel:
  mod=o.modifiers.new('Joinery edge bevel','BEVEL');mod.width=min(bevel,w/4,h/4,d/4);mod.segments=1 if min(w,h,d)<.04 else 3;bpy.ops.object.modifier_apply(modifier=mod.name);o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return own(o,name,material)
def rod(name,a,b,r,material='brass',r2=None,verts=20):
 a,b=Vector(pos(*a)),Vector(pos(*b));v=b-a;bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=r if r2 is None else r2,depth=v.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();own(o,name,material)
 for f in o.data.polygons:f.use_smooth=True
 return o
def curve(name,pts,r,material='brass'):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=3;c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
 for p,co in zip(s.bezier_points,pts):p.co=pos(*co);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new('VIS_'+name,c);bpy.context.collection.objects.link(o);own(o,name,material);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return o
def empty(name,p):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos(*p);return o
def col(name,x,y,z,w,h,d,player=True,camera=True,interaction=True):
 o=box('collision',x,y,z,w,h,d,None,0);o.name='COL_'+name;o['player']=player;o['camera']=camera;o['interaction']=interaction;return o

def model(asset,x,y,z,yaw=0,owner='reading'):
 before=set(bpy.data.objects);f=next((SRC/asset).glob('*.gltf'));bpy.ops.import_scene.gltf(filepath=str(f));bpy.context.view_layer.update();objects=set(bpy.data.objects)-before;meshes=[o for o in objects if o.type=='MESH'];points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)]);offset=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z));rot=Matrix.Rotation(yaw,4,'Z');translation=Matrix.Translation(Vector(pos(x,y,z)))
 for o in meshes:
  world=o.matrix_world.copy();o.parent=None;o.matrix_world=translation@rot@Matrix.Translation(offset)@world;o.name='VIS_'+owner+'__'+o.name;o['owner']=owner
 for o in objects:
  if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
 imports.append({'asset':asset,'position':[x,y,z],'yaw':yaw,'dimensions':list(hi-lo),'scale':1})
 return meshes

def book(owner,x,y,z,w=.12,h=.35,d=.26,cover='teal'):
 box(owner+'__pages',x,y+.008,z,w-.014,h-.02,d-.012,'paper',.006)
 for side in [-1,1]:box(owner+'__cover',x+side*(w-.01)/2,y,z,.014,h,d,cover,.004)
 box(owner+'__spine',x,y,z+d/2,w,h,.018,cover,.006)
 for yy in [.055,h-.06]:box(owner+'__foil',x,y+yy,z+d/2+.011,w*.6,.01,.002,'brass',.001)

def desk(owner,x,z,w=2.1,d=.88):
 box(owner+'__top',x,.78,z,w,.055,d,'oak',.028)
 box(owner+'__apron',x,.61,z,w-.16,.16,d-.14,'walnut',.012)
 for dx in [-w/2+.14,w/2-.14]:
  for dz in [-d/2+.12,d/2-.12]:
   # Turned tapered legs with collars, not raw cylinders as finished furniture.
   for a,b,r1,r2 in [(0,.08,.035,.045),(.08,.16,.045,.037),(.16,.58,.037,.028),(.58,.63,.05,.05),(.63,.78,.043,.043)]:rod(owner+'__turnedleg',(x+dx,a,z+dz),(x+dx,b,z+dz),r1,'walnut',r2)
 for dx in [-w*.25,w*.25]:
  box(owner+'__drawer',x+dx,.64,z+d/2-.045,w*.44,.115,.065,'oak',.012);curve(owner+'__pull',[(x+dx-.08,.693,z+d/2),(x+dx-.07,.68,z+d/2+.026),(x+dx+.07,.68,z+d/2+.026),(x+dx+.08,.693,z+d/2)],.009)
 col(owner+'_desk',x,0,z,w,.84,d)

def lamp(owner,x,y,z):
 rod(owner+'__base',(x,y,z),(x,y+.028,z),.145,'brass',.125,32);rod(owner+'__stem',(x,y+.03,z),(x,y+.48,z),.017)
 # Open fabric lampshade: shell, not a solid glowing cone.
 verts=[];faces=[]
 for yy,r in [(y+.35,.22),(y+.63,.13)]:
  for i in range(48):a=i*math.tau/48;rr=r+(.002 if i%2 else -.002);verts.append(pos(x+rr*math.cos(a),yy,z+rr*math.sin(a)))
 for i in range(48):j=(i+1)%48;faces.append((i,j,48+j,48+i))
 mesh=bpy.data.meshes.new('woven shade');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('shade',mesh);bpy.context.collection.objects.link(o);own(o,owner+'__shade','lamp');uvmetric(o,.3);o.modifiers.new('Fabric thickness','SOLIDIFY').thickness=.003
 for yy,r in [(y+.35,.22),(y+.63,.13)]:curve(owner+'__rim',[(x+r*math.cos(i*math.tau/32),yy,z+r*math.sin(i*math.tau/32)) for i in range(33)],.006,'linen')

def plant(x,y,z):
 rod('plants__pot',(x,y,z),(x,y+.24,z),.12,'ceramic',.17,32);rod('plants__soil',(x,y+.238,z),(x,y+.242,z),.152,'walnut')
 for i in range(9):
  a=i*2.4;h=.35+(i%3)*.10;end=(x+math.cos(a)*.22,y+.24+h,z+math.sin(a)*.22);curve('plants__stem',[(x,y+.22,z),(x+math.cos(a)*.06,y+.42,z+math.sin(a)*.06),end],.005,'leaf')
  # Curved, pointed leaves with a central vein and visible silhouette.
  A=Vector(end);direction=Vector((math.cos(a)*.18,.06,math.sin(a)*.18));side=Vector((-math.sin(a)*.075,0,math.cos(a)*.075));verts=[pos(*A),pos(*(A+direction*.5+side)),pos(*(A+direction+Vector((0,-.055,0)))),pos(*(A+direction*.5-side)),pos(*(A+direction*.48+Vector((0,.028,0))))];me=bpy.data.meshes.new('leaf');me.from_pydata(verts,[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]);me.update();o=bpy.data.objects.new('leaf',me);bpy.context.collection.objects.link(o);own(o,'plants__leaf','leaf');o.modifiers.new('Leaf thickness','SOLIDIFY').thickness=.001

# New intimate 10.8 x 9 m shell, 3.8 m high; existing checkpoints remain within larger bounds.
# Preserve 12x10 outer walk envelope for compatibility; furniture uses the same facility IDs.
box('floor',0,-.14,0,12,.14,10,'oak',.008);col('floor',0,-.2,0,12,.2,10,True,True,False)
# north: wide recessed window on right, door on left; each opening has its own lintel.
for x,w in [(-5.2,1.6),(-1.1,2.6),(5.35,1.3)]:box('walls__north',x,0,-5,w,3.85,.36,'plaster');col('north'+str(x),x,0,-5,w,3.85,.36)
for name,x,w,lower,upper in [('door',-3.3,2.2,0,2.8),('window',2.5,4.4,1.12,3.3)]:
 if lower:box('walls__'+name+'sill',x,0,-5,w,lower,.36,'plaster');col(name+'sill',x,0,-5,w,lower,.36)
 box('walls__'+name+'lintel',x,upper,-5,w,3.85-upper,.36,'plaster');col(name+'lintel',x,upper,-5,w,3.85-upper,.36)
for x in [-6,6]:box('walls__side',x,0,0,.36,3.85,10.3,'plaster');col('side'+str(x),x,0,0,.36,3.85,10.3)
box('walls__south',0,0,5,12.3,3.85,.36,'plaster');col('south',0,0,5,12.3,3.85,.36)
box('ceiling',0,3.85,0,12.3,.16,10.3,'plaster');col('ceiling',0,3.85,0,12.3,.16,10.3,True,True,False)
# Wainscot, baseboard, cornice and framed bays across side/rear walls.
for x in [-5.79,5.79]:
 box('panels__side',x,0,0,.06,.96,9.7,'sage',.006)
 for y,w,h in [(0,.12,.12),(.94,.13,.045),(3.64,.18,.055),(3.72,.12,.08)]:box('molding__side',x,y,0,w,h,9.75,'walnut')
 for z in [i*.8-4.4 for i in range(12)]:box('panels__stile',x,.14,z,.09,.71,.034,'walnut',.004)
box('panels__rear',0,0,4.79,11.6,.96,.06,'sage',.006)
for y in [0,.93,3.67]:box('molding__rear',0,y,4.75,11.6,.07,.09,'walnut')
for z in [-4.68,-1.6,1.6,4.68]:box('beams',0,3.62,z,11.7,.23,.19,'walnut',.025)
# Recessed casement window with double jamb, deep sill and intentional mullion spacing.
for x in [.28,4.72]:
 box('window__jamb',x,1.05,-4.85,.12,2.35,.47,'walnut');box('window__casing',x,1.02,-4.58,.17,2.43,.07,'oak')
for y in [1.06,3.29]:box('window__rail',2.5,y,-4.86,4.58,.12,.45,'walnut')
box('window__sill',2.5,1.08,-4.64,4.75,.09,.83,'oak',.024)
for x in [1.4,2.5,3.6]:box('window__mullion',x,1.19,-4.90,.045,2.12,.12,'walnut',.006)
box('window__mullion',2.5,2.35,-4.90,4.35,.045,.12,'walnut',.006)
col('window_glass',2.5,1.12,-5,4.4,2.18,.06,True,True,False)
# Draped linen panels with curved hem and folds, UV mapped at fabric scale.
for x0 in [.3,4.15]:
 verts=[];faces=[]
 for iy in range(18):
  f=iy/17;y=.33+f*3.08
  for ix in range(25):
   t=ix/24;x=x0+t*.55;z=-4.43+.075*math.cos(t*math.pi*8)+.05*math.sin(f*math.pi);verts.append(pos(x,y+.012*math.sin(t*math.pi*8),z))
 for iy in range(17):
  for ix in range(24):a=iy*25+ix;faces.append((a,a+1,a+26,a+25))
 me=bpy.data.meshes.new('linen folds');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('curtain',me);bpy.context.collection.objects.link(o);own(o,'drapery__linen','linen');uvmetric(o,.5);o.modifiers.new('Hem thickness','SOLIDIFY').thickness=.004
rod('window__curtainrail',(.05,3.47,-4.42),(4.95,3.47,-4.42),.019)
# Actual modeled exterior grove: trunks, branches and leaf silhouettes, not a pasted render.
box('exterior__horizon',0,-1,-22,35,17,.1,'sky',0)
for i in range(11):
 x=-9+i*1.6;z=-17-(i%3)*1.4;rod('exterior__trunk',(x,0,z),(x,7,z),.11,'walnut',.045)
 for j in range(4):
  yy=2.4+j*1.1;end=(x+(-1 if j%2 else 1)*.8,yy+1,z+.25);rod('exterior__branch',(x,yy,z),end,.034,'walnut',.01)
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=pos(end[0],end[1],end[2]));o=bpy.context.object;o.scale=(.75,.7,.85);
  for polygon in o.data.polygons:polygon.use_smooth=True
  own(o,'exterior__canopy','leaf')
# Reading corner quality gate.
box('reading_rug',2.1,.002,-2.8,2.7,.008,2.7,'linen',.003)
for x in [.79,3.41]:box('reading_rug__border',x,.011,-2.8,.028,.001,2.62,'sage',0)
for z in [-4.11,-1.49]:box('reading_rug__border',2.1,.011,z,2.62,.001,.028,'sage',0)
desk('journal',2.15,-3.6,2.05,.90);lamp('journal',2.82,.835,-3.75);plant(3.68,1.17,-4.60)
model('ArmChair_01',2.25,0,-2.28,math.pi,owner='journal_chair');col('journal_chair',2.25,0,-2.28,.86,1.06,.79)
# Open handbound notebook, layered page edges, bowed leaves and ribbon.
box('journal__cover',1.95,.84,-3.43,.65,.02,.44,'teal',.012)
for side in [-1,1]:
 verts=[];faces=[]
 for row in range(2):
  for i in range(13):f=i/12;verts.append(pos(1.95+side*f*.305,.871+.016*math.sin(f*math.pi),-3.63+row*.40))
 for i in range(12):faces.append((i,i+1,i+14,i+13))
 me=bpy.data.meshes.new('curved book leaves');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('paper',me);bpy.context.collection.objects.link(o);own(o,'journal__pages','paper');uvmetric(o);o.modifiers.new('Pages','SOLIDIFY').thickness=.012
 for i in range(6):box('journal__writing',1.95+side*.16,.891,-3.58+i*.048,.22,.001,.003,'ink',0)
curve('journal__ribbon',[(1.95,.893,-3.61),(1.95,.90,-3.27),(1.95,.836,-3.15)],.007,'sage')
rod('journal__pen',(2.42,.858,-3.51),(2.53,.858,-3.28),.008)
rod('journal__cup',(1.34,.84,-3.5),(1.34,.97,-3.5),.06,'ceramic',.073,32);rod('journal__tea',(1.34,.970,-3.5),(1.34,.972,-3.5),.061,'walnut',None,32);curve('journal__handle',[(1.406,.865,-3.5),(1.46,.911,-3.5),(1.411,.952,-3.5)],.011,'ceramic')
# CC0 carved cabinet retains separate door meshes and original metal/roughness/normal textures.
model('GothicCabinet_01',-.95,0,-4.23,owner='cabinet');col('cabinet',-.95,0,-4.23,1.76,2.4,1.15)
# Complementary narrow shelf for reference volumes, deliberately edited and curated.
model('Shelf_01',4.90,0,-4.60,owner='reference')
for level in [0,2,4]:
 for i in range(5):book('reference',4.56+i*.14,.382+level*.2816,-4.50,.10,.22+(i%2)*.012,.18,['teal','sage','walnut'][i%3])
# Door: recessed panels, sculpted casing and discrete brass latch.
for x in [-4.4,-2.2]:
 box('door__jamb',x,0,-4.82,.13,2.91,.43,'walnut');box('door__casing',x,0,-4.57,.20,2.95,.09,'oak')
box('door__crown',-3.3,2.83,-4.67,2.5,.17,.34,'walnut',.025)
box('door_leaf',-3.3,.025,-5.03,2.06,2.78,.12,'teal',.015)
for y,h in [(.25,1.03),(1.45,1.05)]:
 box('door_leaf__recess',-3.3,y,-4.955,1.7,h,.028,'sage',.01)
 for x in [-4.18,-2.42]:box('door_leaf__stile',x,y,-4.93,.045,h,.035,'walnut',.006)
 for yy in [y,y+h]:box('door_leaf__rail',-3.3,yy,-4.93,1.80,.045,.035,'walnut',.006)
rod('door_leaf__rose',(-2.59,1.23,-4.91),(-2.59,1.23,-4.88),.045);curve('door_leaf__handle',[(-2.59,1.23,-4.88),(-2.59,1.23,-4.83),(-2.78,1.23,-4.83)],.016)
box('door__threshold',-3.3,0,-4.96,2.12,.023,.47,'brass',.006);col('door_leaf',-3.3,0,-5.07,2.10,2.83,.13)
empty('SPAWN_home',(0,0,.65));empty('SPAWN_safe',(0,0,1.8));empty('INTERACT_door',(-3.3,1.5,-4.55));empty('INTERACT_cabinet',(-.95,1.65,-3.55));empty('INTERACT_journal',(2.15,1.2,-2.90))
if STAGE=='full':
 # Workshop: substantial writing surface, leather pads, material trays and brass linkage.
 desk('synthesis',-4.40,.25,2.25,1.05)
 for x in [-5.02,-4.4,-3.78]:
  box('synthesis__pad',x,.838,.25,.52,.012,.62,'teal',.035);box('synthesis__card',x,.852,.25,.35,.006,.43,'paper',.007)
  for i in range(3):box('synthesis__note',x,.859,.11+i*.07,.24,.001,.003,'ink',0)
 curve('synthesis__link',[(-5.05,.87,-.10),(-4.8,1.11,-.12),(-4.4,1.02,-.12),(-4.0,1.11,-.12),(-3.75,.87,-.10)],.009)
 lamp('synthesis',-5.19,.836,.59);empty('INTERACT_synthesis',(-4.4,1.35,1.0))
 # Workshop backboard / reference shelf is physically mounted and separately collidable.
 model('Shelf_01',-5.6,0,-2.0,math.pi/2,owner='workshop_shelf');col('workshop_shelf',-5.6,0,-2,.29,2.1,1.01)
 for i in range(5):
  before=set(bpy.data.objects);book('workshop',-5.50,.382,-2.33+i*.15,.10,.22,.16)
  pivot=Matrix.Translation(Vector(pos(-5.50,.382,-2.33+i*.15)));rotation=pivot@Matrix.Rotation(math.pi/2,4,'Z')@pivot.inverted()
  for obj in set(bpy.data.objects)-before:obj.matrix_world=rotation@obj.matrix_world
 # Quiet lounge and architectural fireplace at east wall.
 for z in [-.88,.88]:box('hearth__jamb',5.62,0,z,.48,1.35,.30,'stone',.065)
 box('hearth__lintel',5.62,1.26,0,.48,.20,2.04,'stone',.05);box('hearth__mantel',5.54,1.48,0,.84,.09,2.3,'oak',.027)
 box('hearth__back',5.81,.15,0,.035,1.1,1.4,'ink',.004);box('hearth__slab',5.37,0,0,1.20,.07,2.40,'stone',.025)
 for z in [-.38,.08,.45]:rod('hearth__logs',(5.3,.16,z),(5.63,.16,z+.12),.075,'walnut',None,16)
 col('hearth',5.5,0,0,.9,1.6,2.4);plant(5.5,1.58,.76)
 model('ArmChair_01',3.95,0,.1,-math.pi/2,owner='lounge');col('loungechair',3.95,0,.1,.8,1.08,.88)
 box('lounge__rug',3.7,.002,.3,2.05,.009,2.85,'linen',.003)
 # Small circular side table with turned pedestal and splayed feet.
 rod('lounge__tabletop',(3.63,.61,1.42),(3.63,.65,1.42),.36,'oak',None,48);rod('lounge__pedestal',(3.63,.10,1.42),(3.63,.61,1.42),.037,'walnut',.055)
 for a in [0,2.094,4.189]:curve('lounge__foot',[(3.63,.22,1.42),(3.63+math.cos(a)*.1,.10,1.42+math.sin(a)*.1),(3.63+math.cos(a)*.27,.025,1.42+math.sin(a)*.27)],.027,'walnut')
 col('side_table',3.63,0,1.42,.72,.67,.72)
 # Telephone booth: paneled wood, etched glass, corded black telephone and open doorway.
 for x in [4.12,5.53]:
  for z in [2.32,3.87]:box('phone__post',x,0,z,.095,2.62,.095,'walnut')
 box('phone__cornice',4.825,2.56,3.095,1.64,.16,1.76,'walnut',.03);box('phone__back',4.825,.1,3.86,1.38,2.48,.06,'sage')
 for y in [.13,.76,2.45]:box('phone__rail',4.825,y,3.8,1.36,.045,.045,'oak',.005)
 box('phone__desk',4.825,1.04,3.5,1.36,.065,.61,'oak',.024)
 box('phone__base',4.82,1.112,3.43,.47,.095,.31,'ink',.038);rod('phone__dial',(4.82,1.21,3.43),(4.82,1.219,3.43),.095,'brass',None,40)
 for i in range(10):
  a=i*math.tau/10;rod('phone__dialholes',(4.82+math.cos(a)*.066,1.22,3.43+math.sin(a)*.066),(4.82+math.cos(a)*.066,1.223,3.43+math.sin(a)*.066),.012,'ink',None,12)
 curve('phone__receiver',[(4.56,1.26,3.51),(4.59,1.37,3.51),(5.05,1.37,3.51),(5.08,1.26,3.51)],.032,'ink')
 for x in [4.56,5.08]:rod('phone__earpiece',(x,1.23,3.51),(x,1.28,3.51),.063,'ink',.048,24)
 curve('phone__cord',[(5.09+.023*math.sin(i*1.5),1.28-i*.012,3.5+.023*math.cos(i*1.5)) for i in range(54)],.006,'ink')
 col('phone_back',4.825,0,3.86,1.53,2.75,.14);col('phone_desk',4.825,0,3.5,1.4,1.14,.66)
 for x in [4.12,5.53]:
  for z in [2.32,3.87]:col('phone_post'+str(x)+str(z),x,0,z,.12,2.7,.12)
  # Clear panels are a separate visual layer; no camera or interaction obstruction.
  glass=mat('glass'+str(x),(.18,.28,.24),.18);glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.10
  box('phone__glass',x,.80,3.09,.009,1.63,1.40,'glass'+str(x),0);col('phone_glass'+str(x),x,.8,3.09,.02,1.63,1.4,True,False,False)
 empty('INTERACT_phone',(4.825,1.6,2.38))
 # Rear atlas console, carefully grouped travel objects; broad central circulation stays open.
 desk('atlas',-.3,4.05,2.5,.64)
 for i in range(4):book('atlas',-.9+i*.14,.84,4.02,.11,.33,.25,['sage','teal'][i%2])
 plant(.52,.84,4.03)

# Apply modifiers, retain semantic owner batches and separate original cabinet door parts.
for o in list(bpy.data.objects):
 if o.type=='MESH' and o.name.startswith('VIS_'):
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
for owner in sorted({o.get('owner') for o in bpy.data.objects if o.name.startswith('VIS_')}):
 if owner=='cabinet':continue
 objects=[o for o in bpy.data.objects if o.type=='MESH' and o.get('owner')==owner and o.name.startswith('VIS_')]
 if not objects:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='VIS_'+owner
bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
blend=ROOT/'assets-source'/('home-realistic-'+STAGE+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend))
path=OUT/('home-realistic-'+STAGE+'.glb');bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_tangents=True,export_image_format='AUTO')
report={'stage':STAGE,'blender':bpy.app.version_string,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'imports':imports,'lighting':'Runtime direct shadows and generated PMREM environment. No baked lighting. Imported ARM AO only where original glTF provides it.','textures':'Original color=sRGB, normal/ARM=Non-Color. Metre-projected architecture UV, authored furniture UV.','source':str(blend.relative_to(ROOT))}
(OUT/('home-realistic-'+STAGE+'.build.json')).write_text(json.dumps(report,indent=2));print('EXPORTED',json.dumps(report))
