"""Run: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"""
import hashlib
import json
from pathlib import Path
import secrets
import time
from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from .config import Config, ROOT
from .store import Store, dump
from .content import ContentService, ProviderError
from .models import WorldInput, JourneyInput, AnchorInput, PublishInput, ReportInput, CommentInput, NotificationReadInput
from .world import make_world, expand_world, public_projection, similarity, hash_id, aggregate_trails


def create_app(config=None):
    cfg=config or Config()
    if cfg.mode not in ('demo','live'):
        raise ValueError('ZHIYE_MODE must be demo or live')
    store=Store(cfg.db_path)
    content=ContentService(cfg,store)
    app=FastAPI(title='漫知录 · Knowledge World',version='1.1.0',docs_url=None,redoc_url=None,openapi_url='/api/openapi.json')
    app.state.store,app.state.config,app.state.content=store,cfg,content

    @app.middleware('http')
    async def guard(request:Request,call_next):
        if request.url.path.startswith('/api/'):
            origin=request.headers.get('origin')
            if request.method not in ('GET','HEAD','OPTIONS'):
                if origin and origin not in cfg.origins:
                    return JSONResponse({'detail':'不允许的请求来源'},status_code=403)
                if request.headers.get('sec-fetch-site')=='cross-site':
                    return JSONResponse({'detail':'拒绝跨站写入'},status_code=403)
            try:
                size=int(request.headers.get('content-length','0'))
            except ValueError:
                return JSONResponse({'detail':'无效的请求长度'},status_code=400)
            if size>1_500_000:
                return JSONResponse({'detail':'请求过大'},status_code=413)
            # Reject oversized chunked bodies too, before Pydantic or JSON parsing.
            if request.method in ('POST','PUT','PATCH'):
                received=0
                parts=[]
                async for part in request.stream():
                    received+=len(part)
                    if received>1_500_000:
                        return JSONResponse({'detail':'请求过大'},status_code=413)
                    parts.append(part)
                request._body=b''.join(parts)
            peer=request.client.host if request.client else 'local'
            if not store.rate('ip:'+hashlib.sha256(peer.encode()).hexdigest()[:20],180):
                return JSONResponse({'detail':'请求过于频繁'},status_code=429)
        response=await call_next(request)
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['Referrer-Policy']='strict-origin-when-cross-origin'
        response.headers['Permissions-Policy']='camera=(),microphone=(),geolocation=()'
        response.headers['Content-Security-Policy']="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
        if request.url.path.startswith('/api/'):
            response.headers['Cache-Control']='no-store'
        return response

    def user(request:Request):
        found=store.authenticate(request.cookies.get('zhiye_session'))
        if not found:
            raise HTTPException(401,'请先创建访客会话。')
        return found

    def owned_world(wid,uid):
        row=store.owned('worlds',wid,uid)
        if not row:
            raise HTTPException(404,'找不到这个世界。')
        return json.loads(row['data'])

    @app.exception_handler(ProviderError)
    async def provider_error(request,exc):
        return JSONResponse({'detail':str(exc),'provider':'zhihu','demoFallback':False},status_code=exc.status)

    @app.get('/api/docs', include_in_schema=False)
    def local_docs():
        return FileResponse(ROOT/'web/api-docs.html')

    @app.get('/api/health')
    def health():
        return {'ok':True,'mode':cfg.mode,'renderer':'three-r180 + software fallback','oauth':False,'threeAvailable':(ROOT/'node_modules/three/build/three.module.js').is_file()}

    @app.post('/api/session')
    def session(request:Request,response:Response):
        current=store.authenticate(request.cookies.get('zhiye_session'))
        if not current:
            token,current=store.new_user()
            response.set_cookie('zhiye_session',token,max_age=60*60*24*30,httponly=True,secure=cfg.secure_cookie,samesite='lax',path='/')
        return dict(current,mode=cfg.mode,oauth=False,sharingDefault='private')

    @app.get('/api/status')
    def status(u=Depends(user)):
        return dict(mode=cfg.mode,provider=cfg.provider,configured=cfg.mode=='demo' or bool(cfg.secret) or cfg.provider=='cli',developerUsed=store.quota_count('developer:zhihu_search'),developerBudget=cfg.upstream_limit,guestUsed=store.quota_count('guest:'+u['id']),guestBudget=cfg.guest_limit,dayTimezone='Asia/Shanghai',oauth=False)

    @app.post('/api/worlds')
    def world_create(payload:WorldInput,u=Depends(user)):
        with store.connect() as db:
            count=db.execute('SELECT count(*) FROM worlds WHERE owner=?',(u['id'],)).fetchone()[0]
        if count>=80:
            raise HTTPException(409,'最多保留 80 个世界；请导出后清理旧数据。')
        world=make_world(payload.seed)
        # The layout is seed-stable; ownership IDs differ so users cannot overwrite one another.
        world['id']=hash_id(u['id'],world['id'])
        with store.connect(True) as db:
            row=db.execute('SELECT data FROM worlds WHERE id=? AND owner=?',(world['id'],u['id'])).fetchone()
            if row:
                return json.loads(row[0])
            db.execute('INSERT INTO worlds VALUES(?,?,?,?)',(world['id'],u['id'],dump(world),time.time()))
        return world

    @app.get('/api/worlds/{wid}')
    def world_get(wid:str,u=Depends(user)):
        return owned_world(wid,u['id'])

    @app.post('/api/worlds/{wid}/expand/{nid}')
    def world_expand(wid:str,nid:str,u=Depends(user)):
        # Read and update under the same write transaction; no lost expansions.
        with store.connect(True) as db:
            row=db.execute('SELECT data FROM worlds WHERE id=? AND owner=?',(wid,u['id'])).fetchone()
            if not row:
                raise HTTPException(404,'找不到这个世界。')
            world=json.loads(row[0])
            try:
                expand_world(world,nid)
            except KeyError:
                raise HTTPException(404,'找不到这个话题。')
            db.execute('UPDATE worlds SET data=?,updated=? WHERE id=?',(dump(world),time.time(),wid))
        return world

    @app.get('/api/worlds/{wid}/nodes/{nid}/content')
    async def node_content(wid:str,nid:str,u=Depends(user)):
        world=owned_world(wid,u['id'])
        node=next((n for n in world['nodes'] if n['id']==nid),None)
        if not node:
            raise HTTPException(404,'找不到这个话题。')
        return await content.search(node,world['seed'],u['id'])

    @app.put('/api/journeys/{jid}')
    def journey_save(jid:str,payload:JourneyInput,u=Depends(user)):
        if len(jid)>80 or not all(c.isalnum() or c in '-_' for c in jid):
            raise HTTPException(422,'无效旅程 ID')
        world=owned_world(payload.worldId,u['id'])
        valid_ids={n['id'] for n in world['nodes']}
        if any(n not in valid_ids for n in payload.visited):
            raise HTTPException(422,'旅程含有不属于世界的话题。')
        data=payload.model_dump()
        with store.connect(True) as db:
            row=db.execute('SELECT owner,revision FROM journeys WHERE id=?',(jid,)).fetchone()
            if row and row['owner']!=u['id']:
                raise HTTPException(404,'旅程不存在。')
            if row and row['revision']!=payload.revision:
                raise HTTPException(409,'旅程已在另一页面更新。当前副本已保留在本地，请导出后再加载服务器版本。')
            revision=payload.revision+1
            if not row and payload.revision!=0:
                raise HTTPException(409,'无法恢复未知的服务端修订版本。')
            data['revision']=revision
            db.execute('INSERT INTO journeys(id,owner,world_id,revision,data,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,data=excluded.data,updated=excluded.updated',(jid,u['id'],payload.worldId,revision,dump(data),time.time()))
        return {'id':jid,'revision':revision,'savedAt':time.time()}

    @app.get('/api/journeys')
    def journeys(u=Depends(user)):
        with store.connect() as db:
            rows=db.execute('SELECT id,data,updated,public_slug FROM journeys WHERE owner=? ORDER BY updated DESC LIMIT 100',(u['id'],)).fetchall()
        return [dict(id=r['id'],title=json.loads(r['data'])['title'],updated=r['updated'],publicSlug=r['public_slug'],visited=len(json.loads(r['data']).get('visited',[]))) for r in rows]

    @app.get('/api/home')
    def home(u=Depends(user)):
        with store.connect() as db:
            rows=db.execute('SELECT j.id,j.data,j.updated,j.public_slug,w.data AS world_data FROM journeys j JOIN worlds w ON j.world_id=w.id AND j.owner=w.owner WHERE j.owner=? ORDER BY j.updated DESC',(u['id'],)).fetchall()
        journals,thoughts,bridges,items=[],[],[],{}
        thought_ids,bridge_ids=set(),set()
        for row in rows:
            data,world=json.loads(row['data']),json.loads(row['world_data'])
            nodes={n['id']:n for n in world['nodes']}
            context=dict(journeyId=row['id'],journeyTitle=data['title'])
            journals.append(dict(id=row['id'],title=data['title'],seed=world['seed'],updated=row['updated'],startedAt=data.get('startedAt'),publicSlug=row['public_slug'],visited=len(set(data.get('visited',[]))),items=len(data.get('bag',[])),thoughts=len(data.get('thoughts',[])),bridges=len(data.get('bridges',[]))))
            for card in data.get('bag',[]):
                node=nodes.get(str(card.get('nodeId','')), {})
                stored_topic=card.get('topic')
                topic=(stored_topic.strip()[:180] if isinstance(stored_topic,str) else '') or node.get('title') or ('思维合成' if card.get('kind')=='derived' else '沿途收获')
                cid=str(card.get('id') or hash_id(dump(card)))
                origin=dict(context,topic=topic)
                if cid in items:
                    if row['id'] not in items[cid]['journeyIds']:
                        items[cid]['journeyIds'].append(row['id'])
                        items[cid]['origins'].append(origin)
                    continue
                items[cid]=dict(card,**context,topic=topic,color=node.get('color','#e5bd83'),journeyIds=[row['id']],origins=[origin])
            for kind,target,seen in [('thoughts',thoughts,thought_ids),('bridges',bridges,bridge_ids)]:
                for entry in data.get(kind,[]):
                    key=str(entry.get('id') or hash_id(row['id'],dump(entry)))
                    if key in seen: continue
                    seen.add(key)
                    node=nodes.get(str(entry.get('nodeId','')), {})
                    target.append(dict(entry,**context,topic=node.get('title','沿途')))
        groups={}
        for card in items.values():
            topic=card['topic']
            group=groups.setdefault(topic,dict(topic=topic,nodeId=card.get('nodeId'),color=card['color'],items=[],count=0))
            group['items'].append(card)
            group['count']+=1
        return dict(groups=sorted(groups.values(),key=lambda g:(-g['count'],g['topic'])),journals=journals,thoughts=thoughts,bridges=bridges,stats=dict(journeys=len(journals),items=len(items),topics=len(groups),thoughts=len(thoughts),bridges=len(bridges)))

    @app.get('/api/journeys/{jid}')
    def journey_get(jid:str,u=Depends(user)):
        row=store.owned('journeys',jid,u['id'])
        if not row:
            raise HTTPException(404,'旅程不存在。')
        return dict(id=jid,data=json.loads(row['data']),world=owned_world(row['world_id'],u['id']),publicSlug=row['public_slug'])

    @app.delete('/api/journeys/{jid}')
    def journey_delete(jid:str,u=Depends(user)):
        with store.connect(True) as db:
            n=db.execute('DELETE FROM journeys WHERE id=? AND owner=?',(jid,u['id'])).rowcount
        if not n:
            raise HTTPException(404,'旅程不存在。')
        return {'deleted':True}

    @app.post('/api/journeys/{jid}/publish')
    def journey_publish(jid:str,payload:PublishInput,u=Depends(user)):
        row=store.owned('journeys',jid,u['id'])
        if not row:
            raise HTTPException(404,'请先保存旅程。')
        projection=public_projection(json.loads(row['data']),owned_world(row['world_id'],u['id']),payload.alias)
        if len(projection['nodes'])<2:
            raise HTTPException(422,'至少探索两个话题后，才能公开路线。')
        slug=row['public_slug'] or secrets.token_urlsafe(12)
        with store.connect(True) as db:
            db.execute('UPDATE journeys SET public_slug=?,public_data=? WHERE id=? AND owner=?',(slug,dump(projection),jid,u['id']))
        return {'slug':slug,'public':projection,'notice':'只公开问题、访问过的话题和图上连线；不公开行囊、私人锚点或连续坐标。'}

    @app.delete('/api/journeys/{jid}/publish')
    def journey_unpublish(jid:str,u=Depends(user)):
        with store.connect(True) as db:
            n=db.execute('UPDATE journeys SET public_slug=NULL,public_data=NULL WHERE id=? AND owner=?',(jid,u['id'])).rowcount
        if not n:
            raise HTTPException(404,'旅程不存在。')
        return {'revoked':True}

    @app.get('/api/public/{slug}')
    def public_journey(slug:str):
        with store.connect() as db:
            row=db.execute('SELECT public_data FROM journeys WHERE public_slug=?',(slug,)).fetchone()
        if not row:
            raise HTTPException(404,'该公开路线不存在或已撤回。')
        return json.loads(row[0])

    @app.get('/api/companions/{jid}')
    def companions(jid:str,u=Depends(user)):
        row=store.owned('journeys',jid,u['id'])
        if not row:
            return {'enabled':False,'items':[]}
        if not row['public_slug']:
            return {'enabled':False,'items':[]}
        target=json.loads(row['public_data'])
        with store.connect() as db:
            rows=db.execute('SELECT public_slug,public_data FROM journeys WHERE owner!=? AND public_slug IS NOT NULL LIMIT 500',(u['id'],)).fetchall()
        items=[]
        for candidate in rows:
            p=json.loads(candidate['public_data'])
            score,common=similarity(target,p)
            if score>0:
                items.append(dict(slug=candidate['public_slug'],alias=p['alias'],seed=p['seed'],score=score,commonTopics=common,visitedCount=p['visitedCount']))
        return {'enabled':True,'items':sorted(items,key=lambda x:-x['score'])[:12],'algorithm':'0.65×话题 Jaccard + 0.35×有向图边 Jaccard；不是人格推断。'}

    @app.get('/api/trails')
    def trails(view:str='popular',journeyId:str='',u=Depends(user)):
        if view not in ('popular','companions'):
            raise HTTPException(422,'请选择全员热门小径或同频人足迹。')
        target=None
        if view=='companions':
            row=store.owned('journeys',journeyId,u['id'])
            if not row or not row['public_slug'] or not row['public_data']:
                return dict(view=view,enabled=False,nodes=[],edges=[],pathCount=0)
            target=json.loads(row['public_data'])
        with store.connect() as db:
            rows=db.execute('SELECT owner,public_data FROM journeys WHERE public_slug IS NOT NULL AND public_data IS NOT NULL ORDER BY updated DESC LIMIT 500').fetchall()
        projections=[]
        for row in rows:
            projection=json.loads(row['public_data'])
            if target is not None and (row['owner']==u['id'] or similarity(target,projection)[0]<=0):
                continue
            projections.append(projection)
        return dict(view=view,enabled=True,**aggregate_trails(projections))

    def visible_anchor(db,aid,uid):
        row=db.execute("SELECT a.*,u.alias FROM anchors a JOIN users u ON a.owner=u.id WHERE a.id=? AND (a.owner=? OR (a.visibility='public' AND a.status='approved'))",(aid,uid)).fetchone()
        if not row:
            raise HTTPException(404,'锚点不存在或尚未公开。')
        return row

    def anchor_view(db,row,uid):
        counts=db.execute('SELECT count(read_at) AS readers,coalesce(sum(resonance),0) AS resonance FROM anchor_interactions WHERE anchor_id=?',(row['id'],)).fetchone()
        mine=db.execute('SELECT resonance FROM anchor_interactions WHERE anchor_id=? AND owner=?',(row['id'],uid)).fetchone()
        comments=db.execute('SELECT count(*) FROM anchor_comments WHERE anchor_id=?',(row['id'],)).fetchone()[0]
        return dict(id=row['id'],text=row['text'],topic=row['topic'],alias=row['alias'],own=row['owner']==uid,status=row['status'],visibility=row['visibility'],created=row['created'],readCount=counts['readers'],resonance=counts['readers']+counts['resonance'],myResonance=mine[0] if mine else 0,commentCount=comments)

    @app.post('/api/anchors')
    def anchor_create(payload:AnchorInput,u=Depends(user)):
        if not store.rate('anchor:'+u['id'],6):
            raise HTTPException(429,'记录得太频繁了，请稍后再试。')
        world=owned_world(payload.worldId,u['id'])
        node=next((n for n in world['nodes'] if n['id']==payload.nodeId),None)
        if not node:
            raise HTTPException(404,'话题不存在。')
        aid=secrets.token_hex(12)
        state='pending' if payload.visibility=='public' else 'private'
        with store.connect(True) as db:
            db.execute('INSERT INTO anchors VALUES(?,?,?,?,?,?,?,?,?)',(aid,u['id'],payload.worldId,payload.nodeId,node['title'],payload.text,payload.visibility,state,time.time()))
        return {'id':aid,'status':state,'visibility':payload.visibility}

    @app.get('/api/anchors')
    def anchors(topic:str='',u=Depends(user)):
        topic=topic[:180]
        with store.connect() as db:
            rows=db.execute("SELECT a.*,u.alias FROM anchors a JOIN users u ON a.owner=u.id WHERE a.topic=? AND (a.owner=? OR (a.visibility='public' AND a.status='approved')) ORDER BY coalesce((SELECT sum((i.read_at IS NOT NULL)+i.resonance) FROM anchor_interactions i WHERE i.anchor_id=a.id),0) DESC,a.created DESC LIMIT 60",(topic,u['id'])).fetchall()
            return [anchor_view(db,row,u['id']) for row in rows]

    @app.post('/api/anchors/{aid}/read')
    def anchor_read(aid:str,u=Depends(user)):
        if not store.rate('anchor-read:'+u['id'],60):
            raise HTTPException(429,'阅读请求过于频繁，请稍后再试。')
        with store.connect(True) as db:
            row=visible_anchor(db,aid,u['id'])
            changed=0
            if row['owner']!=u['id']:
                changed=db.execute('INSERT INTO anchor_interactions(anchor_id,owner,read_at) VALUES(?,?,?) ON CONFLICT(anchor_id,owner) DO UPDATE SET read_at=excluded.read_at WHERE anchor_interactions.read_at IS NULL',(aid,u['id'],time.time())).rowcount
            return dict(anchor_view(db,row,u['id']),read=bool(changed))

    @app.post('/api/anchors/{aid}/resonate')
    def anchor_resonate(aid:str,u=Depends(user)):
        if not store.rate('anchor-resonate:'+u['id'],30):
            raise HTTPException(429,'连鸣过于频繁，请稍后再试。')
        with store.connect(True) as db:
            row=visible_anchor(db,aid,u['id'])
            if row['owner']==u['id']:
                raise HTTPException(403,'不能为自己的锚点连鸣。')
            db.execute('INSERT OR IGNORE INTO anchor_interactions(anchor_id,owner) VALUES(?,?)',(aid,u['id']))
            changed=db.execute('UPDATE anchor_interactions SET resonance=resonance+1 WHERE anchor_id=? AND owner=? AND resonance<3',(aid,u['id'])).rowcount
            if not changed:
                raise HTTPException(409,'你已为这个锚点连鸣 3 次。')
            result=anchor_view(db,row,u['id'])
            text=f"你的锚点在「{row['topic']}」话题被一位同路人连鸣了（第 {result['myResonance']} 次）。"
            event_key=f"resonance:{aid}:{u['id']}"
            db.execute('INSERT INTO notifications(id,owner,actor,anchor_id,topic,text,created,event_key) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(event_key) DO UPDATE SET text=excluded.text,created=excluded.created,read_at=NULL',(hash_id('notification',event_key),row['owner'],u['id'],aid,row['topic'],text,time.time(),event_key))
            return result

    @app.get('/api/anchors/{aid}/comments')
    def anchor_comments(aid:str,u=Depends(user)):
        with store.connect() as db:
            visible_anchor(db,aid,u['id'])
            rows=db.execute('SELECT c.*,u.alias FROM anchor_comments c JOIN users u ON c.owner=u.id WHERE c.anchor_id=? ORDER BY c.created DESC LIMIT 100',(aid,)).fetchall()
            total=db.execute('SELECT count(*) FROM anchor_comments WHERE anchor_id=?',(aid,)).fetchone()[0]
        return dict(items=[dict(id=r['id'],text=r['text'],alias=r['alias'],own=r['owner']==u['id'],created=r['created']) for r in rows],total=total)

    @app.post('/api/anchors/{aid}/comments')
    def anchor_comment(aid:str,payload:CommentInput,u=Depends(user)):
        if not store.rate('anchor-comment:'+u['id'],6):
            raise HTTPException(429,'评论过于频繁，请稍后再试。')
        cid,created=secrets.token_hex(12),time.time()
        with store.connect(True) as db:
            anchor=visible_anchor(db,aid,u['id'])
            duplicate=db.execute('SELECT id FROM anchor_comments WHERE anchor_id=? AND owner=? AND text=? AND created>?',(aid,u['id'],payload.text,created-60)).fetchone()
            if duplicate:
                raise HTTPException(409,'这条评论刚刚已经留下了。')
            db.execute('INSERT INTO anchor_comments VALUES(?,?,?,?,?)',(cid,aid,u['id'],payload.text,created))
            if anchor['owner']!=u['id']:
                event_key='comment:'+cid
                excerpt=payload.text[:80]+('…' if len(payload.text)>80 else '')
                text=f"你在「{anchor['topic']}」留下的锚点收到一位同路人的回应：「{excerpt}」"
                db.execute('INSERT OR IGNORE INTO notifications(id,owner,actor,anchor_id,topic,text,created,event_key) VALUES(?,?,?,?,?,?,?,?)',(hash_id('notification',event_key),anchor['owner'],u['id'],aid,anchor['topic'],text,created,event_key))
        return dict(id=cid,text=payload.text,alias=u['alias'],own=True,created=created)

    @app.get('/api/notifications')
    def notifications(u=Depends(user)):
        with store.connect() as db:
            rows=db.execute('SELECT * FROM notifications WHERE owner=? ORDER BY created DESC LIMIT 100',(u['id'],)).fetchall()
            unread=db.execute('SELECT count(*) FROM notifications WHERE owner=? AND read_at IS NULL',(u['id'],)).fetchone()[0]
        return dict(items=[dict(id=r['id'],anchorId=r['anchor_id'],topic=r['topic'],text=r['text'],created=r['created'],read=r['read_at'] is not None) for r in rows],unread=unread)

    @app.post('/api/notifications/read')
    def notifications_read(payload:NotificationReadInput,u=Depends(user)):
        with store.connect(True) as db:
            if payload.ids:
                placeholders=','.join('?' for _ in payload.ids)
                changed=db.execute(f'UPDATE notifications SET read_at=? WHERE owner=? AND read_at IS NULL AND id IN ({placeholders})',(time.time(),u['id'],*payload.ids)).rowcount
            else:
                changed=db.execute('UPDATE notifications SET read_at=? WHERE owner=? AND read_at IS NULL',(time.time(),u['id'])).rowcount
        return dict(read=changed)

    @app.delete('/api/anchors/{aid}')
    def anchor_delete(aid:str,u=Depends(user)):
        with store.connect(True) as db:
            n=db.execute('DELETE FROM anchors WHERE id=? AND owner=?',(aid,u['id'])).rowcount
            if n:
                for table in ('reports','anchor_interactions','anchor_comments','notifications'):
                    db.execute(f'DELETE FROM {table} WHERE anchor_id=?',(aid,))
        if not n:
            raise HTTPException(404,'锚点不存在。')
        return {'deleted':True}

    @app.post('/api/anchors/{aid}/report')
    def anchor_report(aid:str,payload:ReportInput,u=Depends(user)):
        with store.connect(True) as db:
            row=db.execute('SELECT 1 FROM anchors WHERE id=? AND visibility=\'public\' AND status=\'approved\'',(aid,)).fetchone()
            if not row:
                raise HTTPException(404,'锚点不存在。')
            db.execute('INSERT OR REPLACE INTO reports VALUES(?,?,?,?)',(aid,u['id'],payload.reason,time.time()))
        return {'reported':True}

    @app.post('/api/admin/anchors/{aid}/approve')
    def anchor_approve(aid:str,request:Request):
        given=request.headers.get('authorization','').removeprefix('Bearer ')
        if not cfg.admin_token or not secrets.compare_digest(given,cfg.admin_token):
            raise HTTPException(403,'需要管理员授权。')
        with store.connect(True) as db:
            n=db.execute('UPDATE anchors SET status=\'approved\' WHERE id=? AND visibility=\'public\'',(aid,)).rowcount
        if not n:
            raise HTTPException(404,'待审核公开锚点不存在。')
        return {'approved':True}

    @app.delete('/api/me/data')
    def erase(response:Response,u=Depends(user)):
        store.erase_user(u['id'])
        response.delete_cookie('zhiye_session',path='/')
        return {'deleted':True,'notice':'本应用的私有与公开记录均已删除；浏览器本地备份需同时清除。'}

    @app.get('/')
    def index():
        return FileResponse(ROOT/'web/index.html')

    three=ROOT/'node_modules/three'
    if three.is_dir():
        app.mount('/vendor/three',StaticFiles(directory=str(three)),name='three')
    app.mount('/static',StaticFiles(directory=str(ROOT/'web')),name='static')
    return app


app=create_app()
