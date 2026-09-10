"""G08 / F16-F17 original geometry. Executed in the main builder's globals.
All coordinates are local web metres, bottom centre, +Z front. No runtime/data code.
"""

def east_box(name,p,size,mat='M03',bevel=.002):
 o=box(name,p,size,mat,0)
 if bevel:
  m=o.modifiers.new('Furniture edge 2 segment','BEVEL');m.width=min(bevel,min(size)/3);m.segments=2
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
  m=o.modifiers.new('Joinery weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=m.name)
 return o

def east_strokes(name,paths,p,size,mat='M06',width=.035):
 # Original line glyphs; no font files, downloaded text or fabricated user content.
 verts=[];faces=[]
 for path in paths:
  for a,b in zip(path,path[1:]):
   dx=b[0]-a[0];dy=b[1]-a[1];l=math.hypot(dx,dy)
   if l==0:continue
   nx=-dy/l*width/2;ny=dx/l*width/2;n=len(verts)
   for x,y in [(a[0]+nx,a[1]+ny),(a[0]-nx,a[1]-ny),(b[0]-nx,b[1]-ny),(b[0]+nx,b[1]+ny)]:verts.append((p[0]+x*size,p[1]+y*size,p[2]))
   faces.append((n,n+1,n+2,n+3))
 return mesh(name,verts,faces,mat)

def east_number(value,p,size=.023):
 seg=[[(.12,.9),(.65,.9)],[(.68,.87),(.68,.51)],[(.68,.45),(.68,.09)],[(.12,.06),(.65,.06)],[(.09,.09),(.09,.45)],[(.09,.51),(.09,.87)],[(.12,.48),(.65,.48)]]
 digits=['012345','12','01643','01236','1256','02536','023456','012','0123456','012356']
 for k,ch in enumerate(str(value).zfill(2)):east_strokes('VIS_P20.03_number_'+str(value),[seg[int(i)] for i in digits[int(ch)]],(p[0]+k*size*.85,p[1],p[2]),size,'M03',.065)

def east_label(p,number):
 x,y,z=p
 east_box('VIS_P20.01_05_brass_frame',(x,y,z),(.09,.035,.004),'M06',.002)
 east_box('VIS_P20.02_paper',(x,y+.003,z+.0024),(.078,.029,.0005),'M12',0)
 east_number(number,(x-.019,y+.004,z+.003),.024)
 for sx in [-1,1]:
  east_box('VIS_P20.04_pin',(x+sx*.041,y+.015,z+.0025),(.003,.003,.001),'M06',0)

def east_leaf(p,size=.075):
 x,y,z=p
 paths=[[(.5,0),(.5,1)],[(.5,0),(.18,.40),(.155,.70),(.5,1),(.845,.70),(.82,.40),(.5,0)]]
 for h,w in [(.25,.20),(.43,.28),(.62,.22)]:
  for sign in [-1,1]:paths.append([(.5,h),(.5+sign*w,h+.15)])
 east_strokes('VIS_P22_leaf_badge',paths,(x-size*.5,y,z),size,'M06',.025)

def east_cabinet():
 g=group('F07')
 # Plinth with actual feet and stepped cornice: 3.55 x 2.88 x .62.
 for x in [-1.65,-.55,.55,1.65]:
  for z in [-.22,.22]:east_box('VIS_F07.06_foot',(x,0,z),(.16,.12,.17),'M03',.004)
 for y,w,h,d in [(.075,3.55,.055,.62),(.13,3.47,.055,.59),(.185,3.39,.035,.55)]:east_box('VIS_F07.01_plinth',(0,y,0),(w,h,d),'M03',.003)
 for x in [-1.69,-.565,.565,1.69]:
  east_box('VIS_F07.02_structural_stile',(x,.22,-.015),(.08,2.49,.50),'M03',.003)
  # Recessed flute framed by solid pilaster wood, never an all-gold post.
  for dx in [-.020,.020]:east_box('VIS_F07.02_stile_bead',(x+dx,.53,.245),(.006,2.06,.010),'M03',.001)
  for y in [.28,2.60]:east_leaf((x,y,.258),.052)
 for ci,x in enumerate([-1.125,0,1.125]):
  for panel in [-1,0,1]:
   east_box('VIS_F07.04_tongue_back',(x+panel*.346,.22,-.277),(.344,2.49,.027),'M04',.001)
  for row,y in enumerate([.45,1.005,1.56,2.115]):
   east_box('VIS_F07.05_shelf',(x,y,-.018),(1.046,.03,.476),'M03',.0015)
   east_box('VIS_F07.05_shelf_nose',(x,y-.006,.223),(1.046,.035,.018),'M03',.0015)
   socket=empty('SOCKET_F07_cabinet_shelf_%02d'%(row*3+ci+1),(x,y+.03,0))
   east_label((x+.41,y+.036,.249),row*3+ci+1)
   for sx in [-1,1]:east_box('VIS_F07.05_shelf_pin',(x+sx*.51,y-.012,.05),(.012,.012,.025),'M06',.001)
  # Four unobstructed volumes per bay. Only nine top/inner light channels.
  for y in [1.005,1.56,2.67]:
   east_box('VIS_L08.01_channel',(x,y-.017,.137),(1.02,.012,.025),'M06',.0005)
   east_box('VIS_L08.02_shield_lip',(x,y-.03,.153),(1.02,.025,.005),'M06',.0005)
   east_box('VIS_L08.03_diffuser',(x,y-.021,.133),(.99,.003,.019),'M19',0)
   tube('VIS_L08.04_hidden_wire',[(x-.49,y-.01,.12),(x-.49,y-.01,-.245)],.0015,'M26')
   empty('SOCKET_L08_strip',(x,y-.021,.132))
 for y,w,h,d in [(2.67,3.40,.065,.55),(2.735,3.44,.033,.57),(2.768,3.51,.032,.605),(2.80,3.55,.036,.62),(2.836,3.51,.044,.60)]:east_box('VIS_F07.03_crown',(0,y,0),(w,h,d),'M03',.003)
 east_box('VIS_F07.07_plant_tray',(0,2.873,-.02),(3.34,.007,.48),'M03',.001)
 empty('SOCKET_F07_cabinet_plant',(0,2.88,-.02))
 for x in [-1.125,0,1.125]:east_leaf((x,2.687,.282),.065)
 # F08 owns only applied doors and exactly one 4mm pane per bay.
 for ci,x in enumerate([-1.125,0,1.125]):
  left=x-.516;right=x+.516
  for xx in [left,right]:east_box('VIS_F08.01_door_stile',(xx,.49,.273),(.043,2.17,.046),'M03',.002)
  for y in [.49,2.611]:east_box('VIS_F08.01_door_rail',(x,y,.273),(.99,.049,.046),'M03',.002)
  east_box('VIS_F08.02_glass',(x,.539,.271),(.987,2.072,.004),'M16',0)
  for xx in [x-.496,x+.496]:east_box('VIS_F08.03_glass_bead',(xx,.535,.284),(.010,2.08,.010),'M03',.001)
  for y in [.53,2.609]:east_box('VIS_F08.03_glass_bead',(x,y,.284),(.989,.009,.010),'M03',.001)
  hand=1 if ci<2 else -1;hx=x+hand*.50;hinge=x-hand*.52
  empty('PIVOT_F08_door_%d'%(ci+1),(hinge,.49,.274))
  for y in [.66,1.53,2.42]:
   for dx in [-.012,.012]:east_box('VIS_F08.04_hinge_leaf',(hinge+dx,y,.299),(.022,.050,.003),'M06',.0005)
   lathe('VIS_F08.04_hinge_barrel',[(0,0),(.006,0),(.006,.057),(0,.057)],'M06',12,(hinge,y-.004,.304))
  for y in [1.34,1.50]:east_box('VIS_F08.05_handle_mount',(hx,y-.012,.305),(.021,.025,.009),'M06',.001)
  tube('VIS_F08.05_long_pull',[(hx,1.34,.312),(hx,1.36,.338),(hx,1.48,.338),(hx,1.50,.312)],.005,'M06')
  east_box('VIS_F08.06_escutcheon',(hx,1.267,.301),(.021,.043,.004),'M06',.001)
  east_box('VIS_F08.06_keyhole',(hx,1.276,.304),(.004,.015,.001),'M26',0)
 # Drawers kept below glazed doors. Middle drawer pulled out exactly 15mm.
 for ci,x in enumerate([-1.125,0,1.125]):
  dz=.015 if ci==1 else 0
  empty('PIVOT_F09_drawer_%d'%(ci+1),(x,.22,dz))
  east_box('VIS_F09.01_drawer_front',(x,.222,.260+dz),(1.042,.216,.038),'M03',.002)
  east_box('VIS_F09.01_recessed_panel',(x,.247,.281+dz),(.936,.164,.007),'M03',.001)
  east_box('VIS_F09.01_drawer_bottom',(x,.227,-.006+dz),(1.015,.014,.49),'M03',.001)
  for dx in [-.50,0,.50]:east_box('VIS_F09.03_divider',(x+dx,.241,-.013+dz),(.013,.16,.45),'M03',.001)
  for dx in [-.514,.514]:east_box('VIS_F09.06_slide',(x+dx,.276,-.023),(.012,.02,.42),'M06',.0005)
  east_label((x,.34,.294+dz),ci+1)
  tube('VIS_F09.02_pull',[(x-.065,.30,.29+dz),(x-.05,.277,.322+dz),(x+.05,.277,.322+dz),(x+.065,.30,.29+dz)],.004,'M06')
  if ci==1:empty('SOCKET_F09.05_micro_open_15mm',(x,.438,.279))
 col('F07_body',(0,0,-.010),(3.55,2.88,.60),interaction=False)
 # Interaction ray may reach displayed contents through glass; solid rear still occludes.
 col('F07_back',(0,.22,-.277),(3.40,2.49,.028),player=False,camera=False,interaction=True)
 east_decorations()
 place_at(g,'east_cabinet');return g

def east_astrolabe(p,r=.14):
 x,y,z=p
 lathe('VIS_P08.01_astrolabe_base',[(0,0),(.082,0),(.092,.008),(.09,.022),(.047,.032),(.025,.055),(0,.055)],'M06',24,p)
 tube('VIS_P08.02_pedestal',[(x,y+.035,z),(x,y+.12,z)],.012,'M06')
 cy=y+.12+r
 for axis in [0,1,2]:
  pts=[];rr=r*(1-axis*.13)
  for i in range(49):
   a=i*math.tau/48
   pts.append((x+rr*math.cos(a) if axis!=1 else x+.32*rr*math.cos(a),cy+rr*math.sin(a) if axis!=2 else cy+.2*rr*math.sin(a),z+rr*math.sin(a) if axis==2 else z+.65*rr*math.cos(a) if axis==1 else z))
  tube('VIS_P08.%02d_armillary_ring'%(3 if axis==0 else 4),pts,.003,'M06')
 tube('VIS_P08.05_axis',[(x-.09,cy-.10,z),(x+.09,cy+.10,z)],.004,'M06')
 lathe('VIS_P08.06_centre_sphere',[(.023*math.sin(i*math.pi/12),-.023*math.cos(i*math.pi/12)) for i in range(13)],'M06',20,(x,cy,z))
 paths=[]
 for i in range(24):
  a=i*math.tau/24;pts=[(x+rr*math.cos(a),cy+rr*math.sin(a),z+.003) for rr in [r-.006,r+.003]]
  tube('VIS_P08.07_scale_tick',pts,.0007,'M06')

def east_decorations():
 # Fifteen original decorative books: no user inventory or count is represented.
 for ci,x in enumerate([-1.125,0,1.125]):
  for row,y in enumerate([.48,1.59,2.145]):
   if (ci+row)%2==0:
    for i in range(3):book((x-.31+i*.062,y,-.02),ci*2+i+row)
 for p in [(-1.13,1.035,.025),(0,2.145,.025)]:east_astrolabe(p,.12)
 # Original geometric learning diagrams on thick paper and wooden easel support.
 for ci,x in enumerate([-1.125,0,1.125]):
  y=[2.145,.48,1.59][ci];px=x+.22
  east_box('VIS_P06.04_original_chart',(px,y+.025,-.13),(.22,.312,.0004),'M12',.0005)
  for yy in [y+.02,y+.34]:east_box('VIS_P06.01_chart_batten',(px,yy,-.126),(.24,.008,.01),'M03',.001)
  for xx in [px-.116,px+.116]:east_box('VIS_P06.01_chart_frame',(xx,y+.028,-.126),(.008,.312,.01),'M03',.001)
  tube('VIS_P06.05_chart_support',[(px,y,-.12),(px,y+.22,-.15),(px,y,-.23)],.006,'M03')
  pts=[(.5,.15),(.15,.42),(.5,.83),(.85,.42),(.5,.15),(.5,.83)]
  east_strokes('VIS_P06.03_original_compass',[pts,[(.15,.42),(.85,.42)],[(.28,.3),(.72,.66)],[(.28,.66),(.72,.3)]],(px-.10,y+.07,-.127),.20,'M03',.013)

def east_phone_text(p):
 # Hand-authored single stroke Simplified Chinese; no system font is shipped.
 glyphs={
 '同': [[(.1,.05),(.1,.9),(.9,.9),(.9,.05),(.76,.10)],[(.25,.73),(.75,.73)],[(.28,.27),(.28,.58),(.72,.58),(.72,.27),(.28,.27)]],
 '频': [[(.15,.5),(.15,.85)],[(.3,.53),(.3,.94)],[(.3,.75),(.44,.75)],[(.05,.5),(.45,.5)],[(.22,.49),(.22,.31)],[(.14,.35),(.04,.2)],[(.37,.4),(.47,.26)],[(.45,.28),(.13,.02)],[(.52,.88),(.98,.88)],[(.76,.87),(.68,.72)],[(.55,.24),(.55,.72),(.94,.72),(.94,.24)],[(.75,.58),(.75,.26),(.50,.04)],[(.82,.23),(.99,.04)]],
 '电': [[(.1,.32),(.1,.78),(.84,.78),(.84,.32),(.1,.32)],[(.1,.55),(.84,.55)],[(.48,.95),(.48,.12),(.57,.04),(.93,.04),(.96,.2)]],
 '话': [[(.10,.89),(.25,.77)],[(.05,.61),(.22,.61),(.22,.17),(.38,.29)],[(.46,.81),(.86,.94)],[(.64,.86),(.64,.49)],[(.36,.62),(.98,.62)],[(.44,.08),(.44,.44),(.88,.44),(.88,.08),(.44,.08)]],
 '亭': [[(.47,.98),(.56,.91)],[(.06,.83),(.96,.83)],[(.23,.64),(.23,.75),(.79,.75),(.79,.64),(.23,.64)],[(.07,.41),(.07,.56),(.96,.56),(.96,.41)],[(.22,.36),(.81,.36)],[(.52,.36),(.52,.04),(.35,.08)]],
 '暂': [[(.03,.85),(.46,.85)],[(.24,.97),(.08,.60),(.45,.60)],[(.27,.73),(.27,.44)],[(.02,.46),(.48,.51)],[(.55,.81),(.87,.95)],[(.55,.81),(.55,.55),(.48,.44)],[(.56,.68),(.98,.68)],[(.79,.68),(.79,.42)],[(.21,.04),(.21,.38),(.81,.38),(.81,.04),(.21,.04)],[(.21,.21),(.81,.21)]],
 '未': [[(.13,.75),(.87,.75)],[(.05,.53),(.95,.53)],[(.5,.98),(.5,.02)],[(.48,.51),(.28,.25),(.04,.08)],[(.53,.51),(.73,.25),(.96,.08)]],
 '开': [[(.13,.87),(.88,.87)],[(.04,.56),(.98,.56)],[(.33,.87),(.33,.42),(.23,.17),(.07,.03)],[(.73,.87),(.73,.03)]],
 '放': [[(.21,.98),(.29,.89)],[(.04,.77),(.48,.77)],[(.22,.76),(.19,.38),(.07,.06)],[(.2,.58),(.43,.58),(.37,.09),(.25,.06)],[(.66,.97),(.55,.64),(.46,.52)],[(.57,.69),(.98,.69)],[(.87,.68),(.78,.38),(.59,.14),(.46,.04)],[(.58,.58),(.72,.28),(.99,.05)]]}
 for row,line in enumerate(['同频电话亭','暂未开放']):
  size=.088;start=p[0]-len(line)*size*.55
  for i,ch in enumerate(line):east_strokes('VIS_F16.07_'+ch,glyphs[ch],(start+i*size*1.1,p[1]+(.115 if row==0 else 0),p[2]),size,'M06',.04)

def east_telephone(p):
 x,y,z=p
 # Oval profiled bakelite base, a supported receiver, ten visible dial holes.
 base=lathe('VIS_F17.01_bakelite_base',[(0,0),(.12,0),(.145,.012),(.15,.035),(.14,.065),(.10,.10),(0,.10)],'M26',40)
 base.scale.x=1.12;base.scale.y=.85;base.location=xyz(p)
 dial=lathe('VIS_F17.02_dial_plate',[(0,0),(.073,0),(.076,.004),(.076,.01),(.065,.017),(0,.017)],'M06',40)
 dial.rotation_euler.x=math.pi/3;dial.location=xyz((x,y+.092,z+.063))
 for i in range(10):
  a=i*math.tau/10+.25
  hole=lathe('VIS_F17.02_dial_finger_hole',[(0,0),(.010,0),(.012,.001),(.012,.002),(0,.002)],'M26',12)
  hole.rotation_euler.x=math.pi/3
  hole.location=dial.location+dial.rotation_euler.to_matrix()@Vector((.052*math.cos(a),.052*math.sin(a),.018))
 hub=lathe('VIS_F17.02_dial_hub',[(0,0),(.026,0),(.026,.002),(0,.002)],'M12',24);hub.rotation_euler=dial.rotation_euler;hub.location=dial.location+dial.rotation_euler.to_matrix()@Vector((0,0,.019))
 for dx in [-.095,.095]:
  tube('VIS_F17.04_cradle',[(x+dx,y+.08,z-.035),(x+dx,y+.25,z-.035),(x+dx,y+.30,z-.065)],.008,'M06')
  tube('VIS_F17.04_cradle_fork',[(x+dx,y+.25,z-.035),(x+dx,y+.30,z+.005)],.008,'M06')
 pts=[(x-.105+i*.21/24,y+.32+.036*math.sin(i*math.pi/24),z-.029) for i in range(25)]
 tube('VIS_F17.03_receiver_grip',pts,.019,'M26')
 for dx in [-.105,.105]:
  lathe('VIS_F17.03_receiver_cup',[(0,0),(.044,0),(.047,.009),(.043,.021),(.031,.041),(.022,.069),(0,.075)],'M26',28,(x+dx,y+.25,z-.029))
  lathe('VIS_F17.03_receiver_rim',[(.042,0),(.047,.003),(.047,.008),(.043,.011)],'M06',28,(x+dx,y+.248,z-.029))
 # Low resolution helix follows a hanging catenary-like curve with real endpoints.
 pts=[(x+.125,y+.31,z-.03),(x+.155,y+.29,z-.01)]
 for i in range(169):
  t=i/168;a=t*math.tau*21
  pts.append((x+.16+.009*math.cos(a),y+.28-.20*t+.008*math.sin(a),z+.014+.065*math.sin(math.pi*t)))
 pts.extend([(x+.145,y+.075,z+.014),(x+.13,y+.05,z+.01)])
 tube('VIS_F17.05_coiled_cord',pts,.0025,'M26')
 east_box('VIS_F17.06_small_plate',(x,y+.035,z+.123),(.073,.018,.002),'M06',.001)

def east_phone():
 g=group('F16')
 # 1.45 x 2.55 x 1.28; no front door, no collision enclosing the booth.
 for x in [-.66,.66]:
  for z in [-.575,.575]:
   east_box('VIS_F16.01_corner_post',(x,0,z),(.10,2.39,.10),'M03',.004)
   east_box('VIS_F16.01_post_foot',(x,0,z),(.13,.105,.13),'M03',.003)
   col('F16_post',(x,0,z),(.13,2.39,.13))
   for y in [.12,2.25]:east_box('VIS_F16.01_post_cap',(x,y,z),(.116,.04,.116),'M03',.002)
 for y,w,h,d in [(2.35,1.42,.12,1.25),(2.47,1.45,.05,1.28),(2.52,1.39,.03,1.22)]:east_box('VIS_F16.02_cornice',(0,y,0),(w,h,d),'M03',.003)
 col('F16_roof',(0,2.35,0),(1.45,.20,1.28))
 for x in [-.65,.65]:
  for y in [.12,.66,2.20]:east_box('VIS_F16.03_side_rail',(x,y,0),(.075,.055,1.06),'M03',.002)
  for z in [-.18,.18]:east_box('VIS_F16.03_side_mullion',(x,.72,z),(.045,1.48,.025),'M03',.0015)
  for z in [-.36,0,.36]:east_box('VIS_F16.03_side_glass',(x,.72,z),(.004,1.48,.334),'M16',0)
  east_box('VIS_F16.03_lower_panel',(x,.18,0),(.028,.48,1.04),'M03',.001)
  col('F16_side_panel',(x,.12,0),(.075,.595,1.06))
  # Glass blocks player only, never camera or interaction.
  col('F16_side_glass',(x,.715,0),(.012,1.49,1.06),camera=False,interaction=False)
  for z in [-.18,.18]:col('F16_mullion',(x,.72,z),(.045,1.48,.025))
 for x in [-.4,0,.4]:east_box('VIS_F16.04_back_panel',(x,.105,-.583),(.398,2.245,.025),'M03',.001)
 col('F16_back',(0,.105,-.583),(1.24,2.245,.028))
 east_box('VIS_F16.06_phone_counter',(0,.955,-.20),(1.20,.045,.53),'M03',.003)
 for x in [-.47,.47]:tube('VIS_F16.06_counter_brace',[(x,.78,-.55),(x,.94,-.26),(x,.95,-.07)],.018,'M06')
 col('F16_counter',(0,.91,-.20),(1.20,.09,.53))
 empty('SOCKET_F16_phone',(0,1,-.13));empty('SOCKET_F16.05_open_entry',(0,0,.63))
 east_telephone((0,1,-.13))
 east_box('VIS_F16.07_nameplate',(0,1.73,-.558),(.72,.34,.015),'M03',.002)
 for y in [1.742,2.046]:east_box('VIS_F16.07_nameplate_edge',(0,y,-.548),(.69,.006,.003),'M06',.0005)
 east_phone_text((0,1.79,-.545))
 for x in [-.334,.334]:east_box('VIS_P20.04_phone_plate_pin',(x,1.89,-.546),(.007,.007,.003),'M06',.0005)
 east_leaf((0,2.375,.632),.078)
 place_at(g,'east_phone');return g

def build_east():
 return east_cabinet(),east_phone()
