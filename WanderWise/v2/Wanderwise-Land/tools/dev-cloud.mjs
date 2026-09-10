import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createApplication} from '../cloud/application.mjs';
import {memoryStorage} from '../cloud/storage.mjs';

const port = Number(process.env.PORT || 18090), store = memoryStorage();
const app = createApplication({storage: store, secureCookies: false, getEnv: name => name === 'WW_HOURLY_TASK_LIMIT' ? '100' : ''});
const types = {'.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const root = resolve('frontend');
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api/v1/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, {method: req.method, headers: req.headers, ...(!['GET','HEAD'].includes(req.method) ? {body: Buffer.concat(chunks)} : {})});
      const response = await app.handler(request, {ip: req.socket.remoteAddress});
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const path = url.pathname.startsWith('/static/') ? resolve(root, '.' + url.pathname.slice(7)) : resolve(root, 'index.html');
    if (!path.startsWith(root + '/')) {res.writeHead(404); res.end(); return;}
    const content = await readFile(path), ext = path.slice(path.lastIndexOf('.'));
    res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream','Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'"}); res.end(content);
  } catch {res.writeHead(500); res.end('Local cloud-adapter error');}
}).listen(port, '127.0.0.1', () => console.log(`Cloud adapter development server: http://127.0.0.1:${port} (isolated in-memory test data)`));
