import http from 'node:http';
import net from 'node:net';
import { chmod, mkdir, unlink, readFile } from 'node:fs/promises';
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
if (!password || password.length < 24) throw new Error('Private Selkies service credentials are required');
const upstreamAuth = `Basic ${Buffer.from(`${settings.SELKIES_BASIC_AUTH_USER}:${password}`).toString('base64')}`;
const sameOrigin = request => request.headers.origin === `${request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${request.headers.host}`;
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
    if (req.headers.origin && !sameOrigin(req)) { res.writeHead(403, { 'Cache-Control': 'no-store' }); res.end(); return; }
    // Old bookmarks and forms no longer require a code or create a login cookie.
    if (req.url.split('?')[0] === '/cloud/login') {
      req.resume();
      res.writeHead(303, { Location: '/', 'Cache-Control': 'no-store' }); res.end(); return;
    }
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
    // Only the gateway supplies the internal Selkies credential. It is never
    // exposed to the viewer or accepted as a visitor-facing access code.
    req.headers.authorization = upstreamAuth;
    proxy(req, res, { socketPath: streamPath }, req.method === 'GET' && req.url.split('?')[0] === '/');
  }
  catch { if (!res.headersSent) res.writeHead(400); res.end(); }
});
stream.on('upgrade', (request, socket, head) => {
  if (!sameOrigin(request)) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
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
  socket.on('close', () => upstream.destroy());
  upstream.on('close', () => socket.destroy());
});
stream.listen(4190, '127.0.0.1', () => console.log('Wanderwise GPU gateway: http://127.0.0.1:4190'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  origin.close(); stream.close();
  setTimeout(() => process.exit(0), 2000).unref();
});
