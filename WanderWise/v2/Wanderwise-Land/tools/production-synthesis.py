"""G10 synthesis asset family. Executed into the production builder's globals.
All authoring is original geometry; no reference image is embedded. Coordinates:
Web Y-up, bottom-centre. Shared materials and frozen layout remain unmodified.
Call build_synthesis(). Review harness: run this file directly in fresh Blender.
"""

def syn_arc(name, inner, outer, bottom, top, start, end, mat='M04', n=8, bevel=0):
    vs=[]
    for y in [bottom,top]:
        for r in [inner,outer]:
            vs.extend((r*math.cos(start+(end-start)*i/n),y,r*math.sin(start+(end-start)*i/n)) for i in range(n+1))
    k=n+1;fs=[]
    for i in range(n):
        fs.extend([(i,i+1,k+i+1,k+i),(2*k+i,3*k+i,3*k+i+1,2*k+i+1),(i,2*k+i,2*k+i+1,i+1),(k+i,k+i+1,3*k+i+1,3*k+i)])
    fs.extend([(0,k,3*k,2*k),(n,2*k+n,3*k+n,k+n)])
    o=mesh(name,vs,fs,mat)
    import bmesh
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
    # Continuous cylinder UV: grain does not restart at every stave.
    for f in o.data.polygons:
        for li in f.loop_indices:
            v=o.data.vertices[o.data.loops[li].vertex_index].co
            a=math.atan2(-v.y,v.x)
            if a<start-.01:a+=math.tau
            o.data.uv_layers.active.data[li].uv=(a*outer/1.8,v.z/1.8)
    if bevel:
        b=o.modifiers.new('Cabinet edge 2mm','BEVEL');b.width=bevel;b.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
        b=o.modifiers.new('Joinery normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=b.name)
    return o

def syn_ring(name,r,y,width,mat='M06',segments=64):
    return lathe(name,[(r-width/2,y-.0006),(r+width/2,y-.0006),(r+width/2,y+.0004),(r-width/2,y+.0004),(r-width/2,y-.0006)],mat,segments)

def syn_leaf(name,point,w,h,mat='M28',line=.004):
    # Single P22 master geometry used for brass and non-metal textile variants.
    x,y,z=point
    for s in [-1,1]:
        tube(name+'_P22.01_outline',[(x+s*w/2*math.sin(math.pi*t)**.82,y,z-h/2+h*t) for t in [i/16 for i in range(17)]],line,mat)
    tube(name+'_P22.02_04_axis',[(x,y,z-h*.58),(x,y,z+h*.50)],line,mat)
    for t in [.25,.43,.61]:
        for s in [-1,1]:tube(name+'_P22.03_vein',[(x,y,z-h/2+h*t),(x+s*w*.30,y,z-h/2+h*(t+.19))],line*.7,mat)

def syn_flatline(name,pts,width,mat='M28'):
    vs=[]
    for i,p in enumerate(pts):
        a=pts[max(0,i-1)];b=pts[min(len(pts)-1,i+1)];dx=b[0]-a[0];dz=b[2]-a[2];ln=max(1e-8,math.hypot(dx,dz))
        for sign in [-1,1]:vs.append((p[0]-sign*dz/ln*width/2,p[1],p[2]+sign*dx/ln*width/2))
    return mesh(name,vs,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(pts)-1)],mat)

def syn_rug():
    g=group('T01')
    # Actual thickness .012; weighted low curling hems remain below 3mm.
    n=12;vs=[]
    for side in [0,1]:
        for iz in range(n+1):
            for ix in range(n+1):
                x=(ix/n-.5)*5.8;z=(iz/n-.5)*5.2
                edge=min(ix,iz,n-ix,n-iz);h=(.0018*math.sin(ix*1.71+iz*.8)**2 if edge==0 else 0)
                vs.append((x,side*.012+h,z))
    q=(n+1)**2;fs=[]
    for j in range(n):
        for i in range(n):
            a=j*(n+1)+i;fs.append((q+a,q+a+n+1,q+a+n+2,q+a+1));fs.append((a,a+1,a+n+2,a+n+1))
    perimeter=list(range(n+1))+[j*(n+1)+n for j in range(1,n+1)]+[n*(n+1)+i for i in range(n-1,-1,-1)]+[j*(n+1) for j in range(n-1,0,-1)]
    for a,b in zip(perimeter,perimeter[1:]+perimeter[:1]):fs.append((a,q+a,q+b,b))
    o=mesh('VIS_T01.01_06_woven_body_low_hem',vs,fs,'M11');uv(o,.40)
    for inset,wide,part in [(.03,.009,'05_binding'),(.09,.008,'02_outer_border'),(.24,.005,'02_inner_border')]:
        w=2.9-inset;d=2.6-inset
        syn_flatline('VIS_T01.'+part,[(-w,.014,-d),(w,.014,-d),(w,.014,d),(-w,.014,d),(-w,.014,-d)],wide)
    # Original fine leafwork derived once from P22; flat thread ribbons avoid metal and excess geometry.
    for sx in [-1,1]:
        for sz in [-1,1]:
            x=sx*2.46;z=sz*2.15
            for sign in [-1,1]:syn_flatline('VIS_T01.03_P22.01_corner_leaf',[(x+sign*.13*math.sin(t*math.pi),.014,z-.24+t*.48) for t in [i/12 for i in range(13)]],.007)
            syn_flatline('VIS_T01.03_P22.02_axis',[(x,.014,z-.28),(x,.014,z+.24)],.005)
            for t in [-.13,0,.1]:
                for sign in [-1,1]:syn_flatline('VIS_T01.03_P22.03_vein',[(x,.014,z+t),(x+sign*.09,.014,z+t+.09)],.004)
    for sign in [-1,1]:syn_flatline('VIS_T01.04_P22_central_leaf',[(sign*.21*math.sin(t*math.pi),.014,1.58+t*.66) for t in [i/16 for i in range(17)]],.007)
    syn_flatline('VIS_T01.04_P22_midvein',[(0,.014,1.54),(0,.014,2.24)],.005)
    # Rhythmic stitched dashes along both long sides, sparse enough to read at entry distance.
    for x in [-2.74,2.74]:
        for i in range(16):
            z=-1.75+i*.23;syn_flatline('VIS_T01.02_woven_dash',[(x-.02,.014,z-.016),(x+.02,.014,z+.016)],.005)
    place_at(g,'hero_rug');return g

def syn_cabinet():
    g=group('F10')
    lathe('VIS_F10.02_load_bearing_plinth',[(0,0),(1.085,0),(1.107,.015),(1.12,.04),(1.12,.073),(1.10,.085),(1.07,.092),(0,.092)],'M04',64)
    lathe('VIS_F10.01_circular_apron',[(0,.725),(1.45,.725),(1.49,.737),(1.51,.755),(1.53,.777),(1.55,.79),(1.55,.805),(0,.805)],'M04',96)
    lathe('VIS_F10.02_lower_rail',[(1.06,.084),(1.115,.084),(1.128,.094),(1.128,.131),(1.12,.143),(1.06,.143),(1.06,.084)],'M03',64)
    lathe('VIS_F10.02_top_rail',[(1.06,.676),(1.128,.676),(1.128,.715),(1.106,.734),(1.06,.734),(1.06,.676)],'M03',64)
    # A south-facing two-leaf-width access panel and one shallow drawer above it.
    for i in range(24):
        a=i*math.tau/24
        if 4<=i<=7:continue
        syn_arc('VIS_F10.03_curved_stave_%02d'%i,1.071,1.116,.137,.682,a+.0018,a+math.tau/24-.0018,'M04',4,.0018)
    a0=math.pi/3;a1=2*math.pi/3
    syn_arc('VIS_F10.04_south_access_door',1.073,1.121,.15,.535,a0+.004,a1-.004,'M03',16,.002)
    syn_arc('VIS_F10.04_shallow_drawer_front',1.075,1.121,.549,.676,a0+.004,a1-.004,'M04',16,.002)
    for y in [.165,.517,.561,.66]:
        tube('VIS_F10.04_door_raised_moulding',[(1.126*math.cos(a0+.03+(a1-a0-.06)*i/32),y,1.126*math.sin(a0+.03+(a1-a0-.06)*i/32)) for i in range(33)],.004,'M04')
    for a in [a0+.03,a1-.03]:tube('VIS_F10.04_door_stile',[(1.126*math.cos(a),.165,1.126*math.sin(a)),(1.126*math.cos(a),.518,1.126*math.sin(a))],.006,'M04')
    # Restrained escutcheon and hanging pull ring on the actual curved door face.
    box('VIS_F10.06_lock_plate',(0,.30,1.121),(.083,.116,.008),'M06',.0008)
    tube('VIS_F10.06_ring_pull',[(.04*math.cos(i*math.tau/32),.35+.04*math.sin(i*math.tau/32),1.145) for i in range(33)],.004,'M06')
    box('VIS_F10.06_key_slot',(0,.352,1.131),(.006,.020,.003),'M07',.0005)
    tube('VIS_F10.04_drawer_handle',[(-.063,.604,1.126),(-.054,.590,1.147),(.054,.590,1.147),(.063,.604,1.126)],.004,'M06')
    for x in [-.40,.40]:
        z=math.sqrt(1.122**2-x*x)
        for y in [.25,.45]:box('VIS_F10.06_hinge_leaf',(x,y,z),(.040,.046,.009),'M06',.0008)
    for i in range(8):
        a=i*math.tau/8
        # Short rebated feet remain within the plinth silhouette.
        syn_arc('VIS_F10.05_recessed_foot',.98,1.08,0,.05,a-.08,a+.08,'M03',3,.002)
        for y in [.108,.70]:
            o=lathe('VIS_F10.06_flush_rivet',[(0,0),(.005,0),(.005,.002),(0,.003)],'M06',8)
            # A tiny dome mounted radially: turn Web vertical cylinder to radial axis.
            o.rotation_euler=Vector(xyz((math.cos(a),0,math.sin(a)))).to_track_quat('Z','Y').to_euler();o.location=xyz((1.129*math.cos(a),y,1.129*math.sin(a)))
    empty('SOCKET_F10_table_top',(0,.805,0))
    # 12-segment convex proxy with flat bottom and top; tagged for existing collider importer.
    o=lathe('COL_F10_round',( [(0,0),(1.55,0),(1.55,.88),(0,.88)]),None,24)
    for k in ['player','camera','interaction']:o[k]=True
    place_at(g,'synthesis');return g

def syn_tabletop():
    # Keep all synthesis siblings under F10 for static root batching.
    lathe('VIS_F11.01_brass_outer_edge',[(1.522,.805),(1.542,.805),(1.55,.811),(1.55,.867),(1.546,.875),(1.536,.880),(1.522,.880),(1.522,.805)],'M06',96)
    lathe('VIS_F11.02_opaque_teal_inset',[(0,.805),(1.524,.805),(1.524,.877),(1.52,.880),(0,.880)],'M23',96)
    for r,w in [(1.485,.004),(1.34,.005),(.68,.005),(.42,.004)]:syn_ring('VIS_F11.03_concentric_inlay',r,.8805,w)
    for i in range(16):
        a=i*math.tau/16
        tube('VIS_F11.05_radial_inlay',[(r*math.cos(a),.8805,r*math.sin(a)) for r in [1.35,1.48]],.0014,'M06')
    for i in range(8):
        a=i*math.tau/8+math.pi/8
        pts=[((1.413+.021*math.cos(t))*math.cos(a)-.011*math.sin(t)*math.sin(a),.881,(1.413+.021*math.cos(t))*math.sin(a)+.011*math.sin(t)*math.cos(a)) for t in [j*math.tau/16 for j in range(17)]]
        tube('VIS_F11.04_leaf_inlay',pts,.0014,'M06')
    empty('SOCKET_F11_crystal_mount',(0,.88,0))

def syn_crystal():
    lathe('VIS_F12.03_tiered_mount',[(0,.88),(.29,.88),(.315,.887),(.33,.900),(.33,.928),(.315,.935),(.315,.963),(.299,.98),(.263,.98),(.263,.93),(0,.93)],'M06',64)
    syn_ring('VIS_F12.06_base_light_lens',.274,.974,.007,'M22',64)
    # Convex hull is closed and oriented, preserving broad planar asymmetrical facets.
    vs=[]
    for r,y,dx,dz in [(.224,.968,0,0),(.281,1.095,.012,-.008),(.174,1.455,.025,-.017)]:
        for i in range(7):
            a=i*math.tau/7;vs.append((dx+r*math.cos(a),y,dz+r*math.sin(a)))
    vs.append((.031,1.730,-.022))
    o=mesh('VIS_F12.01_02_closed_asymmetric_crystal',vs,[],'M17')
    import bmesh
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.convex_hull(bm,input=list(bm.verts),use_existing_faces=False);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();uv(o,.5)
    o['componentParts']=['F12.01','F12.02'];o['closedConvex']=True
    for i in range(4):
        a=i*math.tau/4+math.pi/4
        tube('VIS_F12.04_mount_claw',[(r*math.cos(a),y,r*math.sin(a)) for r,y in [(.31,.935),(.302,.983),(.261,1.026)]],.008,'M06')
    # Two restrained opaque internal inclusions, not overlapping transparent shells.
    mesh('VIS_F12.05_internal_vein_A',[(-.11,1.10,.02),(.07,1.30,.05),(.055,1.28,.052)],[(0,1,2)],'M22')
    mesh('VIS_F12.05_internal_vein_B',[(.02,1.32,-.03),(.06,1.50,-.01),(.053,1.46,-.008)],[(0,1,2)],'M22')
    empty('SOCKET_F12_light',(0,.975,0))

def syn_slots():
    global root
    parent=root
    for i in range(4):
        a=math.pi/4+i*math.tau/4;x,z=math.cos(a),math.sin(a)
        # Temporary local root makes each slot's transform explicit, flattened after authoring.
        g=group('F13_MAT_'+str(i));g['assetId']='F13'
        box('VIS_F13.01_slot_%d'%i,(0,.882,0),(.36,.022,.24),'M06',.001)
        box('VIS_F13.01_paper_bed_%d'%i,(0,.904,0),(.334,.002,.218),'M04',.001)
        # Vacant cream paper is a work surface; actual selection status belongs to business state.
        box('VIS_F11.06_paper_work_area_%d'%i,(0,.906,.010),(.306,.0015,.187),'M12',0)
        for sx in [-1,1]:
            box('VIS_F13.04_edge_clip',(sx*.141,.908,-.015),(.014,.005,.042),'M06',.0006)
            post=lathe('VIS_F13.02_P21.01_02_03_04_05_post_%d_%d'%(i,sx),[(0,0),(.0175,0),(.0175,.004),(.014,.007),(.010,.009),(.009,.014),(.009,.039),(.011,.041),(.011,.045),(.008,.047),(.008,.051),(.010,.054),(.009,.058),(.005,.060),(0,.061)],'M06',14,(sx*.14,.904,-.086))
            post['componentParts']=['F13.02','P21.01','P21.02','P21.03','P21.04','P21.05']
        for sx in [-1,1]:box('VIS_F13.03_registration_tick',(sx*.10,.908,.086),(.022,.001,.002),'M06',0)
        lathe('VIS_F13.05_idle_indicator_%d'%i,[(0,.907),(.006,.907),(.006,.910),(0,.910)],'M23',12,(0,0,-.098))
        empty('SOCKET_F13_MAT_%d'%i,(0,.908,0));empty('SOCKET_F13.06_link_%d'%i,(0,.912,-.12))
        place(g,(x,0,z),a-math.pi/2)
        bpy.context.view_layer.update()
        for o in list(g.children):
            world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
        bpy.data.objects.remove(g,do_unlink=True);root=parent

def syn_cushion():
    n=24;k=10;vs=[];fs=[]
    sp=lambda a,p:math.copysign(abs(a)**p,a)
    for j in range(k+1):
        v=-math.pi/2+math.pi*j/k
        for i in range(n):
            a=i*math.tau/n;vs.append((.251*sp(math.cos(v),.46)*sp(math.cos(a),.40),.422+.038*sp(math.sin(v),.5),.02+.258*sp(math.cos(v),.46)*sp(math.sin(a),.40)))
    for j in range(k):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;fs.append((a,a+n,b+n,b))
    o=mesh('VIS_F14.03_tailored_soft_seat',vs,fs,'M10',True);uv(o,.30)
    for z in [-.21,.25]:tube('VIS_F14.03_seat_seam',[(-.22,.445,z),(0,.455,z),(.22,.445,z)],.0015,'M10')

def syn_chair(id):
    g=group('F14_'+id.rsplit('_',1)[-1]);g['assetId']='F14'
    # Feet begin at the .013m rug top, with the frozen chair root unchanged.
    for x in [-.245,.245]:
        for z in [-.255,.255]:
            lathe('VIS_F14.02_shaped_leg',[(0,.013),(.020,.013),(.024,.024),(.025,.052),(.018,.068),(.020,.25),(.025,.31),(.027,.37),(0,.37)],'M03',16,(x,0,z))
    for z in [-.257,.273]:box('VIS_F14.01_joined_seat_rail',(0,.336,z),(.55,.067,.039),'M03',.002)
    for x in [-.26,.26]:
        box('VIS_F14.01_side_rail',(x,.336,.008),(.036,.067,.55),'M03',.002)
        tube('VIS_F14.01_curved_back_stile',[(x,.35,-.257),(x,.55,-.276),(x,.82,-.293),(x*.94,.977,-.304)],.024,'M03')
        tube('VIS_F14.06_side_stretcher',[(x,.16,-.255),(x,.16,.255)],.013,'M03')
        # Light, swept wood arms with actual front support.
        tube('VIS_F14.01_arm_support',[(x,.39,.16),(x,.57,.16)],.012,'M03')
        tube('VIS_F14.01_shaped_arm',[(x,.572,.23),(x,.602,.13),(x,.612,-.08),(x,.616,-.28)],.020,'M03')
    tube('VIS_F14.06_cross_stretcher',[(-.245,.175,0),(.245,.175,0)],.013,'M03')
    # Bowed back panel follows the side posts; proper thickness, softly bevelled crown.
    n=16;vs=[]
    for dep in [-.012,.012]:
        for edge in [0,1]:
            for i in range(n+1):
                x=(i/n-.5)*.49;y=(.66 if edge==0 else .952+.024*math.cos(x/.245*math.pi/2));z=-.299-.024*(1-(x/.245)**2)+dep
                vs.append((x,y,z))
    q=n+1;fs=[]
    for i in range(n):fs.extend([(i,i+1,q+i+1,q+i),(2*q+i,3*q+i,3*q+i+1,2*q+i+1),(i,2*q+i,2*q+i+1,i+1),(q+i,q+i+1,3*q+i+1,3*q+i)])
    fs.extend([(0,q,3*q,2*q),(n,2*q+n,3*q+n,q+n)])
    o=mesh('VIS_F14.04_bowed_back_panel',vs,fs,'M03');b=o.modifiers.new('Back panel 2mm edge','BEVEL');b.width=.002;b.segments=2
    # Slender carved inset, no arbitrary floating pillow.
    tube('VIS_F14.04_crown_inlay',[(x,.935+.024*math.cos(x/.22*math.pi/2),-.307-.024*(1-(x/.245)**2)) for x in [-.22+i*.44/24 for i in range(25)]],.0015,'M28')
    syn_cushion()
    col('F14_seat_'+id,(0,.013,0),(.60,.49,.64));col('F14_back_'+id,(0,.50,-.30),(.57,.50,.08));empty('SOCKET_F14.05_chair_cloth',(0,.976,-.32))
    place_at(g,id);return g

def build_synthesis():
    global root
    roots=[syn_rug()]
    g=syn_cabinet();roots.append(g);root=g;syn_tabletop();syn_crystal();syn_slots()
    roots.extend([syn_chair('synthesis_chair_south'),syn_chair('synthesis_chair_north')])
    root=None
    return roots

# Direct execution is an isolated authoring/review process, never the shared builder.
if __name__=='__main__' and 'layout' not in globals():
    import bpy,math,json,sys,hashlib
    from pathlib import Path
    from mathutils import Vector,Matrix
    module_path=Path(__file__).resolve();ROOT=module_path.parents[1]
    scope=globals();source=(ROOT/'tools/build-production-room.py').read_text();prefix=source.split("exec(compile((ROOT/'tools/production-corner.py')")[0]
    exec(compile(prefix,str(ROOT/'tools/build-production-room.py'),'exec'),scope)
    material_textures();build_synthesis()
    for o in bpy.context.scene.objects:
        if o.name=='Cube' and o not in list(collection.objects):o.hide_render=True
    review=ROOT/'assets-source/room-production';review.mkdir(parents=True,exist_ok=True)
    for o in collection.objects:
        if o.name.startswith('COL_'):o.hide_render=True
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48
    scene.world.color=(.2,.2,.2)
    # Original calibrated presentation rig; excluded from production GLB.
    def light(name,pos,energy,size,color):
        d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size;d.color=color;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=xyz(pos);o.rotation_euler=(Vector(xyz((0,.7,0)))-o.location).to_track_quat('-Z','Y').to_euler()
    light('REVIEW_key',(-3,6,2),1000,5,(1,.90,.76));light('REVIEW_fill',(4,3,-2),500,4,(.76,.88,1));light('REVIEW_rim',(-1,4,-4),600,3,(1,.96,.86))
    camera=bpy.data.cameras.new('REVIEW_camera');cam=bpy.data.objects.new('REVIEW_camera',camera);scene.collection.objects.link(cam);scene.camera=cam;cam.location=xyz((5.5,4.3,6.4));cam.rotation_euler=(Vector(xyz((0,.64,0)))-cam.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=8.0
    scene.render.resolution_x=1300;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(review/'synthesis-review.png')
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(review/'synthesis-review.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for o in collection.objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(review/'synthesis-review.glb'),use_selection=True,export_format='GLB',export_yup=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False,export_tangents=True)
    bpy.ops.render.render(write_still=True)
    stats={}
    for o in collection.objects:
        if o.type=='MESH' and o.name.startswith('VIS_'):
            o.data.calc_loop_triangles();id=o.name.split('_')[1].split('.')[0];stats[id]=stats.get(id,0)+len(o.data.loop_triangles)
    import bmesh
    crystal=next(o for o in collection.objects if o.name.startswith('VIS_F12.01_02'));bm=bmesh.new();bm.from_mesh(crystal.data);closed=all(e.is_manifold for e in bm.edges);bm.free()
    assert closed,'Crystal must be watertight'
    assert len([o for o in collection.objects if o.name.startswith('VIS_F13.02_P21.')])==8
    assert len([o for o in collection.objects if o.name.startswith('SOCKET_F13_MAT_')])==4
    assert len({tuple(round(v,4) for v in o.matrix_world.translation) for o in collection.objects if o.name.startswith('SOCKET_F13_MAT_')})==4,'Slots must occupy four distinct quadrants'
    assert M['M17'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value==0
    assert M['M28'].node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value==0
    report=ROOT/'reports/G10_synthesis.md';report.parent.mkdir(exist_ok=True)
    report.write_text('# G10 中央合成台资产自检\n\n状态：asset_review，待视觉复核；未做浏览器runtime验收。\n\n'+
        '原创参数化几何；读取共享M03/M04木、M06铜、M23不透明台面、M17主晶、M28非金属织线。未联网、未使用外部模型或图像贴片。\n\n'+
        'F10.01–06：圆裙板、2.25m基座、弧面分板与缝、南检修门/抽屉、底脚、锁饰铰链。F11.01–06：2.5cm铜包边、青绿嵌面、同心环、叶形嵌条、放射细线、四纸工作区。F12.01–06：闭合凸主晶/不对称晶面、座环、四爪、两处内部细纹、座圈光学镜片（无新增灯）。F13.01–06：四槽、八柱、刻线、夹子、闲置指示点、连接socket；P21五部件合并为八个车削柱；P22统一叶轮廓/中轴/三对叶脉/下尖以地毯变体实现，吊环变体不使用。F14.01–06：两把木框/车削腿/软座/弧背/搭毯socket/横撑，另有带支撑木扶手。T01.01–06：织物实体、双边框、四角叶纹、中央叶徽、压边及低毛边。\n\n'+
        '分层：F10底0顶.805，F11底.805顶.880，F12底.880顶1.730，F13底.882。恰好4槽8柱。主晶闭合流形检查通过；无业务INTERACT副本。椅根遵守冻结布局，椅脚本地底.013接触地毯顶.013。基座底0与.013地毯合法嵌合。\n\n'+
        '组件VIS与COL/socket分开；独立GLB保留组件便于审查，主集成应按根合批。COL_F10_round为24边圆形网格代理，需主集成人确认导入器如何生成碰撞体，未声称角色绕行已测。\n\n'+
        'Blender '+bpy.app.version_string+' 独立进程已建模、保存BLEND/GLB、渲染PNG。三角面统计（未计待应用modifier）：\n\n```json\n'+json.dumps(stats,indent=2)+'\n```\n\n'+
        '限制：独立LOD1/LOD2、2K地毯图集/法线烘焙尚未交付；当前使用共享512px程序表面与几何织线。未做业务选材/保存、浏览器黑面/透明、角色碰撞、固定机位或性能验收。\n\n'+
        '模块SHA256：`'+hashlib.sha256(module_path.read_bytes()).hexdigest()+'`\n',encoding='utf-8')
    print('SYNTHESIS_REVIEW',stats,'closedCrystal',closed)
