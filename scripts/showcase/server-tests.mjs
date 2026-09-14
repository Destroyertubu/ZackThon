import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth, parseStoryboard, sameOrigin } from '../../server/showcase/auth.mjs';
import { JobManager, writeWorkerManifest } from '../../server/showcase/jobs.mjs';
import { mkdtemp, stat, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

test('access code is not a session cookie, sessions expire and brute force is bounded', () => {
  let now = 1000;
  const auth = createAuth('private-test-access-code-not-production', () => now);
  assert.equal(auth.authorized('wanderwise_showcase=private-test-access-code-not-production'), false);
  const accepted = auth.login('private-test-access-code-not-production', 'a');
  assert.equal(auth.authorized(`wanderwise_showcase=${accepted.token}`), true);
  now += 7_200_001;
  assert.equal(auth.authorized(`wanderwise_showcase=${accepted.token}`), false);
  for (let i = 0; i < 10; i++) assert.equal(auth.login('wrong', 'b').status, 401);
  assert.equal(auth.login('private-test-access-code-not-production', 'b').status, 429);
});
test('mutations require the actual page origin', () => {
  assert.equal(sameOrigin({ headers: { host: 'example.test', origin: 'https://example.test', 'x-forwarded-proto': 'https' } }), true);
  assert.equal(sameOrigin({ headers: { host: 'example.test', origin: 'https://other.test', 'x-forwarded-proto': 'https' } }), false);
  assert.equal(sameOrigin({ headers: { host: 'example.test' } }), false);
});
test('storyboard refuses duplicate IDs, filename injection and invalid timing', () => {
  assert.equal(parseStoryboard({ shots: [{ id: 'arrival', duration: 12 }, { id: 'home', durationSeconds: 31 }] }).duration, 43);
  for (const shots of [[{ id: '../bad', duration: 12 }], [{ id: 'x', duration: 0 }], [{ id: 'x', duration: 1 }, { id: 'x', duration: 2 }]]) assert.throws(() => parseStoryboard({ shots }));
});
test('single-task reservation happens before asynchronous setup', async () => {
  const manager = new JobManager({ root: '/unused', state: '/unused', createViewer() {} });
  manager.active = { job: { id: 'already-running' } };
  await assert.rejects(manager.start('smoke'), error => error.status === 409);
});
test('a failed real page action rejects the queued operation', async () => {
  const manager = new JobManager({ root: '/unused', state: '/unused', createViewer() {} });
  const runtime = { queue: [], pending: new Map() };
  const command = manager.command(runtime, 'play', 'home', 1000);
  const request = manager.next(runtime);
  manager.result(runtime, { id: request.id, ok: false, error: 'Collection action failed' });
  await assert.rejects(command, /Collection action failed/);
  assert.equal(runtime.pending.size, 0);
});
test('cancellation rejects queued and future page commands immediately', async () => {
  const manager = new JobManager({ root: '/unused', state: '/unused', createViewer() {} });
  const runtime = { queue: [], pending: new Map(), abort: new AbortController() };
  const pending = manager.command(runtime, 'prepare', 'home', 10000);
  runtime.abort.abort();
  await assert.rejects(pending, /Task cancelled/);
  assert.equal(runtime.queue.length, 0);
  assert.equal(runtime.pending.size, 0);
  await assert.rejects(manager.command(runtime, 'play', 'home', 10000), /Task cancelled/);
});
test('a shot retries real preparation and capture once, retaining its failure evidence', async () => {
  const manager = new JobManager({ root: '/unused', state: '/unused', createViewer() {} });
  const runtime = { job: { mode: 'full' }, abort: new AbortController() };
  manager.update = async (job, values) => Object.assign(job, values);
  manager.persist = async () => {};
  const calls = [];
  manager.command = async (_, action, id) => calls.push(`${action}:${id}`);
  manager.record = async () => { calls.push('record'); if (calls.length === 2) throw new Error('Real action failed'); return { id: 'mix' }; };
  const result = await manager.executeShot(runtime, { id: 'mix', duration: 25 }, 5, 8);
  assert.deepEqual(calls, ['prepare:mix', 'record', 'prepare:mix', 'record']);
  assert.deepEqual(result.attempts.map(a => a.status), ['failed', 'completed']);
  assert.equal(result.attempts[0].error, 'Real action failed');
});
test('a second shot failure terminates, and cancellation never retries', async () => {
  for (const cancel of [false, true]) {
    const manager = new JobManager({ root: '/unused', state: '/unused', createViewer() {} });
    const runtime = { job: { mode: 'full' }, abort: new AbortController() };
    manager.update = async (job, values) => Object.assign(job, values);
    manager.persist = async () => {};
    let calls = 0;
    manager.command = async () => { calls++; if (cancel) runtime.abort.abort(); throw new Error('Scene unavailable'); };
    await assert.rejects(manager.executeShot(runtime, { id: 'opening', duration: 12 }, 0, 8), /Scene unavailable/);
    assert.equal(calls, cancel ? 1 : 2);
  }
});
test('worker manifest remains group-readable under production UMask 0077', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'showcase-permissions-'));
  const previousMask = process.umask(0o077);
  try {
    const path = join(directory, 'concat.txt');
    await writeWorkerManifest(path, "file 'clip-0.mp4'\n");
    assert.equal((await stat(path)).mode & 0o777, 0o640);
    assert.equal(await readFile(path, 'utf8'), "file 'clip-0.mp4'\n");
  } finally { process.umask(previousMask); await rm(directory, { recursive: true, force: true }); }
});

test('unmarked thumbnail pages never poll commands or send heartbeats', async () => {
  const source = await readFile(new URL('../../server/showcase/controller.js', import.meta.url), 'utf8');
  for (const search of ['', '?showcase=0', '?renderRuntime=rtx']) {
    const window = {};
    runInNewContext(source, { window, location: { search }, URLSearchParams,
      fetch() { assert.fail('An unmarked page fetched a control endpoint'); },
      setInterval() { assert.fail('An unmarked page installed a heartbeat'); },
    });
    assert.equal(window.__showcaseControllerAttached, undefined);
  }
});

test('the marked controller continues after SPA navigation removes its query', async () => {
  const source = await readFile(new URL('../../server/showcase/controller.js', import.meta.url), 'utf8');
  const calls = [], pending = [], intervals = [], timers = [];
  const location = { search: '?showcase=1&renderRuntime=rtx', pathname: '/observatory' };
  const context = {
    window: { addEventListener() {} }, location, URLSearchParams,
    innerWidth: 1920, innerHeight: 1080, console: { warn() {}, error() {} },
    document: { createElement: () => ({}), head: { append() {} }, querySelectorAll: () => [] },
    fetch(path, options) { calls.push({ path, options }); return new Promise(resolve => pending.push(resolve)); },
    setInterval(callback) { intervals.push(callback); },
    setTimeout(callback) { timers.push(callback); },
  };
  runInNewContext(source, context);
  assert.equal(calls[0].path, '/__showcase/next');
  location.search = ''; location.pathname = '/home';
  runInNewContext(source, context);
  assert.equal(intervals.length, 1);
  intervals[0]();
  assert.equal(JSON.parse(calls[1].options.body).route, '/home');
  pending[0]({ status: 204 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(timers.length, 1);
  timers[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[2].path, '/__showcase/next');
});
