"""Reproducible, meter-scale Blender scene. Run Blender --background --python this.py -- corner|full.
Only selected CC0 KayKit files are imported. VIS groups are joined by semantic owner;
COL/SPAWN/INTERACT nodes are never merged. No baked lighting is claimed.
"""
import bpy, math, random, sys, json, hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
STAGE=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'corner'
OUT=ROOT/'frontend/assets/home';OUT.mkdir(parents=True,exist_ok=True)
SRC=ROOT/'assets-source/kaykit-furniture'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
random.seed(731)
M={}
def mat(name,col,rough=.75,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;M[name]=m;return m
# Values are scene-linear, not CSS colors. glTF keeps these semantics.
mat('warm oak',(.30,.16,.072),.78);mat('oak edge',(.16,.075,.033),.73);mat('cream plaster',(.64,.57,.43),.92)
mat('sage linen',(.16,.25,.17),.95);mat('deep teal',(.035,.10,.095),.82);mat('brass',(.48,.30,.09),.36,.72)
mat('paper',(.77,.69,.5),.92);mat('ceramic',(.66,.57,.37),.47);mat('ink',(.035,.055,.045),.87)
mat('curtain',(.66,.58,.43),.98);mat('stone',(.24,.23,.18),.96);mat('green',(.065,.17,.07),.92)
mat('glass',(.25,.40,.35),.23);M['glass'].diffuse_color=(.25,.40,.35,.14);M['glass'].node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.14;mat('sky',(.34,.47,.42),1);mat('lamp shade',(.85,.66,.34),.9)
M['lamp shade'].node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(.7,.32,.06,1)
M['lamp shade'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=.18
for i in range(5):mat('plank'+str(i),(.24+i*.015,.12+i*.010,.048+i*.004),.84)

def pos(x,y,z):return (x,-z,y)
def own(o,name,material='warm oak'):
 o.name='VIS_'+name;o['owner']=name.split('__')[0]
 if material:o.data.materials.append(M[material])
 return o

def box(name,x,y,z,w,h,d,material='warm oak',bevel=.025,yaw=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos(x,y+h/2,z));o=bpy.context.object;o.dimensions=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('Crafted edge radius','BEVEL');mod.width=min(bevel,w/4,h/4,d/4);mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name)
  o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
 o.rotation_euler[2]=yaw;return own(o,name,material)

def rod(name,a,b,r,material='brass',vertices=12,r2=None):
 A=Vector(pos(*a));B=Vector(pos(*b));v=B-A
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=v.length,location=(A+B)/2)
 o=bpy.context.object;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();own(o,name,material)
 for p in o.data.polygons:p.use_smooth=True
 return o

def curve(name,points,r,material='brass'):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
 s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for p,co in zip(s.bezier_points,points):p.co=pos(*co);p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 o=bpy.data.objects.new('VIS_'+name,c);bpy.context.collection.objects.link(o);c.materials.append(M[material]);o['owner']=name.split('__')[0]
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False);return o

def empty(name,p):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos(*p);return o

def col(name,x,y,z,w,h,d,player=True,camera=True,interaction=True):
 o=box('collision',x,y,z,w,h,d,None,0);o.name='COL_'+name;o['player']=player;o['camera']=camera;o['interaction']=interaction;return o

imports=[]
def imported(name,x,y,z,scale=1,yaw=0,owner='journal'):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(SRC/(name+'.gltf')))
 objects=list(set(bpy.data.objects)-before);meshes=[o for o in objects if o.type=='MESH']
 for o in meshes:
  # Source glTF is already Y-up, meter scale. Blender importer changes to Z-up.
  o.name='VIS_'+owner+'__KayKit_'+name;o['owner']=owner;o.scale*=scale;o.rotation_euler[2]+=yaw;o.location+=Vector(pos(x,y,z))
  for m in o.data.materials:
   if m and m.use_nodes:m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85
 if name=='armchair_pillows':
  # Classify the source atlas UV regions, then assign cloth materials to the mesh.
  # Source image is unchanged; this is an explicit geometry/material adaptation.
  for o in meshes:
   image=next((n.image for m in o.data.materials if m and m.use_nodes for n in m.node_tree.nodes if n.type=='TEX_IMAGE'),None)
   if image:
    px=list(image.pixels);W,H=image.size;uv=o.data.uv_layers.active
    indices=[]
    for face in o.data.polygons:
     u=sum(uv.data[k].uv.x for k in face.loop_indices)/len(face.loop_indices);v=sum(uv.data[k].uv.y for k in face.loop_indices)/len(face.loop_indices)
     i=(min(H-1,max(0,int(v*H)))*W+min(W-1,max(0,int(u*W))))*4;r,g,b=px[i:i+3];indices.append(1 if b>r*1.2 else 0)
    o.data.materials.clear();o.data.materials.append(M['sage linen']);o.data.materials.append(M['curtain'])
    for f,i in zip(o.data.polygons,indices):f.material_index=i
 imports.append({'asset':name,'scale':scale,'position':[x,y,z],'yaw':yaw,'owner':owner})
 return meshes

# A real floor and connected shell; wall openings are split geometry and split collision.
for i in range(48):
 x=-5.875+i*.25
 for j in range(4):
  z=-3.75+j*2.5
  box('architecture__floor',x,-.16,z,.243,.16,2.492,'plank'+str((i+j)%5),.008)
# north segments around door (-3.2) and recessed window (2.4)
for x,w in [(-5.15,1.7),(-.95,2.5),(5.225,1.55)]:
 box('architecture__north',x,0,-5,w,4.4,.34,'cream plaster');col('north'+str(x),x,0,-5,w,4.4,.34)
box('architecture__door_lintel',-3.2,3.05,-5,2.2,1.35,.34,'cream plaster');col('door_lintel',-3.2,3.05,-5,2.2,1.35,.34)
box('architecture__window_sill_wall',2.4,0,-5,4.1,1.35,.34,'cream plaster');col('window_sill',2.4,0,-5,4.1,1.35,.34)
box('architecture__window_header',2.4,3.65,-5,4.1,.75,.34,'cream plaster');col('window_header',2.4,3.65,-5,4.1,.75,.34)
for x in [-6,6]:
 box('architecture__side',x,0,0,.32,4.4,10.3,'cream plaster');col('side'+str(x),x,0,0,.32,4.4,10.3)
box('architecture__south',0,0,5,12.3,4.4,.32,'cream plaster');col('south',0,0,5,12.3,4.4,.32)
box('architecture__ceiling',0,4.45,0,12.3,.15,10.3,'cream plaster');col('ceiling',0,4.4,0,12.3,.2,10.3,False,True,False)
for z in [-4.75,0,4.75]:box('architecture__beam',0,4.1,z,12,.30,.24,'oak edge',.035)
for x in [-5.78,5.78]:box('architecture__crown',x,3.98,0,.18,.16,10,'oak edge')
for z in [-4.79,4.79]:box('architecture__crown',0,3.98,z,11.6,.16,.18,'oak edge')
# wainscot on solid side and rear walls, framed panels rather than blank boxes
for x in [-5.80,5.80]:
 box('architecture__dado',x,0,0,.07,.94,9.8,'sage linen',.012)
 box('architecture__rail',x,.93,0,.13,.06,9.8,'warm oak',.014)
 for z in [i*.65-4.6 for i in range(15)]:box('architecture__stile',x,.08,z,.095,.8,.055,'warm oak',.008)
for z in [4.8]:box('architecture__dado',0,0,z,11.6,.94,.07,'sage linen',.01);box('architecture__rail',0,.93,z,11.6,.06,.13,'warm oak',.01)
# Deep north window; glass is visual-only. Opening is physically closed by glass for player/camera.
for x in [.34,4.46]:box('window__jamb',x,1.25,-4.87,.17,2.55,.5,'warm oak',.018)
for y in [1.25,3.67]:box('window__frame',2.4,y,-4.87,4.32,.17,.5,'warm oak',.02)
box('window__sill',2.4,1.26,-4.66,4.54,.11,.85,'warm oak',.035)
for x in [1.37,2.4,3.43]:box('window__mullion',x,1.4,-4.88,.055,2.25,.13,'oak edge',.008)
box('window__mullion',2.4,2.55,-4.88,4,.05,.13,'oak edge',.008)
# Background is actual distant geometry outside the window, not a screenshot.
box('exterior__sky',2.4,0,-17,25,13,.1,'sky',0)
for i in range(7):
 x=-4+i*1.9;rod('exterior__trunk',(x,0,-12.5),(x,5,-12.5),.15,'oak edge')
 for y,r in [(2.7,1.1),(3.7,.85),(4.6,.56)]:rod('exterior__pine',(x,y,-12.5),(x,y+1.7,-12.5),r,'green',9,0)
col('window_glass',2.4,1.35,-5,4.05,2.3,.10,True,True,False)
# Cloth drapes use a folded mesh, including thickness, not stretched cubes.
for side in [0,1]:
 x0=.35 if side==0 else 3.78;verts=[];faces=[]
 for iy in range(9):
  y=1.40+iy*.28
  for ix in range(25):
   x=x0+ix*.027;z=-4.49+.048*math.sin(ix/24*math.pi*8);verts.append(pos(x,y,z))
 for iy in range(8):
  for ix in range(24):a=iy*25+ix;faces.append((a,a+1,a+26,a+25))
 mesh=bpy.data.meshes.new('folded linen');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('VIS_window__curtain',mesh);bpy.context.collection.objects.link(o);own(o,'window__curtain','curtain');mod=o.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.008
rod('window__rod',(.15,3.87,-4.48),(4.66,3.87,-4.48),.026)
# Reading desk: actual downloaded modeled furniture with original UV atlas.
imported('table_medium_long',2.35,0,-3.7,.82,owner='journal')
imported('chair_B_wood',2.3,0,-2.53,.9,math.pi,owner='journal')
box('journal__drawer',2.35,.61,-2.91,1.13,.14,.08,'sage linen',.026)
rod('journal__drawer_pull',(2.23,.67,-2.85),(2.47,.67,-2.85),.013)
box('journal__chair_cushion',2.30,.40,-2.53,.55,.065,.49,'sage linen',.05)
imported('lamp_table',3.12,.82,-3.92,.40,owner='journal')
imported('cactus_medium_A',4.00,1.37,-4.61,.66,owner='window')
col('journal_desk',2.35,0,-3.7,2.46,.88,1.64)
col('journal_chair',2.3,0,-2.53,.62,1.1,.70)
# Open journal, softly bowed pages, stitched spine and brass pen.
box('journal__bookcover',2.17,.825,-3.48,.78,.034,.52,'deep teal',.018)
for side in [-1,1]:
 verts=[];faces=[]
 for row in range(2):
  for i in range(9):
   f=i/8;verts.append(pos(2.17+side*f*.36,.870+.027*math.sin(f*math.pi),-3.70+row*.46))
 for i in range(8):faces.append((i,i+1,i+10,i+9))
 mesh=bpy.data.meshes.new('curved paper');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('pages',mesh);bpy.context.collection.objects.link(o);own(o,'journal__pages','paper');o.modifiers.new('Paper thickness','SOLIDIFY').thickness=.004
 for i in range(6):box('journal__ink',2.17+side*.20,.9,-3.64+i*.055,.22,.001,.006,'ink',0)
rod('journal__pen',(2.79,.858,-3.35),(2.98,.858,-3.68),.012)
# Cup is hollow, with a curved handle.
rod('journal__cup',(1.58,.84,-3.35),(1.58,1.00,-3.35),.075,'ceramic',24,.087)
rod('journal__tea',(1.58,1.005,-3.35),(1.58,1.007,-3.35),.065,'oak edge',24)
curve('journal__cup_handle',[(1.66,.87,-3.35),(1.73,.92,-3.35),(1.66,.98,-3.35)],.014,'ceramic')
# Bespoke bookcase: crown, side stiles, shelves, drawers, classification cards.
for x in [-1.48,-.04]:box('cabinet__side',x,0,-4.43,.10,3.15,.74,'warm oak',.025)
box('cabinet__back',-.76,.12,-4.77,1.4,2.94,.08,'oak edge',.014)
for y in [.1,.68,1.31,1.94,2.57,3.14]:box('cabinet__shelf',-.76,y,-4.4,1.59,.075,.82,'warm oak',.02)
box('cabinet__crown',-.76,3.21,-4.43,1.76,.11,.87,'oak edge',.033)
for x in [-1.12,-.40]:
 box('cabinet__drawer',x,.17,-4.02,.68,.40,.07,'sage linen',.024);rod('cabinet__knob',(x,.38,-3.96),(x,.38,-3.92),.04)
 box('cabinet__index',x,.23,-3.966,.16,.065,.006,'paper',.002)
for level in [0,1,2,3]:
 y=.755+level*.63
 for i in range(8):
  h=.36+(i%3)*.045;x=-1.39+i*.16
  box('cabinet__volume',x,y,-4.31,.115,h,.35,['deep teal','paper','sage linen','oak edge'][i%4],.012,yaw=(.04 if i==7 else 0))
  for yy in [.07,h-.075]:box('cabinet__foil',x,y+yy,-4.129,.089,.012,.004,'brass',.001)
col('cabinet',-.76,0,-4.41,1.76,3.32,.91)
# Door frame and inset paneled leaf; leaf remains its own semantic object.
for x in [-4.28,-2.12]:box('door__jamb',x,0,-4.85,.16,3.19,.42,'oak edge',.025)
box('door__lintel',-3.2,3.13,-4.85,2.34,.16,.42,'oak edge',.025)
box('door_leaf__panel',-3.2,.02,-5.07,1.96,3.02,.12,'deep teal',.035)
for y in [.35,1.63]:
 box('door_leaf__inset',-3.2,y,-4.99,1.65,1.10,.05,'sage linen',.016)
 for x in [-4.04,-2.36]:box('door_leaf__molding',x,y,-4.94,.04,1.11,.04,'warm oak',.008)
 for yy in [y,y+1.06]:box('door_leaf__molding',-3.2,yy,-4.94,1.70,.04,.04,'warm oak',.008)
rod('door_leaf__latch',(-2.52,1.34,-4.89),(-2.76,1.34,-4.89),.027)
box('door__threshold',-3.2,0,-4.98,2.15,.035,.54,'brass',.008)
col('door_leaf',-3.2,0,-5.09,1.96,3.08,.13)
empty('INTERACT_door',(-3.2,1.65,-4.68));empty('INTERACT_cabinet',(-.76,1.7,-3.84));empty('INTERACT_journal',(2.35,1.25,-2.80))
empty('SPAWN_home',(0,0,.65));empty('SPAWN_safe',(0,0,1.8))
if STAGE=='full':
 # Distinct artisan synthesis bench, angled wood legs and brass connection rail.
 box('synthesis__top',-4.65,.91,.95,1.45,.13,2.70,'warm oak',.065)
 for x in [-5.14,-4.16]:
  for z in [-.12,2.02]:rod('synthesis__leg',(x+(.06 if x>-4.5 else -.06),0,z),(x,.93,z),.06,'oak edge',8)
 box('synthesis__lower',-4.65,.25,.95,1.2,.07,2.5,'sage linen',.03)
 for z in [.22,.95,1.68]:
  box('synthesis__mat',-4.46,1.052,z,.82,.014,.49,'deep teal',.05)
  box('synthesis__material',-4.48,1.07,z,.49,.035,.32,'paper',.017)
 curve('synthesis__brass_link',[(-5.17,1.13,-.05),(-5.17,1.53,.4),(-5.17,1.45,1.45),(-5.17,1.13,2.03)],.025)
 for z in [.22,.95,1.68]:rod('synthesis__pin',(-5.16,1.08,z),(-5.16,1.35,z),.034)
 col('synthesis',-4.65,0,.95,1.51,1.08,2.76);empty('INTERACT_synthesis',(-3.78,1.55,.95))
 # Phone booth: modeled wood posts, roof, desk, recognizable handset and dial.
 for x in [4.12,5.53]:
  for z in [2.32,3.87]:box('phone__post',x,0,z,.095,2.75,.095,'oak edge',.022)
 box('phone__cornice',4.825,2.7,3.095,1.63,.19,1.76,'deep teal',.06)
 box('phone__back',4.825,.12,3.83,1.35,2.58,.055,'sage linen',.018)
 box('phone__desk',4.825,1.03,3.50,1.35,.09,.60,'warm oak',.04)
 box('phone__base',4.78,1.14,3.43,.53,.12,.37,'deep teal',.08)
 rod('phone__dial',(4.78,1.267,3.43),(4.78,1.28,3.43),.12,'brass',28)
 for i in range(10):
  a=i/10*math.tau;rod('phone__dial_hole',(4.78+math.cos(a)*.084,1.281,3.43+math.sin(a)*.084),(4.78+math.cos(a)*.084,1.283,3.43+math.sin(a)*.084),.015,'ink',8)
 curve('phone__receiver',[(4.49,1.31,3.51),(4.52,1.43,3.51),(5.02,1.43,3.51),(5.06,1.31,3.51)],.053,'ink')
 pts=[(5.10+.032*math.sin(i*.9),1.33-i*.018,3.51+.032*math.cos(i*.9)) for i in range(35)];curve('phone__cord',pts,.011,'ink')
 col('phone_back',4.825,0,3.86,1.53,2.88,.14);col('phone_desk',4.825,0,3.5,1.4,1.16,.66)
 for x in [4.12,5.53]:
  for z in [2.32,3.87]:col('phone_post'+str(x)+str(z),x,0,z,.12,2.8,.12)
  box('phone__glass',x,.82,3.09,.012,1.70,1.4,'glass',0)
  box('phone__side_rail',x,.8,3.09,.07,.07,1.48,'warm oak',.015)
  col('phone_glass'+str(x),x,.82,3.09,.02,1.70,1.40,True,False,False)
 for x in [4.49,5.06]:rod('phone__earpiece',(x,1.29,3.51),(x,1.34,3.51),.085,'ink',16,.075)
 empty('INTERACT_phone',(4.825,1.67,2.37))
 # Compact hearth alcove, arched opening and mantel; no particles or bloom.
 for z in [-.93,.93]:box('hearth__pier',5.60,0,z,.60,1.60,.38,'stone',.10)
 box('hearth__mantel',5.54,1.65,0,.87,.16,2.49,'warm oak',.045)
 box('hearth__black',5.70,0,0,.06,1.55,1.49,'ink',.03)
 for i in range(11):
  a=math.pi*i/10;z=math.cos(a)*.86;y=.96+math.sin(a)*.60
  box('hearth__arch',5.60,y,z,.62,.27,.27,'stone',.035)
 for z in [-.30,.30]:rod('hearth__log',(5.27,.12,z-.18),(5.65,.12,z+.18),.075,'oak edge',10)
 box('hearth__hearthstone',5.32,0,0,1.3,.045,2.50,'stone',.03);col('hearth',5.52,0,0,1.0,1.84,2.45)
 imported('armchair_pillows',3.5,0,-.75,.65,-.55,owner='lounge');col('armchair',3.5,0,-.75,1.22,.95,1.15)
 box('lounge__rug',.9,.005,1.0,3.7,.018,3.3,'sage linen',.075)
 for x in [-.80,2.60]:box('lounge__rug_border',x,.025,1.0,.025,.002,3.1,'paper',.002)
 for z in [-.53,2.53]:box('lounge__rug_border',.9,.025,z,3.4,.002,.025,'paper',.002)
 imported('book_set',5.49,1.98,-.55,.55,math.pi/2,owner='hearth')

# Apply modifiers before joining. Preserve semantic owners, collision flags and markers.
for o in list(bpy.data.objects):
 if o.type=='MESH' and o.name.startswith('VIS_'):
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):
   try:bpy.ops.object.modifier_apply(modifier=mod.name)
   except RuntimeError:pass
owners=sorted({o.get('owner') for o in bpy.data.objects if o.name.startswith('VIS_')})
for owner in owners:
 objects=[o for o in bpy.data.objects if o.name.startswith('VIS_') and o.get('owner')==owner and o.type=='MESH']
 if not objects:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='VIS_'+owner
# Set visual-only collision meshes hidden only at runtime (glTF exporter must retain them).
bpy.ops.object.select_all(action='SELECT')
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
blend=ROOT/'assets-source'/('home-'+STAGE+'.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=OUT/('home-'+STAGE+'.glb')
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
report={'stage':STAGE,'axis':'Y-up','units':'metres','blender':bpy.app.version_string,'sha256':hashlib.sha256(glb.read_bytes()).hexdigest(),'bytes':glb.stat().st_size,'imports':imports,'nodes':[o.name for o in bpy.data.objects],'baking':'None. Base color atlas only; runtime direct shadows. No lightmap or AO map.'}
(OUT/('home-'+STAGE+'.build.json')).write_text(json.dumps(report,indent=2))
print('HOME_EXPORT',json.dumps({'stage':STAGE,'bytes':report['bytes'],'nodes':len(report['nodes'])}))
