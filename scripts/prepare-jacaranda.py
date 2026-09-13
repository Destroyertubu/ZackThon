#!/usr/bin/env python3
"""Prepare the complete CC0 Poly Haven Jacaranda crown for the star-tree garden.

Run with system Python for download/UV-preserving leaf cards; run with Blender
--background --python this-file -- --blender for decimation, placement and GLB.
The original high-detail files stay in artifacts/, never in public/.
"""
from pathlib import Path
import json, math, struct, sys, hashlib, concurrent.futures, urllib.request, io, shutil, heapq

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'artifacts/garden-assets/jacaranda-source'
OUT = ROOT / 'public/models/garden'
REPORT = ROOT / 'artifacts/garden-assets/jacaranda-report.json'
MODEL = OUT / 'jacaranda-mature.glb'
HEIGHT = 7.85


def finalize_web_asset():
    """Keep native 1K/2K detail but avoid shipping photographic JPEGs at quality 100."""
    from PIL import Image
    data=MODEL.read_bytes();json_length=struct.unpack_from('<I',data,12)[0]
    document=json.loads(data[20:20+json_length]);binary=data[28+json_length:]
    images={image['bufferView']:image for image in document['images']};packed=bytearray();image_report=[]
    for index,view in enumerate(document['bufferViews']):
        chunk=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        if index in images:
            image=images[index];decoded=Image.open(io.BytesIO(chunk));original_length=len(chunk)
            if image['mimeType']=='image/jpeg':
                output=io.BytesIO();decoded.save(output,format='JPEG',quality=93,subsampling=0,optimize=True);chunk=output.getvalue()
            image_report.append({'name':image['name'],'size':list(decoded.size),'sourceBytes':original_length,'bytes':len(chunk)})
        packed.extend(b'\0'*((-len(packed))%4));view['byteOffset']=len(packed);view['byteLength']=len(chunk);packed.extend(chunk)
    packed.extend(b'\0'*((-len(packed))%4));document['buffers'][0]['byteLength']=len(packed)
    encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
    MODEL.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(packed))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(packed),0x004e4942)+packed)
    decoder=OUT/'draco';decoder.mkdir(exist_ok=True)
    for name in ('draco_wasm_wrapper.js','draco_decoder.wasm','draco_decoder.js'):
        shutil.copyfile(ROOT/'node_modules/three/examples/jsm/libs/draco/gltf'/name,decoder/name)
    if not (decoder/'LICENSE').exists():
        with urllib.request.urlopen('https://raw.githubusercontent.com/google/draco/main/LICENSE',timeout=60) as response:(decoder/'LICENSE').write_bytes(response.read())
    report=json.loads(REPORT.read_text());report.update(bytes=MODEL.stat().st_size,compression='KHR_draco_mesh_compression; position14 / normal10 / uv14; JPEG93, full chroma; leaf RGBA lossless',images=image_report)
    REPORT.write_text(json.dumps(report,indent=2));print('Final runtime bytes',report['bytes'],flush=True)


def download_sources():
    files = json.loads((ROOT/'artifacts/garden-assets/candidates/jacaranda_tree-files.json').read_text())
    entry = files['gltf']['1k']['gltf']
    jobs = [(SOURCE/'jacaranda_tree_1k.gltf',entry), *[(SOURCE/name,value) for name,value in entry['include'].items()]]
    jobs.append((SOURCE/'textures/jacaranda_tree_leaves_alpha_1k.png',files['leaves_alpha']['1k']['png']))
    jobs += [(SOURCE/name,value) for name,value in files['gltf']['2k']['gltf']['include'].items() if 'trunk_' in name]
    def fetch(job):
        path, metadata = job
        path.parent.mkdir(parents=True,exist_ok=True)
        if not path.exists() or hashlib.md5(path.read_bytes()).hexdigest()!=metadata['md5']:
            with urllib.request.urlopen(metadata['url'],timeout=240) as response: path.write_bytes(response.read())
        assert hashlib.md5(path.read_bytes()).hexdigest()==metadata['md5'],path
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: list(pool.map(fetch,jobs))
    print('Source files verified against Poly Haven MD5 values',flush=True)


def leaf_cards():
    import numpy as np
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    from PIL import Image
    document=json.loads((SOURCE/'jacaranda_tree_1k.gltf').read_text())
    binary=(SOURCE/'jacaranda_tree.bin').read_bytes()
    def accessor(index):
        a=document['accessors'][index]; view=document['bufferViews'][a['bufferView']]
        width={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']]
        return np.frombuffer(binary,dtype={5126:np.float32,5125:np.uint32,5123:np.uint16}[a['componentType']],count=a['count']*width,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)
    leaf=document['meshes'][0]['primitives'][2]
    positions=accessor(leaf['attributes']['POSITION']); normals=accessor(leaf['attributes']['NORMAL']); uv=accessor(leaf['attributes']['TEXCOORD_0'])
    labels_path=SOURCE/'leaf-labels.npy'
    if labels_path.exists(): labels=np.load(labels_path)
    else:
        triangles=accessor(leaf['indices']).reshape(-1,3)
        edges=np.concatenate((triangles[:,[0,1]],triangles[:,[1,2]]))
        graph=coo_matrix((np.ones(len(edges),dtype=np.uint8),(edges[:,0],edges[:,1])),shape=(len(positions),len(positions)))
        _,labels=connected_components(graph,directed=False);np.save(labels_path,labels)
    order=np.argsort(labels,kind='stable'); groups=np.split(order,np.flatnonzero(np.diff(labels[order]))+1)
    print('Preserving all',len(groups),'connected leaf islands',flush=True)
    # Reserve four vertices for ordinary cards, six for the most curved 18,000 islands.
    fitted=[];errors=[]
    for number,group in enumerate(groups):
        p=positions[group].astype(np.float64); chart=uv[group].astype(np.float64); origin=chart.mean(axis=0)
        _,frame=np.linalg.eigh(np.cov((chart-origin).T)); local=(chart-origin)@frame
        lo=local.min(axis=0);hi=local.max(axis=0);middle=(lo+hi)*.5;half=np.maximum((hi-lo)*.5,1e-8)
        normalized=(local-middle)/half; basis=np.column_stack((np.ones(len(group)),normalized))
        linear=np.linalg.lstsq(basis,p,rcond=None)[0]; residual=p-basis@linear
        extent=max(float(np.ptp(p,axis=0).max()),1e-8);error=float(np.sqrt(np.mean(residual**2))/extent)
        fitted.append((group,origin,frame,middle,half,linear,normalized,residual,extent));errors.append(error)
        if number%20000==0:print('Fitted leaf islands',number,flush=True)
    errors=np.array(errors); curved=set(np.argsort(errors)[-18000:].tolist())
    output_positions=[];output_uv=[];output_normals=[];output_indices=[];offset=0
    for number,(group,origin,frame,middle,half,linear,normalized,residual,extent) in enumerate(fitted):
        bend=number in curved and errors[number]>.008
        long_u=np.linalg.norm(linear[1])>np.linalg.norm(linear[2])
        us,vs=([-1,0,1],[-1,1]) if bend and long_u else ([-1,1],[-1,0,1]) if bend else ([-1,1],[-1,1])
        grid=np.array([(u,v) for v in vs for u in us],dtype=np.float64)
        card=np.column_stack((np.ones(len(grid)),grid))@linear
        if bend:
            axis=0 if long_u else 1
            for level in (-1,0,1):
                weights=np.exp(-((normalized[:,axis]-level)/.38)**2)
                card[grid[:,axis]==level]+=(residual*weights[:,None]).sum(axis=0)/max(weights.sum(),1e-10)
        card_extent=float(np.ptp(card,axis=0).max())
        if card_extent>extent*1.35:card=card.mean(axis=0)+(card-card.mean(axis=0))*(extent*1.35/card_extent)
        faces=[];width=len(us)
        for row in range(len(vs)-1):
            for column in range(width-1):
                a=row*width+column;faces.extend(((a,a+1,a+width+1),(a,a+width+1,a+width)))
        faces=np.array(faces,dtype=np.uint32)
        desired=normals[group].mean(axis=0);face_normals=np.cross(card[faces[:,1]]-card[faces[:,0]],card[faces[:,2]]-card[faces[:,0]])
        if np.dot(face_normals.sum(axis=0),desired)<0:faces=faces[:,[0,2,1]];face_normals*=-1
        card_normals=np.zeros_like(card)
        for face,normal in zip(faces,face_normals):
            for index in face:card_normals[index]+=normal
        card_normals/=np.maximum(np.linalg.norm(card_normals,axis=1,keepdims=True),1e-12)
        output_positions.append(card);output_normals.append(card_normals);output_uv.append((grid*half+middle)@frame.T+origin);output_indices.append(faces+offset);offset+=len(card)
    data=bytearray(binary)
    def append(array,kind,component=5126):
        array=np.ascontiguousarray(array);data.extend(b'\0'*((-len(data))%4));offset=len(data);data.extend(array.tobytes())
        view=len(document['bufferViews']);document['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':array.nbytes})
        a={'bufferView':view,'componentType':component,'count':len(array),'type':kind}
        if kind=='VEC3':a.update(min=array.min(axis=0).astype(float).tolist(),max=array.max(axis=0).astype(float).tolist())
        index=len(document['accessors']);document['accessors'].append(a);return index
    leaf['attributes']={'POSITION':append(np.concatenate(output_positions).astype(np.float32),'VEC3'),'NORMAL':append(np.concatenate(output_normals).astype(np.float32),'VEC3'),'TEXCOORD_0':append(np.concatenate(output_uv).astype(np.float32),'VEC2')}
    indices=np.concatenate(output_indices).reshape(-1).astype(np.uint32);leaf['indices']=append(indices,'SCALAR',5125)
    for primitive in document['meshes'][0]['primitives']:
        primitive['attributes']={key:value for key,value in primitive['attributes'].items() if key in ('POSITION','NORMAL','TEXCOORD_0')}
    # Preserve the real alpha silhouettes; glTF's JPG-only download omits this separate official map.
    colour=Image.open(SOURCE/'textures/jacaranda_tree_leaves_diff_1k.jpg').convert('RGBA')
    colour.putalpha(Image.open(SOURCE/'textures/jacaranda_tree_leaves_alpha_1k.png').convert('L'))
    colour.save(SOURCE/'textures/jacaranda_tree_leaves_rgba_1k.png')
    for image in document['images']:
        if 'trunk_' in image['uri']:image['uri']=image['uri'].replace('_1k','_2k')
        if image['uri'].endswith('leaves_diff_1k.jpg'):image.update(uri='textures/jacaranda_tree_leaves_rgba_1k.png',mimeType='image/png')
    document['materials'][2].update(alphaMode='MASK',alphaCutoff=.3,doubleSided=True)
    document['buffers']=[{'uri':'jacaranda-web-input.bin','byteLength':len(data)}]
    (SOURCE/'jacaranda-web-input.bin').write_bytes(data);(SOURCE/'jacaranda-web-input.gltf').write_text(json.dumps(document))
    report={'sourceTriangles':3863832,'leafIslands':len(groups),'leafIslandsRetained':len(groups),'leafTriangles':len(indices)//3,'curvedCards':int(sum(number in curved and errors[number]>.008 for number in range(len(groups)))),'fitRelativeRmsMedian':float(np.median(errors)),'fitRelativeRmsMax':float(errors.max())}
    REPORT.write_text(json.dumps(report,indent=2));print(report,flush=True)


def blender_export():
    import bpy
    import numpy as np
    from mathutils import Vector
    from mathutils.kdtree import KDTree
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE/'jacaranda-web-input.gltf'))
    original=next(obj for obj in bpy.context.scene.objects if obj.type=='MESH')
    bpy.context.view_layer.objects.active=original;original.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
    meshes=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
    source_bounds=[]
    for obj in meshes:
        bpy.context.view_layer.objects.active=obj
        for vertex in obj.data.vertices:source_bounds.append(obj.matrix_world@vertex.co)
    minimum=min(v.z for v in source_bounds);maximum=max(v.z for v in source_bounds);scale=HEIGHT/(maximum-minimum)
    trunk=next(obj for obj in meshes if 'trunk' in obj.data.materials[0].name)
    base=np.array([(trunk.matrix_world@v.co)[:] for v in trunk.data.vertices if (trunk.matrix_world@v.co).z<minimum+.7]);root=np.median(base[:,:2],axis=0)
    counts={}
    for obj in meshes:
        material=obj.data.materials[0];part='leaves' if 'leaves' in material.name else 'trunk' if 'trunk' in material.name else 'branches'
        obj.name='jacaranda_'+part
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        # Root-centred placement. A gentle left lean opens the star gate's right-hand sightline.
        for v in obj.data.vertices:
            x=(v.co.x-root[0])*scale;y=(v.co.y-root[1])*scale;z=(v.co.z-minimum)*scale
            t=max(0,min(1,(z-.5)/5));lean=t*t*(3-2*t)*.7
            x-=lean
            if part!='leaves':
                heights=(0,.35,.62,.89,1.15,1.6,2.2)
                cx=float(np.interp(z,heights,(0,.015,.142,.271,.387,.79,1.1)))
                cy=float(np.interp(z,heights,(0,-.018,.042,.061,.012,-.03,0)))
                dx=x-cx;dy=y-cy;radial=math.hypot(dx,dy)
                t=max(0,min(1,(z-.9)/1.3));fade=1-t*t*(3-2*t)
                t=max(0,min(1,(radial-.65)/.4));influence=1-t*t*(3-2*t)
                thick=1+.72*fade*influence
                x=cx+dx*thick;y=cy+dy*thick
            t=max(0,min(1,(z-1.3)/2.5));crown=t*t*(3-2*t)
            x=x*(1+.15*crown)-.45*crown;y*=1+.15*crown
            # Keep low outer branches within the unchanged 2.12 m flower bed.
            # Above eye height the complete broad canopy keeps its native spread.
            t=max(0,min(1,(z-1.65)/1.6));limit=1.98+4*t*t*(3-2*t)
            radial=math.hypot(x,y)
            if z<3.25 and radial>limit:x*=limit/radial;y*=limit/radial
            v.co=(x,y,z)
        obj.data.update()
        if part!='leaves':
            obj.data.calc_loop_triangles();target=105000 if part=='branches' else 65000
            decimate=obj.modifiers.new('Web surface detail','DECIMATE');decimate.ratio=min(1,target/len(obj.data.loop_triangles));decimate.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=decimate.name)
            for polygon in obj.data.polygons:polygon.use_smooth=True
        obj.data.calc_loop_triangles();counts[part]=len(obj.data.loop_triangles)
        print('Optimized',part,counts[part],flush=True)
    # Keep native PBR textures and make leaf masking explicit in the export.
    for material in bpy.data.materials:
        if material.use_nodes:
            principled=next((node for node in material.node_tree.nodes if node.type=='BSDF_PRINCIPLED'),None)
            if principled and 'leaves' in material.name:principled.inputs['Roughness'].default_value=.88
    assert sum(counts.values())<=500000,counts
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(MODEL),export_format='GLB',use_selection=True,export_apply=True,export_materials='EXPORT',export_texcoords=True,export_normals=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,export_draco_position_quantization=14,export_draco_normal_quantization=10,export_draco_texcoord_quantization=14)
    report=json.loads(REPORT.read_text());report.update(optimizedTriangles=counts,totalTriangles=sum(counts.values()),bytes=MODEL.stat().st_size,height=HEIGHT,rootSourceXY=root.tolist(),sourceScale=scale)
    # Mark actual underside vertices, aiming for a broad front-facing spread rather than arbitrary floating coordinates.
    targets=[(-3.0,4.9,1.0),(-2.0,5.5,-.2),(-1.0,4.8,1.5),(0,4.9,.2),(1.0,5.6,1.3),(2.0,4.8,.3),(-2.6,6.1,-1),(0,6.1,-1.0),(2.4,6.0,-1.0)]
    candidates=[]
    for obj in meshes:
        if 'leaves' in obj.name:continue
        for vertex in obj.data.vertices:
            v=vertex.co;n=vertex.normal
            if 3.9<v.z<6.8 and n.z<-.23:
                # Blender (x,y,z) becomes glTF (x,z,-y).
                candidates.append((np.array([v.x,v.z,-v.y]),obj.name,vertex.index))
    selected=[]
    for target in targets:
        order=sorted(candidates,key=lambda item:float(np.sum((item[0]-target)**2)))
        choice=next(item for item in order if all(np.linalg.norm(item[0]-previous[0])>.7 for previous in selected))
        selected.append(choice)
    report['hangingAnchors']=[{'local':p.tolist(),'world':[float(p[0]-2),float(p[1]+.33),float(p[2]-2)],'mesh':name,'blenderVertexIndex':index} for p,name,index in selected]
    # Dominant cross-section centre/radius provides a measured lower-trunk route for the gold vine.
    stem=[]
    for h in np.linspace(.35,3.3,12):
        sample=np.array([v.co[:] for v in trunk.data.vertices if abs(v.co.z-h)<.09])
        if len(sample):
            center=np.median(sample[:,:2],axis=0);radius=float(np.quantile(np.linalg.norm(sample[:,:2]-center,axis=1),.6))
            stem.append({'height':float(h),'center':[float(center[0]),float(h),float(-center[1])],'radius':radius})
    report['stemSections']=stem
    # Trace connected bark edges. Independent radial raycasts jump across the
    # open crotches of this mature tree; geodesic routes stay on one wood surface.
    vertices=trunk.data.vertices;positions=np.array([v.co[:] for v in vertices]);adjacency=[[] for _ in vertices]
    for edge in trunk.data.edges:
        a,b=edge.vertices;weight=float(np.linalg.norm(positions[a]-positions[b]))
        adjacency[a].append((b,weight));adjacency[b].append((a,weight))
    # UV-seam duplicates and separately scanned bark strips have coincident
    # positions but disconnected topology; join only very close surface samples.
    kd=KDTree(len(vertices))
    for vertex in vertices:kd.insert(vertex.co,vertex.index)
    kd.balance()
    for vertex in vertices:
        for _,neighbor,distance in kd.find_n(vertex.co,16):
            if neighbor!=vertex.index and distance<.035:adjacency[vertex.index].append((neighbor,distance))
    jewelry=[]
    for start_point,end_point in [((.08,-.27,.22),(1.45,-.20,3.4)),((-.20,-.12,.23),(-1.25,-.55,3.65))]:
        start=int(np.argmin(np.linalg.norm(positions-start_point,axis=1)));end=int(np.argmin(np.linalg.norm(positions-end_point,axis=1)))
        distance={start:0};parent={};queue=[(0,start)]
        while queue:
            length,index=heapq.heappop(queue)
            if length>distance[index]:continue
            if index==end:break
            for neighbor,weight in adjacency[index]:
                candidate=length+weight
                if candidate<distance.get(neighbor,float('inf')):
                    distance[neighbor]=candidate;parent[neighbor]=index;heapq.heappush(queue,(candidate,neighbor))
        assert end in distance,'The chosen vine endpoints must share a real connected trunk surface'
        route=[end]
        while route[-1]!=start:route.append(parent[route[-1]])
        path=[]
        for index in reversed(route):
            vertex=vertices[index];point=vertex.co+vertex.normal*.018
            path.append([float(point.x),float(point.z),float(-point.y)])
        jewelry.append(path)
    report['jewelryPaths']=jewelry
    points=np.array([v.co[:] for obj in meshes for v in obj.data.vertices])
    report['boundsLocal']={'min':[float(points[:,0].min()),float(points[:,2].min()),float(-points[:,1].max())],'max':[float(points[:,0].max()),float(points[:,2].max()),float(-points[:,1].min())]}
    wood=np.array([v.co[:] for obj in meshes if 'leaves' not in obj.name for v in obj.data.vertices])
    low=wood[wood[:,2]<1.65]
    report['lowWoodRadius']=float(np.linalg.norm(low[:,:2],axis=1).max())
    report['rootRadius']=float(np.linalg.norm(wood[wood[:,2]<.1,:2],axis=1).max())
    REPORT.write_text(json.dumps(report,indent=2))
    (OUT/'jacaranda-anchors.json').write_text(json.dumps(report['hangingAnchors'],indent=2))
    (OUT/'jacaranda-jewelry.json').write_text(json.dumps(jewelry,indent=2))
    measurements={'hangingAnchors':[entry['local'] for entry in report['hangingAnchors']],'jewelryPaths':jewelry,'boundsLocal':report['boundsLocal']}
    (ROOT/'src/components/observatory/jacarandaMeasurements.json').write_text(json.dumps(measurements,indent=2)+'\n')
    # Offline evidence, with the same camera side used by the actual rooftop arrival.
    bpy.ops.object.camera_add(location=(13,-20,10));camera=bpy.context.object;direction=Vector((-.4,0,3.9))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=13.8;bpy.context.scene.camera=camera
    bpy.ops.object.light_add(type='AREA',location=(4,-7,12));bpy.context.object.data.energy=1700;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=8
    bpy.ops.object.light_add(type='AREA',location=(-7,3,9));bpy.context.object.data.energy=1000;bpy.context.object.data.size=7
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.world=bpy.data.worlds.new('Neutral preview world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.22,.22,.22,1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
    scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.filepath=str(ROOT/'artifacts/garden-assets/jacaranda-web-preview.png');bpy.ops.render.render(write_still=True)
    print('Jacaranda GLB and evidence exported',flush=True)


if __name__=='__main__':
    if '--blender' in sys.argv:blender_export()
    elif '--finalize' in sys.argv:finalize_web_asset()
    else:download_sources();leaf_cards()
