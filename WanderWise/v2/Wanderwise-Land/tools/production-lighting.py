"""L01–L03 authored lighting geometry. Shared material IDs and light rig untouched.
Call build_lighting() in production-builder globals. Twelve visual lanterns, zero lights.
Assembly resolves the actual A07 hook at world y3.4: L01 height .70m, lowest y2.7.
This short-chain fitting avoids the catalog's 1.3m fixture intersecting the tie beam.
"""

def lit_tube(name,points,r,mat='M06',sides=4,closed=False):
    """Small measured metal rod; low radial resolution reserved for sub-cm pieces."""
    vs=[];pts=[Vector(p) for p in points];n=len(pts)
    for i,p in enumerate(pts):
        a=pts[(i-1)%n] if closed else pts[max(0,i-1)];b=pts[(i+1)%n] if closed else pts[min(n-1,i+1)]
        t=(b-a).normalized();ref=Vector((0,1,0)) if abs(t.y)<.9 else Vector((1,0,0));u=t.cross(ref).normalized();v=t.cross(u)
        vs.extend(tuple(p+r*(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))) for j in range(sides))
    fs=[]
    for i in range(n if closed else n-1):
        for j in range(sides):fs.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%n)*sides+(j+1)%sides,((i+1)%n)*sides+j))
    if not closed:fs.extend([tuple(reversed(range(sides))),tuple((n-1)*sides+j for j in range(sides))])
    return mesh(name,vs,fs,mat,True)

def lit_ring(name,p,rx,ry,r=.003,mat='M06',n=8):
    x,y,z=p
    return lit_tube(name,[(x+rx*math.cos(i*math.tau/n),y+ry*math.sin(i*math.tau/n),z) for i in range(n)],r,mat,4,True)

def lit_lantern(p,label):
    x,y,z=p
    before=set(collection.objects)
    lathe('VIS_L02.01_hexagonal_foot_'+label,[(0,0),(.061,0),(.077,.008),(.086,.019),(.086,.029),(.075,.035),(0,.035)],'M06',6,p)
    lathe('VIS_L02.03_two_slope_hood_'+label,[(.084,.255),(.095,.268),(.083,.278),(.046,.311),(.039,.322),(.019,.335),(0,.335)],'M06',6,p)
    for j in range(6):
        a=j*math.tau/6;dx,dz=.078*math.cos(a),.078*math.sin(a)
        lit_tube('VIS_L02.02_frame_'+label,[(x+dx,y+.031,z+dz),(x+dx,y+.261,z+dz)],.0035,sides=4)
    # Glass side panels set 4mm inward, capped beneath the opaque sill and hood.
    lathe('VIS_L02.04_recessed_glass_'+label,[(.074,.036),(.074,.254)],'M16',6,p)
    lathe('VIS_L02.06_warm_core_'+label,[(0,.058),(.021,.058),(.021,.183),(.016,.208),(0,.22)],'M19',6,p)
    lathe('VIS_L02.06_wick_socket_'+label,[(0,.04),(.031,.04),(.031,.055),(.025,.063),(0,.063)],'M06',6,p)
    lit_ring('VIS_L02.05_suspension_eye_'+label,(x,y+.356,z),.012,.021,.0025,n=6)
    for j in range(6):
        a=j*math.tau/6+math.pi/6
        # Opaque inset vent recesses. These are not extra emissive surfaces.
        dx,dz=.043*math.cos(a),.043*math.sin(a)
        tangent=Vector((-math.sin(a)*.002,0,math.cos(a)*.002)); lower=Vector((x+dx,y+.302,z+dz)); upper=Vector((x+dx*.88,y+.311,z+dz*.88)); mesh('VIS_L02.07_vent_'+label,[tuple(lower-tangent),tuple(lower+tangent),tuple(upper+tangent),tuple(upper-tangent)],[(0,1,2,3)],'M07')
    socket=empty('SOCKET_L02_light_'+label,(x,y+.143,z));socket['parentId']='L01' if label.startswith('crown') else 'L03'
    return [o for o in collection.objects if o not in before]

def lit_chain(a,b,label):
    start=Vector(a);end=Vector(b);axis=(end-start).normalized();length=(end-start).length
    ref=axis.cross(Vector((0,1,0))).normalized();other=axis.cross(ref);count=14
    spacing=length/(count-1);half_length=spacing*.62;half_width=.0115
    for j in range(count):
        centre=start+axis*(spacing*j);across=ref if j%2==0 else other
        points=[tuple(centre+axis*(half_length*math.cos(i*math.tau/8))+across*(half_width*math.sin(i*math.tau/8))) for i in range(8)]
        lit_tube('VIS_L01.02_alternating_link_'+label+'_'+str(j),points,.0028,'M06',3,True)

def lit_crown():
    g=group('L01')
    lathe('VIS_L01.01_shaped_ceiling_plate',[(0,.666),(.040,.666),(.064,.675),(.071,.691),(.071,.7),(0,.7)],'M06',16)
    # Ring: 25 x 40mm section with measured stepped edge bevels.
    lathe('VIS_L01.03_ring_frame',[(.875,.371),(.898,.371),(.9,.374),(.9,.408),(.898,.411),(.875,.411),(.875,.371)],'M06',40)
    for j in range(4):
        a=j*math.tau/4+math.pi/4
        low=(.875*math.cos(a),.412,.875*math.sin(a));high=(.043*math.cos(a),.669,.043*math.sin(a))
        lit_chain(low,high,str(j))
        lit_ring('VIS_L01.06_chain_ear_'+str(j),low,.013,.014,.003,n=8)
    for j in range(6):
        a=j*math.tau/6;x,z=.802*math.cos(a),.802*math.sin(a)
        lit_lantern((x,0,z),'crown_'+str(j))
        lit_tube('VIS_L01.04_inward_hanger_'+str(j),[(.887*math.cos(a),.392,.887*math.sin(a)),(x,.392,z),(x,.371,z)],.004,'M06',4)
        empty('SOCKET_L01_lantern_'+str(j),(x,.377,z))
    # Modest central P22 leaf suspended between two cross ties, no floating emblem.
    for a in [0,math.pi/2]:lit_tube('VIS_L01.05_emblem_cross_tie',[(.86*math.cos(a),.38,.86*math.sin(a)),(-.86*math.cos(a),.38,-.86*math.sin(a))],.004,'M06',4)
    for sign in [-1,1]:lit_tube('VIS_L01.05_P22.01_leaf',[(sign*.065*math.sin(t*math.pi),.18+t*.20,0) for t in [i/12 for i in range(13)]],.003,'M06',4)
    lit_tube('VIS_L01.05_P22.02_04_axis',[(0,.17,0),(0,.385,0)],.003,'M06',4)
    for h in [.225,.267,.31]:
        for sign in [-1,1]:lit_tube('VIS_L01.05_P22.03_vein',[(0,h,0),(sign*.044,h+.035,0)],.002,'M06',4)
    # High-level camera proxy; no small chain colliders and no player obstruction.
    col('L01_camera_envelope',(0,0,0),(1.8,.43,1.8),player=False,camera=True,interaction=False)
    empty('SOCKET_L01_ceiling_hook',(0,.7,0));place_at(g,'chandelier');return g

def lit_wall_template():
    g=group('L03_north_west')
    # Back of escutcheon is exactly z=0, so its face clears the support surface.
    box('VIS_L03.01_scalloped_backplate',(0,0,.008),(.072,.19,.016),'M06',.001)
    for yy in [.02,.17]:
        for xx in [-.023,.023]:
            # Dome rivets face outward; six segments suffice at 7mm diameter.
            vs=[(xx,yy,.021)]+[(xx+.0035*math.cos(k*math.tau/6),yy+.0035*math.sin(k*math.tau/6),.018) for k in range(6)]
            mesh('VIS_L03.03_fixing_rivet',vs,[(0,1+k,1+(k+1)%6) for k in range(6)],'M06')
    # Cubic Bezier samples give the continuous S silhouette without faceted corners.
    controls=[(0,.07,.019),(0,.105,.055),(0,.23,.11),(0,.218,.183)]
    pts=[]
    for i in range(9):
        t=i/8;pts.append(tuple((1-t)**3*controls[0][k]+3*(1-t)**2*t*controls[1][k]+3*(1-t)*t*t*controls[2][k]+t**3*controls[3][k] for k in range(3)))
    pts.extend([(0,.213,.201),(0,.194,.208),(0,.186,.197)])
    lit_tube('VIS_L03.02_S_hook',pts,.008,'M06',4)
    lit_ring('VIS_L03.04_hanging_link',(0,.174,.198),.011,.019,.0028,n=8)
    # Lantern ring top .161, linked through the support eye's lower end .155.
    lit_lantern((0,-.216,.198),'wall_master')
    empty('SOCKET_L03.05_lantern_connection',(0,.16,.198))
    return g

def build_lighting():
    global root
    result=[lit_crown()]
    master=lit_wall_template();children=list(master.children)
    # Derived from A12 jamb front -4.808 and A09 inside surface +4.782.
    # Two side fixtures sit above furniture beside the route, without enlarging its footprint.
    mounts=[('north_west',(-2.825,2.63,-4.806),0),('north_east',(2.825,2.63,-4.806),0),('south_west',(-1.33,2.40,4.876),math.pi),('south_east',(1.33,2.40,4.876),math.pi),('west',(-5.874,2.85,.65),math.pi/2),('east',(5.874,2.85,.65),-math.pi/2)]
    for i,(label,p,yaw) in enumerate(mounts):
        if i==0:g=master
        else:
            g=group('L03_'+label)
            for source in children:
                o=source.copy()
                if source.data:o.data=source.data
                collection.objects.link(o);o.name=source.name.replace('wall_master',label)+'_'+label;o.parent=g;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=source.matrix_basis.copy()
        g['assetId']='L03';place(g,p,yaw);result.append(g)
    root=None
    return result
