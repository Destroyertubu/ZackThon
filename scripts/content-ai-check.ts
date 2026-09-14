import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ContentStore } from '../server/content/store.js';
import { ContentService } from '../server/content/service.js';
import { SynthesisService } from '../server/content/synthesis.js';
import { AccessService, loadAccessConfig } from '../server/content/access.js';

const reportPath = 'artifacts/content-service/ai-check.json';
if (!process.argv.includes('--live')) {
  console.log(existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : 'No live report. Run with --live to perform one budgeted public-source check.');
} else {
  const store = new ContentStore('artifacts/content-service/content.sqlite3');
  const content = new ContentService({ store });
  const manifest = JSON.parse(readFileSync('src/features/journeys/curatedSources.json', 'utf8'));
  content.registerCurated(manifest);
  const config = loadAccessConfig('artifacts/content-service/.env.access.local');
  const access = new AccessService(store, config);
  const session = access.exchange(config.inviteCodes[0]);
  const report: Record<string, unknown> = { at: new Date().toISOString(), publicMaterialsOnly: true };
  try {
    const result = await new SynthesisService(content).generate({ mode: 'idea', prompt: '根据这份来源，设计一个文学与摄影结合的观察练习，用中文简短回答。', sourceIds: [manifest[0].id] }, access.authorize(session.token));
    report.ok = true;
    report.provider = result.provider;
    report.textLength = result.draft.text.length;
    report.sources = result.draft.sources.map(({ id, url }) => ({ id, url }));
    writeFileSync('artifacts/content-service/ai-public-draft.json', JSON.stringify(result, null, 2), { mode: 0o600 });
  } catch (error) {
    report.ok = false;
    report.error = error instanceof Error ? error.message : 'Unknown failure';
    process.exitCode = 1;
  } finally {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    store.close();
  }
}
