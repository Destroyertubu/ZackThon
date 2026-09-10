"""G06 asset builders, executed by build-production-room.py in its owned collection.
Local +Z front; each part retains the production kit component ID.
"""
def soft(name,p,size,mat='M08',radius=.05):
 # Parametric padded silhouette with a broad convex surface and pinched edges.
 def sp(v,e):return math.copysign(abs(v)**e,v)
 verts=[];faces=[];N=40;K=20
 for j in range(K+1):
  lat=-math.pi/2+j*math.pi/K
  for i in range(N):
   lon=i*math.tau/N
   verts.append((p[0]+size[0]/2*sp(math.cos(lat),.42)*sp(math.cos(lon),.36),p[1]+size[1]/2+size[1]/2*sp(math.sin(lat),.42),p[2]+size[2]/2*sp(math.cos(lat),.42)*sp(math.sin(lon),.36)))
 for j in range(K):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;faces.append((a,a+N,b+N,b))
 o=mesh(name,verts,faces,mat,True);uv(o,.30);return o

def ringrect(name,w,d,y,z=0,mat='M08',r=.003):
 pts=[]
 for cx,cz,a in [(w/2-.04,d/2-.04,0),(-w/2+.04,d/2-.04,90),(-w/2+.04,-d/2+.04,180),(w/2-.04,-d/2+.04,270)]:
  for i in range(9):t=math.radians(a+i*90/8);pts.append((cx+.04*math.cos(t),y,z+cz+.04*math.sin(t)))
 tube(name,pts+[pts[0]],r,mat)

def chair():
 g=group('F01')
 for x in [-.40,.40]:
  for z in [-.39,.39]:
   lathe('VIS_F01.01_turned_leg',[(0,0),(.026,0),(.03,.01),(.03,.04),(.026,.048),(.034,.075),(.036,.09),(.029,.106),(.026,.17),(.036,.19),(.038,.21),(.038,.25),(0,.25)],'M03',24,(x,0,z))
 box('VIS_F01.02_front_rail',(0,.20,.425),(.9,.085,.065),'M03',.003)
 for x in [-.43,.43]:box('VIS_F01.02_side_rail',(x,.20,0),(.065,.085,.9),'M03',.003)
 seat=soft('VIS_F01.03_seat',(0,.29,.02),(.79,.15,.85),'M08',.052)
 ringrect('VIS_F01.06_seat_piping',.77,.82,.418,.02,'M08',.004)
 back=soft('VIS_F01.04_back',(0,.39,-.40),(.91,.71,.18),'M08',.065);back.rotation_euler.x=-math.radians(10)
 for x in [-.435,.435]:
  soft('VIS_F01.05_arm',(x,.295,.0),(.17,.415,.95),'M08',.064)
  tube('VIS_F01.06_arm_seam',[(x+.07*math.cos(i*math.tau/48),.50+.15*math.sin(i*math.tau/48),.46) for i in range(49)],.003,'M08')
 # Scalloped tension channels are geometric under 2mm, separate from fibre normal.
 for x in [-.24,0,.24]:tube('VIS_F01.08_back_seam',[(x,.50+j*.035,-.285-(j*.035)*.176) for j in range(15)],.0017,'M08')
 for x in [-.37,.37]:box('VIS_F01.02_upright',(x,.25,-.465),(.035,.68,.035),'M03',.003)
 col('F01_seat',(0,0,.01),(1.04,.72,1.04));col('F01_back',(0,.70,-.43),(.94,.42,.28))
 empty('SOCKET_F01_chair_cloth',(0,.445,0));empty('SOCKET_F01_pillow',(0,.44,-.21))
 return g,seat

def pillow(parent):
 global root
 root=parent
 # Tailored two-sided surface with pinched corners. Bottom rests on seat top.
 nx=20;verts=[];faces=[]
 for side in [-1,1]:
  for j in range(nx+1):
   v=j/nx
   for i in range(nx+1):
    u=i/nx;bulge=(math.sin(u*math.pi)*math.sin(v*math.pi))**.65
    verts.append(((u-.5)*.43*(.93+.07*math.sin(v*math.pi)),.444+v*.43+.012*math.sin(u*math.pi)*(1-2*v),-.19-v*.07+side*(.013+.075*bulge)))
 count=(nx+1)**2
 for side in range(2):
  for j in range(nx):
   for i in range(nx):a=side*count+j*(nx+1)+i;f=(a,a+1,a+nx+2,a+nx+1);faces.append(f if side==1 else tuple(reversed(f)))
 for j in range(nx):
  for i in [0,nx]:a=j*(nx+1)+i;b=a+nx+1;faces.append((a,b,b+count,a+count))
 for i in range(nx):
  for j in [0,nx]:a=j*(nx+1)+i;faces.append((a,a+count,a+count+1,a+1))
 o=mesh('VIS_T05.01_tailored_cushion',verts,faces,'M10',True);uv(o,.35)
 # Sewn perimeter, original leaf stitch; all on front shell with surface-following depth.
 def point(u,v):return ((u-.5)*.43*(.93+.07*math.sin(v*math.pi)),.444+v*.43+.012*math.sin(u*math.pi)*(1-2*v),-.19-v*.07+.016+.075*(max(0,math.sin(u*math.pi)*math.sin(v*math.pi)))**.65)
 edge=[point(i/24,0) for i in range(25)]+[point(1,i/24) for i in range(25)]+[point(1-i/24,1) for i in range(25)]+[point(0,1-i/24) for i in range(25)];tube('VIS_T05.02_piping',edge+[edge[0]],.002,'M10')
 tube('VIS_T05.04_leaf_stem',[point(.50,.30+i*.4/20) for i in range(21)],.0018,'M08')
 for sign in [-1,1]:
  for off in [0,.14]:tube('VIS_T05.04_leaf_outline',[point(.50+sign*.17*math.sin(t*math.pi),.36+off+t*.22) for t in [i/20 for i in range(21)]],.0018,'M08')
 return o

def blanket(parent,seat):
 global root
 root=parent
 nx=20;ny=28;verts=[];faces=[]
 # Pin rear row; gravity drapes the free end around the actual seat proxy offline.
 for j in range(ny+1):
  for i in range(nx+1):verts.append(((i/nx-.5)*.57+.06,.47+.032*math.sin(i/nx*math.pi*6)**2,-.13+j/ny*.95))
 for j in range(ny):
  for i in range(nx):a=j*(nx+1)+i;faces.append((a,a+nx+1,a+nx+2,a+1))
 cloth=mesh('VIS_T04.01_draped_blanket',verts,faces,'M09',True);uv(cloth,.3)
 proxy=box('CLOTH_ONLY_seat',(0,.18,.026),(.80,.26,.924),None,.04);proxy.modifiers.new('Offline cloth collision','COLLISION');proxy.collision.thickness_outer=.004
 vg=cloth.vertex_groups.new(name='rear_pin');vg.add(list(range(nx+1)),1,'REPLACE');bpy.context.view_layer.objects.active=cloth;mod=cloth.modifiers.new('Offline gravity drape','CLOTH');mod.settings.quality=7;mod.settings.mass=.25;mod.settings.vertex_group_mass=vg.name;mod.settings.tension_stiffness=22;mod.settings.compression_stiffness=22;mod.settings.shear_stiffness=10;mod.settings.bending_stiffness=.6;mod.collision_settings.use_collision=True;mod.collision_settings.distance_min=.004;mod.point_cache.frame_start=1;mod.point_cache.frame_end=65
 for frame in range(1,66):bpy.context.scene.frame_set(frame)
 bpy.context.view_layer.objects.active=cloth;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(proxy,do_unlink=True)
 # Thick textile is static at runtime; grouped tassels follow the simulated hem.
 def point(i,j,offset=.002):
  v=cloth.data.vertices[j*(nx+1)+i].co;return (v.x,v.z+offset,-v.y)
 for side in [0,nx]:tube('VIS_T04.04_edge_seam',[point(side,j) for j in range(ny+1)],.0022,'M10')
 for i in range(0,nx+1,2):
  a=point(i,ny);tube('VIS_T04.05_tassel',[a,(a[0]+.008,a[1]-.035,a[2]+.006),(a[0],a[1]-.067,a[2]+.01)],.003,'M10')
 solid=cloth.modifiers.new('3mm textile thickness','SOLIDIFY');solid.thickness=.003;bpy.context.view_layer.objects.active=cloth;bpy.ops.object.modifier_apply(modifier=solid.name)
 bpy.context.scene.frame_set(1)
 return cloth

def lamp():
 g=group('L05')
 lathe('VIS_L05.01_weighted_base',[(0,0),(.135,0),(.15,.006),(.15,.026),(.138,.036),(.055,.05),(0,.05)],'M06',40)
 lathe('VIS_L05.02_stem',[(0,.05),(.0125,.05),(.0125,1.27),(0,1.27)],'M06',20)
 tube('VIS_L05.03_bent_neck',[(-.06+.06*math.cos(i*math.pi/32),1.34+.065*math.sin(i*math.pi/32),0) for i in range(33)],.0125,'M06')
 lathe('VIS_L05.04_bell_shade',[(.14,1.21),(.14,1.219),(.133,1.225),(.113,1.26),(.075,1.33),(.037,1.365),(.026,1.373),(.018,1.366),(.027,1.356),(.067,1.32),(.105,1.253),(.127,1.218),(.14,1.21)],'M06',48,(-.08,0,0))
 lathe('VIS_L05.05_adjuster',[(0,1.367),(.024,1.367),(.024,1.405),(0,1.405)],'M06',24,(-.08,0,0))
 lathe('VIS_L05_bulb',[(0,1.245),(.023,1.25),(.03,1.278),(.021,1.30),(0,1.31)],'M19',24,(-.08,0,0))
 tube('VIS_L05.06_cable',[(.014,.08,.008),(.020,.28,.010),(.022,.8,.008),(.017,1.1,.008)],.003,'M07')
 col('L05_base',(0,0,0),(.30,.05,.30),camera=False,interaction=False);col('L05_shade',(-.08,1.21,0),(.28,.24,.28),player=False,interaction=False);empty('SOCKET_L05_light',(-.08,1.255,0));return g

def cup():
 g=group('P13')
 lathe('VIS_P13.01_04_cup',[(0,0),(.038,0),(.043,.006),(.048,.095),(.047,.105),(.044,.108),(.041,.105),(.041,.098),(.036,.012),(0,.012)],'M14',40)
 tube('VIS_P13.05_handle',[(.043,.022,0),(.071,.028,0),(.078,.055,0),(.07,.083,0),(.045,.086,0)],.006,'M14')
 lathe('VIS_P13.07_tea',[(0,.091),(.039,.091)],'M26',40)
 for side in [-1,1]:tube('VIS_P13.06_leaf',[(side*.015*math.sin(t*math.pi),.035+t*.038,.048) for t in [i/20 for i in range(21)]],.0008,'M06')
 empty('SOCKET_P13_base',(0,0,0));return g

def plant():
 g=group('V06')
 lathe('VIS_V06.01_body',[(0,0),(.18,0),(.19,.015),(.22,.08),(.265,.24),(.27,.33),(.247,.47),(.22,.56),(.228,.58),(.228,.6),(.207,.6),(.207,.57)],'M06',48)
 lathe('VIS_V06.05_inner',[(.204,.575),(.204,.51),(.19,.47),(0,.47)],'M14',40)
 lathe('VIS_V06.06_soil',[(0,.535),(.201,.535)],'M27',40)
 for y,r in [(.07,.217),(.19,.254),(.36,.267),(.46,.25),(.585,.23)]:lathe('VIS_V06.03_raised_band',[(r,y),(r+.003,y+.007),(r,y+.015)],'M06',48)
 col('V06_pot',(0,0,0),(.54,.60,.54));empty('SOCKET_V06_plant_soil',(0,.535,0))
 # Nine attached leaves, ribbed curved lobes, three repeatable silhouette families.
 tube('VIS_V01.01_main_stem',[(0,.53,0),(.01,.9,-.015),(.0,1.10,0)],.012,'M15')
 for i in range(9):
  a=i*2.399;h=.78+(i%3)*.23;length=.38+(i%3)*.045;dx,dz=math.cos(a),math.sin(a);sx,sz=-dz,dx;base=(dx*.10,h,dz*.10)
  tube('VIS_V01.02_petiole',[(0,.59,0),(dx*.035,h-.1,dz*.035),base],.006,'M15')
  verts=[];faces=[];N=20
  for row in range(N+1):
   t=row/N;w=math.sin(math.pi*t)**.7*.17*(1-.72*max(0,math.sin(t*math.pi*7))**10);mid=(base[0]+dx*length*t,base[1]+.08*math.sin(math.pi*t)-.12*t*t,base[2]+dz*length*t)
   for side in [-1,0,1]:verts.append((mid[0]+sx*w*side,mid[1]-.018*abs(side)*math.sin(math.pi*t),mid[2]+sz*w*side))
  for row in range(N):
   for side in [0,1]:
    if i%3==0 and side==0 and row in [6,7]:continue
    n=row*3+side;faces.append((n,n+3,n+4,n+1))
  leaf=mesh('VIS_V01.03_04_split_leaf',verts,faces,'M15',True);solid=leaf.modifiers.new('Leaf thickness','SOLIDIFY');solid.thickness=.001
  tube('VIS_V01.03_midrib',[verts[row*3+1] for row in range(N+1)],.0015,'M15')
 return g

def corner():
 architecture();gray_furniture(skip=('F01','F02','F04'))
 # Apply authored surface textures to the wall and continuous floor. The rest is greybox.
 for o in collection.objects:
  if o.name=='VIS_A01_floor':o.data.materials.clear();o.data.materials.append(M['M01']);uv(o,1.65)
 group('A12')
 for x in [-2.78,2.78]:box('VIS_A12_deep_jamb',(x,0,-4.98),(.16,3.3,.48),'M02',.006)
 box('VIS_A12_lintel',(0,3.18,-4.98),(5.72,.19,.48),'M02',.006)
 for x in [-5.78,-2.8]:box('VIS_A03_local_timber',(x,0,-4.78),(.12,3.4,.12),'M02',.004)
 box('VIS_A03_local_crossbeam',(-4.28,2.94,-4.77),(3.15,.12,.16),'M02',.004)
 build_reading()

def build_reading():
 g,seat=chair();pillow(g);blanket(g,seat);place_at(g,'reading_chair')
 place_at(bookcase(),'west_bookcase');place_at(side_table(),'reading_table');place_at(lamp(),'reading_lamp');place(cup(),(-4.98,.59,-1.9));place_at(plant(),'plant_reading')



def book(p,variant=0):
 x,y,z=p;w=.035+(variant%3)*.008;h=.23+(variant%4)*.012;d=.19
 box('VIS_P01.03_paper',(x,y+.003,z),(w-.004,h-.006,d-.006),'M12',.0005)
 for side in [-1,1]:box('VIS_P01.01_cover',(x+side*(w-.002)/2,y,z),(.002,h,d),'M13',.0005)
 box('VIS_P01.02_spine',(x,y,z+d/2),(w,h,.004),'M13',.001)
 for hh in [.024,h-.028]:box('VIS_P01.05_foil',(x,y+hh,z+d/2+.0025),(w*.78,.003,.001),'M06',0)
 box('VIS_P01.06_marker',(x+.009,y+h-.001,z-.045),(.011,.001,.12),'M28',0)

def bookcase():
 g=group('F04')
 box('VIS_F04.02_back',(0,.045,-.17),(3.27,2.66,.035),'M03',.002)
 for x in [-1.64,0,1.64]:box('VIS_F04.01_stile',(x,0,0),(.07,2.74,.4),'M03',.003)
 for y in [.02,.39,.86,1.33,1.80,2.27]:
  box('VIS_F04.03_shelf',(0,y,0),(3.35,.028,.4),'M03',.0015)
  empty('SOCKET_F04_shelf_'+str(y),(0,y+.028,0))
  if y>.1:
   for x in [-1.52,-.12,.12,1.52]:box('VIS_F04.06_bracket',(x,y-.08,.08),(.022,.08,.10),'M06',.001)
 for y,w,h in [(2.67,3.35,.05),(2.72,3.35,.03)]:box('VIS_F04.04_cornice',(0,y,.012),(w,h,.42),'M03',.002)
 for x in [-1.22,-.41,.41,1.22]:
  box('VIS_F04.05_lower_front',(x,.06,.203),(.76,.29,.032),'M03',.002)
  tube('VIS_F04.05_handle',[(x-.045,.19,.223),(x-.04,.17,.245),(x+.04,.17,.245),(x+.045,.19,.223)],.004,'M06')
 for row,y in enumerate([.418,.888,1.358,1.828,2.298]):
  for side in [-1,1]:
   for i in range(6):book((side*.85+(i-2.5)*.052,y,.06),i+row)
 col('F04_case',(0,0,0),(3.35,2.75,.40));return g
