"""Project-authored west study; metre-scale parts follow F03/F05/F06/P02/L04/A15."""
def study_desk():
 g=group('F05')
 box('VIS_F05.01_top',(0,.75,0),(1.85,.04,.78),'M04',.003)
 for x in [-.69,.69]:
  box('VIS_F05.02_case',(x,.38,0),(.45,.37,.66),'M04',.002)
  for j in range(3):
   y=.39+j*.116;box('VIS_F05.02_drawer',(x,y,.346),(.428,.114,.028),'M04',.001)
   tube('VIS_P19_pull',[(x-.05,y+.06,.366),(x-.05,y+.042,.387),(x+.05,y+.042,.387),(x+.05,y+.06,.366)],.006)
  col('F05_case',(x,.38,0),(.45,.37,.72))
  for z in [-.295,.295]:
   lathe('VIS_F05.04_leg',[(0,.011),(.024,.011),(.032,.05),(.026,.12),(.029,.27),(.042,.31),(.033,.38),(0,.40)],'M04',16,(x,.0,z))
   col('F05_leg',(x,0,z),(.085,.4,.085))
 box('VIS_F05.05_rear',(0,.79,-.37),(1.84,.08,.025),'M04',.003)
 box('VIS_F05.06_stretcher',(0,.25,-.29),(1.43,.04,.045),'M04',.003)
 col('F05_top',(0,.75,0),(1.85,.04,.78));empty('SOCKET_F05_writing',(0,.79,.05));empty('SOCKET_F05_lamp',(-.65,.79,-.13))
 # Journal cover and layered, curved pages, rather than a painted plane.
 box('VIS_P02.04_cover',(0,.791,.075),(.42,.006,.29),'M13',.001)
 def page_y(x):return .811+.021*math.sin(math.pi*abs(x)/.205)
 for layer in range(4):
  for side in [-1,1]:
   verts=[(side*(.006+.196*i/16),page_y(side*(.006+.196*i/16))-.003*(3-layer),.075+z) for z in [-.14,.14] for i in range(17)]
   faces=[(i,i+1,i+18,i+17) if side==1 else (i+17,i+18,i+1,i) for i in range(16)]
   mesh('VIS_P02.01_03_curved_page',verts,[tuple(reversed(f)) for f in faces],'M12',True)
 tube('VIS_P02.02_binding',[(0,.812,-.07),(0,.812,.22)],.003,'M13')
 box('VIS_P02.05_bookmark',(.13,.818,.238),(.012,.001,.05),'M09',0)
 # Original drawn route on right page and short writing strokes on left.
 for row in range(9):
  pts=[(-.18+i*.018,page_y(-.18+i*.018)+.001,-.035+row*.023+.001*math.sin(i*2+row)) for i in range(8)]
  tube('VIS_P02.06_note',pts,.00065,'M07')
 tube('VIS_P02.06_route',[(x,page_y(x)+.001,z) for x,z in [(.035,.17),(.085,.12),(.052,.06),(.15,.025),(.18,-.025)]],.001,'M07')
 # Jointed writing lamp, hollow 1.5mm shade and table-contact base.
 lathe('VIS_L04.01_base',[(0,.79),(.086,.79),(.09,.794),(.09,.805),(.078,.815),(0,.815)],'M06',32,(-.65,0,-.13))
 joints=[(-.65,.813,-.13),(-.77,1.04,-.13),(-.50,1.27,-.10)]
 for dx in [-.018,.018]:tube('VIS_L04.02_arm',[(x+dx,y,z) for x,y,z in joints],.007)
 for x,y,z in joints[1:]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.022,location=xyz((x,y,z)));own(bpy.context.object,'VIS_L04.03_joint','M06')
 lathe('VIS_L04.04_shade',[(.145,1.145),(.145,1.153),(.126,1.204),(.085,1.25),(.012,1.28),(.010,1.278),(.083,1.248),(.124,1.202),(.1435,1.152),(.1435,1.145)],'M06',40,(-.50,0,-.10))
 lathe('VIS_L04.04_lining',[(.14,1.148),(.12,1.20),(.08,1.247),(.01,1.276)],'M10',32,(-.50,0,-.10))
 lathe('VIS_L04.05_bulb',[(0,1.16),(.018,1.16),(.027,1.18),(.019,1.20),(0,1.205)],'M19',16,(-.5,0,-.1))
 tube('VIS_L04.06_cable',[(-.7,.798,-.15),(-.8,.798,-.35),(-.85,.65,-.39),(-.85,.06,-.39)],.003,'M07')
 # On-desk books are supported by tabletop and do not occupy writing surface.
 for i in range(6):book((.46+i*.052,.79,-.19),i)
 place_at(g,'west_journal');return g

def study_chair():
 g=group('F06');y0=.011
 for x in [-.235,.235]:
  for z in [-.24,.24]:
   tube('VIS_F06.01_leg',[(x*1.08,y0,z*1.08),(x,.39,z)],.025,'M03')
   col('F06_leg',(x,0,z),(.06,.4,.06))
 box('VIS_F06_frame',(0,.38,0),(.53,.045,.54),'M03',.004)
 soft('VIS_F06.03_seat',(0,.425,0),(.48,.07,.5),'M10')
 for x in [-.25,.25]:
  tube('VIS_F06.02_backframe',[(x,.39,-.24),(x,.98,-.30)],.025,'M03')
  tube('VIS_F06.05_arm',[(x,.43,.21),(x,.67,.2),(x,.67,-.27)],.023,'M03')
  tube('VIS_F06.06_cross',[(x,.2,-.24),(x,.2,.24)],.018,'M03')
 tube('VIS_F06.02_top',[(-.25,.98,-.30),(0,1.02,-.31),(.25,.98,-.30)],.028,'M03')
 soft('VIS_F06.04_back',(0,.67,-.285),(.44,.28,.05),'M10')
 col('F06_seat',(0,.38,0),(.56,.12,.58));col('F06_back',(0,.49,-.29),(.57,.53,.1));place_at(g,'journal_chair')
 return g

def round_trunk():
 g=group('F03');profile=[(0,0),(.275,0),(.30,.04),(.315,.18),(.322,.33),(.31,.54),(.303,.60),(0,.60)]
 lathe('VIS_F03.01_staves',profile,'M04',32)
 for y,r in [(.08,.307),(.32,.324),(.54,.313)]:
  lathe('VIS_F03.02_hoop',[(r-.003,y),(r,y),(r,y+.027),(r-.003,y+.027)],'M06',32)
  for i in range(12):
   a=i*math.tau/12;box('VIS_F03.06_rivet',(math.cos(a)*(r+.001),y+.008,math.sin(a)*(r+.001)),(.009,.009,.009),'M06',.0005)
 lathe('VIS_F03.03_lid',[(0,.605),(.318,.605),(.325,.61),(.325,.633),(.315,.64),(0,.64)],'M04',40)
 box('VIS_F03.04_lock',(0,.51,.31),(.052,.104,.022),'M06',.002)
 for side in [-1,1]:tube('VIS_F03.05_handle',[(side*.317,.40,-.07),(side*.346,.35,-.065),(side*.346,.35,.065),(side*.317,.40,.07)],.01)
 col('F03_proxy',(0,0,0),(.65,.64,.65));place_at(g,'reading_round_trunk');return g

def hearth():
 g=group('A15')
 box('VIS_A15.01_hearth',(0,0,0),(1.55,.10,.65),'M18',.012)
 for x in [-.57,.57]:
  for j in range(4):box('VIS_A15.03_stone',(x,.10+j*.21,0),(.27,.205,.54),'M18',.008)
 box('VIS_A15.04_mantel',(0,.94,0),(1.55,.10,.65),'M02',.008)
 box('VIS_A15.05_flue',(0,1.04,-.19),(1.10,1.16,.24),'M18',.006)
 box('VIS_A15.06_soot_back',(0,.10,-.235),(.9,.84,.055),'M07',.002)
 box('VIS_A15.06_soot_floor',(0,.10,0),(.9,.018,.46),'M07',0)
 for i in range(7):tube('VIS_A15.07_grate',[(-.35+i*.116,.12,.23),(-.35+i*.116,.31,.23)],.009,'M07')
 for i in range(3):tube('VIS_P18_log',[(-.36,.18+i*.042,-.13+i*.075),(.34,.20+i*.04,-.08+i*.075)],.045,'M02')
 for i in range(5):
  x=(i-2)*.11;lathe('VIS_P18_ember_flame',[(0,.23),(.045,.25),(.021,.35),(.009,.43+(i%2)*.065),(0,.45+(i%2)*.065)],'M19',8,(x,0,0))
 col('A15_obstacle',(0,0,0),(1.55,1.04,.65));col('A15_flue',(0,1.04,-.19),(1.1,1.16,.24));empty('SOCKET_A15_fire',(0,.24,0));place_at(g,'hearth')
 return g

def build_study():
 study_desk();study_chair();round_trunk();hearth()
