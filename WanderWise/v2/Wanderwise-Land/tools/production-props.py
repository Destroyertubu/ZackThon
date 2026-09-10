"""Original lived-in P01/P03/P13/P17/L07 dressing. No text claims or runtime lights.
Call after furniture builders. Adds precisely fifteen P01 books (81 + 15 = 96).
Local surfaces: F10=.88, F02=.59, F03=.64, F05=.79; no floor height guessing.
"""

def prop_bind(asset_id,layout_id):
    global root
    root=next((o for o in collection.objects if o.name=='WW_'+asset_id),None)
    if root is None:
        root=group(asset_id+'_props');place_at(root,layout_id)
    return root

def prop_flatbook(p,variant,index,yaw=0):
    """Lay shared vertical book along its thickness without negative scale.
    book helper X thickness becomes Web Y; bottom is exactly support p.y.
    """
    before=set(collection.objects);book((0,0,0),variant)
    w=.035+(variant%3)*.008;h=.23+(variant%4)*.012
    lay=Matrix.Translation(Vector(xyz(p))) @ Matrix.Rotation(yaw,4,'Z') @ Matrix.Translation(Vector((h/2,0,w/2))) @ Matrix.Rotation(-math.pi/2,4,'Y')
    for o in collection.objects:
        if o not in before:
            o.name=o.name+'_dressing_%02d'%index;o.matrix_basis=lay @ o.matrix_basis;o['bookIndex']=81+index;o['variant']=variant
    return p[1]+w

def prop_stack(x,z,surface,count,first,yaw=0):
    y=surface
    for j in range(count):
        v=(first+j)%12;y=prop_flatbook((x+(j%2)*.006,y,z+(j%2)*.003),v,first+j,yaw+(.045 if j%2 else 0))
    return y

def prop_line(name,pts,width,mat='M07'):
    vs=[]
    for i,p in enumerate(pts):
        a=pts[max(0,i-1)];b=pts[min(len(pts)-1,i+1)];dx=b[0]-a[0];dz=b[2]-a[2];d=max(1e-8,math.hypot(dx,dz))
        for sign in [-1,1]:vs.append((p[0]-sign*dz*width/(2*d),p[1],p[2]+sign*dx*width/(2*d)))
    return mesh(name,vs,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(pts)-1)],mat)

def prop_paper(p,index):
    x,y,z=p;nx=4;nz=5;vs=[]
    def h(u,v):return y+.00035+.0017*max(0,(u-.67)/.33)**2*max(0,(v-.65)/.35)**2
    for j in range(nz+1):
        for i in range(nx+1):u=i/nx;v=j/nz;vs.append((x+(u-.5)*.21,h(u,v),z+(v-.5)*.30))
    fs=[(j*(nx+1)+i,(j+1)*(nx+1)+i,(j+1)*(nx+1)+i+1,j*(nx+1)+i+1) for j in range(nz) for i in range(nx)]
    o=mesh('VIS_P03.01_02_working_paper_%d'%index,vs,fs,'M12');o['paperIndex']=index
    sol=o.modifiers.new('Paper 0.3mm','SOLIDIFY');sol.thickness=.0003
    # Original route and mountain diagram, plus short non-language annotations.
    prop_line('VIS_P03.04_mountain_route_%d'%index,[(x+u,h(u/.21+.5,v/.30+.5)+.00012,z+v) for u,v in [(-.074,.07),(-.033,-.018),(0,.039),(.036,-.07),(.079,.067)]],.001)
    for j in range(3):
        zz=.097-j*.012;prop_line('VIS_P03.05_neutral_note_%d'%index,[(x-.077,y+.0005,z+zz),(x-.025+(j%2)*.016,y+.0005,z+zz)],.0008)
    prop_line('VIS_P03.03_fold_%d'%index,[(x-.093,y+.00046,z-.04),(x+.093,y+.00046,z-.04)],.00035,'M10')
    box('VIS_P03.06_corner_clip_%d'%index,(x-.079,y+.00055,z-.13),(.015,.002,.023),'M06',.0003)


def prop_candle(p,index):
    x,y,z=p
    lathe('VIS_P17.01_02_turned_candlestick_%d'%index,[(0,0),(.045,0),(.054,.007),(.054,.014),(.045,.021),(.02,.028),(.014,.045),(.013,.108),(.024,.123),(0,.123)],'M06',10,p)
    lathe('VIS_P17.03_drip_pan_%d'%index,[(0,.119),(.035,.119),(.043,.128),(.043,.135),(.038,.137),(.029,.128),(0,.128)],'M06',10,p)
    lathe('VIS_P17.04_05_wax_and_pool_%d'%index,[(0,.128),(.017,.128),(.017,.276),(.013,.284),(.008,.278),(0,.278)],'M25',10,p)
    tube('VIS_P17.06_wick_%d'%index,[(x,y+.278,z),(x+.001,y+.29,z)],.0012,'M07')
    for dx,depth in [(-.007,.021),(.007,.037)]:tube('VIS_P17.07_wax_drip_%d'%index,[(x+dx,y+.276,z+.015),(x+dx,y+.276-depth,z+.015)],.002,'M25')
    # Wick visibly unlit; X01 remains the owner's effect and no success/state cue is fabricated.
    empty('SOCKET_P17_flame_%d'%index,(x,y+.29,z))


def prop_cup(p):
    x,y,z=p
    lathe('VIS_P13.08_dish',[(0,0),(.060,0),(.070,.004),(.075,.011),(.075,.015),(.067,.014),(.048,.006),(0,.006)],'M14',20,p)
    lathe('VIS_P13.01_02_03_04_hollow_cup',[(0,.006),(.034,.006),(.037,.012),(.046,.093),(.046,.104),(.0435,.106),(.041,.102),(.040,.094),(.032,.018),(0,.018)],'M14',24,p)
    pts=[(x+.044+.027*math.sin(t*math.pi),y+.027+t*.057,z) for t in [i/8 for i in range(9)]]
    tube('VIS_P13.05_attached_handle',pts,.005,'M14')
    lathe('VIS_P13.07_recessed_tea',[(0,.094),(.04,.094)],'M26',20,p)
    for side in [-1,1]:tube('VIS_P13.06_leaf_badge',[(x+side*.011*math.sin(t*math.pi),y+.041+t*.032,z+.045) for t in [i/8 for i in range(9)]],.0007,'M06')
    empty('SOCKET_P13_journal_cup',p)


def prop_floor_lantern(p,label):
    g=group('L07_'+label)
    lathe('VIS_L07.01_layered_base',[(0,0),(.114,0),(.135,.015),(.135,.032),(.119,.045),(0,.045)],'M06',6)
    lathe('VIS_L07.02_long_glass',[(.109,.049),(.109,.367)],'M16',6)
    for i in range(6):
        a=i*math.tau/6;x,z=.118*math.cos(a),.118*math.sin(a)
        tube('VIS_L07.03_frame',[(x,.04,z),(x,.378,z)],.005,'M06')
    lathe('VIS_L07.04_ventilated_hood',[(.12,.369),(.135,.386),(.11,.400),(.045,.451),(.019,.468),(0,.468)],'M06',6)
    lathe('VIS_L07.06_inner_candle',[(0,.045),(.033,.045),(.033,.259),(.026,.274),(0,.283)],'M19',8)
    for x in [-.036,.036]:box('VIS_L07.05_handle_pivot',(x,.451,0),(.012,.028,.012),'M06',.0004)
    tube('VIS_L07.05_carry_handle',[(.044*math.cos(a),.50+.098*math.sin(a),0) for a in [i*math.pi/12 for i in range(13)]],.005,'M06')
    for x in [-.044,.044]:tube('VIS_L07.05_lower_handle',[(x,.464,0),(x,.5,0)],.005,'M06')
    col('L07_'+label,(0,0,0),(.27,.47,.27));empty('SOCKET_L07_glow',(0,.22,0));place(g,p);return g


def build_props():
    global root
    roots=[]
    roots.append(prop_bind('F10','synthesis'))
    prop_stack(0,1.12,.88,3,1,.10)
    prop_stack(-1.11,.03,.88,3,4,math.pi/2-.10)
    prop_stack(.14,-1.08,.88,3,7,-.12)
    for i,(x,z) in enumerate([(.98,-.37),(-.90,.40),(.22,.59),(-.38,-1.02)]):prop_paper((x,.8805,z),i+1)
    prop_candle((.98,.88,.05),1);prop_candle((-.12,.88,-.62),2)
    roots.append(prop_bind('F02','reading_table'));prop_stack(-.17,0,.59,2,10,math.pi/2)
    # F02 already owns a cup at its centre. This stack clears it by 27mm.
    roots.append(prop_bind('F03','reading_round_trunk'));prop_stack(-.12,0,.64,2,12,.02)
    prop_candle((.17,.64,-.11),3);prop_candle((.17,.64,.11),4)
    roots.append(prop_bind('F05','west_journal'));prop_stack(-.73,.16,.79,2,14,.05)
    prop_cup((.57,.79,.16));prop_paper((-.37,.7905,.135),5)
    roots.extend([prop_floor_lantern((5.46,0,.63),'cabinet'),prop_floor_lantern((1.65,0,4.57),'entry')])
    root=None
    return roots
