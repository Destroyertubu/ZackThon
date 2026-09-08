"""SQLite/WAL repository, per-transaction connections and atomic budget reservations.

A single-process hackathon deployment is deliberate. No counter or cached private
result is keyed only by a client-supplied user ID.
"""
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
import hashlib
import json
import secrets
import sqlite3
import time


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':'))


def day_key():
    return datetime.now(timezone(timedelta(hours=8))).date().isoformat()


class Store:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS users (
                  id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL,
                  alias TEXT NOT NULL, created REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS worlds (
                  id TEXT PRIMARY KEY, owner TEXT NOT NULL,
                  data TEXT NOT NULL, updated REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS worlds_owner ON worlds(owner);
                CREATE TABLE IF NOT EXISTS journeys (
                  id TEXT PRIMARY KEY, owner TEXT NOT NULL, world_id TEXT NOT NULL,
                  revision INTEGER NOT NULL, data TEXT NOT NULL,
                  public_slug TEXT UNIQUE, public_data TEXT, updated REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS journeys_owner ON journeys(owner);
                CREATE TABLE IF NOT EXISTS anchors (
                  id TEXT PRIMARY KEY, owner TEXT NOT NULL, world_id TEXT NOT NULL,
                  node_id TEXT NOT NULL, topic TEXT NOT NULL, text TEXT NOT NULL,
                  visibility TEXT NOT NULL, status TEXT NOT NULL, created REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reports (
                  anchor_id TEXT NOT NULL, owner TEXT NOT NULL, reason TEXT NOT NULL,
                  created REAL NOT NULL, PRIMARY KEY(anchor_id, owner)
                );
                CREATE TABLE IF NOT EXISTS anchor_interactions (
                  anchor_id TEXT NOT NULL, owner TEXT NOT NULL,
                  read_at REAL, resonance INTEGER NOT NULL DEFAULT 0 CHECK(resonance BETWEEN 0 AND 3),
                  PRIMARY KEY(anchor_id, owner)
                );
                CREATE TABLE IF NOT EXISTS anchor_comments (
                  id TEXT PRIMARY KEY, anchor_id TEXT NOT NULL, owner TEXT NOT NULL,
                  text TEXT NOT NULL, created REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS anchor_comments_anchor ON anchor_comments(anchor_id,created);
                CREATE TABLE IF NOT EXISTS notifications (
                  id TEXT PRIMARY KEY, owner TEXT NOT NULL, actor TEXT NOT NULL,
                  anchor_id TEXT NOT NULL, topic TEXT NOT NULL, text TEXT NOT NULL,
                  created REAL NOT NULL, read_at REAL,
                  event_key TEXT NOT NULL UNIQUE
                );
                CREATE INDEX IF NOT EXISTS notifications_owner ON notifications(owner,created);
                CREATE TABLE IF NOT EXISTS cache (
                  key TEXT PRIMARY KEY, data TEXT NOT NULL, expires REAL NOT NULL,
                  saved_at REAL
                );
                CREATE TABLE IF NOT EXISTS quotas (
                  day TEXT NOT NULL, scope TEXT NOT NULL, count INTEGER NOT NULL,
                  PRIMARY KEY(day, scope)
                );
                CREATE TABLE IF NOT EXISTS rates (
                  bucket TEXT NOT NULL, scope TEXT NOT NULL, count INTEGER NOT NULL,
                  PRIMARY KEY(bucket, scope)
                );
            ''')
        # Before comment notifications, all events from an actor on an anchor
        # shared a row. Keep those IDs/read states while allowing each comment
        # its own stable event key. The table swap is atomic for existing DBs.
        with self.connect(True) as db:
            cache_columns={row['name'] for row in db.execute('PRAGMA table_info(cache)')}
            if 'saved_at' not in cache_columns:
                # Retain every legacy result, including expired ones. The new
                # default can reuse them without spending another API request.
                db.execute('ALTER TABLE cache ADD COLUMN saved_at REAL')
            columns={row['name'] for row in db.execute('PRAGMA table_info(notifications)')}
            if 'event_key' not in columns:
                db.execute('ALTER TABLE notifications RENAME TO notifications_legacy')
                db.execute('''CREATE TABLE notifications (
                  id TEXT PRIMARY KEY, owner TEXT NOT NULL, actor TEXT NOT NULL,
                  anchor_id TEXT NOT NULL, topic TEXT NOT NULL, text TEXT NOT NULL,
                  created REAL NOT NULL, read_at REAL, event_key TEXT NOT NULL UNIQUE
                )''')
                db.execute("INSERT INTO notifications SELECT id,owner,actor,anchor_id,topic,text,created,read_at,'resonance:'||anchor_id||':'||actor FROM notifications_legacy")
                db.execute('DROP TABLE notifications_legacy')
                db.execute('CREATE INDEX notifications_owner ON notifications(owner,created)')

    @contextmanager
    def connect(self, write=False):
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        db.row_factory = sqlite3.Row
        try:
            if write:
                db.execute('BEGIN IMMEDIATE')
            yield db
            if write:
                db.commit()
        except Exception:
            if write:
                db.rollback()
            raise
        finally:
            db.close()

    def new_user(self):
        token, uid = secrets.token_urlsafe(32), secrets.token_hex(12)
        alias = '旅人 ' + uid[:4].upper()
        with self.connect(True) as db:
            db.execute('INSERT INTO users VALUES(?,?,?,?)', (uid, hashlib.sha256(token.encode()).hexdigest(), alias, time.time()))
        return token, {'id': uid, 'alias': alias}

    def authenticate(self, token):
        if not token or len(token) > 128:
            return None
        with self.connect() as db:
            row = db.execute('SELECT id,alias FROM users WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
            return dict(row) if row else None

    def owned(self, table, item_id, owner):
        if table not in {'worlds', 'journeys'}:
            raise ValueError('unknown table')
        with self.connect() as db:
            row = db.execute(f'SELECT * FROM {table} WHERE id=? AND owner=?', (item_id, owner)).fetchone()
            return dict(row) if row else None

    def cache_get(self, key, ttl=0):
        """Local-first by default; a positive TTL explicitly requests freshness.

        `expires` remains for old databases. New writes record their timestamp so
        opting into a TTL later also works for previously permanent entries.
        Legacy cards already contain retrievedAt; use that when available, and
        otherwise respect the legacy expiry for a positive-TTL request.
        """
        with self.connect() as db:
            row = db.execute('SELECT data,expires,saved_at FROM cache WHERE key=?', (key,)).fetchone()
        if row is None:
            return None
        data=json.loads(row['data'])
        if ttl>0:
            saved_at=row['saved_at']
            if saved_at is None and isinstance(data,list):
                timestamps=[item['retrievedAt'] for item in data if isinstance(item,dict)
                            and isinstance(item.get('retrievedAt'),(int,float)) and item['retrievedAt']>0]
                saved_at=min(timestamps) if timestamps else None
            deadline=saved_at+ttl if saved_at is not None else row['expires']
            if deadline<=time.time():
                return None
        return data

    def cache_set(self, key, data, ttl=0):
        now=time.time()
        with self.connect(True) as db:
            # Never purge other queries just because their former TTL elapsed.
            db.execute('INSERT OR REPLACE INTO cache(key,data,expires,saved_at) VALUES(?,?,?,?)',
                       (key,dump(data),now+ttl if ttl>0 else 0,now))

    def reserve_quota(self, scope, limit):
        """Reserve before each upstream attempt; concurrent sessions share developer budget."""
        day = day_key()
        with self.connect(True) as db:
            db.execute('INSERT OR IGNORE INTO quotas VALUES(?,?,0)', (day, scope))
            changed = db.execute('UPDATE quotas SET count=count+1 WHERE day=? AND scope=? AND count<?', (day, scope, limit)).rowcount
            if not changed:
                return False
            db.execute('DELETE FROM quotas WHERE day<?', ((datetime.now(timezone.utc)-timedelta(days=35)).date().isoformat(),))
            return True

    def quota_count(self, scope):
        with self.connect() as db:
            row = db.execute('SELECT count FROM quotas WHERE day=? AND scope=?', (day_key(), scope)).fetchone()
            return row[0] if row else 0

    def rate(self, scope, limit=60, period=60):
        bucket = str(int(time.time()) // period)
        with self.connect(True) as db:
            db.execute('DELETE FROM rates WHERE CAST(bucket AS INTEGER)<?', (int(bucket)-3,))
            db.execute('INSERT OR IGNORE INTO rates VALUES(?,?,0)', (bucket, scope))
            return bool(db.execute('UPDATE rates SET count=count+1 WHERE bucket=? AND scope=? AND count<?', (bucket, scope, limit)).rowcount)

    def erase_user(self, uid):
        with self.connect(True) as db:
            for table in ('anchor_interactions','anchor_comments','notifications'):
                db.execute(f'DELETE FROM {table} WHERE anchor_id IN (SELECT id FROM anchors WHERE owner=?)', (uid,))
                db.execute(f'DELETE FROM {table} WHERE owner=?', (uid,))
            db.execute('DELETE FROM notifications WHERE actor=?', (uid,))
            db.execute('DELETE FROM reports WHERE anchor_id IN (SELECT id FROM anchors WHERE owner=?)', (uid,))
            for table in ('worlds', 'journeys', 'anchors', 'reports'):
                db.execute(f'DELETE FROM {table} WHERE owner=?', (uid,))
            db.execute('DELETE FROM quotas WHERE scope=?', ('guest:'+uid,))
            db.execute('DELETE FROM users WHERE id=?', (uid,))
