"""Deterministic, incremental spatial graph. Rules suggest questions, never facts.

Coordinates of existing nodes are immutable. A generated relation is explicitly
an exploration proposal, not an evidence-backed entailment.
"""
import hashlib
import math
import re
import secrets
import unicodedata

PALETTE = ['#e5bd83', '#9ec5a9', '#a1c8de', '#d5abc2', '#b4b1de', '#dfac92', '#afd3c3']

LOVE = [
 ('自我认知','自己', '你愿意把时间留给什么？'),
 ('刻意练习','实践', '热爱能否在反复实践中长出来？'),
 ('意义感','哲思', '有意义和有兴趣，是同一回事吗？'),
 ('他人的期待','众生', '别人的目光怎样改变我的选择？'),
 ('偶然与选择','天地', '不确定的尝试，会带我去哪里？'),
 ('可能的生活','跨界', '还有哪些生活方式值得试一次？'),
]
AI = [
 ('记忆与遗忘','概念','AI 应该记住什么，又该忘记什么？'),
 ('信息压缩','机制','压缩之后，什么信息不能丢？'),
 ('人类认知','跨界','人类的遗忘能给机器什么启发？'),
 ('评估与证据','检验','怎样检验记忆真的帮助了推理？'),
 ('隐私与边界','众生','什么记忆应该由用户决定？'),
 ('开放的难题','远方','现有方法无法回答什么？'),
]
GENERAL = [
 ('概念与边界','概念','这个问题中，哪些词需要先讲清楚？'),
 ('机制与证据','求证','我们凭什么相信一种解释？'),
 ('另一种解释','分歧','换个立场，会看到什么？'),
 ('实践与反馈','实践','如何通过一个小实验继续理解？'),
 ('跨学科连接','跨界','另一个领域怎样谈论相似的问题？'),
 ('尚未回答的问题','远方','还有什么值得带着疑问往前走？'),
]


def normalized(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', s)).strip()


def hash_id(*parts):
    return hashlib.sha256('|'.join(parts).encode()).hexdigest()[:16]


def make_world(seed):
    seed = normalized(seed)
    if not seed:
        subject=secrets.choice(['热爱','人工智能','旅行','记忆','阅读','星空','音乐','城市','自然','友谊','艺术','科学'])
        lens=secrets.choice(['好奇心','日常生活','另一个人','未来','一次偶然','童年','时间','一个问题','梦想','勇气'])
        seed=normalized(f'从{subject}出发，沿着{lens}去发现新的可能')
    themes = AI if re.search(r'AI|人工智能|记忆|大模型|[Aa]gent|[Ll][Ll][Mm]', seed) else LOVE if re.search('热爱|人生|生活|自己|选择|意义', seed) else GENERAL
    root_label = '热爱的形状' if themes is LOVE else '记忆的边界' if themes is AI else '问题的原点'
    wid = hash_id(seed, 'world-v1')
    nodes = [dict(id='root', title=root_label, question=seed, category='原点', color=PALETTE[0], x=0., z=0., depth=0, parent=None, relation='seed', expanded=False)]
    edges = []
    # Five nodes around the back half and one right foreground, leaving a calm spawn.
    for i, (title, category, question) in enumerate(themes):
        angle = (-155 + i*51) * math.pi / 180
        radius = 38 if i % 2 == 0 else 43
        nid = hash_id(seed, title)
        nodes.append(dict(id=nid,title=title,question=question,category=category,color=PALETTE[i+1],x=round(math.sin(angle)*radius,3),z=round(-math.cos(angle)*radius,3),depth=1,parent='root',relation='bridge' if category=='跨界' else 'alternative' if category in ('分歧','众生') else 'deepen',expanded=False))
        edges.append(dict(id=hash_id('root',nid),source='root',target=nid,kind=nodes[-1]['relation'],reason='由种子问题提出的探索方向；关联尚待你检验。'))
    return dict(id=wid,seed=seed,version=1,nodes=nodes,edges=edges,maxNodes=64,layout='deterministic-incremental-v1')


def expand_world(world, node_id):
    node = next((n for n in world['nodes'] if n['id']==node_id), None)
    if not node:
        raise KeyError(node_id)
    if node['expanded'] or len(world['nodes']) >= world['maxNodes']:
        return world
    node['expanded'] = True
    # The root already exposes its first ring. Expansion must not spawn duplicates.
    if node_id == 'root':
        world['version'] += 1
        return world
    if node['depth'] >= 3:
        return world
    phrases = [
        (f"理解{node['title']}", 'deepen', f"关于「{node['title']}」，哪些具体经历能帮助我理解？", '深入一层'),
        (f"换个角度看{node['title']}", 'alternative', f"关于「{node['title']}」，还有什么不同的立场或反例？", '换个角度'),
        (f"{node['title']}的另一端", 'bridge', f"「{node['title']}」与另一个领域，能建立怎样的联系？", '跨界试探'),
    ]
    base = math.atan2(node['x'], -node['z'])
    for i, (title, kind, question, category) in enumerate(phrases):
        if len(world['nodes']) >= world['maxNodes']:
            break
        nid = hash_id(world['seed'],node_id,kind)
        theta = base + (i-1)*.75
        for attempt in range(45):
            r = 26 + (attempt//9)*9
            a = theta + ((attempt % 9)-4)*.13
            x, z = node['x']+math.sin(a)*r, node['z']-math.cos(a)*r
            if all(math.hypot(x-n['x'], z-n['z']) > 23 for n in world['nodes']):
                break
        else:
            continue
        child = dict(id=nid,title=title,question=question,category=category,color=node['color'],x=round(x,3),z=round(z,3),depth=node['depth']+1,parent=node_id,relation=kind,expanded=False)
        world['nodes'].append(child)
        world['edges'].append(dict(id=hash_id(node_id,nid),source=node_id,target=nid,kind=kind,reason=f'{category}：这是可选择的探索建议，不代表结论或因果事实。'))
    world['version'] += 1
    return world


def public_projection(journey, world, alias):
    """Allowlist only. Never publish private thoughts, fragments or continuous trace."""
    ids = set(journey.get('visited',[]))
    nodes = [dict(id=n['id'],title=n['title'],category=n['category'],x=n['x'],z=n['z'],color=n['color']) for n in world['nodes'] if n['id'] in ids]
    valid={n['id'] for n in nodes}
    kinds={(e['source'],e['target']):e['kind'] for e in world['edges']}
    visited=[nid for nid in journey.get('visited',[]) if nid in valid]
    pairs=dict.fromkeys((a,b) for a,b in zip(visited,visited[1:]) if a!=b)
    edges=[dict(source=a,target=b,kind=kinds.get((a,b),'walk')) for a,b in pairs]
    return dict(alias=alias,seed=world['seed'],nodes=nodes,edges=edges,visitedCount=len(nodes))


def similarity(a, b):
    def labels(p):
        return {normalized(n['title']) for n in p.get('nodes',[])}
    def edge_labels(p):
        ns = {n['id']:normalized(n['title']) for n in p.get('nodes',[])}
        return {(ns.get(e['source'],''),ns.get(e['target'],'')) for e in p.get('edges',[])}
    def jaccard(x,y):
        return len(x&y)/len(x|y) if x|y else 0.
    common = sorted(labels(a)&labels(b))
    return round(.65*jaccard(labels(a),labels(b))+.35*jaccard(edge_labels(a),edge_labels(b)),4), common


def aggregate_trails(projections):
    """Count each public route once per topic or directed edge, using only its allowlist."""
    nodes,edges={},{}
    for projection in projections:
        labels={n['id']:normalized(n['title']) for n in projection.get('nodes',[])}
        seen=set()
        for node in projection.get('nodes',[]):
            title=labels[node['id']]
            if title in seen: continue
            seen.add(title)
            nid=hash_id('trail-topic',title)
            if nid not in nodes:
                nodes[nid]=dict(id=nid,title=title,category=node.get('category','话题'),color=node.get('color',PALETTE[0]),x=node.get('x',0),z=node.get('z',0),pathCount=0)
            nodes[nid]['pathCount']+=1
        seen=set()
        for edge in projection.get('edges',[]):
            source,target=labels.get(edge.get('source')),labels.get(edge.get('target'))
            if not source or not target or source==target or (source,target) in seen: continue
            seen.add((source,target))
            a,b=hash_id('trail-topic',source),hash_id('trail-topic',target)
            eid=hash_id('trail-edge',a,b)
            if eid not in edges:
                edges[eid]=dict(id=eid,source=a,target=b,kind=edge.get('kind','walk'),pathCount=0)
            edges[eid]['pathCount']+=1
    # Coordinates from separate worlds can overlap. Lay out the combined graph once.
    ordered=sorted(nodes.values(),key=lambda n:(-n['pathCount'],n['title']))
    for i,node in enumerate(ordered):
        radius=0 if i==0 else 32+20*((i-1)//10)
        angle=(i-1)*math.tau/max(1,min(10,len(ordered)-1))
        node.update(x=round(math.sin(angle)*radius,3),z=round(math.cos(angle)*radius,3),heat=node['pathCount'])
    for edge in edges.values(): edge['heat']=edge['pathCount']
    return dict(nodes=ordered,edges=sorted(edges.values(),key=lambda e:(-e['pathCount'],e['id'])),pathCount=len(projections))
