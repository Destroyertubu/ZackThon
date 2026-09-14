import express, { type ErrorRequestHandler } from 'express';
import http from 'node:http';
import { readFile, mkdir, chmod, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { sameOrigin } from './auth.mjs';
import { JobManager, type Runtime } from './jobs.mjs';
import { createFixtureApp } from './fixtures.js';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const state = process.env.SHOWCASE_STATE || join(homedir(), '.local/state/wanderwise-showcase');
const localViewerPort = Number(process.env.SHOWCASE_LOCAL_VIEWER || 0);
if (localViewerPort && (!Number.isInteger(localViewerPort) || localViewerPort < 1024 || localViewerPort > 65535)) throw new Error('SHOWCASE_LOCAL_VIEWER must be a valid loopback port');
await mkdir(state, { recursive: true, mode: 0o700 });
const controller = await readFile(join(root, 'server/showcase/controller.js'));
const consoleHtml = await readFile(join(root, 'server/showcase/console.html'));

async function createViewer(runtime: Runtime, ipc: string, tcpPort = 0) {
  const app = express();
  const fixture = createFixtureApp(root);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '96kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    // Browser networking is local to this isolated origin, even in manual QA.
    // GLTFLoader decodes embedded textures through ImageBitmapLoader.fetch(blob:).
    // Local object URLs are required for authentic materials, not upstream access.
    res.setHeader('Content-Security-Policy', "connect-src 'self' blob: data:; frame-src 'none'; object-src 'none'");
    next();
  });
  app.get('/__showcase/controller.js', (_req, res) => res.type('application/javascript').send(controller));
  app.get('/__showcase/next', (_req, res) => {
    const command = manager.next(runtime);
    if (command) res.json(command); else res.sendStatus(204);
  });
  app.post('/__showcase/heartbeat', (req, res) => { manager.heartbeat(runtime, req.body); res.sendStatus(204); });
  app.post('/__showcase/result', (req, res) => { manager.result(runtime, req.body); res.sendStatus(204); });
  app.use('/__showcase', (_req, res) => res.sendStatus(404));
  app.use((req, res, next) => req.path.startsWith('/api/') ? fixture.app(req, res, next) : next());
  app.use(express.static(join(root, 'dist'), { index: false, redirect: false }));
  app.get(['/', '/home', '/observatory', '/galaxy', '/land', '/world', '/canvas', '/showcase/warmup', '/journey/:realmId'], async (_req, res, next) => {
    try {
      const html = await readFile(join(root, 'dist/index.html'), 'utf8');
      res.type('html').send(html.replace('</head>', '<script src="/__showcase/controller.js"></script></head>'));
    } catch (error) { next(error); }
  });
  app.use((_req, res) => res.sendStatus(404));
  const socket = join(ipc, 'origin.sock');
  await unlink(socket).catch(() => {});
  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(socket, resolve));
  await chmod(socket, 0o660);
  const tcpServer = tcpPort ? http.createServer(app) : undefined;
  if (tcpServer) await new Promise<void>((resolve, reject) => tcpServer.once('error', reject).listen(tcpPort, '127.0.0.1', resolve));
  return { close: async () => {
    if (tcpServer) { tcpServer.closeAllConnections(); await new Promise<void>(resolve => tcpServer.close(() => resolve())); }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); fixture.close(); await unlink(socket).catch(() => {});
  } };
}
const manager = new JobManager({ root, state, createViewer, ...(process.env.SHOWCASE_IMAGE ? { image: process.env.SHOWCASE_IMAGE } : {}) });
await manager.initialize();
let closeLocalViewer: (() => Promise<void>) | undefined;
if (localViewerPort) {
  const ipc = join(state, 'local-viewer');
  await mkdir(ipc, { recursive: true, mode: 0o700 });
  const runtime: Runtime = { job: { id: 'local-qa', mode: 'smoke', status: 'local', createdAt: '', updatedAt: '' }, abort: new AbortController(), queue: [], pending: new Map(), heartbeat: null, container: '' };
  closeLocalViewer = (await createViewer(runtime, ipc, localViewerPort)).close;
  console.info(`Private local showcase viewer: http://127.0.0.1:${localViewerPort}/observatory?showcase=1&renderRuntime=rtx`);
}
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'same-origin'); next(); });
app.get('/', (_req, res) => res.redirect('/showcase'));
app.get('/showcase', (_req, res) => res.type('html').send(consoleHtml));
app.get('/showcase/console.js', (_req, res) => res.sendFile(join(root, 'server/showcase/console.js')));
app.use('/showcase/api', (req, res, next) => {
  if (req.method !== 'GET' && !sameOrigin(req)) { res.status(403).json({ error: '请从当前展示页面操作。' }); return; }
  next();
});
app.get('/showcase/api/status', (_req, res) => res.json({ job: manager.publicJob(manager.latest()) }));
app.post('/showcase/api/start', async (req, res, next) => {
  try { res.status(202).json({ job: manager.publicJob(await manager.start(req.body?.mode)) }); } catch (error) { next(error); }
});
app.post('/showcase/api/jobs/:id/cancel', async (req, res, next) => {
  try { await manager.cancel(req.params.id); res.json({ ok: true }); } catch (error) { next(error); }
});
app.get('/showcase/api/jobs/:id', (req, res) => {
  const job = manager.jobs.get(req.params.id);
  if (!job) { res.sendStatus(404); return; }
  res.json({ job: manager.publicJob(job) });
});
app.get('/showcase/api/jobs/:id/:artifact', (req, res) => {
  const job = manager.jobs.get(req.params.id);
  const artifacts: Record<string, string> = { download: 'output.mp4', clean: 'output-clean.mp4', subtitles: 'subtitles.srt', closing: 'closing.png', evidence: 'evidence.json', audio: 'narration.wav', script: 'narration.md', introduction: 'introduction.md', short: 'introduction-short.md', storyboard: 'storyboard.json' };
  const file = artifacts[req.params.artifact];
  if (!job || job.status !== 'completed' || !file) { res.sendStatus(404); return; }
  const path = join(state, 'jobs', job.id, 'output', file);
  res.setHeader('Content-Disposition', `inline; filename="wanderwise-${job.id.slice(0, 8)}-${file}"`);
  res.sendFile(path);
});
app.use((_req, res) => res.sendStatus(404));
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => res.status(error.status || 500).json({ error: error.status ? error.message : '展示服务无法完成请求。' });
app.use(errorHandler);
const server = app.listen(Number(process.env.SHOWCASE_PORT || 4192), '127.0.0.1', () => console.info('Wanderwise showcase console is ready on loopback.'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  void (async () => {
    if (manager.active) await manager.cancel(manager.active.job.id);
    await closeLocalViewer?.();
    server.closeAllConnections(); server.close(() => process.exit(0));
  })();
  setTimeout(() => process.exit(1), 20_000).unref();
});
