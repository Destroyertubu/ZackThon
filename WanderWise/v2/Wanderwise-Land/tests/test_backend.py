"""Backend integration/security tests use isolated SQLite and explicit provider stubs.
No test calls a live, potentially chargeable Zhihu API.
"""
import time,json,uuid,threading
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app import db,worldgen,providers
from backend.app.errors import AppError

@pytest.fixture
def c(tmp_path,monkeypatch):
    monkeypatch.setenv('WANDERWISE_DB',str(tmp_path/'test.sqlite3'))
    monkeypatch.setenv('WW_HOURLY_TASK_LIMIT','1000')
    monkeypatch.delenv('ZHIHU_ACCESS_SECRET',raising=False)
    with TestClient(app) as client:
        login(client);yield client

def login(c):
    c.headers['Origin']='http://testserver'
    r=c.post('/api/v1/session/guest');assert r.status_code==200,r.text
    data=r.json()['data'];c.headers['X-CSRF-Token']=data['csrfToken'];c.headers['X-Client-Id']=uuid.uuid4().hex
    return data

def post(c,path,body={},key=None):return c.post('/api/v1'+path,json=body,headers={'Idempotency-Key':key or uuid.uuid4().hex})
def data(r,status=200):assert r.status_code==status,r.text;return r.json()['data']
def wait(c,j):
    for _ in range(200):
        r=data(c.get('/api/v1/jobs/'+j['jobId']))
        if r['status'] not in ('queued','running'):return r
        time.sleep(.01)
    raise AssertionError('Task did not terminate')
def world(c):
    j=wait(c,data(post(c,'/worlds',{'seedMode':'demo','presetId':'demo-growth'}),202));assert j['status']=='succeeded',j
    jid=j['result']['journeyId'];w=data(c.get('/api/v1/worlds/'+j['result']['worldId']));journey=data(c.get('/api/v1/journeys/'+jid));data(post(c,'/journeys/'+jid+'/lease',{'expectedVersion':journey['version']}));ct=data(c.get('/api/v1/contents/'+w['nodes'][0]['contentIds'][0]));return w,journey,ct

def collection(c,j,ct,idx=0):return data(post(c,'/bag/items',{'targetType':'excerpt','targetId':ct['excerpts'][idx]['id'],'journeyId':j['id']}))

def test_health_does_not_call_provider(c,monkeypatch):
    monkeypatch.setattr(providers,'get_json',lambda *a,**kw:pytest.fail('health called upstream'))
    assert data(c.get('/api/v1/health/ready'))['database']
    assert data(c.get('/api/v1/health/live'))['status']=='ok'

def test_origin_csrf_and_cookie(c):
    assert 'HttpOnly' in c.post('/api/v1/session/guest').headers['set-cookie']
    assert 'SameSite=strict' in c.post('/api/v1/session/guest').headers['set-cookie']
    assert post(c,'/worlds',{'seedMode':'demo'}).status_code==202
    c.headers['Origin']='https://attacker.invalid';assert post(c,'/worlds',{}).status_code==403
    c.headers['Origin']='http://testserver';c.headers['X-CSRF-Token']='wrong';assert post(c,'/worlds',{}).status_code==403
    time.sleep(.03)

def test_seed_validation_and_no_secret(c):
    assert post(c,'/worlds',{'seedText':' ','seedMode':'search'}).status_code==422
    assert post(c,'/worlds',{'seedText':'字'*101,'seedMode':'search'}).status_code==422
    out=data(c.get('/api/v1/session'));assert out['features']['oauth'] is False
    assert not out['features']['liveSearch']
    assert 'ZHIHU_ACCESS_SECRET' not in json.dumps(out)

def test_world_idempotent_and_conflict(c):
    key=uuid.uuid4().hex;b={'seedMode':'demo','presetId':'demo-growth'}
    j=data(post(c,'/worlds',b,key),202);r=wait(c,j);assert r['status']=='succeeded'
    assert data(post(c,'/worlds',b,key),202)['jobId']==j['jobId']
    assert post(c,'/worlds',{'seedMode':'demo','presetId':'demo-home'},key).status_code==409
    assert len(data(c.get('/api/v1/journeys'))['items'])==1

def test_content_provenance_exact(c):
    w,j,ct=world(c);assert ct['dataMode']=='demo';assert ct['provider']=='demo';assert ct['canEnterField']
    for p in ct['paragraphs']:assert ct['text'][p['start']:p['end']]==p['text']
    for e in ct['excerpts']:assert ct['text'][e['start']:e['end']]==e['text']
    assert all(n['contentIds'] for n in w['nodes']);assert len(w['nodes'])==7
    assert len(w['walkableLinks'])==6

def test_collection_unique_and_replay(c):
    w,j,ct=world(c);b=collection(c,j,ct);other=collection(c,j,ct);assert b['id']==other['id'];assert other['alreadyCollected']
    key=uuid.uuid4().hex;body={'targetType':'content','targetId':ct['id'],'journeyId':j['id']}
    x=data(post(c,'/bag/items',body,key));assert data(post(c,'/bag/items',body,key))['id']==x['id']
    assert len(data(c.get('/api/v1/bag'))['items'])==2
    db.init();assert len(data(c.get('/api/v1/bag'))['items'])==2

def test_notes_version_and_unique_links(c):
    w,j,ct=world(c);a=collection(c,j,ct);b=collection(c,j,ct,1)
    payload={'expectedVersion':a['version'],'tags':['人工标签'],'note':'测试备注'}
    x=data(c.patch('/api/v1/bag/items/'+a['id'],json=payload,headers={'Idempotency-Key':uuid.uuid4().hex}));assert x['version']==2 and x['manualTags']
    assert c.patch('/api/v1/bag/items/'+a['id'],json=payload,headers={'Idempotency-Key':uuid.uuid4().hex}).status_code==409
    l=data(post(c,'/bag/links',{'sourceBagItemId':a['id'],'targetBagItemId':b['id']}))
    assert data(post(c,'/bag/links',{'sourceBagItemId':b['id'],'targetBagItemId':a['id']}))['id']==l['id']
    assert post(c,'/bag/links',{'sourceBagItemId':a['id'],'targetBagItemId':a['id']}).status_code==422
    assert c.delete('/api/v1/bag/items/'+a['id']).status_code==200
    assert not data(c.get('/api/v1/bag/links'))['items']

def test_anchor_context_crud_conflict(c):
    w,j,ct=world(c);n=w['nodes'][0];body={'journeyId':j['id'],'topicId':n['topicId'],'contentId':ct['id'],'text':'<script>不执行</script> 私人草稿'}
    a=data(post(c,'/anchors',body));assert a['visibility']=='private'
    assert post(c,'/anchors',{**body,'visibility':'public'}).status_code==422
    assert post(c,'/anchors',{**body,'topicId':'wrong'}).status_code==422
    assert post(c,'/anchors',{**body,'localOffset':{'x':40,'y':0,'z':0}}).status_code==422
    patch={'text':'第二版本','expectedVersion':1}
    out=data(c.patch('/api/v1/anchors/'+a['id'],json=patch,headers={'Idempotency-Key':uuid.uuid4().hex}));assert out['version']==2
    assert c.patch('/api/v1/anchors/'+a['id'],json=patch,headers={'Idempotency-Key':uuid.uuid4().hex}).status_code==409
    c.delete('/api/v1/anchors/'+a['id']);assert not data(c.get('/api/v1/anchors'))['items']

def test_owner_isolation_all_private_routes(c):
    w,j,ct=world(c);b=collection(c,j,ct);job=data(post(c,'/contents/'+ct['id']+'/fields',{'snapshotId':ct['snapshotId']}),202);job=wait(c,job);assert job['status']=='succeeded',job
    with TestClient(app) as second:
        login(second)
        for path in ['/worlds/'+w['worldId'],'/journeys/'+j['id'],'/contents/'+ct['id'],'/fields/'+job['result']['fieldId'],'/jobs/'+job['id']]:assert second.get('/api/v1'+path).status_code==404,path
        assert second.patch('/api/v1/bag/items/'+b['id'],json={'expectedVersion':1,'note':'intrusion'},headers={'Idempotency-Key':uuid.uuid4().hex}).status_code==404
        assert not data(second.get('/api/v1/bag'))['items']
        assert data(c.get('/api/v1/bag'))['items'][0]['id']==b['id']

def test_field_return_checkpoint_and_refresh(c):
    w,j,ct=world(c);r=wait(c,data(post(c,'/contents/'+ct['id']+'/fields',{'snapshotId':ct['snapshotId']}),202));assert r['status']=='succeeded',r
    f=data(c.get('/api/v1/fields/'+r['result']['fieldId']));assert len(f['sections'])==4
    for section in f['sections']:assert section['text'] in ct['text']
    cp=j['checkpoint'];back={k:cp[k] for k in ['position','yaw','camera','trackedNodeId','navigationMode']};cp={**cp,'scene':'field','fieldId':f['id'],'position':f['spawn']['position'],'returnContext':back}
    out=data(c.put('/api/v1/journeys/'+j['id']+'/checkpoint',json={'expectedVersion':1,'checkpoint':cp}));assert out['checkpoint']['returnContext']==back
    assert data(c.get('/api/v1/journeys/'+j['id']))['checkpoint']['fieldId']==f['id']
    assert data(post(c,'/contents/'+ct['id']+'/fields',{'snapshotId':ct['snapshotId']}))['fieldId']==f['id']
    invalid={**cp,'fieldId':'not-a-field'};assert c.put('/api/v1/journeys/'+j['id']+'/checkpoint',json={'expectedVersion':2,'checkpoint':invalid}).status_code==422

def test_frozen_incremental_world_and_duplicate_expansion(c):
    w,j,ct=world(c);n=w['nodes'][1];r=wait(c,data(post(c,'/worlds/'+w['worldId']+'/expansions',{'nodeId':n['id'],'expectedVersion':1}),202));assert r['status']=='succeeded',r
    new=data(c.get('/api/v1/worlds/'+w['worldId']));assert len(new['nodes'])==11
    assert [n['position'] for n in new['nodes'][:7]]==[n['position'] for n in w['nodes']]
    assert len(new['walkableLinks'])==len(new['nodes'])-1
    assert data(c.get('/api/v1/worlds/'+w['worldId']+'?version=1'))==w
    r=wait(c,data(post(c,'/worlds/'+w['worldId']+'/expansions',{'nodeId':n['id'],'expectedVersion':2}),202));assert r['result']['alreadyExpanded']

def test_pause_resume_archive_and_lease(c):
    w,j,ct=world(c);cp=j['checkpoint']
    old_client=c.headers['X-Client-Id'];c.headers['X-Client-Id']='another-tab'
    assert c.put('/api/v1/journeys/'+j['id']+'/checkpoint',json={'expectedVersion':1,'checkpoint':cp}).status_code==409
    assert post(c,'/journeys/'+j['id']+'/lease',{'expectedVersion':1}).status_code==409
    assert post(c,'/journeys/'+j['id']+'/lease',{'expectedVersion':1,'takeover':True}).status_code==200
    c.headers['X-Client-Id']=old_client
    assert c.put('/api/v1/journeys/'+j['id']+'/checkpoint',json={'expectedVersion':1,'checkpoint':cp}).status_code==409
    c.headers['X-Client-Id']='another-tab';p=data(post(c,'/journeys/'+j['id']+'/pause',{'expectedVersion':1,'checkpoint':cp}));assert p['status']=='paused'
    r=data(post(c,'/journeys/'+j['id']+'/resume',{'expectedVersion':p['version']}));assert r['status']=='active'
    r=data(post(c,'/journeys/'+j['id']+'/complete',{'expectedVersion':r['version']}));assert r['status']=='completed'
    assert post(c,'/journeys/'+j['id']+'/resume',{'expectedVersion':r['version']}).status_code==403
    assert post(c,'/worlds/'+w['worldId']+'/expansions',{'nodeId':w['nodes'][0]['id'],'expectedVersion':1}).status_code==403

def test_events_dedup_and_foreground_constraint(c):
    w,j,ct=world(c);n=w['nodes'][0];e={'eventId':uuid.uuid4().hex,'type':'topic_entered','topicId':n['topicId'],'worldNodeId':n['id'],'occurredAt':db.now(),'payload':{'dwellSeconds':2}}
    x=data(post(c,'/journeys/'+j['id']+'/events',{'events':[e]}));y=data(post(c,'/journeys/'+j['id']+'/events',{'events':[e]}));assert x==y
    bad={**e,'eventId':uuid.uuid4().hex,'payload':{'dwellSeconds':0}};assert post(c,'/journeys/'+j['id']+'/events',{'events':[bad]}).status_code==422
    assert data(c.get('/api/v1/journeys/'+j['id']))['stats']['topics']==1
    assert len(data(c.get('/api/v1/journeys/'+j['id']+'/canvas'))['steps'])==1

def test_manual_synthesis_save_provenance(c):
    w,j,ct=world(c);a,b=collection(c,j,ct),collection(c,j,ct,1)
    body={'bagItemIds':[a['id'],b['id']],'question':'两份材料如何关联？','mode':'manual'}
    job=wait(c,data(post(c,'/syntheses',body),202));assert job['status']=='succeeded',job
    sid=job['result']['synthesisId'];draft=data(c.get('/api/v1/syntheses/'+sid));assert draft['generator']=='user';assert draft['result']['coreInsight']=='';assert draft['status']=='draft'
    assert len(draft['materials'])==2 and all(m['snapshotId'] for m in draft['materials'])
    result=data(post(c,'/syntheses/'+sid+'/save',{'title':'测试洞察','coreInsight':'这是手工书写的测试洞察。','connection':'保留来源，形成联系。','uncertainty':'不能将测试外推到真实用户。','questions':['还可以探索哪些方向？']}));assert result['status']=='saved'
    assert len(data(c.get('/api/v1/insights'))['items'])==1
    assert len(data(c.get('/api/v1/bag'))['items'])==3
    repeated=wait(c,data(post(c,'/syntheses',body),202));assert repeated['result']['synthesisId']==sid
    c.delete('/api/v1/bag/items/'+a['id']);assert len(data(c.get('/api/v1/insights/'+sid))['materials'])==2

def test_invalid_synthesis(c):
    w,j,ct=world(c);a=collection(c,j,ct)
    assert post(c,'/syntheses',{'bagItemIds':[a['id']]}).status_code==422
    t=data(post(c,'/bag/items',{'targetType':'topic','targetId':w['nodes'][0]['topicId'],'journeyId':j['id']}))
    job=wait(c,data(post(c,'/syntheses',{'bagItemIds':[a['id'],t['id']]}),202));assert job['status']=='failed';assert job['error']['code']=='CONTENT_INSUFFICIENT'

def test_clear_and_delete_semantics(c):
    w,j,ct=world(c);a=collection(c,j,ct);anchor=data(post(c,'/anchors',{'journeyId':j['id'],'topicId':w['nodes'][0]['topicId'],'text':'保留锚点'}));c.delete('/api/v1/journeys/'+j['id'])
    assert data(c.get('/api/v1/bag'))['items'][0]['journeyId'] is None
    assert data(c.get('/api/v1/anchors'))['items'][0]['journeyId'] is None
    result=c.request('DELETE','/api/v1/me/data',json={'confirm':'DELETE_MY_DATA'});assert result.status_code==200
    assert c.get('/api/v1/session').status_code==401
    assert db.one('SELECT COUNT(*) n FROM contents')['n']>0

def test_summary_never_gets_full_text_field(c,monkeypatch):
    monkeypatch.setenv('ZHIHU_ACCESS_SECRET','unit-test-not-a-real-secret')
    raw={'Code':0,'Data':{'Items':[{'ContentID':9223372036854775907,'ContentType':'answer','Title':'测试搜索','ContentText':'<b>因为</b>这是摘要。<script>不执行()</script>所以不是全文。首先、其次、结论均不改变摘要范围。','Url':'https://www.zhihu.com/question/1/answer/2?utm=test','AuthorName':'测试作者'}]}}
    monkeypatch.setattr(providers,'get_json',lambda *a,**kw:raw)
    cs,mode,at=providers.search('测试摘要');ct=cs[0];assert ct['externalId']=='9223372036854775907';assert ct['coverage']=='summary';assert not ct['canEnterField'];assert '<script>' not in ct['text'];assert '不执行()' not in ct['text'];assert ct['sourceUrl'].endswith('?utm=test')
    with pytest.raises(AppError):worldgen.field(ct)

def test_provider_cache_error_semantics_and_url_safety(c,monkeypatch):
    calls=[]
    def fetch():calls.append(1);return {'ok':True}
    providers.cached('test',60,fetch);providers.cached('test',60,fetch);assert len(calls)==1
    assert providers.safe_url('javascript:alert(1)') is None
    assert providers.safe_url('https://user:pass@example.com') is None
    for wid in ['a/b','a?b','a#b','a\r\nb','../x']:
        assert not providers.valid_work_id(wid)
    with pytest.raises(AppError) as e:providers.success_data({'Code':30001,'Data':{}})
    assert e.value.code=='QUOTA_EXHAUSTED'
    with pytest.raises(AppError) as e:providers.success_data({'Code':20001,'Data':{}})
    assert e.value.code=='AUTH_INVALID'

def test_invalid_ai_evidence_rejected(c,monkeypatch):
    monkeypatch.setenv('ZHIHU_ACCESS_SECRET','unit-test-not-a-real-secret')
    output={'title':'测试','coreInsight':'测试洞察','connection':'联系','uncertainty':'未知','questions':['为什么'],'evidenceIds':['foreign-one','foreign-two']}
    monkeypatch.setattr(providers,'get_json',lambda *a,**kw:{'choices':[{'message':{'content':json.dumps(output)}}]})
    mats=[{'id':'a','title':'甲','text':'测试材料甲','authorName':'测试','kind':'original_excerpt'},{'id':'b','title':'乙','text':'测试材料乙','authorName':'测试','kind':'original_excerpt'}]
    with pytest.raises(AppError) as e:providers.ai_synthesis(mats,'问题')
    assert e.value.code=='AI_OUTPUT_INVALID'

def test_spa_and_api_miss_are_separate(c):
    r=c.get('/home');assert r.status_code==200 and 'text/html' in r.headers['content-type']
    assert c.get('/api/v1/not-real').status_code==404
    assert c.get('/static/../backend/app/main.py').status_code==404
    assert 'frame-ancestors' in r.headers['content-security-policy']


def test_official_knowledge_catalog_and_detail_contract(c,monkeypatch):
    wid='9234567890123456789'
    def stub(url,**kwargs):
        assert not kwargs.get('headers'), 'public body endpoint must not receive developer secrets'
        if url.endswith('/list'):return [{'work_id':wid,'title':'知识测试正文','description':'协议测试','labels':['测试']}]
        return {'work_id':wid,'author_name':'协议测试作者','chapter_name':'第一章','content':'问题：测试规则。\n因为这只是测试。\n所以不能宣称真实接入。\n结论：必须现场核验。'}
    monkeypatch.setattr(providers,'get_json',stub)
    catalog=data(c.get('/api/v1/catalog/knowledge'));assert catalog['items'][0]['id']==wid
    job=wait(c,data(post(c,'/worlds',{'seedMode':'knowledge','presetId':wid}),202));assert job['status']=='succeeded',job
    w=data(c.get('/api/v1/worlds/'+job['result']['worldId']));ct=data(c.get('/api/v1/contents/'+w['nodes'][0]['contentIds'][0]));assert ct['coverage']=='chapter';assert ct['workId']==wid;assert ct['sourceUrl'] is None
