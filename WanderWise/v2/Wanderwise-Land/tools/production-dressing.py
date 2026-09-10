"""Deterministic original woven ornaments and north scenery, not reference-image planes."""
def small_rug(id,w,d,rootid):
 g=group(id);box('VIS_'+id+'.01_weave',(0,0,0),(w,.009,d),'M11',.001)
 for inset in [.035,.08,.16]:
  pts=[(-w/2+inset,.010,-d/2+inset),(w/2-inset,.010,-d/2+inset),(w/2-inset,.010,d/2-inset),(-w/2+inset,.010,d/2-inset),(-w/2+inset,.010,-d/2+inset)]
  tube('VIS_'+id+'.02_border',pts,.002,'M28')
 for z in [-d/2+.115,d/2-.115]:
  for i in range(int(w/.18)-1):
   x=-w/2+.18+i*.18;mesh('VIS_'+id+'.03_motif',[(x,.010,z-.026),(x+.032,.010,z),(x,.010,z+.026),(x-.032,.010,z)],[(0,3,2,1)],'M28')
 for side in [-1,1]:
  for i in range(int(w/.045)):
   x=-w/2+.03+i*.045;mesh('VIS_'+id+'.04_fringe',[(x,.008,side*d/2),(x+.017,.008,side*d/2),(x+.018,.004,side*(d/2+.038)),(x,.004,side*(d/2+.04))],[(0,1,2,3) if side<0 else (3,2,1,0)],'M10')
 place_at(g,rootid)

def banner(p,yaw):
 g=group('T06');w=.53;h=1.45
 verts=[]
 for y in range(13):
  for i in range(9):
   x=-w/2+w*i/8;verts.append((x,h*y/12,.018*math.sin(i*.8)*(y/12)))
 faces=[(j*9+i,j*9+i+1,(j+1)*9+i+1,(j+1)*9+i) for j in range(12) for i in range(8)]
 mesh('VIS_T06_cloth',verts,faces,'M09',True)
 tube('VIS_T06_rod',[(-.32,h,0),(.32,h,0)],.012)
 # Original leaf badge, embroidery is nonmetallic.
 tube('VIS_T06_leaf',[(-.14,.67,.027),(-.17,.86,.027),(0,1.08,.027),(.17,.86,.027),(.14,.67,.027),(0,.56,.027),(-.14,.67,.027)],.004,'M28')
 tube('VIS_T06_stem',[(0,.51,.03),(0,.99,.03)],.003,'M28')
 for y in [.67,.79,.9]:
  for side in [-1,1]:tube('VIS_T06_vein',[(0,y-.06,.03),(side*.10,y+.025,.03)],.002,'M28')
 for x in [-.24,.24]:tube('VIS_T06_edge',[(x,.02,.03),(x,1.42,.03)],.002,'M28')
 place(g,p,yaw)

def mountain_environment():
 import random
 rng=random.Random(731)
 g=group('E01');N=65;verts=[]
 for j in range(N):
  z=-300+600*j/(N-1)
  for i in range(N):
   x=-400+800*i/(N-1)
   peaks=[(0,-30,450,300),(-235,-40,285,240),(265,-80,305,230)]
   h=max(max(0,ht*(1-math.sqrt(((x-px)/radius)**2+((z-pz)/(radius*.8))**2))) for px,pz,ht,radius in peaks)
   detail=(math.sin(x*.063+z*.027)*math.sin(z*.087)+.4*math.sin(x*.17-z*.11))*min(h*.10,21)
   verts.append((x,max(0,h+detail)*.32,z))
 faces=[]
 for j in range(N-1):
  for i in range(N-1):
   a=j*N+i;faces.extend([(a,a+N,a+1),(a+1,a+N,a+N+1)])
 o=mesh('VIS_E01_ridges',verts,faces,'M18',True);o.data.materials.append(M['M24'])
 for face in o.data.polygons:
  h=sum(o.data.vertices[i].co.z for i in face.vertices)/3
  face.material_index=1 if h>46.4 and face.normal.z>.46+math.sin(face.center.x*.05)*.15 else 0
 place_at(g,'mountain')
 g=group('E02');verts=[];N=35
 def valley(x,z):return -12+min(55,abs(x)*.30)*(1+.16*math.sin(z*.028))+2*math.sin(x*.03+z*.06)
 for j in range(N):
  z=-200+400*j/(N-1)
  for i in range(N):x=-150+300*i/(N-1);verts.append((x,valley(x,z),z))
 faces=[(j*N+i,(j+1)*N+i,(j+1)*N+i+1,j*N+i+1) for j in range(N-1) for i in range(N-1)]
 mesh('VIS_E02_valley',verts,faces,'M20',True)
 positions=[]
 # Fixed sparse valley corridor; tiered irregular needle rings, not cone primitives.
 for k in range(150):
  x=rng.uniform(-147,147);z=rng.uniform(-190,185);center=9*math.sin(z*.017)
  if abs(x-center)<17:continue
  y=valley(x,z);h=rng.uniform(8,15);positions.append([x,y,z,h]);tv=[];tf=[]
  for layer in range(4):
   base=len(tv);rr=h*(.21-layer*.032);yy=y+h*(.18+layer*.19)
   for i in range(10):
    a=i*math.tau/10;r=rr*(.8+rng.random()*.3);tv.append((x+r*math.cos(a),yy+rng.uniform(-.3,.3),z+r*math.sin(a)))
   tv.append((x,yy+h*.37,z))
   for i in range(10):tf.append((base+i,base+10,base+(i+1)%10))
  mesh('VIS_V07_needles',tv,tf,'M20');tube('VIS_V07_trunk',[(x,y,z),(x,y+h*.88,z)],.12,'M02')
 place_at(g,'forest');(SRC/'environment-seed731.json').write_text(json.dumps(positions))
 g=group('E03');v=[]
 for j in range(61):
  z=-120+j*4;x=8*math.sin(z*.017)
  v.extend([(x-7,.02,z),(x+7,.02,z)])
 mesh('VIS_E03_water',v,[(j*2,(j+1)*2,(j+1)*2+1,j*2+1) for j in range(60)],'M21',True);place_at(g,'water')
 g=group('E05');v=[]
 for j in range(8):
  z=-2.5+j*5/7
  for i in range(17):x=-6+i*.75;v.append((x,-1.5+2.1*(j/7)+.13*math.sin(x*2.1),z))
 mesh('VIS_E05_nearslope',v,[(j*17+i,(j+1)*17+i,(j+1)*17+i+1,j*17+i+1) for j in range(7) for i in range(16)],'M18',True);place_at(g,'near_slope')

def build_dressing():
 small_rug('T02',2.45,2.05,'journal_rug');small_rug('T03',1.25,2.1,'entry_rug')
 for p,yaw in [((5.83,1.12,.6),-math.pi/2),((-5.83,1.16,.0),math.pi/2),((3.12,1.2,-4.85),0)]:banner(p,yaw)
 # Same foliage family/scale; roots are frozen design values.
 for id in ['plant_window_left','plant_window_right','plant_journal','plant_phone','plant_cabinet']:place_at(plant(),id)
 mountain_environment()
