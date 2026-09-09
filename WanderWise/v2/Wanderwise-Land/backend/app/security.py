from __future__ import annotations
import hashlib, hmac, os, secrets, time
from fastapi import Request
from . import db
from .errors import AppError

def digest(text:str): return hashlib.sha256(text.encode()).hexdigest()
def session(request:Request):
    raw=request.cookies.get('ww_session','')
    row=db.one('SELECT * FROM sessions WHERE hash=? AND expires>?',(digest(raw),time.time())) if raw else None
    if not row: raise AppError('SESSION_EXPIRED','访客会话已过期。本机草稿仍可保留，请重新开始游客会话。',401)
    return row

def check_origin(request:Request):
    origin=request.headers.get('origin','').rstrip('/')
    expected=os.environ.get('APP_ORIGIN','').rstrip('/') or str(request.base_url).rstrip('/')
    # Browser writes always require an exact same-origin value. No CORS wildcard.
    if not origin or origin!=expected:
        raise AppError('FORBIDDEN','请求来源不匹配。',403)

def write_session(request:Request):
    check_origin(request)
    row=session(request)
    if not hmac.compare_digest(request.headers.get('x-csrf-token',''),row['csrf']):
        raise AppError('FORBIDDEN','安全校验失效，请刷新页面后重试。',403)
    return row

def rate(bucket:str,limit:int,seconds:int):
    slot=int(time.time()//seconds)
    key=f'{bucket}:{slot}'
    with db.tx() as c:
        row=c.execute('SELECT count FROM budgets WHERE bucket=?',(key,)).fetchone()
        if row and row['count']>=limit: raise AppError('RATE_LIMITED','操作过于频繁，请使用已有路线或稍后再试。',429)
        c.execute('INSERT INTO budgets VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1',(key,(slot+1)*seconds))

def owned(table:str,id:str,owner:str,c=None):
    if table not in {'worlds','journeys','bag','anchors','insights','jobs','links'}: raise ValueError('invalid table')
    row=(c.execute(f'SELECT * FROM {table} WHERE id=? AND owner=?',(id,owner)).fetchone() if c else db.one(f'SELECT * FROM {table} WHERE id=? AND owner=?',(id,owner)))
    if not row: raise AppError('NOT_FOUND','记录不存在或不属于当前访客。',404)
    return row

def expect(row,v:int):
    if row['version']!=v: raise AppError('VERSION_CONFLICT','另一标签页修改了此记录；已保留你的输入，请重新加载最新版本。',409,details={'currentVersion':row['version']})

def mutation(request:Request,owner:str,body,fn):
    key=request.headers.get('idempotency-key','')
    if not 8<=len(key)<=160: raise AppError('VALIDATION_ERROR','写入需要有效 Idempotency-Key。',422)
    rh=digest(request.method+request.url.path+db.dumps(body))
    with db.tx() as c:
        old=c.execute('SELECT * FROM mutations WHERE owner=? AND idem=?',(owner,key)).fetchone()
        if old:
            if old['request_hash']!=rh: raise AppError('IDEMPOTENCY_CONFLICT','同一操作标识不能用于不同的请求。',409)
            return db.loads(old['response'])
        out=fn(c)
        c.execute('INSERT INTO mutations VALUES(?,?,?,?,?)',(owner,key,rh,db.dumps(out),time.time()))
        return out
