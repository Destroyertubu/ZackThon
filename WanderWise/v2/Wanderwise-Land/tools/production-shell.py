"""G07 A01–A14. Execute in build-production-room.py shared globals, call build_shell().
Only creates its own WW_Axx roots; no scene cleanup, material edits or export side effects.
Metres, Web Y-up coordinates. Independent review command is recorded in reports/G07_shell.md.
"""

def build_shell():
 import bmesh
 def tube(name,pts,r,mat='M06',resolution=1):
  o=globals()['tube'](name,pts,r,mat,resolution)
  bm=bmesh.new();bm.from_mesh(o.data)
  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.000001)
  boundary=[e for e in bm.edges if e.is_boundary]
  if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
  bmesh.ops.triangulate(bm,faces=list(bm.faces))
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();uv(o);return o
 footprint=layout['footprint_xz']
 def finish(o,bevel=.003,segments=1):
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  if bevel:
   m=o.modifiers.new('Joinery edge mm','BEVEL');m.width=bevel;m.segments=segments
   bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  uv(o);return o
 def prism(name,poly,y0,y1,mat,bevel=.003):
  n=len(poly);vs=[(x,y,z) for y in (y0,y1) for x,z in poly]
  fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
  return finish(mesh(name,vs,fs,mat),bevel)
 def proxy(o,name,player=True,interaction=True):
  bpy.context.view_layer.update()
  c=bpy.data.objects.new('COL_'+name,o.data.copy());own(c,'COL_'+name);c.data.materials.clear();c.matrix_local=o.matrix_local.copy();c['player']=player;c['camera']=True;c['interaction']=interaction;return c
 def grain(o,long_axis):
  # Shared wood texture has fibres along V; keep fibres along each timber, independent of world yaw.
  for f in o.data.polygons:
   normal_axis=max(range(3),key=lambda j:abs(f.normal[j]));axes=[j for j in range(3) if j!=normal_axis]
   if long_axis in axes:axes.remove(long_axis);axes.append(long_axis)
   for li in f.loop_indices:
    co=o.data.vertices[o.data.loops[li].vertex_index].co;o.data.uv_layers.active.data[li].uv=(co[axes[0]],co[axes[1]])
  return o
 def solid(name,p,size,mat='M02',bevel=.004,collision=False):
  o=box('VIS_'+name,p,size,mat,0)
  if bevel:finish(o,bevel,1)
  if mat in ['M02','M03']:grain(o,max(range(3),key=lambda j:o.dimensions[j]))
  if collision:col(name,p,size,interaction=not name.startswith(('A01','A13','A06','A07')))
  return o
 def rail(name,a,b,width,height,mat='M02',collision=False,bevel=.004):
  dx,dz=b[0]-a[0],b[2]-a[2];length=math.hypot(dx,dz)
  o=solid(name,((a[0]+b[0])/2,a[1],(a[2]+b[2])/2),(length,height,width),mat,bevel)
  o.rotation_euler.z=-math.atan2(dz,dx)
  if collision:proxy(o,name,interaction=not name.startswith(('A01','A13','A06','A07')))
  return o
 def slope(name,x0,x1,z0,z1,low_offset,thick,mat='M02',collision=False):
  # Vertical thickness, planar underside follows 3.4m eaves / 5.2m ridge exactly.
  h=lambda x:5.2-.3*abs(x)+low_offset
  vs=[(x,h(x)+dy,z) for dy in (0,thick) for x,z in [(x0,z0),(x1,z0),(x1,z1),(x0,z1)]]
  o=finish(mesh('VIS_'+name,vs,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat),0 if 'board_seam' in name else .003)
  grain(o,0)
  if collision:proxy(o,name,interaction=not name.startswith(('A01','A13','A06','A07')))
  return o
 def peg(name,p,axis='z',mat='M02',r=.012):
  delta={'z':(0,0,.007),'x':(.007,0,0),'y':(0,.007,0)}[axis]
  return tube('VIS_'+name,[p,tuple(p[i]+delta[i] for i in range(3))],r,mat)
 def clip(poly,axis,bound,less):
  out=[]
  for a,b in zip(poly,poly[1:]+poly[:1]):
   ia=a[axis]<=bound if less else a[axis]>=bound;ib=b[axis]<=bound if less else b[axis]>=bound
   if ia:out.append(a)
   if ia!=ib:
    t=(bound-a[axis])/(b[axis]-a[axis]);out.append([a[j]+t*(b[j]-a[j]) for j in range(2)])
  return out
 # A01: two closed octagonal solids, underside retained. Main floor collider has top y=0.
 group('A01')
 outer=[[-5.424,-5.3],[5.424,-5.3],[6.3,-4.424],[6.3,4.424],[5.424,5.3],[-5.424,5.3],[-6.3,4.424],[-6.3,-4.424]]
 prism('VIS_A01.01_05_octagonal_plinth',outer,-.36,-.18,'M18',.004)
 slab=prism('VIS_A01.02_load_slab',footprint,-.18,0,'M02',.003);proxy(slab,'A01_floor',interaction=False)
 solid('A01.03_entry_connection',(0,-.18,5.22),(2.4,.18,.44),'M02')
 solid('A01.04_terrace_connection',(0,-.18,-5.12),(6.4,.18,.24),'M02')
 empty('SOCKET_A01_floor',(0,0,0));empty('SOCKET_A01_north_connection',(0,0,-5))
 # A02: true thin boards clipped to footprint, deterministic stagger and a closed dark joint bed.
 group('A02');prism('VIS_A02.04_joint_bed',footprint,-.026,-.001,'M01',0)
 for i in range(60):
  x0=-6+i*.2+.0004;x1=x0+.1992;offset=(i*0.731)%2.25;z0=-7.25+offset;j=0
  while z0<5:
   z1=min(z0+2.25,5);poly=[list(p) for p in footprint]
   for axis,bound,less in [(0,x0,False),(0,x1,True),(1,max(z0,-5)+.0004,False),(1,z1-.0004,True)]:poly=clip(poly,axis,bound,less) if poly else []
   if len(poly)>=3:
    # Bevel only exposed top perimeter: 0.5mm chamfer, 20 triangles per ordinary board.
    n=len(poly);cx=sum(p[0] for p in poly)/n;cz=sum(p[1] for p in poly)/n
    top=[(x+(.0005 if x<cx else -.0005),z+(.0005 if z<cz else -.0005)) for x,z in poly]
    vs=[(x,y,z) for ring,y in [(poly,-.024),(poly,.0005),(top,.001)] for x,z in ring]
    fs=[tuple(range(n-1,-1,-1)),tuple(range(2*n,3*n))]+[(k*n+q,k*n+(q+1)%n,(k+1)*n+(q+1)%n,(k+1)*n+q) for k in [0,1] for q in range(n)]
    finish(mesh(f'VIS_A02.01_02_03_board_{i:02d}_{j}',vs,fs,'M01'),0)
   z0+=2.25;j+=1
 empty('SOCKET_A02_window_wear_zone',(0,.001,-4.5))
 # A03 exact 240mm walls and genuine portal holes, complete front/back gables.
 group('A03');wall_segments=[]
 for z,opening,height in [(-5,5.4,3.2),(5,1.8,2.6)]:
  for side in [-1,1]:
   a=(side*opening/2,0,z);b=(side*5.3,0,z);wall_segments.append((a,b))
   rail(f'A03.01_02_{z}_{side}',a,b,.24,3.4,'M05',True,.002)
  solid(f'A03.03_04_lintel_{z}',(0,height,z),(opening,3.4-height,.24),'M05',.002,True)
  # Trapezoidal gable has height at chamfer end; roof remains opaque on every normal view.
  vs=[(x,y,z+dz) for dz in [-.12,.12] for x,y in [(-5.3,3.4),(-5.3,3.61),(0,5.2),(5.3,3.61),(5.3,3.4)]]
  o=finish(mesh(f'VIS_A03.05_gable_{z}',vs,[(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)],'M05'),.002);proxy(o,f'A03_gable_{z}',interaction=False)
 for i,(a,b) in enumerate(zip(footprint,footprint[1:]+footprint[:1])):
  if abs(a[1])==5 and a[1]==b[1]:continue
  aa=(a[0],0,a[1]);bb=(b[0],0,b[1]);wall_segments.append((aa,bb));rail(f'A03.06_perimeter_{i}',aa,bb,.24,3.4,'M05',True,.002)
  if a[0]!=b[0]:
   # Sloping chamfer infill closes the small roof-to-eave wedge at all four corners.
   low=[(a[0],3.4,a[1]),(b[0],3.4,b[1])];high=[(x,5.2-.3*abs(x),z) for x,_,z in low]
   dx,dz=b[0]-a[0],b[1]-a[1];le=math.hypot(dx,dz);nx,nz=-dz/le*.12,dx/le*.12
   v=[(x+s*nx,y,z+s*nz) for s in [-1,1] for x,y,z in [low[0],low[1],high[1],high[0]]]
   o=finish(mesh(f'VIS_A03.05_chamfer_gable_{i}',v,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'M05'),0);proxy(o,f'A03_chamfer_gable_{i}',interaction=False)
 # A04 eight footprint posts with layered feet/caps, visible tenons and pegs.
 group('A04')
 for i,(x,z) in enumerate(footprint):
  solid(f'A04.01_04_post_{i}',(x,0,z),(.24,3.4,.24),'M02',.005,True)
  solid(f'A04.02_foot_{i}',(x,0,z),(.28,.14,.28),'M02',.004)
  solid(f'A04.03_cap_{i}',(x,3.26,z),(.30,.14,.30),'M02',.005)
  solid(f'A04.05_tenon_{i}',(x,3.40,z),(.11,.10,.11),'M02',.002)
  for y in [.24,3.13]:peg(f'A04.06_peg_{i}_{y}',(x,y,z-.124))
 # A05 ring beams meet on the octagon; north beam starts at opening height 3.2.
 group('A05')
 for i,(a,b) in enumerate(zip(footprint,footprint[1:]+footprint[:1])):
  bottom=3.2 if a[1]==b[1]==-5 else 3.14
  rail(f'A05.01_04_ring_{i}',(a[0],bottom,a[1]),(b[0],bottom,b[1]),.28,3.4-bottom,'M02',True)
 solid('A05.03_door_lintel',(0,2.6,5),(2.2,.25,.30),'M02',.004,True)
 for x in [-2.84,2.84]:
  solid('A05.02_window_bearing',(x,3.2,-5),(.28,.20,.32),'M02')
  peg('A05.05_window_peg',(x,3.29,-4.834))
 # A06 closed two-pitch ceiling and exterior skin. All camera proxies start at or above y=3.4.
 group('A06')
 for side in [-1,1]:
  x0,x1=sorted([0,side*6])
  slope(f'A06.01_05_closed_roof_{side}',x0,x1,-5.12,5.12,0,.12,collision=True)
  # Fine board grooves and periodic real rafters, following roof pitch.
  for j in range(41):
   z=-5+j*.25;slope(f'A06.01_board_seam_{side}_{j}',x0,x1,z-.002,z+.002,-.003,.003)
  for j,z in enumerate([-4.7,-3.1,-1.55,0,1.55,3.1,4.7]):
   slope(f'A06.02_rafter_{side}_{j}',*sorted([0,side*5.60]),z-.047,z+.047,-.115,.12,collision=True)
  solid(f'A06.04_inner_eave_{side}',(side*5.92,3.4,0),(.16,.09,10),'M02',.003,True)
 solid('A06.03_ridge_cap',(0,5.16,0),(.16,.12,10.24),'M02',.004,True)
 # A07 beam undersides remain at eaves or higher. Plane-cut sloped beams, no rotated crossing boxes.
 group('A07')
 for j,z in enumerate([-4.88,0,4.88]):
  solid(f'A07.01_tie_{j}',(0,3.4,z),(11.84,.24,.24),'M02',.005,True)
  for s in [-1,1]:slope(f'A07.02_principal_{j}_{s}',*sorted([s*5.3,0]),z-.12,z+.12,-.20,.20,collision=True)
  solid(f'A07.03_kingpost_{j}',(0,3.64,z),(.20,1.54,.20),'M02',.004,True)
  for side in [-1,1]:
   solid(f'A07.05_iron_strap_{j}_{side}',(side*.065,3.61,z+.123),(.042,.38,.005),'M07',.0005)
   for y in [3.69,3.90]:peg(f'A07.05_bolt_{j}_{side}_{y}',(side*.065,y,z+.128),r=.010,mat='M07')
 solid('A07.04_ridge_beam',(0,5.02,0),(.22,.18,10.24),'M02',.004,True)
 empty('SOCKET_A07_chandelier_hook',(0,3.4,0))
 # A08 triple-profile skirting with portal and fireplace gaps.
 group('A08')
 for i,(a,b) in enumerate(wall_segments):
  pieces=[(a,b)]
  if a[2]==b[2]==-5 and a[0]>0:pieces=[((2.95,0,-5),(3.55,0,-5)),((4.95,0,-5),(5.3,0,-5))]
  for k,(aa,bb) in enumerate(pieces):
   dx,dz=bb[0]-aa[0],bb[2]-aa[2];ll=math.hypot(dx,dz);mx,mz=(aa[0]+bb[0])/2,(aa[2]+bb[2])/2
   # Move inward by wall half-thickness; robust sign uses the midpoint toward centre.
   nx,nz=-dz/ll,dx/ll
   if nx*mx+nz*mz>0:nx,nz=-nx,-nz
   for part,y,h,w,offset in [('01',0,.11,.035,.1375),('02',.11,.04,.046,.143),('03_04',.034,.014,.044,.143)]:
    rail(f'A08.{part}_skirt_{i}_{k}',(aa[0]+nx*offset,y,aa[2]+nz*offset),(bb[0]+nx*offset,y,bb[2]+nz*offset),w,h,'M03',False,.002)
 # A09 true 1.8 x 2.6 clear portal. Deep reveal connects frozen wall z5 to requested leaf z5.4.
 group('A09')
 for s in [-1,1]:
  solid(f'A09.01_jamb_{s}',(s*1.0,0,5.12),(.2,2.6,.56),'M02',.003,True)
  for z in [4.81,5.43]:solid(f'A09.04_casing_{s}_{z}',(s*1.025,0,z),(.25,2.77,.045),'M02',.003)
  solid(f'A09.03_stop_{s}',(s*.92,0,5.445),(.04,2.60,.035),'M02',.002)
 solid('A09.02_header',(0,2.6,5.12),(2.2,.25,.56),'M02',.003,True)
 for z in [4.81,5.43]:solid(f'A09.04_crown_{z}',(0,2.74,z),(2.28,.11,.055),'M02',.003)
 solid('A09.06_nameplate_recess',(0,2.64,4.788),(.48,.075,.008),'M06',.001)
 for y in [.46,2.04]:solid('A09.05_hinge_seat',(-.925,y,5.37),(.07,.12,.035),'M06',.001)
 empty('SOCKET_A09_nameplate',(0,2.68,4.78))
 # A10 closed leaf: structural frame, recessed panels, brass ring handles, iron straps.
 group('A10');empty('PIVOT_A10_outward_hinge',(-.88,0,5.4))
 solid('A10.01_leaf_core',(0,.02,5.4),(1.76,2.56,.065),'M02',.003)
 for x in [-.795,.795]:solid('A10.01_stile',(x,.02,5.36),(.17,2.56,.045),'M02',.003)
 for y,h in [(.02,.18),(1.16,.16),(2.40,.18)]:solid('A10.01_rail',(0,y,5.36),(1.42,h,.045),'M02',.003)
 for row,y in enumerate([.20,1.32]):
  for i in range(6):solid(f'A10.02_panel_{row}_{i}',(-.592+i*.237,y,5.359),(.234,.96,.012),'M02',.0015)
 for y in [.46,2.04]:
  solid('A10.05_strap',(-.53,y,5.322),(.66,.055,.008),'M07',.0005)
  tube('VIS_A10.05_hinge_barrel',[(-.892,y-.035,5.39),(-.892,y+.10,5.39)],.017,'M06')
  for x in [-.80,-.60,-.28]:peg('A10.06_door_nail',(x,y+.027,5.308),mat='M07',r=.008)
 for z in [5.298,5.45]:
  solid('A10.04_escutcheon',(.56,1.03,z),(.075,.14,.011),'M06',.001)
  tube('VIS_A10.03_ring',[ (.56+.073*math.cos(i*math.tau/32),1.14+.09*math.sin(i*math.tau/32),z-.024) for i in range(33)],.010,'M06')
  tube('VIS_A10.03_ring_stud',[(.56,1.22,z),(.56,1.22,z-.03)],.018,'M06')
 solid('A10.07_kick_plate',(0,.035,5.32),(1.55,.105,.008),'M07',.001)
 col('A10_closed_leaf',(0,.02,5.4),(1.76,2.56,.065))
 # A11 external steps, visible/collision extents match, no interior riser.
 group('A11')
 solid('A11.01_threshold',(0,-.024,5.22),(1.8,.025,.44),'M02',.003,True)
 solid('A11.02_upper_step',(0,-.16,5.475),(2.4,.16,.55),'M18',.006,True)
 solid('A11.03_lower_step',(0,-.32,5.875),(2.4,.16,.35),'M18',.006,True)
 for s in [-1,1]:solid(f'A11.04_side_return_{s}',(s*1.18,-.32,5.65),(.04,.16,.80),'M18',.004)
 # A12 northern frame; glass panels parked entirely outboard of the 5.4m clear opening.
 group('A12')
 for s in [-1,1]:
  solid(f'A12.01_jamb_{s}',(s*2.825,0,-5),(.25,3.2,.32),'M02',.004,True)
  for z in [-5.176,-4.824]:solid(f'A12.01_beaded_casing_{s}_{z}',(s*2.842,0,z),(.284,3.3,.032),'M02',.002)
  for z in [-5.15,-4.85]:solid(f'A12.01_glazing_stop_{s}_{z}',(s*2.721,0,z),(.042,3.2,.016),'M02',.0015)
  # two telescoping leaves per side: distinct shallow channels avoid coincident transparent faces.
  for j in range(2):
   x=s*(3.45+j*.055);z=-5.205-j*.055
   for xx in [x-.67,x+.67]:solid(f'A12.04_parked_stile_{s}_{j}_{xx}',(xx,.024,z),(.055,3.12,.035),'M02',.002)
   for y in [.024,3.084]:solid(f'A12.04_parked_rail_{s}_{j}_{y}',(x,y,z),(1.395,.06,.035),'M02',.002)
   solid(f'A12.04_parked_glass_{s}_{j}',(x,.084,z),(1.285,3.0,.006),'M16',0)
  empty(f'SOCKET_A12_lantern_{"left" if s<0 else "right"}',(s*2.94,2.8,-4.72))
 solid('A12.02_header',(0,3.2,-5),(5.9,.36,.32),'M02',.004,True)
 solid('A12.02_crown',(0,3.56,-5),(5.98,.09,.36),'M02',.004)
 for z in [-5.11,-5.04]:solid(f'A12.03_flush_track_{z}',(0,-.008,z),(5.4,.009,.025),'M02',.001)
 empty('SOCKET_A12_terrace_portal',(0,0,-5))
 # A13 closed, flush 6.4 x 2m terrace. Real seams above load-bearing deck, no separate board colliders.
 group('A13');solid('A13.01_deck',(0,-.2,-6),(6.4,.198,2),'M02',.003,True)
 for i in range(32):solid(f'A13.04_deck_board_{i}',(-3.1+i*.2,-.024,-6),(.198,.025,2),'M02',.0007)
 solid('A13.02_north_fascia',(0,-.2,-6.97),(6.4,.20,.06),'M02',.004)
 for s in [-1,1]:solid('A13.02_side_fascia',(s*3.17,-.2,-6),(.06,.20,2),'M02',.004)
 for x in [-3.05,0,3.05]:solid('A13.03_joist',(x,-.28,-6),(.12,.08,2),'M02',.003)
 # A14 continuous physical top/middle/bottom rails; collision generated from each real rail.
 group('A14')
 for i,(a,b) in enumerate([((-3.13,0,-6.93),(3.13,0,-6.93)),((-3.13,0,-6.93),(-3.13,0,-5)),((3.13,0,-6.93),(3.13,0,-5))]):
  for part,y,h,w in [('02',.97,.08,.14),('03',.47,.075,.085),('03_lower',.13,.075,.085)]:rail(f'A14.{part}_rail_{i}',(a[0],y,a[2]),(b[0],y,b[2]),w,h,'M02',True,.006 if part=='02' else .003)
 positions=[(x,-6.93) for x in [-3.13,-1.565,0,1.565,3.13]]+[(-3.13,-5),(3.13,-5)]
 for i,(x,z) in enumerate(positions):
  solid(f'A14.01_post_{i}',(x,0,z),(.14,1.05,.14),'M02',.004,True)
  solid(f'A14.04_cap_{i}',(x,1.02,z),(.18,.03,.18),'M02',.006)
  solid(f'A14.05_foot_{i}',(x,0,z),(.19,.06,.19),'M02',.003)
  for y in [.13,.47,.96]:solid(f'A14.06_iron_collar_{i}_{y}',(x,y,z),(.148,.025,.148),'M07',.0005)
 return [o for o in collection.objects if o.name in ['WW_A%02d'%i for i in range(1,15)]]
