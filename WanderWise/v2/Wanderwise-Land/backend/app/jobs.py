from __future__ import annotations
import os,time,threading
from concurrent.futures import ThreadPoolExecutor
from . import db, providers, worldgen
from .errors import AppError
from .security import owned,expect,rate,digest

pool=ThreadPoolExecutor(max_workers=2,thread_name_prefix='ww-job')

def public(row):
    return {'id':row['id'],'jobId':row['id'],'type':row['type'],'status':row['status'],'stage':row['stage'],
            'result':db.loads(row['result']),'error':db.loads(row['error']),'createdAt':row['created_at'],'updatedAt':row['updated_at']}

def begin(owner,kind,body,key):
    if not 8<=len(key)<=160: raise AppError('VALIDATION_ERROR','任务需要有效 Idempotency-Key。',422)
    rh=digest(kind+db.dumps(body))
    with db.tx() as c:
        old=c.execute('SELECT * FROM jobs WHERE owner=? AND idem=?',(owner,key)).fetchone()
        if old:
            if old['request_hash']!=rh: raise AppError('IDEMPOTENCY_CONFLICT','任务标识已用于不同请求。',409)
            return public(old)
        group=('world',) if kind=='world' else ('expand','field','synthesis')
        pending=c.execute('SELECT type FROM jobs WHERE owner=? AND status IN (\'queued\',\'running\')',(owner,)).fetchall()
        if any(x['type'] in group for x in pending): raise AppError('RATE_LIMITED','当前有同类任务正在处理，请等待现有任务结束。',429)
        if c.execute("SELECT COUNT(*) FROM jobs WHERE status IN ('queued','running')").fetchone()[0]>=24:
            raise AppError('RATE_LIMITED','生成队列暂满，请稍后再试。',429)
        count=c.execute('SELECT COUNT(*) FROM jobs WHERE owner=? AND type=? AND created_at>?',(owner,kind,__import__('datetime').datetime.fromtimestamp(time.time()-3600,__import__('datetime').timezone.utc).isoformat().replace('+00:00','Z'))).fetchone()[0]
        if count>=int(os.environ.get('WW_HOURLY_TASK_LIMIT','10')): raise AppError('RATE_LIMITED','本小时生成次数已达上限，请使用已有记录。',429)
        id=db.uid('job_');stamp=db.now()
        c.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',(id,owner,kind,'queued','queued',db.dumps(body),None,None,key,rh,stamp,stamp,None))
        row=c.execute('SELECT * FROM jobs WHERE id=?',(id,)).fetchone()
    pool.submit(run,id)
    return public(row)

def stage(id,value):
    with db.tx() as c:
        row=c.execute('SELECT status FROM jobs WHERE id=?',(id,)).fetchone()
        if not row or row['status']=='cancelled': raise AppError('CANCELLED','任务已取消。',409)
        c.execute("UPDATE jobs SET status='running',stage=?,updated_at=?,lease_until=? WHERE id=?",(value,db.now(),time.time()+45,id))

def check_cancel(c,id):
    r=c.execute('SELECT status FROM jobs WHERE id=?',(id,)).fetchone()
    if not r or r['status']=='cancelled': raise AppError('CANCELLED','任务已取消。',409)

def finish(c,id,result):
    check_cancel(c,id)
    c.execute("UPDATE jobs SET status='succeeded',stage='done',result=?,updated_at=? WHERE id=?",(db.dumps(result),db.now(),id))

def run(id):
    try:
        row=db.one('SELECT * FROM jobs WHERE id=?',(id,))
        if not row: return
        owner=row['owner'];b=db.loads(row['input']);kind=row['type']
        if kind=='world':
            stage(id,'retrieving')
            if b['seedMode'] in ('demo','preset'):
                preset=db.one('SELECT payload FROM presets WHERE id=?',(b.get('presetId') or 'demo-growth',))
                if not preset: raise AppError('NOT_FOUND','所选路线不存在。',404)
                p=db.loads(preset['payload'])
                if b['seedMode']=='preset' and p['dataMode']=='demo': raise AppError('VALIDATION_ERROR','演示路线必须明确选择 demo 模式。',422)
                cs=[worldgen.content(cid) for cid in p['contentIds']];mode=p['dataMode'];at=p['sourceFetchedAt'];seed=b.get('seedText') or p['seedText']
            elif b['seedMode']=='knowledge':
                cs,mode,at=providers.knowledge(b.get('presetId') or ''); seed=b.get('seedText') or cs[0]['title'][:100]
            else:
                seed=b.get('seedText') or ''
                cs,mode,at=providers.search(seed)
            stage(id,'structuring');w=worldgen.create(seed,cs,mode,at)
            stage(id,'layout');jid=db.uid('journey_')
            cp={'worldVersion':1,'scene':'world','position':w['spawn']['position'],'yaw':0,'camera':{'yaw':0,'pitch':.25,'distance':5},'trackedNodeId':None,'navigationMode':0,'returnContext':None,'fieldId':None}
            with db.tx() as c:
                check_cancel(c,id)
                c.execute("UPDATE journeys SET status='paused',version=version+1,lease_client=NULL,lease_until=0 WHERE owner=? AND status='active'",(owner,))
                c.execute('INSERT INTO worlds VALUES(?,?,?,?,?)',(w['worldId'],owner,1,db.dumps(w),db.now()))
                c.execute('INSERT INTO world_versions VALUES(?,?,?)',(w['worldId'],1,db.dumps(w)))
                c.execute('INSERT INTO journeys(id,owner,world_id,status,checkpoint,started_at) VALUES(?,?,?,?,?,?)',(jid,owner,w['worldId'],'active',db.dumps(cp),db.now()))
                finish(c,id,{'worldId':w['worldId'],'journeyId':jid})
        elif kind=='expand':
            stage(id,'retrieving');r=owned('worlds',b['worldId'],owner);expect(r,b['expectedVersion']);w=db.loads(r['payload'])
            p=next((n for n in w['nodes'] if n['id']==b['nodeId']),None)
            if not p: raise AppError('NOT_FOUND','话题不存在。',404)
            if p['expansionState'] in ('expanded','exhausted') or len(w['nodes'])>=50:
                with db.tx() as c: finish(c,id,{'worldId':w['worldId'],'alreadyExpanded':True})
                return
            if w['dataMode']=='demo':
                cs=[db.loads(x['payload']) for x in db.all("SELECT payload FROM contents WHERE provider='demo'")];mode='demo';at=w['sourceFetchedAt']
            else:
                cs,mode,at=providers.search(p['title'])
            stage(id,'layout');result=worldgen.expand(w,p['id'],cs,mode,at)
            with db.tx() as c:
                current=owned('worlds',w['worldId'],owner,c);expect(current,b['expectedVersion']);check_cancel(c,id)
                if not c.execute("SELECT id FROM journeys WHERE owner=? AND world_id=? AND status='active'",(owner,w['worldId'])).fetchone():raise AppError('FORBIDDEN','旅程已暂停或归档，未提交迟到扩展。',403)
                c.execute('UPDATE worlds SET version=?,payload=? WHERE id=?',(w['version'],db.dumps(w),w['worldId']))
                c.execute('INSERT INTO world_versions VALUES(?,?,?)',(w['worldId'],w['version'],db.dumps(w)))
                j=c.execute("SELECT id FROM journeys WHERE owner=? AND world_id=? AND status='active'",(owner,w['worldId'])).fetchone()
                db.emit(c,j['id'] if j else None,'world_expanded',p['topicId'],{'newNodes':len(result['newNodes'])})
                finish(c,id,result)
        elif kind=='field':
            stage(id,'structuring');ct=worldgen.content(b['contentId'],b['snapshotId']);f=worldgen.field(ct)
            with db.tx() as c:
                check_cancel(c,id)
                c.execute('INSERT OR IGNORE INTO fields VALUES(?,?,?,?)',(f['id'],ct['id'],ct['snapshotId'],db.dumps(f)))
                finish(c,id,{'fieldId':f['id']})
        elif kind=='synthesis':
            stage(id,'checking_sources')
            ids=sorted(set(b['bagItemIds']))
            if not 2<=len(ids)<=4: raise AppError('VALIDATION_ERROR','需要 2–4 份不同材料。',422)
            mats=[]
            for bid in ids:
                br=owned('bag',bid,owner);m=db.loads(br['payload'])
                if br['target_type']=='topic' or not m.get('text'): raise AppError('CONTENT_INSUFFICIENT','话题词本身不是证据，请选择内容或摘录。',422)
                mats.append({'id':bid,'version':br['version'],'title':m['title'],'text':m['text'][:2000],'authorName':m['authorName'],
                             'sourceUrl':m.get('sourceUrl'),'sourceLabel':m['sourceLabel'],'kind':m['kind'],'snapshotId':m.get('snapshotId'),
                             'contentId':m.get('contentId'),'evidenceChain':m.get('evidenceChain',[]),'dataMode':m['dataMode']})
            sig=digest(db.dumps({'materials':mats,'question':b['question'],'mode':b['mode'],'promptVersion':'1'}))
            previous=db.one('SELECT * FROM insights WHERE owner=? AND json_extract(payload,\'$.signature\')=? ORDER BY created_at DESC LIMIT 1',(owner,sig))
            if previous:
                with db.tx() as c: finish(c,id,{'synthesisId':previous['id'],'cached':True})
                return
            if b['mode']=='ai':
                stage(id,'generating');result=providers.ai_synthesis(mats,b['question']);generator='zhihu-ai'
            else:
                result={'title':'在两份收获之间','coreInsight':'','connection':'','uncertainty':'请核对两份材料适用的条件，并写下尚未确定的部分。','questions':[],'evidenceIds':ids}
                generator='user'
            sid=db.uid('insight_');payload={'id':sid,'materials':mats,'question':b['question'],'result':result,'generator':generator,
                'signature':sig,'status':'draft','generationVersion':'1','dataMode':'demo' if any(m['dataMode']=='demo' for m in mats) else 'cached',
                'createdAt':db.now()}
            with db.tx() as c:
                check_cancel(c,id)
                c.execute('INSERT INTO insights VALUES(?,?,?,?,?)',(sid,owner,db.dumps(payload),'draft',db.now()))
                finish(c,id,{'synthesisId':sid,'cached':False})
    except AppError as e:
        with db.tx() as c:
            c.execute("UPDATE jobs SET status='failed',stage='failed',error=?,updated_at=? WHERE id=? AND status!='cancelled'",(db.dumps(e.public()),db.now(),id))
    except Exception:
        # Do not print upstream headers, bodies, private material or credential-bearing exceptions.
        with db.tx() as c:
            c.execute("UPDATE jobs SET status='failed',stage='failed',error=?,updated_at=? WHERE id=? AND status!='cancelled'",(db.dumps({'code':'INTERNAL_ERROR','message':'任务未能完成，请查看脱敏诊断或显式重试。','retryable':True}),db.now(),id))
