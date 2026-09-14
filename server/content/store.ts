import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApiError } from '../galaxy/zhihu.js';
import type { ContentItem, ContentResponse } from './types.js';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Public source snapshots only. Private notes and generated drafts never enter this DB. */
export class ContentStore {
  readonly db: DatabaseSync;
  constructor(path: string, private readonly now = Date.now) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS public_cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS source_items (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS budgets (day TEXT NOT NULL, scope TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day,scope));
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  close() { this.db.close(); }
  get(key: string): ContentResponse | undefined {
    const row = this.db.prepare('SELECT payload FROM public_cache WHERE key=?').get(key);
    if (!row) return undefined;
    try { return { ...JSON.parse(String(row.payload)), cached: true }; } catch { return undefined; }
  }
  put(key: string, value: ContentResponse) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT OR REPLACE INTO public_cache VALUES(?,?,?)').run(key, JSON.stringify(value), value.fetchedAt);
      for (const item of value.items) {
        const previous = this.source(item.id);
        const merged = previous ? { ...item, author: item.author === '作者未提供' ? previous.author : item.author, title: item.title === '知乎作者的回答' ? previous.title : item.title } : item;
        this.db.prepare('INSERT OR REPLACE INTO source_items VALUES(?,?)').run(item.id, JSON.stringify(merged));
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  source(id: string): ContentItem | undefined {
    const row = this.db.prepare('SELECT payload FROM source_items WHERE id=?').get(id);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  reserve(kind: 'search' | 'ai', actor: string, globalLimit: number, actorLimit: number) {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const scopes = [[`${kind}:global`, globalLimit], [`${kind}:${digest(actor)}`, actorLimit]] as const;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const [scope, limit] of scopes) {
        const current = this.db.prepare('SELECT count FROM budgets WHERE day=? AND scope=?').get(day, scope);
        if (Number(current?.count ?? 0) >= limit) throw new ApiError(429, 'DAILY_BUDGET_EXHAUSTED', `${kind === 'ai' ? 'AI 合成' : '实时检索'}的今日应用预算已用完，已有内容仍可使用。`);
      }
      for (const [scope] of scopes) this.db.prepare('INSERT INTO budgets VALUES(?,?,1) ON CONFLICT(day,scope) DO UPDATE SET count=count+1').run(day, scope);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  session(token: string): string | undefined {
    const row = this.db.prepare('SELECT code_hash FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token), this.now());
    return row ? String(row.code_hash) : undefined;
  }
  issueSession(token: string, codeHash: string, expiresAt: number) {
    this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(this.now());
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token), codeHash, expiresAt);
  }
}
