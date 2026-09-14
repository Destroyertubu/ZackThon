import express from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../galaxy/app.js';
import { ZhihuService, ApiError } from '../galaxy/zhihu.js';
import { ContentStore } from '../content/store.js';
import { ContentService } from '../content/service.js';

/** A fresh, private in-memory source cache. This process has no upstream credentials. */
export function createFixtureApp(root: string) {
  const snapshot = JSON.parse(readFileSync(join(root, 'server/galaxy/data/zhihu-public.json'), 'utf8'));
  const works = JSON.parse(readFileSync(join(root, 'src/data/works.json'), 'utf8'));
  const store = new ContentStore(':memory:');
  const content = new ContentService({ store, configured: false, runner: async () => { throw new Error('Showcase does not call upstream services'); } });
  content.registerCurated(JSON.parse(readFileSync(join(root, 'src/features/journeys/curatedSources.json'), 'utf8')));
  const service = new ZhihuService({ snapshot, content, fetchImpl: async () => { throw new ApiError(503, 'SHOWCASE_SNAPSHOT_ONLY', '演示只读取固定公开快照。'); } });
  const router = express();
  router.get('/api/works', (_req, res) => res.json(works));
  router.post(['/api/synthesis', '/api/access'], (_req, res) => res.status(403).json({ error: 'SHOWCASE_SNAPSHOT_ONLY', message: '演示空间不调用外部生成服务。' }));
  // Passing synthesis keeps highlights on the existing extractive code path.
  router.use(createApp(service, { distDir: join(root, '.no-static-here'), refreshPublic: false, synthesis: {} as never }));
  return { app: router, close: () => store.close() };
}
