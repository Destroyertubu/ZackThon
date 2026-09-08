"""Offline tests. Any upstream payload below is a TEST fixture, not a verified API schema."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.config import Config
from backend.main import create_app
from backend.world import make_world,expand_world,public_projection,similarity
from backend.store import Store
from backend.content import ContentService,ProviderError,normalize_results,plain,safe_zhihu_url

@pytest.fixture
def app(tmp_path):
    return create_app(replace(Config(),mode='demo',db_path=str(tmp_path/'test.db'),admin_token='TEST-ONLY'))

@pytest.fixture
def client(app):
    with TestClient(app) as c:
        assert c.post('/api/session').status_code==200
        yield c

def world(c):
    r=c.post('/api/worlds',json={'seed':'如何找到自己的热爱？'})
    assert r.status_code==200,r.text
    return r.json()

def journey(w):
    return {'worldId':w['id'],'revision':0,'title':w['seed'],'position':{'x':0,'z':8,'yaw':0,'pitch':0},'visited':[n['id'] for n in w['nodes'][:2]],'trace':[{'x':1,'z':2,'t':0}],'bag':[{'id':'private','text':'SECRET-BAG'}],'thoughts':[{'text':'SECRET-THOUGHT'}],'bridges':[],'startedAt':'2026-09-08T00:00:00Z','updatedAt':'2026-09-08T00:00:00Z'}

def test_requires_session_and_cookie_flags(app):
    with TestClient(app) as c:
        assert c.get('/api/journeys').status_code==401
        r=c.post('/api/session');cookie=r.headers['set-cookie']
        assert 'HttpOnly' in cookie and 'SameSite=lax' in cookie
        assert r.json()['oauth'] is False
        assert c.post('/api/session').json()['id']==r.json()['id']

def test_csrf_and_request_limit(client):
    assert client.post('/api/worlds',json={'seed':'hello'},headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post('/api/worlds',json={'seed':'hello'},headers={'Sec-Fetch-Site':'cross-site'}).status_code==403
    assert client.post('/api/worlds',content=b'x'*1_500_001).status_code==413
    assert client.post('/api/worlds',json={'seed':'  '}).status_code==422

def test_seed_stable_world_and_incremental_layout():
    a=make_world('如何找到自己的热爱？');b=make_world('如何找到自己的热爱？')
    assert a==b and len(a['nodes'])==7
    original={n['id']:(n['x'],n['z']) for n in a['nodes']}
    expand_world(a,a['nodes'][1]['id']);after=json.dumps(a,sort_keys=True)
    expand_world(a,a['nodes'][1]['id']);assert json.dumps(a,sort_keys=True)==after
    assert len(a['nodes'])==10
    for n in a['nodes']:
        if n['id'] in original: assert (n['x'],n['z'])==original[n['id']]
    for _ in range(4):
        for n in list(a['nodes']):expand_world(a,n['id'])
    assert len(a['nodes'])<=64 and len(set(n['id'] for n in a['nodes']))==len(a['nodes'])
    assert max(n['depth'] for n in a['nodes'])<=3

def test_world_ownership_and_source_truth(client,app):
    w=world(client)
    with TestClient(app) as other:
        other.post('/api/session')
        assert other.get('/api/worlds/'+w['id']).status_code==404
        assert other.post(f"/api/worlds/{w['id']}/expand/root").status_code==404
    r=client.get(f"/api/worlds/{w['id']}/nodes/root/content")
    assert r.status_code==200
    assert all(x['source']=='demo' and x['url'] is None and not x['verifiedQuote'] for x in r.json()['items'])
    assert client.get('/api/status').json()['developerUsed']==0

def test_revision_prevents_lost_update(client):
    w=world(client);j=journey(w)
    assert client.put('/api/journeys/j1',json=j).json()['revision']==1
    assert client.put('/api/journeys/j1',json=j).status_code==409
    j['revision']=1
    assert client.put('/api/journeys/j1',json=j).json()['revision']==2
    assert client.get('/api/journeys/j1').json()['data']['revision']==2
    j['visited']=['not-in-this-world']
    assert client.put('/api/journeys/j1',json=j).status_code==422

def test_public_routes_are_explicit_minimized_and_revocable(client):
    w=world(client);j=journey(w);client.put('/api/journeys/j1',json=j)
    assert client.get('/api/companions/j1').json()=={'enabled':False,'items':[]}
    assert client.post('/api/journeys/j1/publish',json={'confirm':False,'alias':'我'}).status_code==422
    p=client.post('/api/journeys/j1/publish',json={'confirm':True,'alias':'旅人'}).json()
    r=client.get('/api/public/'+p['slug']);assert r.status_code==200
    assert 'SECRET' not in r.text
    assert set(r.json())=={'alias','seed','nodes','edges','visitedCount'}
    assert client.delete('/api/journeys/j1/publish').status_code==200
    assert client.get('/api/public/'+p['slug']).status_code==404

def test_matching_requires_both_users_to_opt_in(client,app):
    w=world(client);client.put('/api/journeys/j1',json=journey(w));client.post('/api/journeys/j1/publish',json={'confirm':True,'alias':'甲'})
    with TestClient(app) as other:
        other.post('/api/session');w2=world(other);other.put('/api/journeys/j2',json=journey(w2))
        assert client.get('/api/companions/j1').json()['items']==[]
        other.post('/api/journeys/j2/publish',json={'confirm':True,'alias':'乙'})
        items=client.get('/api/companions/j1').json()['items']
        assert len(items)==1 and items[0]['alias']=='乙' and items[0]['score']==1
        assert other.get('/api/journeys/j1').status_code==404

def test_anchor_privacy_moderation_reporting_and_deletion(client,app):
    w=world(client)
    private=client.post('/api/anchors',json={'worldId':w['id'],'nodeId':'root','text':'PRIVATE'}).json()
    public=client.post('/api/anchors',json={'worldId':w['id'],'nodeId':'root','text':'PUBLIC','visibility':'public'}).json()
    assert private['status']=='private' and public['status']=='pending'
    with TestClient(app) as other:
        other.post('/api/session')
        assert other.get('/api/anchors',params={'topic':w['nodes'][0]['title']}).json()==[]
        assert other.delete('/api/anchors/'+private['id']).status_code==404
        route='/api/admin/anchors/'+public['id']+'/approve'
        assert other.post(route).status_code==403
        assert other.post(route,headers={'Authorization':'Bearer TEST-ONLY'}).status_code==200
        visible=other.get('/api/anchors',params={'topic':w['nodes'][0]['title']}).json()
        assert len(visible)==1 and visible[0]['text']=='PUBLIC'
        assert other.post('/api/anchors/'+public['id']+'/report',json={'reason':'测试报告'}).status_code==200
    assert client.delete('/api/anchors/'+public['id']).status_code==200

def test_full_deletion_revokes_sessions_and_shared_routes(client,app):
    w=world(client);client.put('/api/journeys/j1',json=journey(w));p=client.post('/api/journeys/j1/publish',json={'confirm':True,'alias':'甲'}).json()
    assert client.delete('/api/me/data').status_code==200
    assert client.get('/api/journeys').status_code==401
    assert client.get('/api/public/'+p['slug']).status_code==404

def test_safe_source_normalization_and_html():
    assert safe_zhihu_url('javascript:alert(1)') is None
    assert safe_zhihu_url('https://zhihu.com.evil.example/a') is None
    assert safe_zhihu_url('https://evil.example@zhihu.com/a') is None
    assert safe_zhihu_url('https://zhihu.com:999/a') is None
    assert safe_zhihu_url('https://zhihu.com/\n') is None
    assert 'evil' not in plain('<p>文字</p><script>evil</script>')
    p={'Data':{'Items':[{'Title':'测试','Url':'https://www.zhihu.com/question/123','Summary':'<b>正文</b>','Author':{'Name':'测试作者'}}]}}
    c=normalize_results(p,{'id':'root'})[0]
    assert c['body']=='正文' and c['kind']=='search_summary' and c['verifiedQuote'] is False
    with pytest.raises(ProviderError):normalize_results({'unknown':{}},{'id':'root'})
    with pytest.raises(ProviderError):normalize_results({'data':[{'title':'不明来源','url':'https://evil.example'}]},{'id':'root'})

def test_quota_atomic_under_threads_and_persistent(tmp_path):
    path=tmp_path/'q.db';s=Store(path)
    with ThreadPoolExecutor(max_workers=8) as pool:
        passed=list(pool.map(lambda _:s.reserve_quota('developer:zhihu_search',7),range(40)))
    assert sum(passed)==7
    assert Store(path).quota_count('developer:zhihu_search')==7

def test_live_singleflight_persistent_cache_and_shared_budget(tmp_path):
    async def check():
        store=Store(tmp_path/'q.db');cfg=replace(Config(),mode='live',db_path=str(tmp_path/'q.db'),upstream_limit=1,guest_limit=20)
        svc=ContentService(cfg,store);calls=[]
        async def fake(query):
            calls.append(query);await asyncio.sleep(.025)
            return {'data':[{'title':'测试结果','url':'https://www.zhihu.com/question/123','summary':'测试摘要'}]}
        svc._http=fake
        results=await asyncio.gather(*(svc.search({'id':'n','title':'同一个话题'},'同一个问题',str(i)) for i in range(8)))
        assert len(calls)==1 and all(len(x['items'])==1 for x in results)
        assert store.quota_count('developer:zhihu_search')==1
        restarted=ContentService(cfg,store)
        cached=await restarted.search({'id':'new-node','title':'同一个话题'},'同一个问题','new-user')
        assert cached['cached'] and cached['items'][0]['nodeId']=='new-node'
        with pytest.raises(ProviderError) as e:await svc.search({'id':'other','title':'不同话题'},'同一个问题','next-user')
        assert e.value.status==429
    asyncio.run(check())

def test_live_missing_secret_fails_without_demo_fallback(tmp_path):
    app=create_app(replace(Config(),mode='live',secret='',provider='http',db_path=str(tmp_path/'live.db')))
    with TestClient(app) as c:
        c.post('/api/session');w=world(c)
        r=c.get(f"/api/worlds/{w['id']}/nodes/root/content")
        assert r.status_code==503 and r.json()['demoFallback'] is False

def test_health_no_credentials_and_static_files(client):
    assert 'secret' not in client.get('/api/health').text.lower()
    assert client.get('/').status_code==200
    assert 'API 契约' in client.get('/api/docs').text
    assert '/api/session' in client.get('/api/openapi.json').json()['paths']
    assert client.get('/static/js/app.js').status_code==200
    assert client.get('/static/../.env').status_code!=200
