"""G12 V03: three shelf-top pots, four connected trailing vines.
Uses shared M15/M14/M27 only. D29 cabinet/bookcase subset; no runtime lights.
"""

def vine_leaf(p,length,angle,depth=0):
 # Closed, shallow heart-shaped blade; three measured sizes share one topology.
 # Base notch is the exact petiole attachment, not an unattached billboard.
 outline=[(0,0),(-.35,.16),(-.52,-.05),(-.48,-.30),(0,-1),(.48,-.30),(.52,-.05),(.35,.16)]
 co=[];ca=math.cos(angle);sa=math.sin(angle)
 for u,v in outline:
  u*=length;v*=length
  co.append((p[0]+u*ca-v*sa,p[1]+u*sa+v*ca,p[2]+depth*v))
 for z in [.012,-.002]:co.append((p[0]+.32*length*sa,p[1]-.32*length*ca,p[2]+z))
 faces=[]
 for i in range(8):j=(i+1)%8;faces.extend([(8,i,j),(9,j,i)])
 return mesh('VIS_V03.03_heart_leaf',co,faces,'M15',True)

def vine_pot(p):
 x,y,z=p
 lathe('VIS_V03.05_pot_and_foot',[(0,0),(.075,0),(.08,.007),(.08,.02),(.09,.03),(.108,.16),(.11,.175),(.105,.19),(.094,.19),(.092,.174),(.079,.034),(0,.034)],'M14',18,p)
 lathe('VIS_V03.05_root_soil',[(0,.168),(.094,.168)],'M27',18,p)
 empty('SOCKET_V03_soil',(x,y+.168,z))
 # Four connected upward stems make the crown a rooted plant, not a bare rope.
 for i in range(4):
  a=i*2.4;end=(x+.08*math.cos(a),y+.25+.014*(i%2),z+.06*math.sin(a))
  tube('VIS_V03.02_rooted_crown_stem',[(x,y+.159,z),(x+.025*math.cos(a),y+.23,z+.025*math.sin(a)),end],.0025,'M15')
  vine_leaf(end,.105+(i%3)*.012,math.pi+(-.5 if end[0]>x else .5),.18)

def vine_trail(p,edge,drop,phase=0,zoffset=0):
 x,y,root_z=p;z=root_z+zoffset;direction=1 if edge>x else -1
 # Starts below the soil surface, rises over the pot lip, rests on the top,
 # reaches the side edge, then hangs outside the solid cabinet silhouette.
 points=[(x,y+.16,root_z),(x+direction*.06,y+.205,z),(x+direction*.14,y+.07,z),
         (edge-direction*.175,y+.0033,z),(edge,y+.0033,z)]
 for i in range(1,13):
  t=i/12;points.append((edge+direction*.018*math.sin(t*math.pi*2+phase),y-drop*t,z+.016*math.sin(t*math.pi+phase)))
 tube('VIS_V03.01_connected_main_vine',points,.0032,'M15')
 empty('SOCKET_V03.06_crown_support',(edge-direction*.175,y+.0033,z))
 # Reuse main-stem vertices as branch roots, with deterministic leaf spacing.
 for i,index in enumerate(range(5,17)):
  base=points[index];side=-1 if i%2 else 1
  end=(base[0]+side*.025,base[1]-.018,base[2]+(.024 if i%3 else -.01))
  tube('VIS_V03.02_connected_petiole',[base,end],.0013,'M15')
  vine_leaf(end,[.100,.116,.127][(i+int(phase))%3],side*.18,.1)
 # Tendril grows from an existing stem point and curls outward, away from wood.
 start=points[9];curl=[start]
 for i in range(1,10):
  a=i*.58;r=.012+i*.0009
  curl.append((start[0]+direction*(.018+r*math.cos(a)),start[1]-.025-r*math.sin(a),start[2]+.01))
 tube('VIS_V03.04_attached_tendril',curl,.0009,'M15')

def build_vines():
 # Cabinet crown's authored support surface is y=2.88, bookcase crown y=2.75.
 # Trailing x lies outside the solid sides, leaving every glass pane clear.
 east=group('V03_east');east['assetId']='V03'
 for sign in [-1,1]:
  p=(sign*1.48,2.88,.01);vine_pot(p)
  vine_trail(p,sign*1.92,.66 if sign<0 else .73,0 if sign<0 else 1)
 place_at(east,'east_cabinet')
 west=group('V03_west');west['assetId']='V03'
 p=(-1.40,2.75,.015);vine_pot(p)
 for phase,zz,drop in [(0,-.065,.58),(2,.105,.69)]:vine_trail(p,-1.83,drop,phase,zz)
 place_at(west,'west_bookcase')
 return east,west
