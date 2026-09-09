"""Single-instance SQLite persistence. Every acknowledged write is committed before reply."""
from __future__ import annotations
import contextlib, json, os, sqlite3, threading, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_LOCK = threading.RLock()
def now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
def uid(prefix: str = '') -> str:
    return prefix + uuid.uuid4().hex
def dumps(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
def loads(value):
    return json.loads(value) if value else None

def path() -> Path:
    p = Path(os.environ.get('WANDERWISE_DB', str(ROOT / 'data' / 'wanderwise.sqlite3')))
    p.parent.mkdir(parents=True, exist_ok=True)
    return p

def connect() -> sqlite3.Connection:
    c = sqlite3.connect(path(), timeout=15, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    c.execute('PRAGMA busy_timeout=15000')
    return c

@contextlib.contextmanager
def tx():
    with _LOCK, contextlib.closing(connect()) as c:
        c.execute('BEGIN IMMEDIATE')
        try:
            yield c
            c.commit()
        except BaseException:
            c.rollback()
            raise

def one(sql: str, args=()):
    with contextlib.closing(connect()) as c:
        return c.execute(sql, args).fetchone()
def all(sql: str, args=()):
    with contextlib.closing(connect()) as c:
        return c.execute(sql, args).fetchall()

def init():
    with contextlib.closing(connect()) as c:
        c.execute('PRAGMA journal_mode=WAL')
        c.execute('PRAGMA synchronous=FULL')
        c.executescript('''
        CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL);
        INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_version);
        CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, last_seen REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          csrf TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS worlds(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          version INTEGER NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS world_versions(world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
          version INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(world_id,version));
        CREATE TABLE IF NOT EXISTS journeys(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE, status TEXT NOT NULL CHECK(status IN ('active','paused','completed')),
          version INTEGER NOT NULL DEFAULT 1, checkpoint TEXT NOT NULL, started_at TEXT NOT NULL, completed_at TEXT,
          lease_client TEXT, lease_until REAL NOT NULL DEFAULT 0);
        CREATE UNIQUE INDEX IF NOT EXISTS one_active ON journeys(owner) WHERE status='active';
        CREATE TABLE IF NOT EXISTS events(journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
          event_id TEXT NOT NULL, seq INTEGER NOT NULL, type TEXT NOT NULL, topic_id TEXT, payload TEXT NOT NULL,
          occurred_at TEXT NOT NULL, received_at TEXT NOT NULL, PRIMARY KEY(journey_id,event_id), UNIQUE(journey_id,seq));
        CREATE TABLE IF NOT EXISTS contents(id TEXT PRIMARY KEY, provider TEXT NOT NULL, source_type TEXT NOT NULL,
          external_id TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(provider,source_type,external_id));
        CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES contents(id),
          payload TEXT NOT NULL, content_hash TEXT NOT NULL, fetched_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS fields(id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES contents(id),
          snapshot_id TEXT NOT NULL REFERENCES snapshots(id), payload TEXT NOT NULL, UNIQUE(snapshot_id));
        CREATE TABLE IF NOT EXISTS bag(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_type TEXT NOT NULL, target_id TEXT NOT NULL, journey_id TEXT REFERENCES journeys(id) ON DELETE SET NULL,
          payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
          UNIQUE(owner,target_type,target_id));
        CREATE TABLE IF NOT EXISTS links(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          source TEXT NOT NULL REFERENCES bag(id) ON DELETE CASCADE, target TEXT NOT NULL REFERENCES bag(id) ON DELETE CASCADE,
          note TEXT NOT NULL, UNIQUE(owner,source,target), CHECK(source<target));
        CREATE TABLE IF NOT EXISTS anchors(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          journey_id TEXT REFERENCES journeys(id) ON DELETE SET NULL, topic_id TEXT NOT NULL,
          payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS insights(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          payload TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','saved')), created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL, status TEXT NOT NULL, stage TEXT NOT NULL, input TEXT NOT NULL, result TEXT, error TEXT,
          idem TEXT NOT NULL, request_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
          lease_until REAL, UNIQUE(owner,idem));
        CREATE TABLE IF NOT EXISTS mutations(owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          idem TEXT NOT NULL, request_hash TEXT NOT NULL, response TEXT NOT NULL, created_at REAL NOT NULL,
          PRIMARY KEY(owner,idem));
        CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS budgets(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS presets(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS worlds_owner ON worlds(owner);
        CREATE INDEX IF NOT EXISTS bag_owner ON bag(owner);
        CREATE INDEX IF NOT EXISTS anchors_owner ON anchors(owner);
        CREATE INDEX IF NOT EXISTS journeys_owner ON journeys(owner);
        ''')
        # An interrupted chargeable operation is never replayed automatically.
        err = dumps({'code':'INTERRUPTED','message':'服务重启中断了任务；未自动重发上游请求。请检查后显式重试。','retryable':True})
        c.execute("UPDATE jobs SET status='failed',stage='interrupted',error=?,updated_at=? WHERE status IN ('queued','running')", (err, now()))

def emit(c, journey: str | None, kind: str, topic: str | None = None, payload=None, event_id=None, occurred_at=None):
    if not journey:
        return None
    eid = event_id or uid('evt_')
    old = c.execute('SELECT seq FROM events WHERE journey_id=? AND event_id=?', (journey,eid)).fetchone()
    if old:
        return old['seq']
    seq = c.execute('SELECT COALESCE(MAX(seq),0)+1 FROM events WHERE journey_id=?',(journey,)).fetchone()[0]
    c.execute('INSERT INTO events VALUES(?,?,?,?,?,?,?,?)', (journey,eid,seq,kind,topic,dumps(payload or {}),occurred_at or now(),now()))
    return seq

def cleanup():
    cutoff = time.time()-30*86400
    with tx() as c:
        c.execute('DELETE FROM users WHERE last_seen<?',(cutoff,))
        c.execute('DELETE FROM mutations WHERE created_at<?',(time.time()-86400,))
        c.execute('DELETE FROM budgets WHERE expires<?',(time.time(),))
        c.execute("DELETE FROM insights WHERE status='draft' AND created_at<?",(__import__('datetime').datetime.fromtimestamp(time.time()-86400,__import__('datetime').timezone.utc).isoformat().replace('+00:00','Z'),))
