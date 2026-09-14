// Read-only browser acceptance of a completed console video in a fresh profile.
// No login or stored browser session is required.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const [base, expectedJob, screenshot] = process.argv.slice(2);
if (!/^https?:\/\//.test(base || '') || !/^[a-f0-9-]{36}$/.test(expectedJob || '')) throw new Error('Expected console origin and completed job UUID');
const profile = await mkdtemp(join(tmpdir(), 'showcase-console-preview-'));
const browser = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-sync', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--window-size=1440,1100', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, serial = 0;
const pending = new Map();
function rpc(method, params = {}, sessionId) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser timed out: ${method}`)); }, 45000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: value => { clearTimeout(timer); reject(value); } });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); }
  }
  if (!port) throw new Error('Isolated Chrome did not start');
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data), item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
  };
  const { targetId } = await rpc('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rpc('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async expression => {
    const result = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }, sessionId);
    if (result.exceptionDetails) throw new Error('Browser evaluation failed');
    return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await delay(200); }
    throw new Error('Console element did not become ready');
  };
  await rpc('Page.enable', {}, sessionId);
  await rpc('Page.navigate', { url: base.replace(/\/$/, '') + '/showcase' }, sessionId);
  await wait('Boolean(document.getElementById("console") && !document.getElementById("console").hidden)');
  assert(await evaluate('!document.querySelector("input[type=password], form[action*=login]")'));
  const cookies = await rpc('Network.getCookies', { urls: [base.replace(/\/$/, '') + '/showcase'] }, sessionId);
  assert(!cookies.cookies.some(cookie => cookie.name === 'wanderwise_showcase'));
  await wait('Boolean(document.querySelector("video")?.readyState >= 3)');
  const before = await evaluate('(()=>{const v=document.querySelector("video");return {src:v.getAttribute("src"),width:v.videoWidth,height:v.videoHeight,duration:v.duration,readyState:v.readyState,visible:!v.hidden}})()');
  assert(before.src.includes(expectedJob));
  assert.equal(before.width, 1920); assert.equal(before.height, 1080); assert.equal(before.duration, 180); assert(before.visible);
  await evaluate('document.querySelector("video").muted=true; document.querySelector("video").play().then(()=>true)');
  await delay(1500);
  const after = await evaluate('(()=>{const v=document.querySelector("video");return {currentTime:v.currentTime,paused:v.paused,error:v.error?.code||null}})()');
  assert(after.currentTime > 0 && !after.paused && !after.error);
  if (screenshot) {
    const result = await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
    await writeFile(screenshot, Buffer.from(result.data, 'base64'));
  }
  console.log(JSON.stringify({ anonymousPreview: 'passed', jobId: expectedJob, browser: version.Browser, ...before, ...after }));
} finally {
  socket?.close(); browser.kill('SIGTERM');
  for (let i = 0; i < 50 && browser.exitCode === null; i++) await delay(100);
  if (browser.exitCode === null) browser.kill('SIGKILL');
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
