import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContentStore } from './store.js';
import { ContentService, normalizeItems } from './service.js';
import { AccessService } from './access.js';
import { SynthesisService } from './synthesis.js';
import { createApp } from '../galaxy/app.js';
import { ZhihuService } from '../galaxy/zhihu.js';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';

const payload = { Code: 0, Data: { Items: [{ Title: '如何观察植物？', Url: 'https://www.zhihu.com/question/123/answer/456', AuthorName: '真实作者', ContentText: '<p>这是上游摘要。</p>', ContentType: 'Answer' }] } };
const context = { visitorId: 'visitor-a' };
const config = { version: 1 as const, cookieSecret: 'a'.repeat(64), inviteCodes: ['a-test-invite-code-with-entropy'] };

test('cache survives restart, source identities remain stable, and explicit refresh consumes a new attempt', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mirror-content-'));
  const file = join(dir, 'content.sqlite3');
  let calls = 0;
  let store = new ContentStore(file);
  const runner = async () => { calls++; return payload; };
  let service = new ContentService({ store, runner });
  const first = await service.search('植物 摄影', 'zhihu', context);
  assert.equal(first.cached, false);
  assert.equal(first.items[0].id, 'answer-456');
  store.close();
  store = new ContentStore(file);
  service = new ContentService({ store, runner });
  assert.equal((await service.search('植物   摄影', 'zhihu', context)).cached, true);
  assert.equal(calls, 1);
  assert.equal(store.source('answer-456')?.summary, '这是上游摘要。');
  await service.search('植物 摄影', 'zhihu', { ...context, refresh: true });
  assert.equal(calls, 2);
  store.close(); rmSync(dir, { recursive: true });
});

test('parallel identical requests share one upstream attempt and both budgets reserve atomically', async () => {
  const store = new ContentStore(':memory:');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const service = new ContentService({ store, globalLimit: 1, visitorLimit: 1, runner: async () => { calls++; await gate; return payload; } });
  const first = service.search('植物', 'zhihu', context);
  const second = service.search('植物', 'zhihu', { visitorId: 'visitor-b' });
  release();
  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
  assert.throws(() => service.search('山川', 'zhihu', { visitorId: 'visitor-b' }), /预算/);
  const counts = store.db.prepare('SELECT count FROM budgets').all();
  assert.equal(counts.length, 2);
  assert.ok(counts.every((row) => row.count === 1));
  assert.equal((await service.search('植物', 'zhihu', context)).cached, true);
  store.close();
});

test('upstream failure does not manufacture results and an existing cache survives a failed refresh', async () => {
  const store = new ContentStore(':memory:');
  let fail = false;
  const service = new ContentService({ store, runner: async () => { if (fail) throw new Error('provider unavailable'); return payload; } });
  await service.search('植物', 'zhihu', context);
  fail = true;
  await assert.rejects(service.search('植物', 'zhihu', { ...context, refresh: true }));
  assert.equal((await service.search('植物', 'zhihu', context)).items.length, 1);
  assert.equal(store.db.prepare('SELECT count FROM budgets WHERE scope=?').get('search:global')?.count, 2);
  store.close();
});

test('source boundaries preserve summaries, strip markup and reject different question IDs and executable URLs', () => {
  const result = normalizeItems({ Data: { Items: [
    { Url: 'https://www.zhihu.com/question/123/answer/2', Summary: '<script>bad()</script>只有摘要', Author: { Name: '作者' } },
    { Url: 'https://www.zhihu.com/question/999/answer/3', Summary: '另一个问题' },
    { Url: 'javascript:alert(1)', Title: 'bad' },
    { Url: 'https://www.zhihu.com/question/123', Title: '并非回答' },
  ], Paging: { IsEnd: false, NextOffset: 20 } } }, 'zhihu', 'answer_summary', '2026-09-13T00:00:00Z', '123');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].summary, '只有摘要');
  assert.equal(result.items[0].kind, 'answer_summary');
  assert.deepEqual(result.paging, { isEnd: false, nextOffset: 20 });
});

test('malicious shell text stays in one query argument and cannot choose CLI command or URL', async () => {
  const store = new ContentStore(':memory:');
  let args: string[] = [];
  const service = new ContentService({ store, runner: async (value) => { args = value; return payload; } });
  await service.search('--help $(touch /tmp/never) `whoami` ; auth export', 'zhihu', context);
  assert.deepEqual(args.slice(0, 2), ['search', 'zhihu']);
  assert.equal(args[2], '--query=--help $(touch /tmp/never) `whoami` ; auth export');
  assert.equal(args.length, 5);
  assert.throws(() => service.answers('123; whoami', context), /编号/);
  assert.throws(() => service.search('a\nb', 'zhihu', context), /检索词/);
  store.close();
});

test('invite sessions expire, cannot be invented, and cannot be replaced by a local visitor identity', () => {
  let now = 1000;
  const store = new ContentStore(':memory:', () => now);
  const access = new AccessService(store, config, () => now);
  const visitor = access.visitor();
  assert.equal(access.visitor(visitor.cookie).id, visitor.id);
  assert.notEqual(access.visitor(`${visitor.id}.wrong`).id, visitor.id);
  assert.throws(() => access.authorize(visitor.id), /访问码/);
  assert.throws(() => access.exchange('127.0.0.1'), /访问码/);
  const session = access.exchange(config.inviteCodes[0]);
  assert.ok(access.authorize(session.token));
  now = session.expiresAt;
  assert.throws(() => access.authorize(session.token), /过期/);
  store.close();
});

test('AI uses validated sources, rejects invented citations, keeps drafts out of public DB and shares per-code budgets', async () => {
  const store = new ContentStore(':memory:');
  const item = normalizeItems(payload, 'zhihu', 'search_summary', new Date().toISOString());
  store.put('seed', item);
  let invented = false;
  const content = new ContentService({ store, runner: async () => ({ choices: [{ message: { content: JSON.stringify({ text: '新的观察计划。', sourceIds: [invented ? 'answer-fake' : 'answer-456'] }) } }] }) });
  const synthesis = new SynthesisService(content, { global: 3, perCode: 2 });
  const input = { mode: 'idea', prompt: '两个材料能产生什么想法', sourceIds: ['answer-456'], personalText: '我的私人笔记' };
  assert.equal((await synthesis.generate(input, 'same-code')).draft.sources[0].id, 'answer-456');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM public_cache').get()?.n, 1);
  invented = true;
  await assert.rejects(synthesis.generate(input, 'same-code'), /未提供/);
  await assert.rejects(synthesis.generate(input, 'same-code'), /预算/);
  await assert.rejects(synthesis.generate({ ...input, sourceIds: ['fake'] }, 'another-code'), /来源/);
  store.close();
});

test('HTTP validates access, malformed JSON, search provider and keeps private CLI commands unavailable', async () => {
  const store = new ContentStore(':memory:');
  const content = new ContentService({ store, runner: async () => payload });
  const access = new AccessService(store, config);
  const service = new ZhihuService({ content, snapshot: { fetchedAt: new Date().toISOString(), sourceUrl: '', items: [], details: {} } });
  const app = createApp(service, { access, synthesis: new SynthesisService(content), refreshPublic: false });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(`${url}/api/search?q=植物&provider=me`)).status, 400);
    assert.equal((await fetch(`${url}/api/me/favorites`)).status, 404);
    assert.equal((await fetch(`${url}/api/synthesis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'idea', prompt: 'hello' }) })).status, 401);
    assert.equal((await fetch(`${url}/api/access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await fetch(`${url}/api/access`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.invalid' }, body: JSON.stringify({ code: config.inviteCodes[0] }) })).status, 403);
    const grant = await fetch(`${url}/api/access`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: config.inviteCodes[0] }) });
    assert.equal(grant.status, 200);
    assert.match(grant.headers.get('set-cookie') ?? '', /HttpOnly/);
    assert.equal((await grant.json()).token, undefined);
    const search = await fetch(`${url}/api/search?q=植物`);
    assert.equal(search.status, 200);
    assert.equal((await search.json()).items[0].kind, 'search_summary');
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); store.close(); }
});

test('daily budgets survive restart and reset at UTC day boundary', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mirror-budget-'));
  const path = join(dir, 'content.sqlite3');
  let now = Date.parse('2026-09-13T23:59:00Z');
  let store = new ContentStore(path, () => now);
  store.reserve('search', 'same-visitor', 2, 1);
  store.close(); store = new ContentStore(path, () => now);
  assert.throws(() => store.reserve('search', 'same-visitor', 2, 1), /预算/);
  now += 120_000;
  store.reserve('search', 'same-visitor', 2, 1);
  assert.equal(store.db.prepare('SELECT COUNT(DISTINCT day) AS n FROM budgets').get()?.n, 2);
  store.close(); rmSync(dir, { recursive: true });
});

test('legacy migration copies only validated public search summaries and is repeatable without changing the old DB', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mirror-import-'));
  const oldPath = join(dir, 'old.sqlite3');
  const old = new DatabaseSync(oldPath);
  old.exec('CREATE TABLE cache(key TEXT PRIMARY KEY,data TEXT); CREATE TABLE users(secret TEXT);');
  old.prepare('INSERT INTO users VALUES(?)').run('private sentinel');
  const card = { title: '真实旧文', text: '来源摘要', url: 'https://www.zhihu.com/question/123/answer/456', author: '真实作者', source: 'zhihu', kind: 'search_summary', verifiedQuote: false, retrievedAt: 1788853351 };
  old.prepare('INSERT INTO cache VALUES(?,?)').run('zhihu:v1:testhash', JSON.stringify([card]));
  old.prepare('INSERT INTO cache VALUES(?,?)').run('zhihu:v1:demo', JSON.stringify([{ ...card, source: 'demo' }]));
  old.prepare('INSERT INTO cache VALUES(?,?)').run('private:notes', JSON.stringify([{ ...card, text: 'private sentinel' }]));
  old.close();
  const store = new ContentStore(':memory:');
  const service = new ContentService({ store, runner: async () => payload });
  assert.deepEqual(service.importLegacy(oldPath), { imported: 1, skipped: 1 });
  assert.deepEqual(service.importLegacy(oldPath), { imported: 0, skipped: 0 });
  assert.equal(store.source('answer-456')?.title, '真实旧文');
  assert.ok(!JSON.stringify(store.db.prepare('SELECT payload FROM source_items').all()).includes('private sentinel'));
  const unchanged = new DatabaseSync(oldPath, { readOnly: true });
  assert.equal(unchanged.prepare('SELECT COUNT(*) AS n FROM cache').get()?.n, 3);
  unchanged.close(); store.close(); rmSync(dir, { recursive: true });
});

test('AI allows at most two concurrent requests and busy rejections consume no budget', async () => {
  const store = new ContentStore(':memory:');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const content = new ContentService({ store, runner: async () => { await gate; return { choices: [{ message: { content: '{"text":"一个想法","sourceIds":[]}' } }] }; } });
  const synthesis = new SynthesisService(content);
  const input = { mode: 'idea', prompt: '观察' };
  const first = synthesis.generate(input, 'code-a');
  const second = synthesis.generate(input, 'code-b');
  await assert.rejects(synthesis.generate(input, 'code-c'), /其他想法/);
  assert.equal(store.db.prepare('SELECT count FROM budgets WHERE scope=?').get('ai:global')?.count, 2);
  release(); await Promise.all([first, second]); store.close();
});

test('CLI-backed galaxy expansion keeps all actual answers, known authors and exact question membership', async () => {
  const store = new ContentStore(':memory:');
  const content = new ContentService({ store, runner: async (args) => args[0] === 'search' ? payload : { Code: 0, Data: { Items: Array.from({ length: 20 }, (_, i) => ({ Url: `https://www.zhihu.com/question/123/answer/${456 + i}`, Summary: `官方摘要 ${i}` })) } } });
  const galaxy = new ZhihuService({ content, snapshot: { fetchedAt: new Date().toISOString(), sourceUrl: '', items: [], details: {} } });
  const question = await galaxy.question('question-123', '植物', context);
  assert.equal(question.question.answers.length, 20);
  assert.equal(question.question.answers.find((answer) => answer.id === 'answer-456')?.author, '真实作者');
  assert.equal(question.question.answers.find((answer) => answer.id === 'answer-457')?.author, '作者未提供');
  assert.equal((await galaxy.findAnswer('answer-470', 'question-123', '植物', context)).isExcerpt, true);
  store.close();
});
