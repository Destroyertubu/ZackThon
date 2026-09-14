import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoryboard, sameOrigin } from '../../server/showcase/auth.mjs';
import { JobManager, writeWorkerManifest } from '../../server/showcase/jobs.mjs';
import { mkdtemp, stat, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

test('console and saved downloads work anonymously without a secret file; mutations retain origin checks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'showcase-anonymous-'));
  const listener = createServer();
  listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  // Unit-level HTTP verification must never reclaim or launch real containers.
  const bin = join(directory, 'bin'); await mkdir(bin);
  await writeFile(join(bin, 'docker'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const id = '00000000-0000-0000-0000-000000000001';
  const jobPath = join(directory, 'jobs', id);
  await mkdir(join(jobPath, 'output'), { recursive: true });
  await writeFile(join(jobPath, 'job.json'), JSON.stringify({ id, status: 'completed', mode: 'full', createdAt: new Date().toISOString() }));
  await writeFile(join(jobPath, 'output', 'output.mp4'), 'unit-test-media');
  const child = spawn(process.execPath, ['--import', 'tsx', 'server/showcase/index.ts'], {
    cwd: new URL('../../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: bin, SHOWCASE_PORT: String(port), SHOWCASE_STATE: directory, SHOWCASE_LOCAL_VIEWER: '', SHOWCASE_ACCESS_FILE: join(directory, 'absent-secret-file') },
  });
  let output = ''; child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { output += value; });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; !output.includes('console is ready') && i < 100; i++) {
      assert.equal(child.exitCode, null, output);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    const page = await fetch(base + '/showcase');
    assert.equal(page.status, 200); assert.equal(page.headers.get('set-cookie'), null);
    assert.doesNotMatch(await page.text(), /type="password"|id="login"/);
    const status = await fetch(base + '/showcase/api/status');
    assert.equal(status.status, 200); assert.equal((await status.json()).job.id, id);
    const download = await fetch(base + `/showcase/api/jobs/${id}/download`, { headers: { Range: 'bytes=0-3' } });
    assert.equal(download.status, 206); assert.equal(await download.text(), 'unit');
    assert.equal(download.headers.get('set-cookie'), null);
    const post = (path, origin, body = {}) => fetch(base + path, { method: 'POST', headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const origin of [undefined, 'https://invalid.example']) assert.equal((await post('/showcase/api/start', origin)).status, 403);
    assert.equal((await post('/showcase/api/start', base, { mode: 'invalid' })).status, 400);
    assert.equal((await post('/showcase/api/jobs/absent/cancel', base)).status, 409);
    assert.equal((await post('/showcase/login', base)).status, 404);
    assert.equal((await fetch(base + '/__showcase/next')).status, 404);
  } finally {
    child.kill('SIGTERM');
    if (child.exitCode === null) await once(child, 'exit');
    await rm(directory, { recursive: true, force: true });
  }
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
