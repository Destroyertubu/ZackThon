import { randomInt } from 'node:crypto';
import { assert, uid, hash, now, owned, expect, paged, emit, journeyPublic, allowedContent } from './common.mjs';
import { seedDemo } from './providers.mjs';

const LAYOUT_VERSION = 'land-polar-frozen-1';
const BIOMES = ['forest', 'meadow', 'lake', 'ruins'];
const copy = value => structuredClone(value);
const h = text => hash(text).slice(0, 24);
const round = value => Math.round(value * 1000) / 1000;
const values = map => Object.values(map ?? {});

function content(state, id, snapshotId) {
  const item = snapshotId ? state.snapshots[snapshotId] : state.contents[id];
  assert(item && item.id === id, 'NOT_FOUND', '来源内容不存在。', 404);
  return item;
}

function makeNode(item, index, position) {
  const labels = (item.labels ?? []).filter(x => typeof x === 'string')
    .map(x => x.trim()).filter(x => Array.from(x).length > 1 && Array.from(x).length <= 18);
  const title = labels[0] || Array.from(item.title.replace(/[《》「」“”"?？!！]/g, '')).slice(0, 14).join('') || '未分类内容';
  return {
    id: 'n_' + h(item.id + index), topicId: 't_' + h(item.provider + ':' + title),
    title, category: title, position, biome: BIOMES[index % BIOMES.length],
    contentIds: [item.id], excerptIds: item.excerpts.slice(0, 2).map(e => e.id),
    expansionState: 'unexpanded', evidenceIds: [item.snapshotId],
  };
}

function edgesFor(source, target) {
  const edge = {
    id: 'e_' + h(source.id + target.id), source: source.id, target: target.id,
    relation: '同一问题下的阅读方向（规则布局，非因果判断）',
    evidenceIds: [...source.evidenceIds, ...target.evidenceIds],
  };
  const link = {
    id: 'w_' + h(edge.id), source: source.id, target: target.id, kind: 'path',
    waypoints: [copy(source.position), copy(target.position)],
  };
  return [edge, link];
}

export function makeWorld(seed, inputContents, mode, at, layoutSeed = randomInt(2 ** 31)) {
  const contents = [...new Map(inputContents.map(item => [item.id, item])).values()];
  assert(contents.length, 'CONTENT_INSUFFICIENT', '没有可用于构建地图的来源。');
  const base = (layoutSeed % 120) / 120 * Math.PI * 2;
  const nodes = [];
  if (contents.length === 1 && contents[0].canEnterField) {
    const item = contents[0], paragraphs = item.paragraphs.slice(0, 7);
    for (const [index, paragraph] of paragraphs.entries()) {
      const angle = base + (index - 1) * Math.PI * 2 / Math.max(1, paragraphs.length - 1);
      const position = index === 0 ? { x: 0, y: 0, z: -5 } : { x: round(Math.sin(angle) * 30), y: 0, z: round(Math.cos(angle) * 30) };
      const node = makeNode(item, index, position);
      node.title = index === 0 ? '主要问题' : `正文段落 ${index + 1}`;
      node.topicId = 't_' + h(item.id + paragraph.id);
      node.excerptIds = [`${item.snapshotId}:${paragraph.id}`];
      nodes.push(node);
    }
  } else {
    for (const [index, item] of contents.slice(0, 8).entries()) {
      const angle = base + (index - 1) * Math.PI * 2 / Math.max(1, Math.min(7, contents.length - 1));
      const position = index === 0 ? { x: 0, y: 0, z: -5 } : { x: round(Math.sin(angle) * 32), y: 0, z: round(Math.cos(angle) * 32) };
      nodes.push(makeNode(item, index, position));
    }
  }
  assert(nodes.length, 'CONTENT_INSUFFICIENT', '来源中没有可用于构建地图的段落。');
  const edges = [], walkableLinks = [];
  for (const node of nodes.slice(1)) {
    const [edge, link] = edgesFor(nodes[0], node); edges.push(edge); walkableLinks.push(link);
  }
  const snapshotMap = Object.fromEntries(contents.filter(item => nodes.some(node => node.contentIds.includes(item.id))).map(item => [item.id, item.snapshotId]));
  return {
    schemaVersion: '1.0-land', worldId: uid('world_'), version: 1, seedText: seed,
    layoutSeed, layoutVersion: LAYOUT_VERSION, sourceSnapshotSetId: 'set_' + h(JSON.stringify(snapshotMap)),
    snapshotMap, nodeLimit: 50, nodes, edges, walkableLinks,
    spawn: { position: { x: 0, y: 0, z: 3 }, yaw: 0 },
    capabilities: { canExpand: true, fieldTemplates: ['argument'] }, dataMode: mode, sourceFetchedAt: at,
    notice: nodes.length < 6 ? '目前资料较少，地图仅展示已取得的证据。' : '',
    semanticMethod: '原始标签／标题与段落规则；连线表示阅读方向，不表示事实或因果关系。',
  };
}

// Mutates only the supplied working world. Callers retain immutable version copies.
export function expandWorld(world, parentId, contents, _mode, _at) {
  const used = new Set(world.nodes.flatMap(node => node.contentIds));
  const fresh = [];
  for (const item of contents) if (!used.has(item.id)) { fresh.push(item); used.add(item.id); }
  const parent = world.nodes.find(node => node.id === parentId);
  assert(parent, 'NOT_FOUND', '扩展话题不存在。', 404);
  const baseVersion = world.version, newNodes = [], newEdges = [], newWalkableLinks = [];
  for (const item of fresh.slice(0, Math.max(0, Math.min(4, world.nodeLimit - world.nodes.length)))) {
    const index = world.nodes.length;
    let position;
    for (let attempt = 0; attempt < 300; attempt++) {
      const angle = (index + attempt) * 2.39996323 + (world.layoutSeed % 100) / 100;
      const radius = 36 + Math.floor(attempt / 14) * 18;
      const candidate = { x: round(parent.position.x + Math.cos(angle) * radius), y: 0, z: round(parent.position.z + Math.sin(angle) * radius) };
      if (world.nodes.every(node => Math.hypot(candidate.x - node.position.x, candidate.z - node.position.z) >= 18)) { position = candidate; break; }
    }
    if (!position) break;
    const node = makeNode(item, index, position), [edge, link] = edgesFor(parent, node);
    newNodes.push(node); newEdges.push(edge); newWalkableLinks.push(link);
    world.nodes.push(node); world.edges.push(edge); world.walkableLinks.push(link);
    world.snapshotMap[item.id] = item.snapshotId;
  }
  parent.expansionState = newNodes.length ? 'expanded' : 'exhausted';
  world.version += 1;
  world.sourceSnapshotSetId = 'set_' + h(JSON.stringify(world.snapshotMap));
  if (world.dataMode !== 'demo') world.dataMode = 'cached';
  if (world.nodes.length >= world.nodeLimit) {
    world.capabilities.canExpand = false;
    world.notice = '本次旅程的边界已展开，可换个问题再出发。';
  }
  return {
    worldId: world.worldId, baseVersion, newVersion: world.version, newNodes, newEdges,
    newWalkableLinks, updatedExpansionState: parent.expansionState,
  };
}

export function makeField(item) {
  assert(item.canEnterField, 'CONTENT_INSUFFICIENT', item.fieldDisabledReason || '此来源没有可进入的正文。');
  const paragraphs = item.paragraphs;
  assert(paragraphs.length, 'CONTENT_INSUFFICIENT', '此来源没有可进入的正文段落。');
  const chosen = paragraphs.length <= 8 ? paragraphs : [paragraphs[0], ...paragraphs.slice(1, 7), paragraphs.at(-1)];
  const sections = chosen.map((paragraph, index) => ({
    id: 'section_' + paragraph.id,
    title: index === 0 ? '主要问题' : index === chosen.length - 1 ? '总结 / 开放问题' : `论述段落 ${index}`,
    paragraphIds: [paragraph.id], text: paragraph.text, excerptId: `${item.snapshotId}:${paragraph.id}`,
    position: { x: index === 0 ? 0 : index % 2 ? -5 : 5, y: 0, z: -index * 15 },
  }));
  return {
    id: 'f_' + h(item.snapshotId + ':argument-rules-1'), contentId: item.id, snapshotId: item.snapshotId,
    templateType: 'argument', templateVersion: 'argument-rules-1', generator: 'rules', title: item.title, coverage: item.coverage,
    coverageNote: `规则结构导览，依据已取得的${item.coverage === 'chapter' ? '章节正文' : '正文'}；选取 ${chosen.length} / ${paragraphs.length} 个段落，不声称自动验证作者论证。`,
    sections, relations: sections.slice(1).map((section, index) => ({ source: sections[index].id, target: section.id, relation: '原文顺序' })),
    spawn: { position: { x: 0, y: 0, z: 6 }, yaw: 0 }, dataMode: item.dataMode,
  };
}

function clientId(request) {
  const id = request.headers.get('x-client-id') || '';
  assert(id.length >= 8 && id.length <= 100, 'VALIDATION_ERROR', '缺少标签页标识。');
  return id;
}

function checkLease(journey, request) {
  assert(journey.status === 'active', 'FORBIDDEN', '此旅程未处于漫游状态。', 403);
  assert(journey.leaseClient === clientId(request) && journey.leaseUntil >= Date.now(), 'TAB_CONFLICT', '此旅程由另一标签页控制，或写入租约已过期；请重新接管。', 409);
}

function validateCheckpoint(state, journey, checkpoint) {
  const world = owned(state.worlds, journey.worldId);
  assert(checkpoint.worldVersion === world.version, 'VERSION_CONFLICT', '世界已扩展，请载入最新地图再保存。', 409);
  if (checkpoint.scene === 'field') {
    const field = state.fields[checkpoint.fieldId];
    assert(field && world.snapshotMap[field.contentId] === field.snapshotId && checkpoint.returnContext, 'VALIDATION_ERROR', '场域与返回上下文无效。');
  }
  assert(!checkpoint.trackedNodeId || world.nodes.some(node => node.id === checkpoint.trackedNodeId), 'VALIDATION_ERROR', '追踪目标不存在。');
  return copy(checkpoint);
}

function pauseOthers(state, except) {
  for (const journey of values(state.journeys)) if (journey.id !== except && journey.status === 'active') {
    journey.status = 'paused'; journey.version += 1; journey.leaseClient = null; journey.leaseUntil = 0;
  }
}

function canvas(state, journey) {
  const world = owned(state.worlds, journey.worldId), events = [...(journey.events ?? [])].sort((a, b) => a.seq - b.seq);
  const nodes = world.nodes.map(node => ({
    ...copy(node), visits: events.filter(event => event.type === 'topic_entered' && event.topicId === node.topicId).length,
    dwellSeconds: Math.min(600, events.filter(event => event.type === 'topic_left' && event.topicId === node.topicId).reduce((sum, event) => sum + (event.payload.dwellSeconds || 0), 0)),
  }));
  let previous;
  const edges = new Map();
  for (const event of events) if (event.type === 'topic_entered') {
    if (previous && previous !== event.topicId && event.topicId) {
      const key = [previous, event.topicId].sort().join('|'); edges.set(key, (edges.get(key) || 0) + 1);
    }
    previous = event.topicId;
  }
  return {
    journey: journeyPublic(state, journey), nodes,
    edges: [...edges].map(([key, count]) => ({ topics: key.split('|'), count })),
    steps: events.map(event => ({ type: event.type, topicId: event.topicId, seq: event.seq, occurredAt: event.occurredAt })),
    anchors: values(state.anchors).filter(item => item.journeyId === journey.id),
    bag: values(state.bag).filter(item => item.journeyId === journey.id),
  };
}

export async function handleWorld(ctx) {
  const { state, request, method, path, query, body = {}, provider, job } = ctx;
  let match;
  if (method === 'GET' && path === '/seeds') {
    const demos = seedDemo(state);
    return { data: { items: [...new Map([...demos, ...values(state.presets)].map(item => [item.id, item])).values()].sort((a, b) => a.id.localeCompare(b.id)) } };
  }
  if (method === 'GET' && path === '/catalog/knowledge') {
    const items = await provider.knowledgeList();
    return { data: { items, dataMode: items[0]?.dataMode ?? 'cached', sourceFetchedAt: items[0]?.sourceFetchedAt ?? null } };
  }
  if (method === 'POST' && path === '/worlds') {
    const seedText = body.seedText == null ? null : body.seedText.trim();
    assert(seedText === null || (Array.from(seedText).length >= 2 && Array.from(seedText).length <= 100), 'VALIDATION_ERROR', '问题需要 2–100 个字符。');
    return job('world', { ...body, seedText }, async () => {
    let contents, mode, at, seed;
    const seedMode = body.seedMode ?? 'demo';
    if (seedMode === 'demo' || seedMode === 'preset') {
      const demos = seedDemo(state), presetId = body.presetId || 'demo-growth';
      const preset = values(state.presets).find(item => item.id === presetId) || demos.find(item => item.id === presetId);
      assert(preset, 'NOT_FOUND', '所选路线不存在。', 404);
      assert(!(seedMode === 'preset' && preset.dataMode === 'demo'), 'VALIDATION_ERROR', '演示路线必须明确选择 demo 模式。');
      contents = preset.contentIds.map(id => content(state, id)); mode = preset.dataMode; at = preset.sourceFetchedAt; seed = seedText || preset.seedText;
    } else if (seedMode === 'knowledge') {
      ({ contents, mode, at } = await provider.knowledge(state, body.presetId || ''));
      seed = seedText || Array.from(contents[0]?.title || '').slice(0, 100).join('');
    } else {
      seed = seedText || ''; ({ contents, mode, at } = await provider.search(state, seed));
    }
    const world = makeWorld(seed, contents, mode, at), journeyId = uid('journey_');
    const checkpoint = {
      worldVersion: 1, scene: 'world', position: copy(world.spawn.position), yaw: 0,
      camera: { yaw: 0, pitch: .25, distance: 5 }, trackedNodeId: null, navigationMode: 0, returnContext: null, fieldId: null,
    };
    pauseOthers(state);
    state.worlds[world.worldId] = world; state.worldVersions[`${world.worldId}:1`] = copy(world);
    state.journeys[journeyId] = { id: journeyId, worldId: world.worldId, status: 'active', version: 1, checkpoint, startedAt: now(), completedAt: null, leaseClient: null, leaseUntil: 0, events: [] };
    return { worldId: world.worldId, journeyId };
    });
  }
  if (method === 'GET' && (match = path.match(/^\/worlds\/([^/]+)$/))) {
    let world = owned(state.worlds, match[1]);
    if (query.has('version')) {
      const version = Number(query.get('version'));
      assert(Number.isInteger(version) && version >= 1, 'VALIDATION_ERROR', '世界版本无效。');
      world = owned(state.worldVersions, `${world.worldId}:${version}`);
    }
    return { data: { ...world, dataMode: world.dataMode === 'demo' ? 'demo' : 'cached' } };
  }
  if (method === 'POST' && (match = path.match(/^\/worlds\/([^/]+)\/expansions$/))) {
    const worldId = match[1]; owned(state.worlds, worldId);
    assert(values(state.journeys).some(journey => journey.worldId === worldId && journey.status === 'active'), 'FORBIDDEN', '只有正在进行的旅程可以扩展。', 403);
    return job('expand', { worldId, ...body }, async () => {
      const current = owned(state.worlds, worldId); expect(current, body.expectedVersion);
      const world = copy(current), parent = world.nodes.find(node => node.id === body.nodeId);
      assert(parent, 'NOT_FOUND', '话题不存在。', 404);
      if (['expanded', 'exhausted'].includes(parent.expansionState) || world.nodes.length >= world.nodeLimit) return { worldId, alreadyExpanded: true };
      let contents, mode, at;
      if (world.dataMode === 'demo') {
        seedDemo(state); contents = values(state.contents).filter(item => item.provider === 'demo'); mode = 'demo'; at = world.sourceFetchedAt;
      } else ({ contents, mode, at } = await provider.search(state, parent.title));
      const result = expandWorld(world, parent.id, contents, mode, at);
      expect(owned(state.worlds, worldId), body.expectedVersion);
      const active = values(state.journeys).find(journey => journey.worldId === worldId && journey.status === 'active');
      assert(active, 'FORBIDDEN', '旅程已暂停或归档，未提交迟到扩展。', 403);
      const version = copy(world);
      emit(state, active.id, 'world_expanded', parent.topicId, { newNodes: result.newNodes.length });
      state.worlds[worldId] = world; state.worldVersions[`${worldId}:${world.version}`] = version;
      return result;
    });
  }
  if (method === 'GET' && (match = path.match(/^\/contents\/([^/]+)$/))) {
    const item = allowedContent(state, match[1], query.get('snapshotId') || undefined);
    return { data: { ...item, dataMode: item.dataMode === 'demo' ? 'demo' : 'cached' } };
  }
  if (method === 'POST' && (match = path.match(/^\/contents\/([^/]+)\/fields$/))) {
    const item = allowedContent(state, match[1], body.snapshotId);
    assert(item.canEnterField, 'CONTENT_INSUFFICIENT', item.fieldDisabledReason || '此来源没有可进入的正文。');
    const existing = values(state.fields).find(field => field.snapshotId === body.snapshotId);
    if (existing) return { data: { fieldId: existing.id } };
    return job('field', { contentId: item.id, ...body }, async () => {
      const field = makeField(item); state.fields[field.id] = field; return { fieldId: field.id };
    });
  }
  if (method === 'GET' && (match = path.match(/^\/fields\/([^/]+)$/))) {
    const field = owned(state.fields, match[1]); allowedContent(state, field.contentId, field.snapshotId); return { data: field };
  }
  if (method === 'GET' && path === '/journeys') {
    return { data: paged(values(state.journeys).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(journey => journeyPublic(state, journey)), query) };
  }
  if (!(match = path.match(/^\/journeys\/([^/]+)(?:\/(lease|checkpoint|pause|resume|complete|events|canvas))?$/))) return undefined;
  const [, journeyId, action] = match;
  const supported = (!action && ['GET', 'DELETE'].includes(method)) || (action === 'canvas' && method === 'GET') || (action === 'checkpoint' && method === 'PUT') || (['lease', 'pause', 'resume', 'complete', 'events'].includes(action) && method === 'POST');
  if (!supported) return undefined;
  const journey = owned(state.journeys, journeyId);
  if (method === 'GET') return { data: action === 'canvas' ? canvas(state, journey) : journeyPublic(state, journey) };
  if (method === 'DELETE') {
    const deleteValue = (query.get('deletePrivateAnchors') || 'false').toLowerCase();
    assert(['true', '1', 'yes', 'on', 'false', '0', 'no', 'off'].includes(deleteValue), 'VALIDATION_ERROR', '删除锚点参数无效。');
    const deleteAnchors = ['true', '1', 'yes', 'on'].includes(deleteValue);
    for (const item of values(state.bag)) if (item.journeyId === journeyId) item.journeyId = null;
    for (const item of values(state.anchors)) if (item.journeyId === journeyId) {
      if (deleteAnchors) delete state.anchors[item.id]; else item.journeyId = null;
    }
    delete state.journeys[journeyId];
    return { data: { removedId: journeyId, collectionsRetained: true } };
  }
  if (action === 'events') {
    const world = owned(state.worlds, journey.worldId), pending = [], seen = new Map((journey.events ?? []).map(event => [event.eventId, event]));
    for (const event of body.events) {
      if (seen.has(event.eventId)) continue;
      checkLease(journey, request);
      assert(!event.topicId || world.nodes.some(node => node.topicId === event.topicId), 'VALIDATION_ERROR', '事件话题不属于此世界。');
      assert(!event.worldNodeId || world.nodes.some(node => node.id === event.worldNodeId && (!event.topicId || node.topicId === event.topicId)), 'VALIDATION_ERROR', '事件节点与话题不一致。');
      assert(typeof event.occurredAt === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(event.occurredAt) && Number.isFinite(Date.parse(event.occurredAt)), 'VALIDATION_ERROR', '事件时间无效。');
      const payload = { scene: event.payload?.scene === 'field' ? 'field' : 'world' };
      if (event.type === 'topic_entered') assert(Number.isFinite(Number(event.payload?.dwellSeconds)) && Number(event.payload.dwellSeconds) >= 2, 'VALIDATION_ERROR', '需要前台停留两秒才记录访问。');
      if (event.type === 'topic_left') {
        const seconds = Number(event.payload?.dwellSeconds ?? 0); payload.dwellSeconds = Number.isFinite(seconds) ? Math.min(120, Math.max(0, seconds)) : 0;
      }
      pending.push({ ...event, payload }); seen.set(event.eventId, event);
    }
    for (const event of pending) {
      emit(state, journeyId, event.type, event.topicId ?? null, event.payload, event.eventId);
      const saved = journey.events.find(item => item.eventId === event.eventId); saved.occurredAt = event.occurredAt;
    }
    const accepted = body.events.map(event => ({ eventId: event.eventId, seq: journey.events.find(item => item.eventId === event.eventId).seq }));
    return { data: { accepted, highestSeq: Math.max(0, ...accepted.map(event => event.seq)) } };
  }
  expect(journey, body.expectedVersion);
  if (action === 'lease') {
    const client = clientId(request);
    assert(journey.status === 'active', 'FORBIDDEN', '请先继续旅程。', 403);
    assert(!journey.leaseClient || journey.leaseClient === client || journey.leaseUntil <= Date.now() || body.takeover, 'TAB_CONFLICT', '另一标签页正在控制此旅程。可显式接管。', 409);
    journey.leaseClient = client; journey.leaseUntil = Date.now() + 90_000;
    return { data: { leaseSeconds: 90 } };
  }
  if (action === 'checkpoint' || action === 'pause') {
    checkLease(journey, request);
    journey.checkpoint = validateCheckpoint(state, journey, body.checkpoint); journey.version += 1;
    if (action === 'pause') { journey.status = 'paused'; journey.leaseClient = null; journey.leaseUntil = 0; }
    else journey.leaseUntil = Date.now() + 90_000;
  } else if (action === 'resume') {
    assert(journey.status !== 'completed', 'FORBIDDEN', '已归档旅程为只读，请从大门开始新的旅程。', 403);
    const client = clientId(request); pauseOthers(state, journeyId);
    journey.status = 'active'; journey.version += 1; journey.leaseClient = client; journey.leaseUntil = Date.now() + 90_000;
  } else if (action === 'complete') {
    if (journey.status === 'active') checkLease(journey, request);
    if (journey.status !== 'completed') { journey.status = 'completed'; journey.completedAt = now(); journey.version += 1; journey.leaseClient = null; journey.leaseUntil = 0; }
  }
  return { data: journeyPublic(state, journey) };
}
