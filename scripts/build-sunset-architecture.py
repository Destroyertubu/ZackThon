"""Editable architectural kit for the Sunset Boulevard, authored in metre units.
Run: Blender --background --python scripts/build-sunset-architecture.py
The three collections remain separate/editable in the source .blend; runtime GLBs
are triangulated and merged by material. No downloaded model geometry is used.
"""
import bpy, bmesh, math, pathlib, json, sys
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/models/sunset-boulevard'
SOURCE=ROOT/'assets/source/sunset-boulevard'
OUT.mkdir(parents=True,exist_ok=True);SOURCE.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

PALETTE={'plaster':('#eee0c9',.84,0),'darkWood':('#614035',.58,0),'wood':('#aa7350',.64,0),'brass':('#be955e',.32,.8),'iron':('#354249',.5,.72),'paper':('#e6d6b6',.86,0),'rose':('#aa6172',.64,0),'ink':('#405e65',.68,0),'glass':('#bbd4d6',.16,.1),'glow':('#ffc787',.3,0),'stone':('#c8baa4',.8,0)}
MATS={}
for name,(hexc,rough,metal) in PALETTE.items():
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');rgb=tuple(int(hexc[i:i+2],16)/255 for i in (1,3,5))
    bs.inputs['Base Color'].default_value=(*rgb,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
    if name=='glass': bs.inputs['Alpha'].default_value=.13;mat.surface_render_method='DITHERED'
    if name=='glow': bs.inputs['Emission Color'].default_value=(*rgb,1);bs.inputs['Emission Strength'].default_value=2
    MATS[name]=mat

def coords(v): return (v[0],-v[2],v[1])
def assign(obj,name,key):
    obj.name=name;obj.data.materials.append(MATS[key]);return obj
def bevel(obj,width=.04,segments=3):
    mod=obj.modifiers.new('Crafted soft edges','BEVEL');mod.width=width;mod.segments=segments
    mod=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    return obj
def box(name,key,p,size,radius=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=coords(p));o=bpy.context.object;o.dimensions=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    assign(o,name,key)
    if radius:bevel(o,min(radius,min(size)*.24),2)
    return o
def tube(name,key,points,radius=.035):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=radius;curve.bevel_resolution=2
    s=curve.splines.new('POLY');s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*coords(v),1)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);assign(obj,name,key);return obj
def archpoints(cx,bottom,width,height,depth,steps=24):
    r=width*.5;spring=bottom+height-r
    return [(cx-r,bottom,depth),(cx-r,spring,depth)]+[(cx+math.cos(math.pi-i/steps*math.pi)*r,spring+math.sin(math.pi-i/steps*math.pi)*r,depth) for i in range(steps+1)]+[(cx+r,bottom,depth)]
def archsolid(name,key,cx,bottom,width,height,front,depth):
    outline=archpoints(cx,bottom,width,height,front);n=len(outline)
    verts=[coords(v) for v in outline]+[coords((x,y,z-depth)) for x,y,z in outline]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);assign(o,name,key);return o
def pot(x,z,size=.42):
    profile=[(.65,0),(.7,.055),(.82,.64),(.97,1.4),(1,1.47),(.98,1.54),(.88,1.55),(.85,1.44),(.7,.18),(.54,.13)]
    verts=[];faces=[];segments=40
    for radius,h in profile:
        for i in range(segments):
            a=i/segments*math.tau;verts.append(coords((x+math.cos(a)*radius*size,h*size,z+math.sin(a)*radius*size)))
    for row in range(len(profile)-1):
        for i in range(segments):
            a=row*segments+i;b=row*segments+(i+1)%segments;faces.append((a,a+segments,b+segments,b))
    mesh=bpy.data.meshes.new('Hollow wheel-thrown stoneware');mesh.from_pydata(verts,[],faces);mesh.update()
    for poly in mesh.polygons:poly.use_smooth=True
    obj=bpy.data.objects.new('Hand-thrown ceramic planter',mesh);bpy.context.collection.objects.link(obj);assign(obj,'Hand-thrown ceramic planter','rose')
    obj['sunsetPotNormals']='outward'
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=size*.82,depth=.035,location=coords((x,size*1.27,z)))
    assign(bpy.context.object,'Recessed planter soil','darkWood')
    # An inset foliage rosette is scaled to the vessel rather than a giant leaf card.
    for i in range(13):
        a=i*2.399;r=size*(.26+(i%3)*.15);h=size*(1.57+(i%4)*.12)
        tube('Rosemary stem','ink',[(x,size*1.29,z),(x+math.cos(a)*r*.4,h,z+math.sin(a)*r*.4),(x+math.cos(a)*r,h-.08,z+math.sin(a)*r)],.008)
        for side in [-1,1]:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=4,radius=1,location=coords((x+math.cos(a)*r,h-.045,z+math.sin(a)*r)))
            leaf=bpy.context.object;leaf.scale=(.045,.085,.019);leaf.rotation_euler[2]=a+side*.5;assign(leaf,'Small rosemary foliage','ink')
def book(x,y,z,width,height,key):
    box('Individual bound volume',key,(x,y+height*.5,z),(width,height,.31),.012)
    box('Paper page block','paper',(x,y+height*.5,z-.01),(width*.8,height*.91,.285),.006)
    for h in [.08,height-.08]:box('Gilt spine band','brass',(x,y+h,z+.162),(width*.8,.012,.007),.002)
def lamp(x,y,z):
    tube('Wall sconce arm','brass',[(x,y+.55,z-.2),(x,y+.7,z+.22),(x,y+.48,z+.46)],.028)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.17,location=coords((x,y+.17,z+.44)));o=bpy.context.object;o.scale=(.8,.8,1.45);assign(o,'Amber lamp bulb','glow')
    for h in [0,.4]:box('Sconce cap','brass',(x,y+h,z+.44),(.35,.065,.35),.024)
    for dx in [-.14,.14]:tube('Sconce lantern ribs','brass',[(x+dx,y,z+.32),(x+dx,y+.42,z+.32)],.016)
def roof(width,depth,base,kind):
    # A low barrel roof is a continuous, double-curved silhouette rather than a box.
    n=24;verts=[]
    for d in [-depth-.1,.55]:
        for j in range(n+1):
            x=(j/n-.5)*(width+1.0);y=base+.65*math.cos((j/n-.5)*math.pi)
            verts.append(coords((x,y,d)))
    faces=[(j,j+1,j+1+n+1,j+n+1) for j in range(n)]
    m=bpy.data.meshes.new('Curved copper roof');m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new('Curved copper roof',m);bpy.context.collection.objects.link(o);assign(o,'Curved copper roof','darkWood')
    sol=o.modifiers.new('Copper roof thickness','SOLIDIFY');sol.thickness=.1
    for d in [-depth-.1,.55]:tube('Roof rolled copper edge','brass',[(v[0],v[2],-v[1]) for v in verts[(n+1 if d>.1 else 0):(2*(n+1) if d>.1 else n+1)]],.048)
    for x in [-width*.5,-width*.25,0,width*.25,width*.5]:
        y=base+.65*math.cos(x/(width+1)*math.pi)
        tube('Standing roof seam','brass',[(x,y+.025,-depth),(x,y+.025,.5)],.013)

def building(kind):
    width={'bookshop':8.8,'atelier':6.8,'gallery':9.2}[kind];height={'bookshop':5.5,'atelier':4.8,'gallery':5.8}[kind];depth=2.55
    coll=bpy.data.collections.new(kind);bpy.context.scene.collection.children.link(coll)
    previous=set(bpy.data.objects)
    wall=box('Lime plaster facade','plaster',(0,height*.5,-.12),(width,height,.3),.045)
    bays=[-width*.32,0,width*.32] if kind!='atelier' else [-1.65,1.65]
    baywidth=width*.255 if kind!='atelier' else 2.55
    sill=.65 if kind!='gallery' else .2;openingheight=height-1.2
    for index,x in enumerate(bays):
        cutter=archsolid('Window cutout','paper',x,sill,baywidth,openingheight,.4,1)
        mod=wall.modifiers.new('Actual arched opening','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
        bpy.context.view_layer.objects.active=wall;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
        tube('Carved arch surround','darkWood',archpoints(x,sill,baywidth+.1,openingheight+.05,.095),.11)
        tube('Fine brass arch inlay','brass',archpoints(x,sill+.02,baywidth-.09,openingheight-.03,.205),.023)
        box('Projecting stone windowsill','stone',(x,sill-.06,.12),(baywidth+.42,.16,.62),.045)
        if kind!='gallery':
            archsolid('Clear inset arched pane','glass',x,sill+.06,baywidth-.16,openingheight-.12,-.18,.008)
            tube('Window transom','brass',[(x-baywidth*.47,sill+openingheight*.61,-.12),(x+baywidth*.47,sill+openingheight*.61,-.12)],.022)
        if kind=='bookshop' or (kind=='atelier' and index==0):
            for row in range(4):
                y=.65+row*.68;box('Recessed walnut bookshelf','darkWood',(x,y,-1.87),(baywidth-.12,.09,.65),.018)
                for j in range(8):book(x-baywidth*.4+j*baywidth*.113,y+.06,-1.65,.18,.32+.08*((row+j)%3),['rose','ink','darkWood'][(j+row)%3])
        else:
            # Empty frame opening is filled by real, attributed museum art in the app.
            for dx in [-.8,.8]:box('Gallery gilt frame','brass',(x+dx,2.13,-1.75),(.06,1.52,.065),.012)
            for h in [1.37,2.89]:box('Gallery gilt frame','brass',(x,h,-1.75),(1.65,.06,.065),.012)
            box('Recessed picture backing','paper',(x,2.13,-1.79),(1.55,1.43,.04),.01)
        # Deep ceiling coves are actual geometry; the point lights are owned by WorldCanvas.
        box('Recessed amber light strip','glow',(x,height-.55,-.7),(baywidth*.76,.035,.04),.008)
    box('Rear gallery wall','plaster',(0,height*.48,-depth),(width,height*.96,.22),.04)
    for x in [-width*.5,width*.5]:
        box('Solid return wall','plaster',(x,height*.5,-depth*.5),(.28,height,depth),.04)
        box('Walnut corner pilaster','darkWood',(x,height*.5,.13),(.2,height,.24),.035)
        box('Pilaster capital','brass',(x,height-.34,.15),(.37,.14,.35),.035)
    box('Interior parquet platform','wood',(0,-.1,-depth*.5),(width,.2,depth+.55),.04)
    box('Lime plinth','stone',(0,.22,.035),(width+.2,.4,.36),.04)
    roof(width,depth,height,kind)
    # Curved awning for the writing atelier; linen ribs create a different frontage.
    if kind=='atelier':
        for j in range(15):
            x=-width*.5+j*width/14
            tube('Linen canopy rib','paper',[(x,3.7,.15),(x,3.55,.95),(x,3.05,1.25)],.052)
        for d,h in [(.95,3.55),(1.25,3.05)]:tube('Awning brass seam','brass',[(-width*.52,h,d),(width*.52,h,d)],.027)
    for x in [-width*.43,width*.43]:lamp(x,2.65,.2)
    for x in [-width*.46,width*.45]:pot(x,.65,.37 if kind=='atelier' else .44)
    for o in set(bpy.data.objects)-previous:
        for old in list(o.users_collection):old.objects.unlink(o)
        coll.objects.link(o)
    return coll

if '--export-only' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'sunset-architecture.blend'))
    collections=[bpy.data.collections[k] for k in ['bookshop','atelier','gallery']]
else:
    collections=[building(k) for k in ['bookshop','atelier','gallery']]
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'sunset-architecture.blend'))
repaired=False
for collection in collections:
    for obj in collection.objects:
        if obj.name.startswith('Hand-thrown ceramic planter') and obj.type=='MESH' and obj.get('sunsetPotNormals')!='outward' and len(obj.data.vertices)>100:
            mesh=bmesh.new();mesh.from_mesh(obj.data);bmesh.ops.reverse_faces(mesh,faces=list(mesh.faces));mesh.to_mesh(obj.data);mesh.free()
            obj['sunsetPotNormals']='outward';repaired=True
if repaired:bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'sunset-architecture.blend'))
report=[]
for coll in collections:
    bpy.ops.object.select_all(action='DESELECT')
    originals=list(coll.objects);clones=[]
    for source in originals:
        obj=source.copy();obj.data=source.data.copy();bpy.context.scene.collection.objects.link(obj);obj.select_set(True);clones.append(obj)
    bpy.context.view_layer.objects.active=clones[0];bpy.ops.object.convert(target='MESH')
    clones=list(bpy.context.selected_objects)
    # Export one mesh per material, with inspectable semantic names.
    for key in PALETTE:
        group=[o for o in bpy.context.scene.collection.objects if o.type=='MESH' and o.data.materials and o.data.materials[0].name==key]
        if not group:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();bpy.context.object.name=f'{coll.name}-{key}'
    bpy.ops.object.select_all(action='DESELECT')
    export_objs=[o for o in bpy.context.scene.collection.objects if o.type=='MESH' and o not in originals]
    # Runtime UVs derive from physical metres and largest-normal planar projection.
    for o in export_objs:
        o.select_set(True)
        if not o.data.uv_layers:o.data.uv_layers.new(name='UVMap')
        uv=o.data.uv_layers.active.data
        for poly in o.data.polygons:
            axis=max(range(3),key=lambda i:abs(poly.normal[i]))
            for loopidx in poly.loop_indices:
                v=o.matrix_world@o.data.vertices[o.data.loops[loopidx].vertex_index].co
                uv[loopidx].uv=(v.y*.5,v.z*.5) if axis==0 else (v.x*.5,v.z*.5) if axis==1 else (v.x*.5,v.y*.5)
    path=OUT/f'{coll.name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=12)
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in export_objs)
    report.append({'model':path.name,'bytes':path.stat().st_size,'triangles':triangles,'editableSource':'assets/source/sunset-boulevard/sunset-architecture.blend','generatedBy':'scripts/build-sunset-architecture.py','license':'Project-authored geometry'})
    for o in export_objs:bpy.data.objects.remove(o,do_unlink=True)
(OUT/'manifest.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
