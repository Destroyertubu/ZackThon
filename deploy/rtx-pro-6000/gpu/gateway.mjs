import http from 'node:http';
import net from 'node:net';
import { chmod, mkdir, unlink, readFile } from 'node:fs/promises';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only these two Unix sockets cross the renderer's network namespace.
const ipc = process.env.WANDERWISE_GPU_IPC || join(homedir(), '.local/state/wanderwise-gpu/ipc');
await mkdir(ipc, { recursive: true, mode: 0o2770 });
const originPath = join(ipc, 'origin.sock');
const streamPath = join(ipc, 'stream.sock');
const settings = Object.fromEntries((await readFile(join(ipc, '../session.env'), 'utf8')).trim().split('\n').map(line => {
  const split = line.indexOf('='); return [line.slice(0, split), line.slice(split + 1)];
}));
const password = settings.SELKIES_BASIC_AUTH_PASSWORD;
if (!password || password.length < 24) throw new Error('A private GPU access code is required');
const upstreamAuth = `Basic ${Buffer.from(`${settings.SELKIES_BASIC_AUTH_USER}:${password}`).toString('base64')}`;
const sessions = new Map(), attempts = new Map();
const digest = text => createHash('sha256').update(text).digest();
const sessionKey = request => digest((request.headers.cookie || '').match(/(?:^|;\s*)wanderwise_cloud=([^;]+)/)?.[1] || '').toString('hex');
function authenticated(request) {
  const key = sessionKey(request), session = sessions.get(key);
  if (!session) return false;
  if (session.expires <= Date.now()) { session.sockets.forEach(socket => socket.destroy()); sessions.delete(key); return false; }
  return session;
}
const cookie = request => `Path=/; HttpOnly; SameSite=Strict${request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
const sameOrigin = request => request.headers.origin === `${request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${request.headers.host}`;
const loginPage = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>镜海 · 云端漫游</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;color:#e7ece4;background:radial-gradient(ellipse at 70% 20%,#24434a,transparent 65%),#0d1824;font:16px system-ui}main{width:min(380px,80vw);padding:42px;border:1px solid #b4d8cd33;border-radius:24px;background:#10202aba;box-shadow:0 28px 100px #0006}small{color:#b6ccb9;letter-spacing:.16em}h1{font-size:32px;font-weight:500}p{color:#afc4cb;line-height:1.8}label{display:block;margin:28px 0 10px}input,button{box-sizing:border-box;width:100%;padding:15px;border-radius:9px;font:inherit}input{border:1px solid #9ab6bd55;background:#091923;color:white}button{margin-top:16px;border:0;background:#c9dbc4;color:#19312f;cursor:pointer}</style><main><small>WANDERWISE · 云端漫游</small><h1>把远方，留给想象。</h1><p>由云端绘制你的星树花园。<br>这是独立的单人预览空间。</p><form method="post" action="/cloud/login"><label for="code">访问码</label><input id="code" name="code" type="password" autocomplete="current-password" required autofocus maxlength="256"><button type="submit">进入云端花园</button></form></main></html>`;
function showLogin(res, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", 'Referrer-Policy': 'same-origin' });
  res.end(status === 401 ? loginPage.replace('<form ', '<p role="alert">访问码不正确，请重新输入。</p><form ') : loginPage);
}
async function authorize(req, res) {
  if (process.env.CLOUD_AUTH_DIAGNOSTICS === '1' && ['/', '/cloud/login'].includes(req.url))
    console.log('cloud-auth', req.method, req.url, 'session', Boolean(authenticated(req)), 'origin', req.headers.origin || 'none');
  if (req.url === '/cloud/login' && req.method === 'POST') {
    if (!sameOrigin(req)) { res.writeHead(403); res.end(); return false; }
    const ip = req.headers['cf-connecting-ip'] || req.socket.remoteAddress;
    let attempt = attempts.get(ip);
    if (!attempt || attempt.until < Date.now()) { attempt = { count: 0, until: Date.now() + 600_000 }; attempts.set(ip, attempt); }
    if (++attempt.count > 10) { res.writeHead(429, { 'Retry-After': '600' }); res.end('请稍后再试。'); return false; }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 4096) { res.writeHead(413); res.end(); return false; } }
    const code = new URLSearchParams(body).get('code') || '';
    if (!timingSafeEqual(digest(code), digest(password))) { showLogin(res, 401); return false; }
    if (process.env.CLOUD_AUTH_DIAGNOSTICS === '1') console.log('cloud-auth accepted');
    const token = randomBytes(32).toString('base64url');
    sessions.set(digest(token).toString('hex'), { expires: Date.now() + 7_200_000, sockets: new Set() });
    res.writeHead(303, { Location: '/', 'Set-Cookie': `wanderwise_cloud=${token}; ${cookie(req)}; Max-Age=7200`, 'Cache-Control': 'no-store' });
    res.end(); return false;
  }
  if (authenticated(req)) { req.headers.authorization = upstreamAuth; return true; }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/cloud/login')) showLogin(res);
  else { res.writeHead(401, { 'Cache-Control': 'no-store' }); res.end('请先输入云渲染访问码。'); }
  return false;
}
setInterval(() => {
  for (const [key, session] of sessions) if (session.expires <= Date.now()) { session.sockets.forEach(socket => socket.destroy()); sessions.delete(key); }
  for (const [key, attempt] of attempts) if (attempt.until <= Date.now()) attempts.delete(key);
}, 60_000).unref();
await unlink(originPath).catch(error => { if (error.code !== 'ENOENT') throw error; });

function proxy(request, response, target, decorate = false) {
  const headers = { ...request.headers, ...(decorate ? { 'accept-encoding': 'identity' } : {}) };
  if (decorate) { delete headers['if-none-match']; delete headers['if-modified-since']; }
  const upstream = http.request({ ...target, path: request.url, method: request.method, headers }, reply => {
    if (decorate && reply.statusCode === 200 && reply.headers['content-type']?.includes('text/html')) {
      const chunks = [];
      reply.on('data', chunk => chunks.push(chunk));
      reply.on('end', () => {
        const body = Buffer.from(Buffer.concat(chunks).toString('utf8').replace('</body>', '<script src="/cloud/client.js"></script></body>'));
        const outgoing = { ...reply.headers, 'content-length': body.length, 'cache-control': 'no-store' };
        for (const key of ['etag', 'last-modified', 'transfer-encoding']) delete outgoing[key];
        response.writeHead(reply.statusCode, outgoing); response.end(body);
      });
      reply.on('error', () => response.destroy());
      return;
    }
    response.writeHead(reply.statusCode, reply.headers);
    reply.pipe(response);
    reply.on('error', () => response.destroy());
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3' });
    response.end('云渲染会话正在准备，请稍后重试。');
  });
  request.on('aborted', () => upstream.destroy());
  response.on('close', () => { if (!response.writableEnded) upstream.destroy(); });
  request.pipe(upstream);
}

const origin = http.createServer((req, res) => proxy(req, res, { host: '127.0.0.1', port: 4187 }));
await new Promise((resolve, reject) => origin.once('error', reject).listen(originPath, resolve));
await chmod(originPath, 0o660);

const stream = http.createServer(async (req, res) => {
  try {
    if (!await authorize(req, res)) return;
    if (req.method === 'GET' && req.url === '/cloud/client.js') {
      const body = await readFile(fileURLToPath(new URL('./stream-client.js', import.meta.url)));
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body); return;
    }
    if (req.method === 'GET' && req.url === '/cloud/status') {
      const body = await readFile(join(ipc, 'metrics.json')).catch(() => Buffer.from('{}'));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(body); return;
    }
    proxy(req, res, { socketPath: streamPath }, req.method === 'GET' && req.url.split('?')[0] === '/');
  }
  catch { if (!res.headersSent) res.writeHead(400); res.end(); }
});
stream.on('upgrade', (request, socket, head) => {
  const session = authenticated(request);
  if (!session) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
  if (!sameOrigin(request)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
  session.sockets.add(socket);
  socket.setNoDelay(true);
  const upstream = net.connect(streamPath);
  upstream.on('connect', () => {
    const headers = [];
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      if (request.rawHeaders[i].toLowerCase() !== 'authorization') headers.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
    }
    headers.push(`Authorization: ${upstreamAuth}`);
    upstream.write(`${request.method} ${request.url} HTTP/1.1\r\n${headers.join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => { session.sockets.delete(socket); upstream.destroy(); });
  upstream.on('close', () => socket.destroy());
});
stream.listen(4190, '127.0.0.1', () => console.log('Wanderwise GPU gateway: http://127.0.0.1:4190'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  origin.close(); stream.close();
  setTimeout(() => process.exit(0), 2000).unref();
});
