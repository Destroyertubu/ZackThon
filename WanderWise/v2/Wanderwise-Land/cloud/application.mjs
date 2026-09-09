import {AppError, assert, uid, hash, now, equal, owned, updateDocument, canonical} from './common.mjs';
import {validateBody} from './validation.mjs';
import {createProvider} from './providers.mjs';
import {handleWorld} from './world.mjs';
import {handleKnowledge} from './knowledge.mjs';

const DAY = 86400000;
function freshState() {
  return {schemaVersion: 'netlify-land-1', owner: uid('guest_'), csrf: uid(), createdAt: now(), lastSeen: Date.now(), expiresAt: Date.now() + 30 * DAY,
    worlds: {}, worldVersions: {}, journeys: {}, contents: {}, snapshots: {}, fields: {}, bag: {}, anchors: {}, links: {}, insights: {}, jobs: {}, mutations: {}};
}
const requiresIdempotency = (method, path) => (method === 'POST' && (['/worlds','/bag/items','/bag/links','/anchors','/syntheses'].includes(path) || /\/(expansions|fields|save)$/.test(path))) || (method === 'PATCH' && /^\/(bag\/items|anchors)\//.test(path));
function safeFailure(error) {return error instanceof AppError ? error.public() : {code: 'INTERNAL_ERROR', message: '任务未能完成，请稍后重试。', retryable: true, details: {}};}

export function createApplication({storage, getEnv = name => process.env[name], secureCookies = true, provider: suppliedProvider} = {}) {
  const provider = suppliedProvider || createProvider({storage, getEnv});
  const flags = () => ({liveSearch: !!getEnv('ZHIHU_ACCESS_SECRET'), aiSynthesis: !!getEnv('ZHIHU_ACCESS_SECRET'), oauth: false, social: false, renderer: 'native-webgl2', serverPersistence: true, hosting: 'netlify'});
  const summary = state => ({user: {id: state.owner, identityType: 'guest', displayName: '漫行者'}, csrfToken: state.csrf, features: flags(), retentionDays: 30});
  const cookie = (raw, remove = false) => `ww_session=${remove ? '' : raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${remove ? 0 : 2592000}${secureCookies ? '; Secure' : ''}`;
  async function load(request) {
    const raw = request.headers.get('cookie')?.match(/(?:^|;\s*)ww_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    assert(raw, 'SESSION_EXPIRED', '访客会话已过期，请重新开始游客会话。', 401);
    const key = 'users/' + hash(raw), record = await storage.read(key);
    assert(record && !record.data.deleted && record.data.expiresAt > Date.now(), 'SESSION_EXPIRED', '访客会话已过期，请重新开始游客会话。', 401);
    return {raw, key, ...record};
  }
  async function handler(request, context = {}) {
    const requestId = uid('req_');
    const respond = (data, status = 200, headers = {}, error = false) => new Response(JSON.stringify({[error ? 'error' : 'data']: data, meta: {requestId}}), {status,
      headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers}});
    try {
      const url = new URL(request.url), path = url.pathname.replace(/^\/api\/v1/, ''), method = request.method;
      if (method === 'GET' && path === '/health/live') return respond({status: 'ok', hosting: 'netlify', version: '1.0.0-land-netlify'});
      if (method === 'GET' && path === '/health/ready') {await storage.read('health/probe'); return respond({status: 'ok', database: true, persistence: 'netlify-blobs', features: flags()});}
      const writing = !['GET','HEAD'].includes(method);
      let body = {};
      if (writing) {
        assert(request.headers.get('origin') === url.origin, 'FORBIDDEN', '请求来源不匹配。', 403);
        assert(Number(request.headers.get('content-length') || 0) <= 512000, 'TOO_LARGE', '请求体超过限制。', 413);
        const raw = await request.text(); assert(Buffer.byteLength(raw) <= 512000, 'TOO_LARGE', '请求体超过限制。', 413);
        if (raw) {
          assert(request.headers.get('content-type')?.startsWith('application/json'), 'VALIDATION_ERROR', '只接受 JSON 请求。', 415);
          try {body = JSON.parse(raw);} catch {throw new AppError('VALIDATION_ERROR', '请求不是有效 JSON。');}
          assert(body && typeof body === 'object' && !Array.isArray(body), 'VALIDATION_ERROR', '请求应为 JSON 对象。');
        }
        validateBody(method, url.pathname, body);
      }
      if (method === 'POST' && path === '/session/guest') {
        let user;
        try {user = await load(request);} catch (error) {if (error.code !== 'SESSION_EXPIRED') throw error;}
        if (user) {
          const state = await updateDocument(storage, user.key, state => {
            assert(state && !state.deleted && state.expiresAt > Date.now(), 'SESSION_EXPIRED', '访客会话已过期。', 401);
            state.lastSeen = Date.now(); state.expiresAt = Date.now() + 30 * DAY; return {data: state, result: state};
          });
          return respond(summary(state), 200, {'Set-Cookie': cookie(user.raw)});
        }
        await updateDocument(storage, `guest-rate/${hash(context.ip || 'local')}/${Math.floor(Date.now() / 3600000)}`, previous => {
          const entry = previous || {count: 0, expiresAt: Date.now() + DAY};
          assert(entry.count < 30, 'RATE_LIMITED', '此网络创建访客过于频繁，请稍后重试。', 429);
          entry.count++; return {data: entry};
        });
        const raw = uid() + uid(), state = freshState();
        assert(await storage.compareSet('users/' + hash(raw), state, null), 'INTERNAL_ERROR', '会话建立失败。', 500);
        return respond(summary(state), 200, {'Set-Cookie': cookie(raw)});
      }
      // Demo route metadata is public, matching the Python endpoint.
      if (method === 'GET' && path === '/seeds') {
        let state = freshState();
        try {state = (await load(request)).data;} catch (error) {if (error.code !== 'SESSION_EXPIRED') throw error;}
        return respond((await handleWorld({state, request, path, method, query: url.searchParams, body, provider})).data);
      }
      const user = await load(request);
      if (writing) assert(equal(request.headers.get('x-csrf-token'), user.data.csrf), 'FORBIDDEN', '安全校验失效，请刷新页面后重试。', 403);
      if (method === 'GET' && path === '/session') return respond(summary(user.data));
      if (method === 'DELETE' && path === '/me/data') {
        // A tombstone prevents an in-flight request from resurrecting the deleted document.
        await updateDocument(storage, user.key, () => ({data: {deleted: true, expiresAt: Date.now() + DAY}}));
        return respond({deleted: true}, 200, {'Set-Cookie': cookie('', true)});
      }
      const key = request.headers.get('idempotency-key');
      if (requiresIdempotency(method, path)) assert(key && key.length >= 8 && key.length <= 160, 'VALIDATION_ERROR', '写入需要有效 Idempotency-Key。');
      const mutationKey = key ? hash(key) : null, signature = hash(method + path + canonical(body));
      const replay = state => {
        const previous = mutationKey && state.mutations[mutationKey];
        if (!previous) return null;
        assert(previous.signature === signature, 'IDEMPOTENCY_CONFLICT', '同一操作标识不能用于不同请求。', 409);
        return respond(previous.response.data, previous.response.status || 200);
      };
      if (writing) {const previous = replay(user.data); if (previous) return previous;}
      // Persist a claim before any generation call. Concurrent retries cannot double-call an upstream.
      // Claims are never automatically reclaimed after an uncertain outcome; a new explicit action uses a new key.
      const generation = method === 'POST' && (['/worlds','/syntheses'].includes(path) || /\/(expansions|fields)$/.test(path));
      if (generation) {
        const claimKey = `operations/${hash(user.key)}/${mutationKey}`;
        if (!await storage.compareSet(claimKey, {signature, createdAt: Date.now()}, null)) {
          const latest = await storage.read(user.key);
          assert(latest && !latest.data.deleted && latest.data.expiresAt > Date.now(), 'SESSION_EXPIRED', '访客会话已过期。', 401);
          const previous = replay(latest.data); if (previous) return previous;
          const claim = await storage.read(claimKey);
          assert(claim?.data.signature === signature, 'IDEMPOTENCY_CONFLICT', '任务标识已用于不同请求。', 409);
          throw new AppError('GENERATION_IN_PROGRESS', '这次生成正在处理，或结果尚未确认；没有重复调用上游。请稍后查看日志，必要时重新发起。', 409, true);
        }
      }
      let preparedProvider;
      // Memoize external calls across CAS retries so conflicts never replay paid upstream work.
      const external = new Map();
      preparedProvider = Object.fromEntries(['search','knowledge','knowledgeList','aiSynthesis'].map(name => [name, async (...args) => {
        const hasState = ['search','knowledge'].includes(name), values = hasState ? args.slice(1) : args;
        const id = name + JSON.stringify(values);
        if (!external.has(id)) external.set(id, Promise.resolve(provider[name](...args)).then(result => ({result, presets: hasState ? structuredClone(args[0].presets || {}) : {}})));
        const cached = await external.get(id), value = structuredClone(cached.result);
        if (hasState) {
          for (const c of value.contents) {args[0].contents[c.id] = c; args[0].snapshots[c.snapshotId] ||= c;}
          args[0].presets = {...(args[0].presets || {}), ...structuredClone(cached.presets)};
        }
        return value;
      }]));
      for (let attempt = 0; attempt < 6; attempt++) {
        const record = attempt ? await storage.read(user.key) : user;
        assert(record && !record.data.deleted && record.data.expiresAt > Date.now(), 'SESSION_EXPIRED', '访客会话已过期。', 401);
        const state = structuredClone(record.data);
        for (const [id, insight] of Object.entries(state.insights)) if (insight.status === 'draft' && Date.parse(insight.createdAt) < Date.now() - DAY) delete state.insights[id];
        if (writing && mutationKey && state.mutations[mutationKey]) {
          const old = state.mutations[mutationKey];
          assert(old.signature === signature, 'IDEMPOTENCY_CONFLICT', '同一操作标识不能用于不同请求。', 409);
          return respond(old.response.data, old.response.status || 200);
        }
        const ctx = {state, request, path, method, query: url.searchParams, body, provider: preparedProvider};
        ctx.job = async (kind, input, fn) => {
          const limit = Number(getEnv('WW_HOURLY_TASK_LIMIT') || 10);
          assert(Object.values(state.jobs).filter(j => j.type === kind && Date.parse(j.createdAt) > Date.now() - 3600000).length < limit, 'RATE_LIMITED', '本小时生成次数已达上限，请使用已有记录。', 429);
          const stamp = now(), job = {id: uid('job_'), type: kind, status: 'running', stage: 'generating', result: null, error: null, createdAt: stamp, updatedAt: stamp};
          job.jobId = job.id; state.jobs[job.id] = job;
          const before = structuredClone(state);
          try {job.result = await fn(); job.status = 'succeeded'; job.stage = 'done';}
          catch (error) {
            for (const name of Object.keys(state)) delete state[name];
            Object.assign(state, before);
            job.status = 'failed'; job.stage = 'failed'; job.error = safeFailure(error);
          }
          state.jobs[job.id] = job;
          job.updatedAt = now(); return {data: job, status: 202};
        };
        let response;
        const jobsMatch = path.match(/^\/jobs\/([^/]+)(\/cancel)?$/);
        if (jobsMatch && ['GET','POST'].includes(method)) {
          const job = owned(state.jobs, jobsMatch[1]);
          if (method === 'POST' && jobsMatch[2] && ['queued','running'].includes(job.status)) {job.status = 'cancelled'; job.stage = 'cancelled';}
          response = {data: job};
        } else response = await handleWorld(ctx) || await handleKnowledge(ctx);
        assert(response, 'NOT_FOUND', '此接口不存在。', 404);
        if (!writing) return respond(response.data, response.status || 200);
        state.lastSeen = Date.now(); state.expiresAt = Date.now() + 30 * DAY;
        for (const [id, old] of Object.entries(state.mutations)) if (old.createdAt < Date.now() - DAY) delete state.mutations[id];
        if (mutationKey) state.mutations[mutationKey] = {signature, response: structuredClone(response), createdAt: Date.now()};
        assert(Object.keys(state.mutations).length <= 3000 && Buffer.byteLength(JSON.stringify(state)) <= 12_000_000, 'STORAGE_LIMIT', '私人存档已达容量上限，请整理历史记录。');
        if (await storage.compareSet(user.key, state, record.etag)) return respond(response.data, response.status || 200);
      }
      throw new AppError('VERSION_CONFLICT', '存档正被另一项操作修改，请稍后重试。', 409, true);
    } catch (error) {
      return respond(safeFailure(error), error instanceof AppError ? error.status : 500, {}, true);
    }
  }
  return {handler};
}
