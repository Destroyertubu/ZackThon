from __future__ import annotations
import hashlib, math, random, re
from . import db, providers
from .errors import AppError

LAYOUT_VERSION='land-polar-frozen-1'
BIOMES=['forest','meadow','lake','ruins']
def h(text): return hashlib.sha256(text.encode()).hexdigest()[:24]
def content(cid,snapshot=None):
    row=db.one('SELECT payload FROM snapshots WHERE id=? AND content_id=?',(snapshot,cid)) if snapshot else db.one('SELECT payload FROM contents WHERE id=?',(cid,))
    if not row: raise AppError('NOT_FOUND','来源内容不存在。',404)
    return db.loads(row['payload'])

def seed_demo():
    from pathlib import Path
    items=db.loads((db.ROOT/'demo-data'/'original_articles.json').read_text(encoding='utf-8'))
    ids=[]
    for i in items:
        item=providers.register_content('demo','original',i['externalId'],i['title'],i['authorName'],None,i['text'],'full_text',
              '2026-09-09T00:00:00Z','demo',i['labels'])
        ids.append(item['id'])
    presets=[('demo-growth','我们如何在变化中找到自己的方向？','成长、选择、记忆与不确定性',ids[:7]),
             ('demo-knowledge','收藏的知识，怎样变成自己的想法？','记忆、联系、行动与反馈',[ids[i] for i in [2,7,1,3,5,8,9]]),
             ('demo-home','为什么走得再远，也想有一个精神家园？','故乡、照顾、社区与自由探索',[ids[i] for i in [4,10,11,0,3,6,7]])]
    with db.tx() as c:
        for id,seed,desc,cids in presets:
            p={'id':id,'seedText':seed,'description':desc,'contentIds':cids,'sourceFetchedAt':'2026-09-09T00:00:00Z',
               'dataMode':'demo','sourceLabel':'自制演示文章，非知乎内容'}
            c.execute('INSERT OR REPLACE INTO presets VALUES(?,?)',(id,db.dumps(p)))

def topic_for(c,index=0):
    labels=[x.strip() for x in c.get('labels',[]) if isinstance(x,str) and 1<len(x.strip())<=18]
    if labels: return labels[0]
    title=re.sub(r'[《》「」“”"?？!！]','',c['title'])
    return title[:14] or '未分类内容'

def make_node(c,index,position):
    name=topic_for(c,index)
    topic='t_'+h(c['provider']+':'+name)
    return {'id':'n_'+h(c['id']+str(index)), 'topicId':topic,'title':name,'category':name,'position':position,
            'biome':BIOMES[index%4],'contentIds':[c['id']],'excerptIds':[e['id'] for e in c['excerpts'][:2]],
            'expansionState':'unexpanded','evidenceIds':[c['snapshotId']]}

def edges_for(source,target):
    e={'id':'e_'+h(source['id']+target['id']),'source':source['id'],'target':target['id'],
       'relation':'同一问题下的阅读方向（规则布局，非因果判断）','evidenceIds':source['evidenceIds']+target['evidenceIds']}
    a,b=source['position'],target['position']
    link={'id':'w_'+h(e['id']),'source':source['id'],'target':target['id'],'kind':'path','waypoints':[a,b]}
    return e,link

def create(seed,contents,mode,at,layout_seed=None):
    unique={c['id']:c for c in contents}; contents=list(unique.values())
    if not contents: raise AppError('CONTENT_INSUFFICIENT','没有可用于构建地图的来源。',422)
    # A single full-text work can form evidenced paragraph topic nodes; no invented separate articles.
    nodes=[]; layout_seed=layout_seed if layout_seed is not None else random.SystemRandom().randrange(2**31)
    base=(layout_seed%120)/120*math.tau
    if len(contents)==1 and contents[0]['canEnterField']:
        c=contents[0]; ps=c['paragraphs'][:7]
        for i,p in enumerate(ps):
            pos={'x':0.,'y':0.,'z':-5.} if i==0 else {'x':round(math.sin(base+(i-1)*math.tau/max(1,len(ps)-1))*30,3),'y':0.,'z':round(math.cos(base+(i-1)*math.tau/max(1,len(ps)-1))*30,3)}
            node=make_node(c,i,pos)
            node['title']=('主要问题' if i==0 else f'正文段落 {i+1}')
            node['topicId']='t_'+h(c['id']+p['id']); node['excerptIds']=[f'{c["snapshotId"]}:{p["id"]}']
            nodes.append(node)
    else:
        for i,c in enumerate(contents[:8]):
            pos={'x':0.,'y':0.,'z':-5.} if i==0 else {'x':round(math.sin(base+(i-1)*math.tau/max(1,min(7,len(contents)-1)))*32,3),'y':0.,'z':round(math.cos(base+(i-1)*math.tau/max(1,min(7,len(contents)-1)))*32,3)}
            nodes.append(make_node(c,i,pos))
    edges=[];links=[]
    for n in nodes[1:]:
        e,l=edges_for(nodes[0],n);edges.append(e);links.append(l)
    snapshots={c['id']:c['snapshotId'] for c in contents if any(c['id'] in n['contentIds'] for n in nodes)}
    return {'schemaVersion':'1.0-land','worldId':db.uid('world_'),'version':1,'seedText':seed,'layoutSeed':layout_seed,
            'layoutVersion':LAYOUT_VERSION,'sourceSnapshotSetId':'set_'+h(db.dumps(snapshots)), 'snapshotMap':snapshots,
            'nodeLimit':50,'nodes':nodes,'edges':edges,'walkableLinks':links,'spawn':{'position':{'x':0,'y':0,'z':3},'yaw':0},
            'capabilities':{'canExpand':True,'fieldTemplates':['argument']},'dataMode':mode,'sourceFetchedAt':at,
            'notice':('目前资料较少，地图仅展示已取得的证据。' if len(nodes)<6 else ''),
            'semanticMethod':'原始标签／标题与段落规则；连线表示阅读方向，不表示事实或因果关系。'}

def expand(world,parent,contents,mode,at):
    used={cid for n in world['nodes'] for cid in n['contentIds']}; new=[]
    for c in contents:
        if c['id'] not in used: new.append(c); used.add(c['id'])
    new=new[:min(4,world['nodeLimit']-len(world['nodes']))]
    p=next((n for n in world['nodes'] if n['id']==parent),None)
    if not p: raise AppError('NOT_FOUND','扩展话题不存在。',404)
    base_version=world['version']; new_nodes=[];new_edges=[];new_links=[]
    for c in new:
        idx=len(world['nodes']);pos=None
        # Freeze all old positions, and search only unoccupied new slots.
        for attempt in range(300):
            angle=(idx+attempt)*2.39996323+(world['layoutSeed']%100)/100
            radius=36+attempt//14*18
            candidate={'x':round(p['position']['x']+math.cos(angle)*radius,3),'y':0.,'z':round(p['position']['z']+math.sin(angle)*radius,3)}
            if all(math.hypot(candidate['x']-n['position']['x'],candidate['z']-n['position']['z'])>=18 for n in world['nodes']):
                pos=candidate;break
        if not pos: break
        n=make_node(c,idx,pos);e,l=edges_for(p,n)
        new_nodes.append(n);new_edges.append(e);new_links.append(l)
        world['nodes'].append(n);world['edges'].append(e);world['walkableLinks'].append(l)
        world['snapshotMap'][c['id']]=c['snapshotId']
    p['expansionState']='expanded' if new_nodes else 'exhausted'
    world['version']+=1
    world['sourceSnapshotSetId']='set_'+h(db.dumps(world['snapshotMap']))
    # Mixed cached/live is conservatively reported as cached, never upgraded from demo.
    if world['dataMode']!='demo': world['dataMode']='cached'
    if len(world['nodes'])>=50:
        world['capabilities']['canExpand']=False
        world['notice']='本次旅程的边界已展开，可换个问题再出发。'
    return {'worldId':world['worldId'],'baseVersion':base_version,'newVersion':world['version'],'newNodes':new_nodes,
            'newEdges':new_edges,'newWalkableLinks':new_links,'updatedExpansionState':p['expansionState']}

def field(c):
    if not c['canEnterField']: raise AppError('CONTENT_INSUFFICIENT',c['fieldDisabledReason'],422)
    ps=c['paragraphs']; chosen=ps if len(ps)<=8 else [ps[0],*ps[1:7],ps[-1]]
    sections=[]
    for i,p in enumerate(chosen):
        label='主要问题' if i==0 else ('总结 / 开放问题' if i==len(chosen)-1 else f'论述段落 {i}')
        sections.append({'id':'section_'+p['id'],'title':label,'paragraphIds':[p['id']],'text':p['text'],'excerptId':f'{c["snapshotId"]}:{p["id"]}',
                         'position':{'x':(-5 if i%2 else 5) if i else 0,'y':0,'z':-i*15}})
    return {'id':'f_'+h(c['snapshotId']+':argument-rules-1'),'contentId':c['id'],'snapshotId':c['snapshotId'],'templateType':'argument',
            'templateVersion':'argument-rules-1','generator':'rules','title':c['title'],'coverage':c['coverage'],
            'coverageNote':f'规则结构导览，依据已取得的{ "章节正文" if c["coverage"]=="chapter" else "正文" }；选取 {len(chosen)} / {len(ps)} 个段落，不声称自动验证作者论证。',
            'sections':sections,'relations':[{'source':sections[i-1]['id'],'target':s['id'],'relation':'原文顺序'} for i,s in enumerate(sections) if i],
            'spawn':{'position':{'x':0,'y':0,'z':6},'yaw':0},'dataMode':c['dataMode']}
