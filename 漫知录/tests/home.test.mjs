import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveHomeData, filterHomeItems, buildHomeLog } from '../web/js/home.js';

const world = { seed: '学习的意义', nodes: [{ id: 'root', title: '好奇心', color: '#719075' }] };
const makeCard = (id, extra = {}) => ({ id, nodeId: 'root', title: `拾光 ${id}`, text: '停下来，问一个好问题', source: 'demo', ...extra });
const journey = (extra = {}) => ({ id: 'current', title: '学习的意义', startedAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-08T12:00:00Z', bag: [], thoughts: [], bridges: [], visited: ['root'], ...extra });

test('an empty home gives a coherent empty model without requiring a journey', () => {
    const model = deriveHomeData(null);
    assert.deepEqual(model.stats, { journeys: 0, items: 0, topics: 0, thoughts: 0, bridges: 0 });
    assert.deepEqual(buildHomeLog(model), []);
});

test('unsaved current contents replace their saved version, including removals', () => {
    const remote = {
        groups: [{ topic: '旧话题', items: [makeCard('removed', { journeyId: 'current' }), makeCard('other', { journeyId: 'older', journeyTitle: '昨天的漫游' })] }],
        journals: [{ id: 'current', title: '旧名字', items: 1 }, { id: 'older', title: '昨天的漫游', items: 1 }],
        thoughts: [{ id: 'removed-thought', journeyId: 'current', text: '已删除' }],
    };
    const before = JSON.stringify(remote);
    const model = deriveHomeData(remote, journey({ bag: [makeCard('new')] }), world);
    assert.deepEqual(new Set(model.items.map(item => item.id)), new Set(['other', 'new']));
    assert.equal(model.items.find(item => item.id === 'new').topic, '好奇心');
    assert.equal(model.journals.find(item => item.id === 'current').title, '学习的意义');
    assert.equal(model.thoughts.length, 0);
    assert.equal(model.stats.journeys, 2);
    assert.equal(JSON.stringify(remote), before);
});

test('shared cards retain another journey after removal from the current bag', () => {
    const remote = { groups: [{ topic: '好奇心', items: [makeCard('shared', { journeyId: 'current', origins: [{ journeyId: 'current', journeyTitle: '今天', topic: '好奇心' }, { journeyId: 'older', journeyTitle: '昨天', topic: '学习' }] })] }] };
    const model = deriveHomeData(remote, journey(), world);
    assert.equal(model.items.length, 1);
    assert.equal(model.items[0].journeyId, 'older');
    assert.equal(model.items[0].topic, '学习');
    assert.equal(model.items[0].origins.length, 1);
});

test('an imported card keeps its original topic when node IDs collide across worlds', () => {
    const model = deriveHomeData({}, journey({ bag: [makeCard('imported', { topic: '宇宙起源', originNodeId: 'root' })] }), world);
    assert.equal(model.items[0].topic, '宇宙起源');
    assert.equal(model.items[0].origins[0].topic, '宇宙起源');
    assert.equal(model.groups[0].topic, '宇宙起源');
});

test('collection across journeys deduplicates card IDs while keeping origins', () => {
    const remote = { groups: [{ topic: '好奇心', items: [makeCard('shared', { journeyId: 'older', journeyTitle: '昨天' })] }] };
    const model = deriveHomeData(remote, journey({ bag: [makeCard('shared', { personalNote: '这次新的理解' }), makeCard('insight', { kind: 'derived' })] }), world);
    assert.equal(model.items.length, 2);
    assert.equal(model.items.find(item => item.id === 'shared').origins.length, 2);
    assert.equal(model.items.find(item => item.id === 'shared').personalNote, '这次新的理解');
    assert.equal(model.items.find(item => item.id === 'insight').topic, '我的洞察');
});

test('topic and case-insensitive multiword search include personal notes and past journeys', () => {
    const items = [makeCard('a', { topic: '认知', author: 'Ada', personalNote: '理解 AI 的边界', origins: [{ journeyTitle: '大学生活' }] }), makeCard('b', { topic: '实践', author: 'Ada', text: 'AI 实践' })];
    assert.deepEqual(filterHomeItems(items, { topic: '认知', query: ' ada  AI ' }).map(item => item.id), ['a']);
    assert.deepEqual(filterHomeItems(items, { query: '大学生活' }).map(item => item.id), ['a']);
    assert.equal(filterHomeItems(items, { query: '不存在的片段' }).length, 0);
    assert.equal(filterHomeItems(items, { query: '  ' }).length, 2);
});

test('journal sorts mixed timestamp formats and does not duplicate synthesized cards as bridges', () => {
    const model = deriveHomeData({
        journals: [{ id: 'old', title: '早些时候', updated: Date.parse('2026-09-01T00:00:00Z') / 1000 }],
        groups: [{ topic: '知识', items: [makeCard('derived', { kind: 'derived', journeyId: 'old', createdAt: '2026-09-03T12:00:00Z' })] }],
        thoughts: [{ id: 'thought', journeyId: 'old', topic: '好奇心', text: '是否还存在另一种解释？', createdAt: '2026-09-02T00:00:00Z' }],
        bridges: [{ id: 'bridge', journeyId: 'old', targetId: 'derived', note: '联系', createdAt: '2026-09-03T12:00:00Z' }],
    });
    const entries = buildHomeLog(model);
    assert.deepEqual(entries.map(entry => entry.kind), ['insight', 'thought', 'journey']);
    assert.equal(buildHomeLog(model, 'insight').length, 1);
    assert.equal(buildHomeLog(model, 'thought')[0].text, '是否还存在另一种解释？');
});

test('a connection remains in the log if its generated card is no longer in the bag', () => {
    const model = deriveHomeData({}, journey({ bridges: [{ id: 'b', targetId: 'gone', note: '实践也会改变兴趣', createdAt: '2026-09-04T00:00:00Z' }] }), world);
    const entries = buildHomeLog(model, 'insight');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].text, '实践也会改变兴趣');
});
