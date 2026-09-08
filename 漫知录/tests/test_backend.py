"""Offline tests. Any upstream payload below is a TEST fixture, not a verified API schema."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import hashlib
import json
import sqlite3
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
    assert client.post('/api/worlds',json={'seed':'  '}).status_code==200

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
        path=tmp_path/'q.db'
        store=Store(path);cfg=replace(Config(),mode='live',db_path=str(path),upstream_limit=1,guest_limit=1,cache_seconds=0)
        svc=ContentService(cfg,store);calls=[]
        async def fake(query):
            calls.append(query);await asyncio.sleep(.025)
            return {'data':[{'title':'测试结果','url':'https://www.zhihu.com/question/123','summary':'测试摘要'}]}
        svc._http=fake
        results=await asyncio.gather(*(svc.search({'id':f'n{i}','title':'同一个话题'},'同一个问题',str(i)) for i in range(8)))
        assert len(calls)==1 and all(len(x['items'])==1 for x in results)
        assert [x['items'][0]['nodeId'] for x in results]==[f'n{i}' for i in range(8)]
        assert store.quota_count('developer:zhihu_search')==1
        assert sum(store.quota_count('guest:'+str(i)) for i in range(8))==1
        restarted_store=Store(path)
        restarted=ContentService(replace(cfg,guest_limit=0),restarted_store)
        cached=await restarted.search({'id':'new-node','title':'同一个话题'},'同一个问题','new-user')
        assert cached['cached'] and cached['items'][0]['nodeId']=='new-node'
        assert restarted_store.quota_count('guest:new-user')==0
        assert restarted_store.quota_count('developer:zhihu_search')==1
        with pytest.raises(ProviderError) as e:await svc.search({'id':'other','title':'不同话题'},'同一个问题','next-user')
        assert e.value.status==429
    asyncio.run(check())


def test_expired_legacy_searches_survive_migration_and_new_writes(tmp_path):
    path=tmp_path/'legacy.db'
    query='同一个问题 同一个话题'
    key='zhihu:v1:'+hashlib.sha256(query.encode()).hexdigest()
    original=[{'id':'article-one','nodeId':'legacy-node','title':'本地旧结果',
               'body':'已下载的内容','url':'https://www.zhihu.com/question/123','retrievedAt':1}]
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE cache (key TEXT PRIMARY KEY,data TEXT NOT NULL,expires REAL NOT NULL)')
        db.execute('INSERT INTO cache VALUES(?,?,?)',(key,json.dumps(original),2))
    store=Store(path)
    store.cache_set('unrelated-new-query',[])
    assert store.cache_get(key)==original
    assert store.cache_get(key,ttl=60) is None

    async def check():
        restarted_store=Store(path)
        cfg=replace(Config(),mode='live',db_path=str(path),cache_seconds=0,upstream_limit=0,guest_limit=0)
        service=ContentService(cfg,restarted_store)
        async def unexpected_upstream(query):
            pytest.fail('A legacy local result must not trigger a paid API search')
        service._http=unexpected_upstream
        first=await service.search({'id':'world-a-node','title':'同一个话题'},'同一个问题','visitor-a')
        second=await service.search({'id':'world-b-node','title':'同一个话题'},'同一个问题','visitor-b')
        assert first['cached'] and second['cached']
        assert first['items'][0]['nodeId']=='world-a-node'
        assert second['items'][0]['nodeId']=='world-b-node'
        assert restarted_store.cache_get(key)==original
        assert restarted_store.quota_count('developer:zhihu_search')==0
        assert restarted_store.quota_count('guest:visitor-a')==0
        assert restarted_store.quota_count('guest:visitor-b')==0
    asyncio.run(check())


def test_positive_ttl_can_refresh_previously_permanent_search(tmp_path):
    async def check():
        store=Store(tmp_path/'ttl.db')
        cfg=replace(Config(),mode='live',cache_seconds=0,upstream_limit=5,guest_limit=5)
        service=ContentService(cfg,store)
        calls=[]
        async def fake(query):
            calls.append(query)
            return {'data':[{'title':f'第 {len(calls)} 次返回','url':'https://www.zhihu.com/question/123','summary':'本地摘要'}]}
        service._http=fake
        node={'id':'n','title':'话题'}
        await service.search(node,'问题','visitor')
        with store.connect(True) as db:
            db.execute('UPDATE cache SET saved_at=saved_at-1000')
        assert (await service.search(node,'问题','visitor'))['cached']
        assert len(calls)==1
        ttl_service=ContentService(replace(cfg,cache_seconds=60),Store(store.path))
        ttl_service._http=fake
        refreshed=await ttl_service.search(node,'问题','visitor')
        assert not refreshed['cached'] and refreshed['items'][0]['title']=='第 2 次返回'
        assert (await ttl_service.search(node,'问题','visitor'))['cached']
        assert len(calls)==2 and store.quota_count('developer:zhihu_search')==2
    asyncio.run(check())


def test_empty_search_results_are_persistent_cache_hits(tmp_path):
    async def check():
        path=tmp_path/'empty.db'
        store=Store(path)
        cfg=replace(Config(),mode='live',cache_seconds=0,upstream_limit=1,guest_limit=1)
        service=ContentService(cfg,store)
        async def empty(query):
            return {'Data':{'Items':[]}}
        service._http=empty
        node={'id':'n','title':'未找到的主题'}
        first=await service.search(node,'问题','visitor')
        assert first['items']==[] and not first['cached']
        with store.connect(True) as db:
            db.execute('UPDATE cache SET saved_at=1,expires=2')
        restarted=ContentService(replace(cfg,upstream_limit=0,guest_limit=0),Store(path))
        second=await restarted.search(node,'问题','another-visitor')
        assert second['items']==[] and second['cached']
        assert store.quota_count('developer:zhihu_search')==1
        assert store.quota_count('guest:another-visitor')==0
    asyncio.run(check())


@pytest.mark.parametrize('failure',['network','business','invalid-schema'])
def test_failed_searches_do_not_poison_the_local_cache(tmp_path,failure):
    async def check():
        store=Store(tmp_path/'failure.db')
        cfg=replace(Config(),mode='live',cache_seconds=0,upstream_limit=3,guest_limit=3)
        service=ContentService(cfg,store)
        calls=[]
        async def fake(query):
            calls.append(query)
            if len(calls)==1:
                if failure=='network':
                    raise ProviderError('TEST upstream failure')
                return {'Code':500,'Data':{'Items':[]}} if failure=='business' else {'unexpected':[]}
            return {'data':[{'title':'重试成功','url':'https://www.zhihu.com/question/123','summary':'有效内容'}]}
        service._http=fake
        node={'id':'n','title':'话题'}
        with pytest.raises(ProviderError):
            await service.search(node,'问题','visitor')
        with store.connect() as db:
            assert db.execute('SELECT COUNT(*) FROM cache').fetchone()[0]==0
        result=await service.search(node,'问题','visitor')
        assert not result['cached'] and result['items'][0]['title']=='重试成功'
        assert (await service.search(node,'问题','visitor'))['cached']
        assert len(calls)==2 and store.quota_count('developer:zhihu_search')==2
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


def test_random_and_single_character_seed_with_vertical_save(client):
    for payload in ({},{'seed':'  '}):
        response=client.post('/api/worlds',json=payload)
        assert response.status_code==200
        generated=response.json()
        assert len(generated['seed'])>2
        assert make_world(generated['seed'])['nodes']==generated['nodes']
    w=client.post('/api/worlds',json={'seed':'梦'}).json()
    assert w['seed']=='梦'
    j=journey(w);j['position']['y']=35.75;j['trace'][0]['y']=34.5
    assert client.put('/api/journeys/flying',json=j).status_code==200
    saved=client.get('/api/journeys/flying').json()['data']
    assert saved['position']['y']==35.75 and saved['trace'][0]['y']==34.5
    del j['position']['y']
    assert client.put('/api/journeys/legacy',json=j).status_code==200
    assert client.get('/api/journeys/legacy').json()['data']['position']['y']==2.6
    j['position']['y']=1001
    assert client.put('/api/journeys/too-high',json=j).status_code==422


def test_home_groups_unique_cards_and_keeps_origins_private(client,app):
    w=world(client);j=journey(w)
    j['bag']=[{'id':'one-card','nodeId':'root','title':'第一束光','text':'仅自己可见'}]
    j['thoughts']=[{'id':'thought-one','nodeId':'root','text':'我的想法'}]
    j['bridges']=[{'id':'bridge-one','sourceIds':['one-card'],'note':'我的联系'}]
    assert client.put('/api/journeys/home-one',json=j).status_code==200
    j['title']='第二次探索'
    j['bag'].append({'id':'derived-card','kind':'derived','text':'新的理解','sourceIds':['one-card']})
    assert client.put('/api/journeys/home-two',json=j).status_code==200
    result=client.get('/api/home').json()
    assert result['stats']==dict(journeys=2,items=2,topics=2,thoughts=1,bridges=1)
    card=next(card for group in result['groups'] for card in group['items'] if card['id']=='one-card')
    assert set(card['journeyIds'])=={'home-one','home-two'}
    assert len(card['origins'])==2 and card['topic']==w['nodes'][0]['title']
    assert all(journal['publicSlug'] is None for journal in result['journals'])
    with TestClient(app) as other:
        other.post('/api/session')
        result=other.get('/api/home').json()
        assert result['groups']==[] and result['journals']==[] and result['stats']['items']==0
    client.delete('/api/journeys/home-one')
    assert client.get('/api/home').json()['stats']['journeys']==1


def test_home_imported_root_card_preserves_original_topic(client):
    original=world(client)
    target=client.post('/api/worlds',json={'seed':'人工智能怎样记住问题'}).json()
    assert original['nodes'][0]['id']==target['nodes'][0]['id']=='root'
    original_topic=original['nodes'][0]['title']
    assert original_topic!=target['nodes'][0]['title']
    saved=journey(target)
    saved['bag']=[
        {'id':'imported-root','nodeId':'root','topic':original_topic,'text':'另一段旅程的收获'},
        {'id':'detached-root','originNodeId':'root','topic':original_topic,'text':'不属于当前地图的收获'},
        {'id':'local-root','nodeId':'root','text':'当前世界的收获'},
    ]
    assert client.put('/api/journeys/imported-world',json=saved).status_code==200
    home=client.get('/api/home').json()
    groups={group['topic']:group for group in home['groups']}
    assert {card['id'] for card in groups[original_topic]['items']}=={'imported-root','detached-root'}
    assert groups[target['nodes'][0]['title']]['items'][0]['id']=='local-root'


def test_anchor_read_resonance_comments_moderation_and_notifications(client,app):
    w=world(client)
    private=client.post('/api/anchors',json={'worldId':w['id'],'nodeId':'root','text':'仅自己'}).json()['id']
    aid=client.post('/api/anchors',json={'worldId':w['id'],'nodeId':'root','text':'等待审核','visibility':'public'}).json()['id']
    assert client.post(f'/api/anchors/{aid}/read').json()['resonance']==0
    assert client.post(f'/api/anchors/{aid}/resonate').status_code==403
    with TestClient(app) as other:
        other.post('/api/session')
        for anchor_id in (private,aid):
            for suffix in ('read','resonate'):
                assert other.post(f'/api/anchors/{anchor_id}/{suffix}').status_code==404
            assert other.get(f'/api/anchors/{anchor_id}/comments').status_code==404
            assert other.post(f'/api/anchors/{anchor_id}/comments',json={'text':'想读'}).status_code==404
        client.post(f'/api/admin/anchors/{aid}/approve',headers={'Authorization':'Bearer TEST-ONLY'})
        first=other.post(f'/api/anchors/{aid}/read').json()
        second=other.post(f'/api/anchors/{aid}/read').json()
        assert first['read'] is True and second['read'] is False
        assert second['readCount']==1 and second['resonance']==1
        resonance_notification_ids=[]
        for count in range(1,4):
            row=other.post(f'/api/anchors/{aid}/resonate').json()
            assert row['myResonance']==count and row['resonance']==count+1
            resonance_notification_ids.append(client.get('/api/notifications').json()['items'][0]['id'])
        assert len(set(resonance_notification_ids))==1
        assert other.post(f'/api/anchors/{aid}/resonate').status_code==409
        assert other.post(f'/api/anchors/{aid}/comments',json={'text':' '}).status_code==422
        assert other.post(f'/api/anchors/{aid}/comments',json={'text':'长'*1001}).status_code==422
        comment=other.post(f'/api/anchors/{aid}/comments',json={'text':'这个想法让我想起了另一个角度。'})
        assert comment.status_code==200
        notification_ids={n['id'] for n in client.get('/api/notifications').json()['items']}
        assert other.post(f'/api/anchors/{aid}/comments',json={'text':'这个想法让我想起了另一个角度。'}).status_code==409
        assert {n['id'] for n in client.get('/api/notifications').json()['items']}==notification_ids
        comments=client.get(f'/api/anchors/{aid}/comments').json()
        assert comments['total']==1 and comments['items'][0]['own'] is False
        notice=client.get('/api/notifications').json()
        assert notice['unread']==2 and len(notice['items'])==2
        assert any('第 3 次' in n['text'] for n in notice['items'])
        assert any('收到一位同路人的回应' in n['text'] for n in notice['items'])
        assert all(n['anchorId']==aid for n in notice['items'])
        assert other.get('/api/notifications').json()['items']==[]
        assert other.post('/api/notifications/read',json={'ids':[notice['items'][0]['id']]}).json()['read']==0
        assert client.get('/api/notifications').json()['unread']==2
        assert client.post('/api/notifications/read',json={}).json()['read']==2
        assert client.get('/api/notifications').json()['unread']==0
        visible=client.get('/api/anchors',params={'topic':w['nodes'][0]['title']}).json()[0]
        assert visible['id']==aid and visible['resonance']==4 and visible['commentCount']==1
        assert client.delete('/api/anchors/'+aid).status_code==200
        assert other.get(f'/api/anchors/{aid}/comments').status_code==404
    assert client.get('/api/notifications').json()['items']==[]
    with app.state.store.connect() as db:
        for table in ('anchor_interactions','anchor_comments','notifications'):
            assert db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]==0


def test_resonance_and_read_are_atomic_for_same_visitor(client,app):
    w=world(client)
    aid=client.post('/api/anchors',json={'worldId':w['id'],'nodeId':'root','text':'同一人的共鸣','visibility':'public'}).json()['id']
    client.post(f'/api/admin/anchors/{aid}/approve',headers={'Authorization':'Bearer TEST-ONLY'})
    with TestClient(app) as other:
        other.post('/api/session')
        with ThreadPoolExecutor(max_workers=8) as pool:
            reads=list(pool.map(lambda _:other.post(f'/api/anchors/{aid}/read'),range(12)))
            responses=list(pool.map(lambda _:other.post(f'/api/anchors/{aid}/resonate'),range(12)))
        assert sum(r.json()['read'] for r in reads)==1
        assert sum(r.status_code==200 for r in responses)==3
        assert all(r.status_code in (200,409) for r in responses)
        row=other.get('/api/anchors',params={'topic':w['nodes'][0]['title']}).json()[0]
        assert row['readCount']==1 and row['resonance']==4 and row['myResonance']==3
        assert other.delete('/api/me/data').status_code==200
    row=client.get('/api/anchors',params={'topic':w['nodes'][0]['title']}).json()[0]
    assert row['readCount']==0 and row['resonance']==0
    assert client.get('/api/notifications').json()['items']==[]


def test_comment_rate_is_bounded(client,app):
    w=world(client)
    aid=client.post('/api/anchors',json={'worldId':w['id'],'nodeId':'root','text':'评论频率'}).json()['id']
    for index in range(6):
        assert client.post(f'/api/anchors/{aid}/comments',json={'text':f'想法 {index}'}).status_code==200
    assert client.post(f'/api/anchors/{aid}/comments',json={'text':'第七条'}).status_code==429
    assert client.get('/api/notifications').json()['items']==[]


def test_trails_include_only_shared_snapshots_and_matching_opt_in(client,app):
    w=world(client);j=journey(w)
    # Repeated transitions should not multiply the route's contribution.
    j['visited']=[w['nodes'][0]['id'],w['nodes'][1]['id'],w['nodes'][0]['id'],w['nodes'][1]['id']]
    client.put('/api/journeys/trail-owner',json=j)
    assert client.get('/api/trails').json()['pathCount']==0
    assert client.get('/api/trails',params={'view':'companions','journeyId':'trail-owner'}).json()['enabled'] is False
    client.post('/api/journeys/trail-owner/publish',json={'confirm':True,'alias':'甲'})
    with TestClient(app) as other:
        other.post('/api/session');other_world=world(other)
        other_journey=journey(other_world);other_journey['visited']=j['visited']
        other.put('/api/journeys/trail-other',json=other_journey)
        assert client.get('/api/trails').json()['pathCount']==1
        other.post('/api/journeys/trail-other/publish',json={'confirm':True,'alias':'乙'})
        result=client.get('/api/trails').json()
        assert result['pathCount']==2
        assert len(result['nodes'])==2 and len(result['edges'])==2
        assert all(edge['heat']==2 and edge['pathCount']==2 for edge in result['edges'])
        assert all(node['heat']==2 for node in result['nodes'])
        assert 'SECRET' not in json.dumps(result)
        matched=client.get('/api/trails',params={'view':'companions','journeyId':'trail-owner'}).json()
        assert matched['enabled'] is True and matched['pathCount']==1
        assert other.get('/api/trails',params={'view':'companions','journeyId':'trail-owner'}).json()['enabled'] is False
        other.delete('/api/journeys/trail-other/publish')
        assert client.get('/api/trails').json()['pathCount']==1
        assert client.get('/api/trails',params={'view':'companions','journeyId':'trail-owner'}).json()['pathCount']==0
    assert client.get('/api/trails',params={'view':'invalid'}).status_code==422
    client.delete('/api/journeys/trail-owner')
    assert client.get('/api/trails').json()['pathCount']==0


def test_official_summary_author_mapping_and_business_errors():
    payload={'Code':0,'Data':{'Items':[{'Title':'官方形态','Url':'https://www.zhihu.com/question/123','ContentText':'<em>知识</em>摘要','AuthorName':'作者甲'}]}}
    result=normalize_results(payload,{'id':'root'})[0]
    assert result['body']=='知识摘要' and result['author']=='作者甲'
    schema=json.loads((Path(__file__).resolve().parents[1]/'backend/schema.example.json').read_text())
    assert normalize_results(payload,{'id':'root'},schema)[0]['body']=='知识摘要'
    for payload in ({'Code':403,'Data':{'Items':[]}}, {'success':False,'data':[]}):
        with pytest.raises(ProviderError):
            normalize_results(payload,{'id':'root'})


def test_social_tables_upgrade_legacy_database_and_preserve_state(tmp_path):
    path=tmp_path/'legacy.db'
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE anchors(id TEXT PRIMARY KEY,owner TEXT NOT NULL,world_id TEXT NOT NULL,node_id TEXT NOT NULL,topic TEXT NOT NULL,text TEXT NOT NULL,visibility TEXT NOT NULL,status TEXT NOT NULL,created REAL NOT NULL)')
        db.execute("INSERT INTO anchors VALUES('legacy-anchor','owner','world','root','旧话题','旧想法','private','private',1)")
        db.execute('CREATE TABLE notifications(id TEXT PRIMARY KEY,owner TEXT NOT NULL,actor TEXT NOT NULL,anchor_id TEXT NOT NULL,topic TEXT NOT NULL,text TEXT NOT NULL,created REAL NOT NULL,read_at REAL,UNIQUE(owner,actor,anchor_id))')
        db.execute("INSERT INTO notifications VALUES('notice','owner','visitor','legacy-anchor','旧话题','连鸣',1,2)")
    store=Store(path)
    with store.connect(True) as db:
        assert db.execute('SELECT text FROM anchors').fetchone()[0]=='旧想法'
        db.execute("INSERT INTO anchor_interactions VALUES('legacy-anchor','visitor',1,3)")
    reopened=Store(path)
    with reopened.connect() as db:
        assert db.execute('SELECT resonance FROM anchor_interactions').fetchone()[0]==3
        row=db.execute('SELECT * FROM notifications').fetchone()
        assert row['text']=='连鸣' and row['id']=='notice' and row['read_at']==2
        assert row['event_key']=='resonance:legacy-anchor:visitor'
    reopened.erase_user('owner')
    with reopened.connect() as db:
        for table in ('anchors','anchor_interactions','notifications'):
            assert db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]==0
