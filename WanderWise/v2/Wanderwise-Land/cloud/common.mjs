import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

export class AppError extends Error {
  constructor(code, message, status = 422, retryable = false, details = {}) {
    super(message); this.code = code; this.status = status;
    if (typeof retryable === 'object') {details = retryable.details || {}; retryable = retryable.retryable || false;}
    this.retryable = retryable; this.details = details;
  }
  public() {return {code: this.code, message: this.message, retryable: this.retryable, details: this.details};}
}
export function assert(value, code, message, status = 422) {if (!value) throw new AppError(code, message, status);}
export const uid = (prefix = '') => prefix + randomBytes(16).toString('hex');
export const hash = text => createHash('sha256').update(String(text)).digest('hex');
export const now = () => new Date().toISOString();
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function equal(a, b) {return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));}
export function owned(map, id) {assert(typeof id === 'string' && Object.hasOwn(map, id), 'NOT_FOUND', '记录不存在或不属于当前访客。', 404); return map[id];}
export function expect(row, version) {
  if (row.version !== version) throw new AppError('VERSION_CONFLICT', '另一标签页修改了此记录；请重新加载最新版本。', 409, false, {currentVersion: row.version});
}
export function paged(items, query) {
  const offset = Number(query.get('cursor') || 0), limit = Number(query.get('limit') || 50);
  assert(Number.isInteger(offset) && offset >= 0 && Number.isInteger(limit) && limit >= 1 && limit <= 50, 'VALIDATION_ERROR', '分页参数无效。');
  return {items: items.slice(offset, offset + limit), hasMore: items.length > offset + limit, nextCursor: items.length > offset + limit ? String(offset + limit) : null};
}
export function emit(state, journeyId, type, topicId, payload = {}, eventId = uid('event_')) {
  const j = state.journeys[journeyId]; if (!j) return;
  j.events ||= [];
  if (j.events.some(e => e.eventId === eventId)) return;
  assert(j.events.length < 10000, 'STORAGE_LIMIT', '旅程事件已达容量上限，请保存并开启新的旅程。');
  j.events.push({eventId, type, topicId, payload, seq: j.events.length + 1, occurredAt: now()});
}
export function journeyPublic(state, j) {
  const world = owned(state.worlds, j.worldId), events = j.events || [];
  return {id: j.id, worldId: j.worldId, seedText: world.seedText, status: j.status, version: j.version,
    checkpoint: j.checkpoint, startedAt: j.startedAt, completedAt: j.completedAt || null,
    stats: {topics: new Set(events.filter(e => e.type === 'topic_entered').map(e => e.topicId)).size,
      collections: events.filter(e => e.type === 'collected').length, anchors: events.filter(e => e.type === 'anchor_created').length},
    dataMode: world.dataMode, sourceFetchedAt: world.sourceFetchedAt};
}
export function allowedContent(state, contentId, snapshotId = null) {
  const world = Object.values(state.worlds).find(w => Object.hasOwn(w.snapshotMap, contentId) && (!snapshotId || w.snapshotMap[contentId] === snapshotId));
  const material = Object.values(state.bag).find(b => b.contentId === contentId && (!snapshotId || b.snapshotId === snapshotId));
  assert(world || material, 'NOT_FOUND', '此来源不在当前访客的旅程或收藏中。', 404);
  const sid = snapshotId || world?.snapshotMap[contentId] || material?.snapshotId;
  const content = owned(state.snapshots, sid);
  assert(content.id === contentId, 'NOT_FOUND', '来源快照不匹配。', 404);
  return content;
}
export async function updateDocument(storage, key, operation, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    const record = await storage.read(key), next = await operation(record ? structuredClone(record.data) : null);
    if (await storage.compareSet(key, next.data, record?.etag ?? null)) return next.result;
  }
  throw new AppError('VERSION_CONFLICT', '存档正被另一项操作修改，请稍后重试。', 409, true);
}
