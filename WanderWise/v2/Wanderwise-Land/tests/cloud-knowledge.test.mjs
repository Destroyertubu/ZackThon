import test from 'node:test';
import assert from 'node:assert/strict';
import { handleKnowledge } from '../cloud/knowledge.mjs';

function fixture() {
  const state = Object.fromEntries(['bag', 'links', 'anchors', 'insights', 'worlds', 'journeys', 'contents', 'snapshots', 'fields', 'jobs'].map((key) => [key, {}]));
  for (let n = 1; n <= 3; n += 1) {
    const content = {
      id: `content_${n}`, snapshotId: `snap_${n}`, title: `材料 ${n}`, text: `原文 ${n}`,
      authorName: '演示作者', sourceUrl: null, sourceLabel: '原创演示 · 非知乎数据',
      dataMode: 'demo', coverage: 'full', sourceFetchedAt: '2026-09-09T00:00:00.000Z',
      labels: ['学习'], excerpts: [{ id: `snap_${n}:excerpt_1`, text: `摘录 ${n}`, kind: 'excerpt' }],
    };
    state.contents[content.id] = structuredClone(content);
    state.snapshots[content.snapshotId] = structuredClone(content);
  }
  state.worlds.world_1 = {
    worldId: 'world_1', seedText: '如何学习', dataMode: 'demo',
    snapshotMap: { content_1: 'snap_1', content_2: 'snap_2' },
    nodes: [{ id: 'node_1', topicId: 'topic_1', title: '学习', contentIds: ['content_1', 'content_2'] }],
  };
  state.worlds.world_2 = {
    worldId: 'world_2', seedText: '另一个问题', dataMode: 'demo',
    snapshotMap: { content_3: 'snap_3' },
    nodes: [{ id: 'node_2', topicId: 'topic_2', title: '其他', contentIds: ['content_3'] }],
  };
  state.journeys.journey_1 = { id: 'journey_1', worldId: 'world_1', status: 'active', version: 1, events: [] };
  state.journeys.journey_2 = { id: 'journey_2', worldId: 'world_2', status: 'paused', version: 1, events: [] };
  const provider = { aiSynthesis: async () => { throw new Error('manual flow must not call AI'); } };
  let jobCount = 0;
  async function call(method, url, body = {}) {
    const target = new URL(url, 'https://wanderwise.example');
    return handleKnowledge({
      state, provider, method, path: target.pathname, query: target.searchParams, body,
      request: new Request(target, { method }),
      job: async (kind, input, fn) => {
        const id = `job_${++jobCount}`;
        const result = await fn();
        const job = { id, jobId: id, type: kind, input, status: 'succeeded', stage: 'done', result };
        state.jobs[id] = job;
        return { data: job, status: 202 };
      },
    });
  }
  async function collect(targetId, targetType = 'content', journeyId = 'journey_1') {
    return (await call('POST', '/bag/items', { targetType, targetId, journeyId })).data;
  }
  return { state, call, collect, provider };
}

const code = (expected) => (error) => error.code === expected;

test('collect snapshots and excerpts with original provenance; duplicate collection emits no extra event', async () => {
  const { state, collect } = fixture();
  const first = await collect('snap_1:excerpt_1', 'excerpt');
  assert.equal(first.text, '摘录 1');
  assert.equal(first.contentId, 'content_1');
  assert.equal(first.snapshotId, 'snap_1');
  assert.equal(first.topicId, 'topic_1');
  assert.equal(first.sourceLabel, '原创演示 · 非知乎数据');
  assert.equal(first.version, 1);
  assert.equal(first.alreadyCollected, false);
  const again = await collect('snap_1:excerpt_1', 'excerpt');
  assert.equal(again.id, first.id);
  assert.equal(again.alreadyCollected, true);
  assert.equal(state.journeys.journey_1.events.length, 1);
  state.snapshots.snap_1.excerpts[0].text = '来源后来发生变化';
  assert.equal(state.bag[first.id].text, '摘录 1');
  await assert.rejects(collect('content_3'), code('FORBIDDEN'));
  await assert.rejects(collect('snap_1:missing', 'excerpt'), code('NOT_FOUND'));
});

test('bag editing requires the current version, normalizes tags and supports combined filters', async () => {
  const { state, collect, call } = fixture();
  const a = await collect('content_1'), b = await collect('content_2');
  state.bag[a.id].createdAt = '2026-09-08T00:00:00.000Z';
  state.bag[b.id].createdAt = '2026-09-09T00:00:00.000Z';
  const edited = (await call('PATCH', `/bag/items/${a.id}`, { expectedVersion: 1, tags: ['  方法  ', '方法', '', '证据'], note: '值得再读' })).data;
  assert.deepEqual(edited.tags, ['方法', '证据']);
  assert.equal(edited.manualTags, true);
  assert.equal(edited.version, 2);
  await assert.rejects(call('PATCH', `/bag/items/${a.id}`, { expectedVersion: 2, tags: ['长'.repeat(31)] }), code('VALIDATION_ERROR'));
  await assert.rejects(call('PATCH', `/bag/items/${a.id}`, { expectedVersion: 1, note: '旧版本' }), code('VERSION_CONFLICT'));
  assert.equal(state.bag[a.id].note, '值得再读');
  const filtered = (await call('GET', '/bag?q=再读&journeyId=journey_1&topicId=topic_1')).data;
  assert.deepEqual(filtered.items.map((item) => item.id), [a.id]);
  const first = (await call('GET', '/bag?limit=1')).data;
  assert.equal(first.items[0].id, b.id);
  assert.equal(first.hasMore, true);
  assert.equal(first.nextCursor, '1');
  assert.equal((await call('GET', '/bag?limit=1&cursor=1')).data.items[0].id, a.id);
});

test('links are unordered and deduplicated; deleting a bag item cascades only its links', async () => {
  const { state, call, collect } = fixture();
  const a = await collect('content_1'), b = await collect('content_2');
  const one = (await call('POST', '/bag/links', { sourceBagItemId: a.id, targetBagItemId: b.id, note: '互相补充' })).data;
  const two = (await call('POST', '/bag/links', { sourceBagItemId: b.id, targetBagItemId: a.id, note: '不覆盖原联系' })).data;
  assert.equal(two.id, one.id);
  assert.equal(two.note, '互相补充');
  await assert.rejects(call('POST', '/bag/links', { sourceBagItemId: a.id, targetBagItemId: a.id }), code('VALIDATION_ERROR'));
  await call('DELETE', `/bag/items/${a.id}`);
  assert.equal(Object.keys(state.links).length, 0);
  assert.ok(state.bag[b.id]);
  assert.deepEqual((await call('DELETE', '/bag/links/missing')).data, { removedId: 'missing' });
});

test('private anchors enforce context, bounds, archived journeys, excerpt identity and version', async () => {
  const { state, call } = fixture();
  const body = { journeyId: 'journey_1', topicId: 'topic_1', contentId: 'content_1', excerptId: 'snap_1:excerpt_1', text: '  我自己的想法  ' };
  const anchor = (await call('POST', '/anchors', body)).data;
  assert.deepEqual(anchor.localOffset, { x: 1, y: 0, z: 1 });
  assert.equal(anchor.visibility, 'private');
  assert.equal(anchor.topicTitle, '学习');
  assert.equal(anchor.text, '我自己的想法');
  assert.equal(state.journeys.journey_1.events.length, 1);
  for (const change of [
    { contentId: 'content_3' }, { excerptId: 'snap_2:excerpt_1' }, { contentId: null },
    { localOffset: { x: 13, y: 0, z: 0 } }, { localOffset: { x: 0, y: 5, z: 0 } },
    { text: '   ' },
  ]) await assert.rejects(call('POST', '/anchors', { ...body, ...change }), code('VALIDATION_ERROR'));
  state.journeys.journey_1.status = 'completed';
  await assert.rejects(call('POST', '/anchors', body), code('FORBIDDEN'));
  const edited = (await call('PATCH', `/anchors/${anchor.id}`, { expectedVersion: 1, text: '重新思考' })).data;
  assert.equal(edited.version, 2);
  assert.equal(edited.text, '重新思考');
  await assert.rejects(call('PATCH', `/anchors/${anchor.id}`, { expectedVersion: 1, text: '覆盖' }), code('VERSION_CONFLICT'));
  assert.equal((await call('GET', '/anchors?journeyId=journey_1&topicId=topic_1&contentId=content_1')).data.items.length, 1);
  assert.equal((await call('GET', '/anchors?contentId=content_2')).data.items.length, 0);
  await assert.rejects(call('GET', '/anchors?scope=public'), code('FEATURE_NOT_ENABLED'));
  await call('DELETE', `/anchors/${anchor.id}`);
  assert.equal((await call('GET', '/anchors')).data.items.length, 0);
});

test('manual synthesis freezes sources, caches reordered materials, and invalidates cache after an edit', async () => {
  const { state, call, collect } = fixture();
  const a = await collect('content_1'), b = await collect('content_2');
  const body = { bagItemIds: [b.id, a.id], mode: 'manual', question: '它们有什么联系？' };
  const response = await call('POST', '/syntheses', body);
  assert.equal(response.status, 202);
  const id = response.data.result.synthesisId;
  const insight = state.insights[id];
  assert.equal(insight.generator, 'user');
  assert.equal(insight.status, 'draft');
  assert.equal(insight.dataMode, 'demo');
  assert.equal(insight.result.coreInsight, '');
  assert.deepEqual(insight.result.evidenceIds, [a.id, b.id].sort());
  const again = await call('POST', '/syntheses', { ...body, bagItemIds: [a.id, b.id] });
  assert.deepEqual(again.data.result, { synthesisId: id, cached: true });
  await call('PATCH', `/bag/items/${a.id}`, { expectedVersion: 1, note: '修改材料备注' });
  const changed = await call('POST', '/syntheses', body);
  assert.notEqual(changed.data.result.synthesisId, id);
  assert.equal(insight.materials.find((item) => item.id === a.id).version, 1);
  assert.equal((await call('GET', '/insights')).data.items.length, 0);
  assert.equal((await call('GET', `/syntheses/${id}`)).data.id, id);
});

test('synthesis rejects duplicate-only input and topics without evidence', async () => {
  const { call, collect } = fixture();
  const a = await collect('content_1'), topic = await collect('topic_1', 'topic');
  await assert.rejects(call('POST', '/syntheses', { bagItemIds: [a.id, a.id], mode: 'manual' }), code('VALIDATION_ERROR'));
  await assert.rejects(call('POST', '/syntheses', { bagItemIds: [a.id, topic.id], mode: 'manual' }), code('CONTENT_INSUFFICIENT'));
});

test('AI uses the adapter and saved insights retain immutable evidence and become bag materials', async () => {
  const { state, call, collect, provider } = fixture();
  const a = await collect('content_1'), b = await collect('content_2');
  state.bag[a.id].evidenceChain = [{ id: 'earlier_source', text: '早期来源' }];
  let calls = 0;
  provider.aiSynthesis = async (materials, question) => {
    calls += 1;
    assert.equal(question, '为什么');
    assert.equal(materials.length, 2);
    return { title: '接口结果', coreInsight: '接口生成的内容', connection: '联系', uncertainty: '待核验', questions: [], evidenceIds: [a.id] };
  };
  const generation = await call('POST', '/syntheses', { bagItemIds: [a.id, b.id], mode: 'ai', question: '为什么' });
  const id = generation.data.result.synthesisId;
  assert.equal(calls, 1);
  assert.equal(state.insights[id].generator, 'zhihu-ai');
  state.bag[a.id].evidenceChain[0].text = '后续修改';
  assert.equal(state.insights[id].materials.find((item) => item.id === a.id).evidenceChain[0].text, '早期来源');
  await assert.rejects(collect(id, 'insight', null), code('FORBIDDEN'));
  await assert.rejects(call('POST', `/syntheses/${id}/save`, { title: ' ', coreInsight: '内容' }), code('VALIDATION_ERROR'));
  const saved = (await call('POST', `/syntheses/${id}/save`, { title: '我的标题', coreInsight: '编辑后的内容', personalNote: '私人备注' })).data;
  assert.equal(saved.status, 'saved');
  assert.deepEqual(saved.result.evidenceIds, [a.id]);
  const material = Object.values(state.bag).find((item) => item.targetId === id);
  assert.equal(material.kind, 'ai_insight');
  assert.equal(material.journeyId, null);
  assert.equal(material.note, '私人备注');
  assert.equal(material.evidenceChain.length, 2);
  await call('POST', `/syntheses/${id}/save`, { title: '重复提交', coreInsight: '不应覆盖' });
  assert.equal(saved.result.title, '我的标题');
  assert.equal(Object.values(state.bag).filter((item) => item.targetId === id).length, 1);
  await call('DELETE', `/bag/items/${a.id}`);
  assert.equal(material.evidenceChain.find((item) => item.id === a.id).text, '原文 1');
  await call('POST', '/bag/links', { sourceBagItemId: material.id, targetBagItemId: b.id });
  assert.equal((await call('GET', '/insights')).data.items.length, 1);
  await call('DELETE', `/insights/${id}`);
  assert.equal(Object.values(state.bag).some((item) => item.targetId === id), false);
  assert.equal(Object.keys(state.links).length, 0);
  assert.ok(state.bag[b.id]);
  await assert.rejects(call('GET', `/insights/${id}`), code('NOT_FOUND'));
});

test('unknown routes remain available to the next handler', async () => {
  const { call } = fixture();
  assert.equal(await call('GET', '/journeys'), undefined);
  assert.equal(await call('PUT', '/bag/items/not_an_item'), undefined);
});
