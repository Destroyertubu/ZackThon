import { writeFileSync } from 'node:fs';
import { ContentStore } from '../server/content/store.js';
import { ContentService } from '../server/content/service.js';
import { createCliRunner } from '../server/content/cli.js';

const live = process.argv.includes('--live');
const store = new ContentStore('artifacts/content-service/content.sqlite3');
const runner = createCliRunner();
const service = new ContentService({ store, runner: async (args, timeout) => {
  if (!live) throw new Error('Cache miss; use --live for one budgeted verification');
  const result = await runner(args, timeout);
  // Only public responses, never auth output or private account endpoints.
  writeFileSync(`artifacts/content-service/live-${args[0]}.json`, JSON.stringify(result, null, 2));
  return result;
} });
const report: Record<string, unknown> = { at: new Date().toISOString(), live };
try {
  const search = await service.search('文学 摄影 落日', 'zhihu', { visitorId: 'implementation-verification' });
  report.search = { count: search.items.length, cached: search.cached, allSummary: search.items.every((item) => item.kind === 'search_summary'), allLinked: search.items.every((item) => item.url && item.title) };
  const known = search.items.find((item) => item.questionId) ?? store.db.prepare('SELECT payload FROM source_items').all().map((row) => JSON.parse(String(row.payload))).find((item) => item.questionId);
  if (known?.questionId) {
    const answers = await service.answers(known.questionId, { visitorId: 'implementation-verification' });
    report.answers = { questionId: known.questionId, count: answers.items.length, cached: answers.cached, allSummary: answers.items.every((item) => item.kind === 'answer_summary') };
  }
} catch (error) {
  report.error = error instanceof Error ? error.message : 'Unknown failure';
  process.exitCode = 1;
} finally {
  writeFileSync('artifacts/content-service/live-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  store.close();
}
