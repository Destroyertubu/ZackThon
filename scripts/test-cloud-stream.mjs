import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

const clientSource = await readFile('deploy/rtx-pro-6000/gpu/stream-client.js', 'utf8')
const statusSource = await readFile('deploy/rtx-pro-6000/gpu/cloud-status.js', 'utf8')
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function fixture(source) {
  class Node {
    style = {}; dataset = {}; children = []; handlers = new Map(); textContent = ''; id = ''
    setAttribute() {}
    focus() { this.focused = true }
    append(child) { this.children.push(child) }
    contains(target) { return target === this || this.children.includes(target) }
    closest() { return null }
    addEventListener(type, listener) { const list = this.handlers.get(type) || []; list.push(listener); this.handlers.set(type, list) }
    emit(type, event = {}) { for (const listener of this.handlers.get(type) || []) listener(event) }
  }
  let now = 20000, blocked = false, version = 'a'.repeat(64), reloads = 0, locks = 0, statusOk = true, path = '/observatory', remoteLocked = false
  const sent = [], messages = [], intervals = [], timeouts = [], posts = [], storage = new Map()
  const window = new Node(), document = new Node(), canvas = new Node()
  document.body = new Node(); document.currentScript = { dataset: { cloudBuild: version } }
  document.createElement = () => new Node()
  document.querySelector = selector => selector.startsWith('canvas') ? canvas : blocked ? {} : null
  document.activeElement = { matches: () => blocked }
  document.exitPointerLock = () => { document.pointerLockElement = null; document.emit('pointerlockchange') }
  canvas.getContext = () => null
  canvas.dataset = { worldFps: '60', worldP95Ms: '17', landscape: 'particle-floating-islands', islandCount: '9' }
  canvas.requestPointerLock = async () => { locks++; document.pointerLockElement = canvas; document.emit('pointerlockchange') }
  window.webrtcInput = { element: canvas, inputAttached: true, send: value => sent.push(value) }
  window.selkiesTransport = { readyState: 1 }; window.postMessage = msg => messages.push(msg)
  window.network_stats = { latency_ms: 120 }; window.fps = 60
  const context = vm.createContext({ window, document, Date: class extends Date { static now() { return now } },
    location: { origin: 'https://example.test', pathname: '/observatory', reload: () => reloads++ }, innerWidth: 1920, innerHeight: 1080,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) }, sessionStorage: { setItem() {} },
    setInterval: (fn, ms) => intervals.push({ fn, ms }), setTimeout: fn => timeouts.push(fn), AbortSignal, console,
    fetch: async (url, options) => {
      if (url === '/__cloud/metrics') posts.push(JSON.parse(options.body))
      return { ok: statusOk, json: async () => url === '/cloud/status' ?
        { at: new Date(now).toISOString(), path, lookAllowed: !blocked, pointerLocked: remoteLocked } : { build: version } }
    },
  })
  vm.runInContext(source, context)
  return { window, document, canvas, sent, messages, posts, intervals, storage,
    get locks() { return locks }, get reloads() { return reloads },
    set blocked(v) { blocked = v }, set version(v) { version = v }, set ok(v) { statusOk = v }, set path(v) { path = v },
    set remoteLocked(v) { remoteLocked = v },
    advance(ms) { now += ms }, key(code) { window.emit('keydown', { code, target: canvas }) },
    async tick(ms) { for (const item of intervals.filter(x => x.ms === ms)) await item.fn(); await settle() },
    async flush() { for (const fn of timeouts.splice(0)) fn(); await settle() },
  }
}
const client = fixture(clientSource); await settle()
// The pinned Selkies version captures game input with a full-video search input.
client.canvas.id = 'overlayInput'; client.canvas.closest = () => client.canvas
assert.equal(client.messages[0].settings.video_bitrate, 8000)
assert.equal(client.messages[0].settings.framerate, 60)
client.document.body.children[0].children[1].emit('click')
assert.equal(client.messages.at(-1).settings.video_bitrate, 16000)
assert.equal(client.canvas.focused, true, 'changing stream quality returns keyboard focus to the game surface')
client.sent.length = 0
client.key('KeyW'); await settle()
assert.equal(client.locks, 1, 'walking must acquire viewer pointer lock for Selkies relative motion')
assert.deepEqual(client.sent, ['kd,102', 'ku,102'], 'remote look is restored before mouse packets')
client.sent.length = 0
client.key('KeyE'); await client.flush()
assert.equal(client.document.pointerLockElement, null)
assert.deepEqual(client.sent, [], 'opening an E interaction must never send Esc and close it again')
client.blocked = true; await client.tick(1000); client.key('KeyF'); await settle()
assert.equal(client.locks, 1, 'remote text/reading UI must not capture the viewing mouse')
client.blocked = false; await client.tick(1000); client.key('KeyF'); await settle()
assert.equal(client.locks, 2)
client.sent.length = 0; client.key('Escape'); await settle()
assert.equal(client.document.pointerLockElement, null)
assert.ok(client.sent.includes('kd,65307'), 'one Escape releases both sides')
client.key('KeyW'); await settle(); assert.equal(client.locks, 2, 'Escape suppresses automatic reacquisition until F')
client.key('KeyH'); await client.flush(); client.path = '/home'; await client.tick(1000)
client.key('KeyW'); await settle()
assert.equal(client.locks, 3, 'a new home route restores automatic capture on walking')
client.key('KeyE'); await client.flush(); client.path = '/observatory'; await client.tick(1000)
assert.equal(client.document.pointerLockElement, null, 'route changes do not lock the viewer without player input')
client.key('KeyW'); await settle()
assert.equal(client.locks, 4, 'returning through the balcony restores walking capture too')
console.log('Cloud input passed: relative lock, F/E/Escape, home/balcony round trip, dialog protection, 1080p60 bitrate preference.')

const loading = fixture(clientSource); await settle()
loading.key('KeyW'); await settle(); loading.sent.length = 0
loading.advance(1500); await loading.tick(1000)
assert.deepEqual(loading.sent, ['kd,102', 'ku,102'], 'retry a restore lost before the remote controller mounted')
loading.sent.length = 0; loading.remoteLocked = true; loading.advance(1500); await loading.tick(1000)
assert.deepEqual(loading.sent, [], 'remote acknowledgement stops restore retries')
loading.remoteLocked = false; loading.blocked = true; loading.advance(1500); await loading.tick(1000)
assert.deepEqual(loading.sent, [], 'opening a panel stops restore retries without sending Escape')
assert.equal(loading.document.pointerLockElement, null)
console.log('Cloud loading passed: retry missing remote locks, stop after confirmation, preserve panel interactions.')

const renderer = fixture(statusSource); await settle()
assert.equal(renderer.posts[0].build, 'a'.repeat(64))
assert.equal(renderer.posts[0].islandCount, 9)
await renderer.tick(15000); renderer.advance(6000); await renderer.tick(1000)
assert.equal(renderer.reloads, 0, 'unchanged builds must not refresh')
renderer.version = 'b'.repeat(64); await renderer.tick(15000)
renderer.blocked = true; await renderer.tick(1000)
assert.equal(renderer.reloads, 0, 'deploying must not interrupt a reading/editing dialog')
renderer.blocked = false; renderer.key('KeyW'); renderer.advance(6000); await renderer.tick(1000)
assert.equal(renderer.reloads, 0, 'held movement keys postpone deployment reload')
renderer.window.emit('keyup', { code: 'KeyW' }); await renderer.tick(1000)
assert.equal(renderer.reloads, 0, 'wait for idle after releasing keys')
renderer.advance(6000); await renderer.tick(1000)
assert.equal(renderer.reloads, 1, 'idle cloud session loads the newly deployed build')
const offline = fixture(statusSource); await settle(); offline.version = 'c'.repeat(64); offline.ok = false
await offline.tick(15000); offline.advance(6000); await offline.tick(1000)
assert.equal(offline.reloads, 0, 'upstream failures must not trigger reload loops')
console.log('Cloud release passed: exact build marker, same-version stability, idle refresh, dialog/key guards and outage handling.')
