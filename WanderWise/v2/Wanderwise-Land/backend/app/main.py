from __future__ import annotations
import os,time,secrets,math,asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI,Request,Query
from fastapi.responses import JSONResponse,FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from . import db,schemas as S,security as sec,worldgen,jobs,providers
from .errors import AppError

@asynccontextmanager
async def lifespan(app):
    db.init();worldgen.seed_demo();db.cleanup()
    async def housekeeping():
        while True:
            await asyncio.sleep(3600)
            await asyncio.to_thread(db.cleanup)
    task=asyncio.create_task(housekeeping())
    yield
    task.cancel()

app=FastAPI(title='Wanderwise Land',version='1.0.0',lifespan=lifespan,docs_url='/api/docs',openapi_url='/api/openapi.json',redoc_url=None)
P='/api/v1'

def reply(data,status=200): return JSONResponse({'data':data,'meta':{'requestId':db.uid('req_')}},status_code=status)
@app.exception_handler(AppError)
async def app_error(r,e): return JSONResponse({'error':e.public(),'meta':{'requestId':db.uid('req_')}},status_code=e.status)
@app.exception_handler(RequestValidationError)
async def validation(r,e):
    # Do not echo malicious text, credentials or private drafts in validation reports.
    return JSONResponse({'error':{'code':'VALIDATION_ERROR','message':'输入不符合要求，请检查长度、格式和必填项。','retryable':False,'details':{'fields':[str(x['loc'][-1]) for x in e.errors()]}},'meta':{'requestId':db.uid('req_')}},status_code=422)

@app.middleware('http')
async def guard(request,call_next):
    try: body_length=int(request.headers.get('content-length','0') or '0')
    except ValueError: return JSONResponse({'error':{'code':'VALIDATION_ERROR','message':'Invalid Content-Length','retryable':False}},status_code=400)
    if body_length>512000:
        return JSONResponse({'error':{'code':'TOO_LARGE','message':'请求体超过限制。','retryable':False}},status_code=413)
    res=await call_next(request)
    res.headers['X-Content-Type-Options']='nosniff'
    res.headers['Referrer-Policy']='strict-origin-when-cross-origin'
    res.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    if request.url.path.startswith('/api/'): res.headers['Cache-Control']='no-store'
    return res

def flags(): return {'liveSearch':bool(os.getenv('ZHIHU_ACCESS_SECRET')),'aiSynthesis':bool(os.getenv('ZHIHU_ACCESS_SECRET')),'oauth':False,'social':False,'renderer':'native-webgl2','serverPersistence':True}

def summary_session(s):
    return {'user':{'id':s['owner'],'identityType':'guest','displayName':'漫行者'},'csrfToken':s['csrf'],'features':flags(),'retentionDays':30}

@app.get(P+'/health/live')
def live(): return reply({'status':'ok'})
@app.get(P+'/health/ready')
def ready(): return reply({'status':'ok','database':bool(db.one('SELECT 1'))})
@app.post(P+'/session/guest')
def guest(r:Request):
    sec.check_origin(r)
    raw=r.cookies.get('ww_session','');s=db.one('SELECT * FROM sessions WHERE hash=? AND expires>?',(sec.digest(raw),time.time())) if raw else None
    if not s:
        sec.rate('guest:'+sec.digest(r.client.host if r.client else 'local'),30,3600)
        raw=secrets.token_urlsafe(32);owner=db.uid('guest_');csrf=secrets.token_urlsafe(32)
        with db.tx() as c:
            c.execute('INSERT INTO users VALUES(?,?,?)',(owner,db.now(),time.time()))
            c.execute('INSERT INTO sessions VALUES(?,?,?,?)',(sec.digest(raw),owner,csrf,time.time()+30*86400))
        s=db.one('SELECT * FROM sessions WHERE hash=?',(sec.digest(raw),))
    with db.tx() as c:
        c.execute('UPDATE users SET last_seen=? WHERE id=?',(time.time(),s['owner']))
        c.execute('UPDATE sessions SET expires=? WHERE hash=?',(time.time()+30*86400,s['hash']))
    out=reply(summary_session(s));out.set_cookie('ww_session',raw,max_age=30*86400,httponly=True,secure=r.url.scheme=='https' or os.getenv('COOKIE_SECURE')=='1',samesite='strict',path='/');return out
@app.get(P+'/session')
def get_session(r:Request): return reply(summary_session(sec.session(r)))
@app.get(P+'/seeds')
def seeds():
    return reply({'items':[db.loads(x['payload']) for x in db.all('SELECT payload FROM presets ORDER BY id') ]})
@app.get(P+'/catalog/knowledge')
def catalog(r:Request):
    sec.session(r);items=providers.knowledge_list();return reply({'items':items,'dataMode':items[0]['dataMode'] if items else 'cached','sourceFetchedAt':items[0]['sourceFetchedAt'] if items else None})

def startjob(r,kind,b):
    s=sec.write_session(r);j=jobs.begin(s['owner'],kind,b,r.headers.get('idempotency-key',''));return reply(j,202)
@app.post(P+'/worlds')
def new_world(b:S.WorldCreate,r:Request): return startjob(r,'world',b.model_dump())
@app.get(P+'/jobs/{id}')
def get_job(id:str,r:Request): return reply(jobs.public(sec.owned('jobs',id,sec.session(r)['owner'])))
@app.post(P+'/jobs/{id}/cancel')
def cancel_job(id:str,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:
        j=sec.owned('jobs',id,s['owner'],c)
        if j['status'] in ('queued','running'):c.execute("UPDATE jobs SET status='cancelled',stage='cancelled',updated_at=? WHERE id=?",(db.now(),id))
    return reply(jobs.public(sec.owned('jobs',id,s['owner'])))
@app.get(P+'/worlds/{id}')
def get_world(id:str,r:Request,version:int|None=Query(default=None,ge=1)):
    row=sec.owned('worlds',id,sec.session(r)['owner'])
    if version is not None:
        row=db.one('SELECT payload FROM world_versions WHERE world_id=? AND version=?',(id,version))
        if not row: raise AppError('NOT_FOUND','世界版本不存在。',404)
    w=db.loads(row['payload'])
    if w.get('dataMode')!='demo':w={**w,'dataMode':'cached'}
    return reply(w)
@app.post(P+'/worlds/{id}/expansions')
def expand(id:str,b:S.Expand,r:Request):
    s=sec.write_session(r);sec.owned('worlds',id,s['owner'])
    if not db.one("SELECT id FROM journeys WHERE owner=? AND world_id=? AND status='active'",(s['owner'],id)):
        raise AppError('FORBIDDEN','只有正在进行的旅程可以扩展。',403)
    return startjob(r,'expand',{'worldId':id,**b.model_dump()})

def allowed_content(owner,cid,sid=None,c=None):
    rows=c.execute('SELECT payload FROM worlds WHERE owner=?',(owner,)).fetchall() if c else db.all('SELECT payload FROM worlds WHERE owner=?',(owner,))
    for row in rows:
        w=db.loads(row['payload'])
        if cid in w['snapshotMap'] and (sid is None or w['snapshotMap'][cid]==sid):return worldgen.content(cid,sid or w['snapshotMap'][cid])
    rows=c.execute('SELECT payload FROM bag WHERE owner=?',(owner,)).fetchall() if c else db.all('SELECT payload FROM bag WHERE owner=?',(owner,))
    for row in rows:
        p=db.loads(row['payload'])
        if p.get('contentId')==cid and (sid is None or p.get('snapshotId')==sid):return worldgen.content(cid,sid or p.get('snapshotId'))
    raise AppError('NOT_FOUND','此来源不在当前访客的旅程或收藏中。',404)
@app.get(P+'/contents/{id}')
def get_content(id:str,r:Request,snapshotId:str|None=None):
    ct=allowed_content(sec.session(r)['owner'],id,snapshotId)
    if ct.get('dataMode')!='demo':ct={**ct,'dataMode':'cached'}
    return reply(ct)
@app.post(P+'/contents/{id}/fields')
def new_field(id:str,b:S.FieldCreate,r:Request):
    s=sec.write_session(r);ct=allowed_content(s['owner'],id,b.snapshotId)
    if not ct['canEnterField']:raise AppError('CONTENT_INSUFFICIENT',ct['fieldDisabledReason'],422)
    old=db.one('SELECT id FROM fields WHERE snapshot_id=?',(b.snapshotId,))
    if old:return reply({'fieldId':old['id']})
    return startjob(r,'field',{'contentId':id,**b.model_dump()})
@app.get(P+'/fields/{id}')
def get_field(id:str,r:Request):
    row=db.one('SELECT * FROM fields WHERE id=?',(id,))
    if not row: raise AppError('NOT_FOUND','场域不存在。',404)
    allowed_content(sec.session(r)['owner'],row['content_id'],row['snapshot_id']);return reply(db.loads(row['payload']))

def bag_public(row):return {**db.loads(row['payload']),'id':row['id'],'targetType':row['target_type'],'targetId':row['target_id'],'journeyId':row['journey_id'],'version':row['version'],'createdAt':row['created_at']}
def anchor_public(row):return {**db.loads(row['payload']),'id':row['id'],'journeyId':row['journey_id'],'version':row['version'],'createdAt':row['created_at'],'updatedAt':row['updated_at']}
def paged(items,cursor,limit):
    try: offset=int(cursor or '0')
    except ValueError:raise AppError('VALIDATION_ERROR','分页游标无效。',422)
    if offset<0:raise AppError('VALIDATION_ERROR','分页游标无效。',422)
    return {'items':items[offset:offset+limit],'hasMore':len(items)>offset+limit,'nextCursor':str(offset+limit) if len(items)>offset+limit else None}
@app.get(P+'/bag')
def bag(r:Request,q:str='',journeyId:str|None=None,topicId:str|None=None,cursor:str|None=None,limit:int=Query(default=50,ge=1,le=50)):
    s=sec.session(r);rows=db.all('SELECT * FROM bag WHERE owner=? ORDER BY created_at DESC',(s['owner'],));items=[]
    for row in rows:
        p=bag_public(row)
        if journeyId and p['journeyId']!=journeyId:continue
        if topicId and p.get('topicId')!=topicId:continue
        if q and q.casefold() not in (p.get('title','')+p.get('text','')+p.get('note','')+' '.join(p.get('tags',[]))).casefold():continue
        items.append(p)
    return reply(paged(items,cursor,limit))

def bag_material(c,owner,b):
    journey=None;w=None
    if b.journeyId:
        journey=sec.owned('journeys',b.journeyId,owner,c)
        w=db.loads(sec.owned('worlds',journey['world_id'],owner,c)['payload'])
    if b.targetType=='insight':
        ir=sec.owned('insights',b.targetId,owner,c);p=db.loads(ir['payload'])
        if ir['status']!='saved':raise AppError('FORBIDDEN','洞察还未保存。',403)
        return insight_material(p),journey
    if b.targetType=='topic':
        node=next((n for n in (w or {}).get('nodes',[]) if n['topicId']==b.targetId),None)
        if not node:raise AppError('NOT_FOUND','话题不在此旅程中。',404)
        return {'title':node['title'],'text':'','kind':'topic','authorName':'','sourceLabel':'话题词 · 不是证据','dataMode':w['dataMode'],'topicId':node['topicId'],'tags':[node['title']],'note':''},journey
    if b.targetType=='content':ct=allowed_content(owner,b.targetId,(w or {}).get('snapshotMap',{}).get(b.targetId),c);excerpt=None
    else:
        sid=b.targetId.split(':')[0];snap=c.execute('SELECT content_id FROM snapshots WHERE id=?',(sid,)).fetchone()
        if not snap:raise AppError('NOT_FOUND','摘录不存在。',404)
        ct=allowed_content(owner,snap['content_id'],sid,c);excerpt=next((e for e in ct['excerpts'] if e['id']==b.targetId),None)
        if not excerpt:raise AppError('NOT_FOUND','此摘录无有效来源定位。',404)
    if w and ct['id'] not in w['snapshotMap']:raise AppError('FORBIDDEN','材料不属于此旅程。',403)
    node=next((n for n in (w or {}).get('nodes',[]) if ct['id'] in n['contentIds']),None)
    payload={'title':ct['title'],'text':excerpt['text'] if excerpt else ct['text'],'kind':excerpt['kind'] if excerpt else ct['coverage'],
      'authorName':ct['authorName'],'sourceUrl':ct['sourceUrl'],'sourceLabel':ct['sourceLabel'],'dataMode':ct['dataMode'],
      'sourceFetchedAt':ct['sourceFetchedAt'],'snapshotId':ct['snapshotId'],'contentId':ct['id'],'excerptId':excerpt['id'] if excerpt else None,
      'topicId':node['topicId'] if node else None,'tags':ct['labels'][:10],'note':'','evidenceChain':[]}
    return payload,journey
@app.post(P+'/bag/items')
def collect(b:S.BagCreate,r:Request):
    s=sec.write_session(r)
    def save(c):
        old=c.execute('SELECT * FROM bag WHERE owner=? AND target_type=? AND target_id=?',(s['owner'],b.targetType,b.targetId)).fetchone()
        if old:return {**bag_public(old),'alreadyCollected':True}
        payload,j=bag_material(c,s['owner'],b);id=db.uid('bag_')
        c.execute('INSERT INTO bag(id,owner,target_type,target_id,journey_id,payload,created_at) VALUES(?,?,?,?,?,?,?)',(id,s['owner'],b.targetType,b.targetId,b.journeyId,db.dumps(payload),db.now()))
        if j and j['status']=='active':db.emit(c,j['id'],'collected',payload.get('topicId'),{'bagItemId':id})
        return {**bag_public(c.execute('SELECT * FROM bag WHERE id=?',(id,)).fetchone()),'alreadyCollected':False}
    return reply(sec.mutation(r,s['owner'],b.model_dump(),save))
@app.patch(P+'/bag/items/{id}')
def patch_bag(id:str,b:S.BagPatch,r:Request):
    s=sec.write_session(r)
    def save(c):
        row=sec.owned('bag',id,s['owner'],c);sec.expect(row,b.expectedVersion);p=db.loads(row['payload'])
        if b.tags is not None:p['tags']=list(dict.fromkeys(t.strip() for t in b.tags if t.strip()));p['manualTags']=True
        if b.note is not None:p['note']=b.note
        c.execute('UPDATE bag SET payload=?,version=version+1 WHERE id=?',(db.dumps(p),id));return bag_public(c.execute('SELECT * FROM bag WHERE id=?',(id,)).fetchone())
    return reply(sec.mutation(r,s['owner'],b.model_dump(),save))
@app.delete(P+'/bag/items/{id}')
def remove_bag(id:str,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:c.execute('DELETE FROM bag WHERE id=? AND owner=?',(id,s['owner']))
    return reply({'removedId':id})
@app.get(P+'/bag/links')
def links(r:Request):return reply({'items':[{'id':x['id'],'sourceBagItemId':x['source'],'targetBagItemId':x['target'],'note':x['note']} for x in db.all('SELECT * FROM links WHERE owner=?',(sec.session(r)['owner'],))]})
@app.post(P+'/bag/links')
def new_link(b:S.LinkCreate,r:Request):
    s=sec.write_session(r)
    def save(c):
        a,z=sorted([b.sourceBagItemId,b.targetBagItemId]);sec.owned('bag',a,s['owner'],c);sec.owned('bag',z,s['owner'],c)
        if a==z:raise AppError('VALIDATION_ERROR','不能将材料与自身连线。',422)
        c.execute('INSERT OR IGNORE INTO links VALUES(?,?,?,?,?)',(db.uid('link_'),s['owner'],a,z,b.note))
        row=c.execute('SELECT * FROM links WHERE owner=? AND source=? AND target=?',(s['owner'],a,z)).fetchone()
        return {'id':row['id'],'sourceBagItemId':a,'targetBagItemId':z,'note':row['note']}
    return reply(sec.mutation(r,s['owner'],b.model_dump(),save))
@app.delete(P+'/bag/links/{id}')
def remove_link(id:str,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:c.execute('DELETE FROM links WHERE id=? AND owner=?',(id,s['owner']))
    return reply({'removedId':id})
@app.get(P+'/anchors')
def anchors(r:Request,journeyId:str|None=None,topicId:str|None=None,contentId:str|None=None,scope:str='mine'):
    if scope!='mine':raise AppError('FEATURE_NOT_ENABLED','公开锚点尚未开放。',403)
    items=[anchor_public(row) for row in db.all('SELECT * FROM anchors WHERE owner=? ORDER BY created_at DESC',(sec.session(r)['owner'],))]
    return reply({'items':[p for p in items if (not journeyId or p['journeyId']==journeyId) and (not topicId or p['topicId']==topicId) and (not contentId or p.get('contentId')==contentId)]})
@app.post(P+'/anchors')
def new_anchor(b:S.AnchorCreate,r:Request):
    s=sec.write_session(r)
    def save(c):
        j=sec.owned('journeys',b.journeyId,s['owner'],c)
        if j['status']=='completed':raise AppError('FORBIDDEN','归档旅程不可新增事件；请开始新的旅程。',403)
        w=db.loads(sec.owned('worlds',j['world_id'],s['owner'],c)['payload']);node=next((n for n in w['nodes'] if n['topicId']==b.topicId),None)
        if not node or (b.contentId and b.contentId not in node['contentIds']):raise AppError('VALIDATION_ERROR','锚点关联不是同一语境。',422)
        if abs(b.localOffset.x)>12 or abs(b.localOffset.z)>12 or abs(b.localOffset.y)>4:raise AppError('VALIDATION_ERROR','锚点偏移超出话题区域。',422)
        if b.excerptId:
            if not b.contentId:raise AppError('VALIDATION_ERROR','摘录需要绑定内容。',422)
            ct=allowed_content(s['owner'],b.contentId,w['snapshotMap'].get(b.contentId),c)
            if not any(e['id']==b.excerptId for e in ct['excerpts']):raise AppError('VALIDATION_ERROR','摘录与内容不符。',422)
        id=db.uid('anchor_');p={**b.model_dump(),'topicTitle':node['title']};stamp=db.now()
        c.execute('INSERT INTO anchors(id,owner,journey_id,topic_id,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',(id,s['owner'],b.journeyId,b.topicId,db.dumps(p),stamp,stamp))
        if j['status']=='active':db.emit(c,j['id'],'anchor_created',b.topicId,{'anchorId':id})
        return anchor_public(c.execute('SELECT * FROM anchors WHERE id=?',(id,)).fetchone())
    return reply(sec.mutation(r,s['owner'],b.model_dump(),save))
@app.patch(P+'/anchors/{id}')
def patch_anchor(id:str,b:S.AnchorPatch,r:Request):
    s=sec.write_session(r)
    def save(c):
        row=sec.owned('anchors',id,s['owner'],c);sec.expect(row,b.expectedVersion);p=db.loads(row['payload']);p['text']=b.text
        c.execute('UPDATE anchors SET payload=?,version=version+1,updated_at=? WHERE id=?',(db.dumps(p),db.now(),id));return anchor_public(c.execute('SELECT * FROM anchors WHERE id=?',(id,)).fetchone())
    return reply(sec.mutation(r,s['owner'],b.model_dump(),save))
@app.delete(P+'/anchors/{id}')
def remove_anchor(id:str,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:c.execute('DELETE FROM anchors WHERE id=? AND owner=?',(id,s['owner']))
    return reply({'removedId':id})

def journey_public(row):
    w=db.loads(db.one('SELECT payload FROM worlds WHERE id=?',(row['world_id'],))['payload'])
    counts=db.one("SELECT COUNT(DISTINCT CASE WHEN type='topic_entered' THEN topic_id END) topics,COUNT(CASE WHEN type='collected' THEN 1 END) collections,COUNT(CASE WHEN type='anchor_created' THEN 1 END) anchors FROM events WHERE journey_id=?",(row['id'],))
    return {'id':row['id'],'worldId':row['world_id'],'seedText':w['seedText'],'status':row['status'],'version':row['version'],'checkpoint':db.loads(row['checkpoint']),
      'startedAt':row['started_at'],'completedAt':row['completed_at'],'stats':dict(counts),'dataMode':w['dataMode'],'sourceFetchedAt':w['sourceFetchedAt']}
@app.get(P+'/journeys')
def journeys(r:Request,cursor:str|None=None,limit:int=Query(default=50,ge=1,le=50)):
    return reply(paged([journey_public(x) for x in db.all('SELECT * FROM journeys WHERE owner=? ORDER BY started_at DESC',(sec.session(r)['owner'],))],cursor,limit))
@app.get(P+'/journeys/{id}')
def journey(id:str,r:Request):return reply(journey_public(sec.owned('journeys',id,sec.session(r)['owner'])))

def clientid(r):
    value=r.headers.get('x-client-id','')
    if not 8<=len(value)<=100:raise AppError('VALIDATION_ERROR','缺少标签页标识。',422)
    return value

def check_lease(row,r):
    if row['status']!='active':raise AppError('FORBIDDEN','此旅程未处于漫游状态。',403)
    if row['lease_client']!=clientid(r) or row['lease_until']<time.time():raise AppError('TAB_CONFLICT','此旅程由另一标签页控制，或写入租约已过期；请重新接管。',409)
@app.post(P+'/journeys/{id}/lease')
def lease(id:str,b:S.Lease,r:Request):
    s=sec.write_session(r);cl=clientid(r)
    with db.tx() as c:
        row=sec.owned('journeys',id,s['owner'],c);sec.expect(row,b.expectedVersion)
        if row['status']!='active':raise AppError('FORBIDDEN','请先继续旅程。',403)
        if row['lease_client'] and row['lease_client']!=cl and row['lease_until']>time.time() and not b.takeover:raise AppError('TAB_CONFLICT','另一标签页正在控制此旅程。可显式接管。',409)
        c.execute('UPDATE journeys SET lease_client=?,lease_until=? WHERE id=?',(cl,time.time()+90,id))
    return reply({'leaseSeconds':90})

def validate_cp(c,row,cp,owner):
    w=db.loads(sec.owned('worlds',row['world_id'],owner,c)['payload'])
    if cp.worldVersion!=w['version']:raise AppError('VERSION_CONFLICT','世界已扩展，请载入最新地图再保存。',409)
    if cp.scene=='field':
        f=c.execute('SELECT * FROM fields WHERE id=?',(cp.fieldId,)).fetchone()
        if not f or f['content_id'] not in w['snapshotMap'] or w['snapshotMap'][f['content_id']]!=f['snapshot_id'] or not cp.returnContext:raise AppError('VALIDATION_ERROR','场域与返回上下文无效。',422)
    if cp.trackedNodeId and not any(n['id']==cp.trackedNodeId for n in w['nodes']):raise AppError('VALIDATION_ERROR','追踪目标不存在。',422)
    return cp.model_dump()
@app.put(P+'/journeys/{id}/checkpoint')
def checkpoint(id:str,b:S.CPWrite,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:
        row=sec.owned('journeys',id,s['owner'],c);sec.expect(row,b.expectedVersion);check_lease(row,r);cp=validate_cp(c,row,b.checkpoint,s['owner'])
        c.execute('UPDATE journeys SET checkpoint=?,version=version+1,lease_until=? WHERE id=?',(db.dumps(cp),time.time()+90,id))
    return reply(journey_public(sec.owned('journeys',id,s['owner'])))
@app.post(P+'/journeys/{id}/pause')
def pause(id:str,b:S.CPWrite,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:
        row=sec.owned('journeys',id,s['owner'],c);sec.expect(row,b.expectedVersion);check_lease(row,r);cp=validate_cp(c,row,b.checkpoint,s['owner'])
        c.execute("UPDATE journeys SET checkpoint=?,status='paused',version=version+1,lease_client=NULL,lease_until=0 WHERE id=?",(db.dumps(cp),id))
    return reply(journey_public(sec.owned('journeys',id,s['owner'])))
@app.post(P+'/journeys/{id}/resume')
def resume(id:str,b:S.Version,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:
        row=sec.owned('journeys',id,s['owner'],c);sec.expect(row,b.expectedVersion)
        if row['status']=='completed':raise AppError('FORBIDDEN','已归档旅程为只读，请从大门开始新的旅程。',403)
        c.execute("UPDATE journeys SET status='paused',version=version+1,lease_client=NULL,lease_until=0 WHERE owner=? AND status='active' AND id!=?",(s['owner'],id))
        c.execute("UPDATE journeys SET status='active',version=version+1,lease_client=?,lease_until=? WHERE id=?",(clientid(r),time.time()+90,id))
    return reply(journey_public(sec.owned('journeys',id,s['owner'])))
@app.post(P+'/journeys/{id}/complete')
def complete(id:str,b:S.Version,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:
        row=sec.owned('journeys',id,s['owner'],c);sec.expect(row,b.expectedVersion)
        if row['status']=='active':check_lease(row,r)
        if row['status']!='completed':c.execute("UPDATE journeys SET status='completed',completed_at=?,version=version+1,lease_client=NULL,lease_until=0 WHERE id=?",(db.now(),id))
    return reply(journey_public(sec.owned('journeys',id,s['owner'])))
@app.post(P+'/journeys/{id}/events')
def events(id:str,b:S.Events,r:Request):
    s=sec.write_session(r);accepted=[]
    with db.tx() as c:
        row=sec.owned('journeys',id,s['owner'],c)
        # Late retransmission of acknowledged events is safe even after archive.
        w=db.loads(sec.owned('worlds',row['world_id'],s['owner'],c)['payload'])
        for e in b.events:
            old=c.execute('SELECT seq FROM events WHERE journey_id=? AND event_id=?',(id,e.eventId)).fetchone()
            if old:accepted.append({'eventId':e.eventId,'seq':old['seq']});continue
            check_lease(row,r)
            if e.topicId and not any(n['topicId']==e.topicId for n in w['nodes']):raise AppError('VALIDATION_ERROR','事件话题不属于此世界。',422)
            if e.worldNodeId and not any(n['id']==e.worldNodeId and (not e.topicId or n['topicId']==e.topicId) for n in w['nodes']):raise AppError('VALIDATION_ERROR','事件节点与话题不一致。',422)
            try:datetime.fromisoformat(e.occurredAt.replace('Z','+00:00'))
            except ValueError:raise AppError('VALIDATION_ERROR','事件时间无效。',422)
            payload={'scene':'field' if e.payload.get('scene')=='field' else 'world'}
            if e.type=='topic_entered' and float(e.payload.get('dwellSeconds',0))<2:raise AppError('VALIDATION_ERROR','需要前台停留两秒才记录访问。',422)
            if e.type=='topic_left':
                try:payload['dwellSeconds']=min(120,max(0,float(e.payload.get('dwellSeconds',0))))
                except (ValueError,TypeError):payload['dwellSeconds']=0
                if not math.isfinite(payload['dwellSeconds']):payload['dwellSeconds']=0
            seq=db.emit(c,id,e.type,e.topicId,payload,event_id=e.eventId,occurred_at=e.occurredAt);accepted.append({'eventId':e.eventId,'seq':seq})
    return reply({'accepted':accepted,'highestSeq':max([x['seq'] for x in accepted],default=0)})
@app.get(P+'/journeys/{id}/canvas')
def canvas(id:str,r:Request):
    s=sec.session(r);j=sec.owned('journeys',id,s['owner']);w=db.loads(sec.owned('worlds',j['world_id'],s['owner'])['payload']);ev=[dict(x) for x in db.all('SELECT * FROM events WHERE journey_id=? ORDER BY seq',(id,))]
    nodes=[];visited=[];edges={}
    for n in w['nodes']:
        enters=[e for e in ev if e['type']=='topic_entered' and e['topic_id']==n['topicId']]
        seconds=sum(db.loads(e['payload']).get('dwellSeconds',0) for e in ev if e['type']=='topic_left' and e['topic_id']==n['topicId'])
        nodes.append({**n,'visits':len(enters),'dwellSeconds':min(600,seconds)})
    for e in ev:
        if e['type']=='topic_entered':
            if visited and visited[-1]!=e['topic_id']:
                pair='|'.join(sorted([visited[-1],e['topic_id']]));edges[pair]=edges.get(pair,0)+1
            visited.append(e['topic_id'])
    return reply({'journey':journey_public(j),'nodes':nodes,'edges':[{'topics':k.split('|'),'count':v} for k,v in edges.items()],
      'steps':[{'type':e['type'],'topicId':e['topic_id'],'seq':e['seq'],'occurredAt':e['occurred_at']} for e in ev],
      'anchors':[anchor_public(x) for x in db.all('SELECT * FROM anchors WHERE owner=? AND journey_id=?',(s['owner'],id))],
      'bag':[bag_public(x) for x in db.all('SELECT * FROM bag WHERE owner=? AND journey_id=?',(s['owner'],id))]})
@app.delete(P+'/journeys/{id}')
def delete_journey(id:str,r:Request,deletePrivateAnchors:bool=False):
    s=sec.write_session(r)
    with db.tx() as c:
        row=sec.owned('journeys',id,s['owner'],c)
        if deletePrivateAnchors:c.execute('DELETE FROM anchors WHERE journey_id=? AND owner=?',(id,s['owner']))
        c.execute('DELETE FROM journeys WHERE id=?',(id,))
        # Keep the immutable private world so retained source references remain resolvable.
    return reply({'removedId':id,'collectionsRetained':True})
@app.post(P+'/syntheses')
def synthesize(b:S.Synthesis,r:Request):return startjob(r,'synthesis',b.model_dump())
@app.get(P+'/syntheses/{id}')
def get_synthesis(id:str,r:Request):return reply(db.loads(sec.owned('insights',id,sec.session(r)['owner'])['payload']))

def insight_material(p):
    result=p['result'];return {'title':result['title'],'text':result['coreInsight'],'kind':'user_insight' if p['generator']=='user' else 'ai_insight',
      'authorName':'你','sourceLabel':'个人洞察 · '+('手工创作' if p['generator']=='user' else 'AI 辅助，可编辑'),'dataMode':p['dataMode'],
      'sourceUrl':None,'tags':['洞察'],'note':p.get('personalNote',''),'evidenceChain':p['materials'],'sourceFetchedAt':p['createdAt']}
@app.post(P+'/syntheses/{id}/save')
def save_synthesis(id:str,b:S.InsightSave,r:Request):
    s=sec.write_session(r)
    def save(c):
        row=sec.owned('insights',id,s['owner'],c);p=db.loads(row['payload'])
        if row['status']=='saved':return p
        if not b.coreInsight.strip() or not b.title.strip():raise AppError('VALIDATION_ERROR','请写下洞察内容和标题。',422)
        evidence=p['result'].get('evidenceIds',[m['id'] for m in p['materials']]);p['result']={**b.model_dump(exclude={'personalNote'}),'evidenceIds':evidence};p['personalNote']=b.personalNote;p['status']='saved';p['savedAt']=db.now()
        c.execute("UPDATE insights SET payload=?,status='saved' WHERE id=?",(db.dumps(p),id))
        c.execute('INSERT OR IGNORE INTO bag(id,owner,target_type,target_id,payload,created_at) VALUES(?,?,?,?,?,?)',(db.uid('bag_'),s['owner'],'insight',id,db.dumps(insight_material(p)),db.now()))
        return p
    return reply(sec.mutation(r,s['owner'],b.model_dump(),save))
@app.get(P+'/insights')
def insights(r:Request):return reply({'items':[db.loads(x['payload']) for x in db.all("SELECT payload FROM insights WHERE owner=? AND status='saved' ORDER BY created_at DESC",(sec.session(r)['owner'],))]})
@app.get(P+'/insights/{id}')
def insight(id:str,r:Request):return reply(db.loads(sec.owned('insights',id,sec.session(r)['owner'])['payload']))
@app.delete(P+'/insights/{id}')
def delete_insight(id:str,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:
        sec.owned('insights',id,s['owner'],c);c.execute("DELETE FROM bag WHERE owner=? AND target_type='insight' AND target_id=?",(s['owner'],id));c.execute('DELETE FROM insights WHERE id=?',(id,))
    return reply({'removedId':id})
@app.delete(P+'/me/data')
def clear_data(b:S.ClearData,r:Request):
    s=sec.write_session(r)
    with db.tx() as c:c.execute('DELETE FROM users WHERE id=?',(s['owner'],))
    out=reply({'deleted':True});out.delete_cookie('ww_session',path='/');return out

app.mount('/static',StaticFiles(directory=db.ROOT/'frontend'),name='static')
@app.get('/{path:path}',include_in_schema=False)
def spa(path:str):
    if path and not(path in {'home','settings','credits'} or path.startswith('journeys/') or path.startswith('canvas/')):
        raise AppError('NOT_FOUND','此入口不存在。',404)
    return FileResponse(db.ROOT/'frontend'/'index.html',media_type='text/html',headers={'Cache-Control':'no-cache'})
