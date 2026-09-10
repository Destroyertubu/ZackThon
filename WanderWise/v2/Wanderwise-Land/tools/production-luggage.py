"""G12 F15/F18 local original assets, shared builder globals; no books/config edits.
Three explicitly dimensioned luggage variants, six rolled maps, no random dressing.
"""

def luggage_box(name,p,size,mat='M03',bevel=.002):
 o=box(name,p,size,mat,0)
 if bevel:
  mod=o.modifiers.new('Small travel joinery bevel','BEVEL');mod.width=min(bevel,min(size)/3);mod.segments=1
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('Travel weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def luggage_band(x,y,w,h,d):
 # Closed ribbon over lid/front/base/back; thickness .8mm, no leather tube.
 profile=[(0,-d/2), (h,-d/2), (h,d/2), (0,d/2)]
 verts=[];faces=[]
 for xx in [x-w/2,x+w/2]:
  for yy,zz in profile:verts.append((xx,y+yy,zz))
 for i in range(4):j=(i+1)%4;faces.append((i,j,j+4,i+4))
 o=mesh('VIS_F15.06_wrapped_strap',verts,faces,'M13')
 mod=o.modifiers.new('Leather strap 0.8mm','SOLIDIFY');mod.thickness=.0008
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)

def luggage_case(p,size,variant):
 x,y,z=p;w,h,d=size;body_d=d-.052;half=body_d/2;seam=y+h-.09
 for xx in [-w*.39,w*.39]:
  for zz in [-body_d*.36,body_d*.36]:luggage_box('VIS_F15.07_foot',(x+xx,y,z+zz),(.045,.025,.04),'M03',.002)
 luggage_box('VIS_F15.01_lower_shell',(x,y+.025,z),(w,h-.118,body_d),'M03',.005)
 luggage_box('VIS_F15.01_separate_lid',(x,seam,z),(w,.09,body_d),'M03',.005)
 # Independently authored leather insets allow the timber edge to remain readable.
 for sign in [-1,1]:
  luggage_box('VIS_F15.02_leather_inset',(x,y+.053,z+sign*(half+.001)),(w-.060,h-.17,.002),'M13',.001)
  luggage_box('VIS_F15.02_lid_leather',(x,seam+.014,z+sign*(half+.001)),(w-.06,.058,.002),'M13',.001)
 luggage_box('VIS_F15.02_top_inset',(x,y+h-.001,z),(w-.060,.002,body_d-.06),'M13',.001)
 # Folded three-face caps follow each actual corner; never floating gold cubes.
 for sx in [-1,1]:
  for sz in [-1,1]:
   for sy in [0,1]:
    yy=y+.025 if sy==0 else y+h-.027;xx=x+sx*(w/2-.015);zz=z+sz*(half-.015)
    luggage_box('VIS_F15.03_folded_corner_front',(xx,yy,z+sz*(half+.002)),(.033,.027,.002),'M06',0)
    luggage_box('VIS_F15.03_folded_corner_side',(x+sx*(w/2+.001),yy,zz),(.002,.027,.033),'M06',0)
    luggage_box('VIS_F15.03_folded_corner_top',(xx,yy+(.026 if sy else 0),zz),(.033,.001,.033),'M06',0)
 for dx in [-w*.29,w*.29]:
  # Profile coordinates translated as a rigid component, rather than resizing a mesh.
  before=set(collection.objects);luggage_band(x+dx,y+.024,.032,h-.023,body_d+.007)
  for o in set(collection.objects)-before:o.location.y=-z
  luggage_box('VIS_F15.05_latch_base',(x+dx,seam-.033,z+half+.004),(.040,.072,.006),'M06',.001)
  luggage_box('VIS_F15.05_latch_tongue',(x+dx,seam-.006,z+half+.009),(.019,.049,.005),'M06',.001)
  luggage_box('VIS_F15.05_key_slot',(x+dx,seam-.025,z+half+.008),(.005,.012,.001),'M03',0)
  luggage_box('VIS_F15.05_rear_hinge',(x+dx,seam-.026,z-half-.004),(.052,.047,.003),'M06',.0005)
  tube('VIS_F15.05_rear_hinge_pin',[(x+dx-.028,seam,z-half-.008),(x+dx+.028,seam,z-half-.008)],.004,'M06')
 # All handles are on the front: the next case rests on the unobstructed lid.
 for dx in [-.084,.084]:luggage_box('VIS_F15.04_handle_mount',(x+dx,y+h*.48,z+half+.006),(.029,.032,.007),'M06',.001)
 tube('VIS_F15.04_leather_grip',[(x-.084,y+h*.51,z+half+.010),(x-.070,y+h*.47,z+half+.025),(x-.050,y+h*.45,z+half+.027),(x+.050,y+h*.45,z+half+.027),(x+.070,y+h*.47,z+half+.025),(x+.084,y+h*.51,z+half+.010)],.007,'M13')
 empty('SOCKET_F15_top_'+str(variant),(x,y+h,z))
 col('F15_case_'+str(variant),(x,y,z),(w+.004,h,d+.004))

def luggage_map_roll(p,height,phase):
 # Actual paper spiral extrusion, open centre and a thin visible spiral rim.
 x,y,z=p;n=28;verts=[];faces=[]
 for hh in [0,height]:
  for i in range(n+1):
   t=i/n;a=phase+t*math.tau*1.3;r=.023+.014*t
   verts.append((x+r*math.cos(a),y+hh,z+r*math.sin(a)))
 for i in range(n):faces.append((i,i+1,i+n+2,i+n+1))
 o=mesh('VIS_P04.01_02_05_open_spiral',verts,faces,'M12',True)
 mod=o.modifiers.new('Rolled paper 0.35mm','SOLIDIFY');mod.thickness=.00035
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Bound below top rail; this ribbon follows the outside without crossing paper.
 verts=[];faces=[]
 for yy in [y+height*.48,y+height*.48+.006]:
  for i in range(17):a=i*math.tau/16;verts.append((x+.039*math.cos(a),yy,z+.039*math.sin(a)))
 for i in range(16):faces.append((i,i+1,i+18,i+17))
 mesh('VIS_P04.03_binding_ribbon',verts,faces,'M09')

def luggage_rack():
 g=group('F18')
 luggage_box('VIS_F18.01_plinth',(0,0,0),(.46,.035,.38),'M03',.003)
 luggage_box('VIS_F18.05_recessed_liner',(0,.035,0),(.394,.009,.314),'M03',.001)
 for x in [-.211,.211]:
  for z in [-.171,.171]:luggage_box('VIS_F18.01_corner_post',(x,.035,z),(.033,.625,.033),'M03',.003)
 # Six map bays, rigid dividers at the mouth and open rails lower down.
 for y in [.115,.612]:
  for x in [-.208,.208]:luggage_box('VIS_F18.01_side_rail',(x,y,0),(.025,.034,.31),'M03',.002)
  for z in [-.168,.168]:luggage_box('VIS_F18.01_cross_rail',(0,y,z),(.40,.034,.025),'M03',.002)
 for x in [-.067,.067]:luggage_box('VIS_F18.02_divider',(x,.075,0),(.009,.548,.314),'M03',.001)
 luggage_box('VIS_F18.02_middle_divider',(0,.075,0),(.396,.548,.009),'M03',.001)
 # Copper hoop follows the top corners, and supports the actual upper timber frame.
 pts=[];w=.435;d=.355;r=.018
 for cx,cz,a in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
  for i in range(5):ang=math.radians(a+i*90/4);pts.append((cx+r*math.cos(ang),.646,cz+r*math.sin(ang)))
 tube('VIS_F18.03_copper_hoop',pts+[pts[0]],.003,'M06')
 slots=[(x,z) for z in [-.083,.083] for x in [-.134,0,.134]]
 for i,(x,z) in enumerate(slots):
  h=[.62,.69,.57,.73,.65,.60][i]
  empty('SOCKET_F18.04_roll_%02d'%(i+1),(x,.044,z))
  luggage_map_roll((x,.044,z),h,i*.61)
 col('F18_rack',(0,0,0),(.46,.66,.38))
 place_at(g,'map_rack');return g

def build_luggage():
 east=group('F15_east');east['assetId']='F15'
 luggage_case((0,0,0),(.92,.48,.56),'large');place_at(east,'east_luggage')
 entry=group('F15_entry');entry['assetId']='F15'
 luggage_case((0,0,0),(.76,.36,.46),'medium')
 luggage_case((.024,.36,-.012),(.64,.30,.40),'small');place_at(entry,'entry_luggage')
 return east,entry,luggage_rack()
