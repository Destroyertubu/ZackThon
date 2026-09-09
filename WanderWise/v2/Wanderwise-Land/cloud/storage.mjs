import {getStore} from '@netlify/blobs';

export function blobStorage(context = {}) {
  const suffix = context.deploy?.context === 'production' ? 'production' : `preview-${context.deploy?.id || 'local'}`;
  const store = getStore({name: `wanderwise-land-v2-${suffix}`.slice(0, 64), consistency: 'strong'});
  return {
    read: key => store.getWithMetadata(key, {type: 'json'}),
    async compareSet(key, data, etag) {
      const result = await store.setJSON(key, data, etag === null ? {onlyIfNew: true} : {onlyIfMatch: etag});
      if (typeof result?.modified !== 'boolean') throw new Error('Conditional storage confirmation missing');
      return result.modified;
    },
    async list(prefix = '') {
      const keys = [];
      for await (const page of store.list({prefix, paginate: true})) for (const blob of page.blobs) keys.push(blob.key);
      return keys;
    },
    remove: key => store.delete(key),
  };
}

// Local development and tests use explicit isolated adapters, never a cloud fallback.
export function memoryStorage() {
  const entries = new Map(); let revision = 0;
  return {
    async read(key) {return entries.has(key) ? structuredClone(entries.get(key)) : null;},
    async compareSet(key, data, etag) {
      if ((entries.get(key)?.etag ?? null) !== etag) return false;
      entries.set(key, {data: structuredClone(data), etag: String(++revision)}); return true;
    },
    async list(prefix = '') {return [...entries.keys()].filter(k => k.startsWith(prefix));},
    async remove(key) {entries.delete(key);},
  };
}
