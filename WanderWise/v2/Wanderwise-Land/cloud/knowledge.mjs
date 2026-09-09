import { assert, uid, hash, now, owned, expect, paged, emit, allowedContent } from './common.mjs';

const newest = (items) => items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const copy = (value) => structuredClone(value);
const sameTarget = (state, type, id) => Object.values(state.bag).find((item) => item.targetType === type && item.targetId === id);

function insightMaterial(insight) {
  return {
    title: insight.result.title, text: insight.result.coreInsight,
    kind: insight.generator === 'user' ? 'user_insight' : 'ai_insight',
    authorName: '你',
    sourceLabel: '个人洞察 · ' + (insight.generator === 'user' ? '手工创作' : 'AI 辅助，可编辑'),
    dataMode: insight.dataMode, sourceUrl: null, tags: ['洞察'],
    note: insight.personalNote ?? '', evidenceChain: copy(insight.materials), sourceFetchedAt: insight.createdAt,
  };
}

function bagMaterial(state, body) {
  const journey = body.journeyId ? owned(state.journeys, body.journeyId) : null;
  const world = journey ? owned(state.worlds, journey.worldId) : null;
  if (body.targetType === 'insight') {
    const insight = owned(state.insights, body.targetId);
    assert(insight.status === 'saved', 'FORBIDDEN', '洞察还未保存。', 403);
    return { material: insightMaterial(insight), journey };
  }
  if (body.targetType === 'topic') {
    const node = world?.nodes.find((n) => n.topicId === body.targetId);
    assert(node, 'NOT_FOUND', '话题不在此旅程中。', 404);
    return { journey, material: {
      title: node.title, text: '', kind: 'topic', authorName: '', sourceLabel: '话题词 · 不是证据',
      dataMode: world.dataMode, topicId: node.topicId, tags: [node.title], note: '',
    } };
  }
  let content, excerpt = null;
  if (body.targetType === 'content') {
    content = allowedContent(state, body.targetId, world?.snapshotMap?.[body.targetId]);
  } else {
    const snapshotId = body.targetId.split(':')[0];
    const snapshot = Object.hasOwn(state.snapshots, snapshotId) ? state.snapshots[snapshotId] : null;
    assert(snapshot, 'NOT_FOUND', '摘录不存在。', 404);
    content = allowedContent(state, snapshot.contentId ?? snapshot.content_id ?? snapshot.id, snapshotId);
    excerpt = content.excerpts.find((item) => item.id === body.targetId);
    assert(excerpt, 'NOT_FOUND', '此摘录无有效来源定位。', 404);
  }
  assert(!world || Object.hasOwn(world.snapshotMap, content.id), 'FORBIDDEN', '材料不属于此旅程。', 403);
  const node = world?.nodes.find((n) => n.contentIds.includes(content.id));
  return { journey, material: {
    title: content.title, text: excerpt ? excerpt.text : content.text,
    kind: excerpt ? excerpt.kind : content.coverage, authorName: content.authorName,
    sourceUrl: content.sourceUrl, sourceLabel: content.sourceLabel, dataMode: content.dataMode,
    sourceFetchedAt: content.sourceFetchedAt, snapshotId: content.snapshotId, contentId: content.id,
    excerptId: excerpt?.id ?? null, topicId: node?.topicId ?? null,
    tags: content.labels.slice(0, 10), note: '', evidenceChain: [],
  } };
}

function addBag(state, material, targetType, targetId, journeyId = null) {
  const id = uid('bag_');
  const item = { ...copy(material), id, targetType, targetId, journeyId, version: 1, createdAt: now() };
  state.bag[id] = item;
  return item;
}

function removeBag(state, id) {
  delete state.bag[id];
  for (const link of Object.values(state.links)) {
    if (link.sourceBagItemId === id || link.targetBagItemId === id) delete state.links[link.id];
  }
}

async function synthesize(ctx) {
  const { state, body, provider } = ctx;
  return ctx.job('synthesis', body, async () => {
    const ids = [...new Set(body.bagItemIds)].sort();
    assert(ids.length >= 2 && ids.length <= 4, 'VALIDATION_ERROR', '需要 2–4 份不同材料。');
    const materials = ids.map((id) => {
      const item = owned(state.bag, id);
      assert(item.targetType !== 'topic' && item.text, 'CONTENT_INSUFFICIENT', '话题词本身不是证据，请选择内容或摘录。');
      return {
        id, version: item.version, title: item.title,
        text: Array.from(item.text).slice(0, 2000).join(''), authorName: item.authorName,
        sourceUrl: item.sourceUrl ?? null, sourceLabel: item.sourceLabel, kind: item.kind,
        snapshotId: item.snapshotId ?? null, contentId: item.contentId ?? null,
        evidenceChain: copy(item.evidenceChain ?? []), dataMode: item.dataMode,
      };
    });
    const question = body.question ?? '';
    const mode = body.mode ?? 'manual';
    const signature = hash(JSON.stringify({ materials, question, mode, promptVersion: '1' }));
    const previous = newest(Object.values(state.insights)).find((item) => item.signature === signature);
    if (previous) return { synthesisId: previous.id, cached: true };
    const result = mode === 'ai' ? await provider.aiSynthesis(copy(materials), question) : {
      title: '在两份收获之间', coreInsight: '', connection: '',
      uncertainty: '请核对两份材料适用的条件，并写下尚未确定的部分。', questions: [], evidenceIds: ids,
    };
    const id = uid('insight_');
    state.insights[id] = {
      id, materials, question, result: copy(result), generator: mode === 'ai' ? 'zhihu-ai' : 'user',
      signature, status: 'draft', generationVersion: '1',
      dataMode: materials.some((item) => item.dataMode === 'demo') ? 'demo' : 'cached', createdAt: now(),
    };
    return { synthesisId: id, cached: false };
  });
}

/** The caller owns authentication, schema validation, idempotency and durable CAS writes. */
export async function handleKnowledge(ctx) {
  const { state, method, path, query } = ctx;
  const body = ctx.body ?? {};
  let match;
  if (method === 'GET' && path === '/bag') {
    const needle = (query.get('q') ?? '').toLowerCase();
    const items = newest(Object.values(state.bag)).filter((item) =>
      (!query.get('journeyId') || item.journeyId === query.get('journeyId')) &&
      (!query.get('topicId') || item.topicId === query.get('topicId')) &&
      (!needle || (item.title + (item.text ?? '') + (item.note ?? '') + (item.tags ?? []).join(' ')).toLowerCase().includes(needle)));
    return { data: paged(items, query) };
  }
  if (method === 'POST' && path === '/bag/items') {
    const previous = sameTarget(state, body.targetType, body.targetId);
    if (previous) return { data: { ...previous, alreadyCollected: true } };
    const { material, journey } = bagMaterial(state, body);
    const item = addBag(state, material, body.targetType, body.targetId, body.journeyId ?? null);
    if (journey?.status === 'active') emit(state, journey.id, 'collected', material.topicId ?? null, { bagItemId: item.id });
    return { data: { ...item, alreadyCollected: false } };
  }
  if ((match = path.match(/^\/bag\/items\/([^/]+)$/))) {
    const id = match[1];
    if (method === 'PATCH') {
      const item = owned(state.bag, id);
      expect(item, body.expectedVersion);
      if (body.tags != null) {
        // Pydantic's custom validator is not represented by the OpenAPI schema.
        assert(body.tags.every((tag) => Array.from(tag).length <= 30), 'VALIDATION_ERROR', '标签最多 30 字。');
        item.tags = [...new Set(body.tags.map((tag) => tag.trim()).filter(Boolean))];
        item.manualTags = true;
      }
      if (body.note != null) item.note = body.note;
      item.version += 1;
      return { data: item };
    }
    if (method === 'DELETE') {
      removeBag(state, id);
      return { data: { removedId: id } };
    }
  }
  if (method === 'GET' && path === '/bag/links') return { data: { items: Object.values(state.links) } };
  if (method === 'POST' && path === '/bag/links') {
    const [sourceBagItemId, targetBagItemId] = [body.sourceBagItemId, body.targetBagItemId].sort();
    owned(state.bag, sourceBagItemId);
    owned(state.bag, targetBagItemId);
    assert(sourceBagItemId !== targetBagItemId, 'VALIDATION_ERROR', '不能将材料与自身连线。');
    const previous = Object.values(state.links).find((link) => link.sourceBagItemId === sourceBagItemId && link.targetBagItemId === targetBagItemId);
    if (previous) return { data: previous };
    const id = uid('link_');
    const link = { id, sourceBagItemId, targetBagItemId, note: body.note ?? '' };
    state.links[id] = link;
    return { data: link };
  }
  if (method === 'DELETE' && (match = path.match(/^\/bag\/links\/([^/]+)$/))) {
    delete state.links[match[1]];
    return { data: { removedId: match[1] } };
  }
  if (method === 'GET' && path === '/anchors') {
    assert((query.get('scope') ?? 'mine') === 'mine', 'FEATURE_NOT_ENABLED', '公开锚点尚未开放。', 403);
    const items = newest(Object.values(state.anchors)).filter((item) =>
      ['journeyId', 'topicId', 'contentId'].every((field) => !query.get(field) || item[field] === query.get(field)));
    return { data: { items } };
  }
  if (method === 'POST' && path === '/anchors') {
    const text = body.text.trim();
    assert(text, 'VALIDATION_ERROR', '想法不能为空白。');
    const journey = owned(state.journeys, body.journeyId);
    assert(journey.status !== 'completed', 'FORBIDDEN', '归档旅程不可新增事件；请开始新的旅程。', 403);
    const world = owned(state.worlds, journey.worldId);
    const node = world.nodes.find((item) => item.topicId === body.topicId);
    assert(node && (!body.contentId || node.contentIds.includes(body.contentId)), 'VALIDATION_ERROR', '锚点关联不是同一语境。');
    const offset = body.localOffset ?? { x: 1, y: 0, z: 1 };
    assert(Math.abs(offset.x) <= 12 && Math.abs(offset.z) <= 12 && Math.abs(offset.y) <= 4, 'VALIDATION_ERROR', '锚点偏移超出话题区域。');
    if (body.excerptId) {
      assert(body.contentId, 'VALIDATION_ERROR', '摘录需要绑定内容。');
      const content = allowedContent(state, body.contentId, world.snapshotMap[body.contentId]);
      assert(content.excerpts.some((item) => item.id === body.excerptId), 'VALIDATION_ERROR', '摘录与内容不符。');
    }
    const id = uid('anchor_'), stamp = now();
    const anchor = {
      journeyId: journey.id, topicId: body.topicId, contentId: body.contentId ?? null, excerptId: body.excerptId ?? null,
      localOffset: copy(offset), text, visibility: 'private', topicTitle: node.title,
      id, version: 1, createdAt: stamp, updatedAt: stamp,
    };
    state.anchors[id] = anchor;
    if (journey.status === 'active') emit(state, journey.id, 'anchor_created', body.topicId, { anchorId: id });
    return { data: anchor };
  }
  if ((match = path.match(/^\/anchors\/([^/]+)$/))) {
    const id = match[1];
    if (method === 'PATCH') {
      const text = body.text.trim();
      assert(text, 'VALIDATION_ERROR', '想法不能为空白。');
      const anchor = owned(state.anchors, id);
      expect(anchor, body.expectedVersion);
      anchor.text = text;
      anchor.version += 1;
      anchor.updatedAt = now();
      return { data: anchor };
    }
    if (method === 'DELETE') {
      delete state.anchors[id];
      return { data: { removedId: id } };
    }
  }
  if (method === 'POST' && path === '/syntheses') return synthesize(ctx);
  if (method === 'GET' && (match = path.match(/^\/(?:syntheses|insights)\/([^/]+)$/))) {
    return { data: owned(state.insights, match[1]) };
  }
  if (method === 'POST' && (match = path.match(/^\/syntheses\/([^/]+)\/save$/))) {
    const insight = owned(state.insights, match[1]);
    if (insight.status === 'saved') return { data: insight };
    assert(body.coreInsight.trim() && body.title.trim(), 'VALIDATION_ERROR', '请写下洞察内容和标题。');
    const evidenceIds = insight.result.evidenceIds ?? insight.materials.map((item) => item.id);
    insight.result = {
      title: body.title, coreInsight: body.coreInsight, connection: body.connection ?? '', uncertainty: body.uncertainty ?? '',
      questions: copy(body.questions ?? []), evidenceIds: copy(evidenceIds),
    };
    insight.personalNote = body.personalNote ?? '';
    insight.status = 'saved';
    insight.savedAt = now();
    if (!sameTarget(state, 'insight', insight.id)) addBag(state, insightMaterial(insight), 'insight', insight.id);
    return { data: insight };
  }
  if (method === 'GET' && path === '/insights') {
    return { data: { items: newest(Object.values(state.insights).filter((insight) => insight.status === 'saved')) } };
  }
  if (method === 'DELETE' && (match = path.match(/^\/insights\/([^/]+)$/))) {
    const id = match[1];
    owned(state.insights, id);
    for (const item of Object.values(state.bag)) if (item.targetType === 'insight' && item.targetId === id) removeBag(state, item.id);
    delete state.insights[id];
    return { data: { removedId: id } };
  }
  return undefined;
}
