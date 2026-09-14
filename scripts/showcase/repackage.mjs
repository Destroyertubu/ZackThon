// Operational recovery for a packaging failure after all real shots succeeded.
// Stop the showcase service first; no browser or game session is created here.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JobManager, runProcess } from '../../server/showcase/jobs.mjs';
import { parseStoryboard } from '../../server/showcase/auth.mjs';

const id = process.argv[2];
if (!/^[a-f0-9-]{36}$/.test(id || '')) throw new Error('Expected an existing failed job UUID');
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const state = process.env.SHOWCASE_STATE || join(homedir(), '.local/state/wanderwise-showcase');
const output = join(state, 'jobs', id, 'output');
const job = JSON.parse(await readFile(join(state, 'jobs', id, 'job.json'), 'utf8'));
const evidence = JSON.parse(await readFile(join(output, 'evidence.partial.json'), 'utf8'));
const storyboard = parseStoryboard(JSON.parse(await readFile(join(root, 'docs/showcase/storyboard.json'), 'utf8')));
if (job.status !== 'failed' || job.mode !== 'full' || evidence.shots.length !== storyboard.shots.length) throw new Error('Recovery requires every real shot from a failed full job');
for (const [index, shot] of storyboard.shots.entries()) {
  const actual = evidence.shots[index];
  if (actual.id !== shot.id || actual.attempts?.at(-1)?.status !== 'completed' || Math.abs(Number(actual.probe.format.duration) - shot.duration) > .15) throw new Error('A real shot is missing or unverified');
}
const manager = new JobManager({ root, state, createViewer: () => { throw new Error('Packaging recovery must not launch a browser'); } });
const runtime = { job, abort: new AbortController(), container: `wanderwise-showcase-${id.slice(0, 12)}` };
job.packagingRecovery = { startedAt: new Date().toISOString(), previousError: job.error, source: 'all eight recorded and verified clips retained' };
try {
  await runProcess('docker', ['run', '-d', '--name', runtime.container, '--label', 'com.wanderwise.showcase=recording', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges=true', '--runtime', 'nvidia', '--gpus', `device=${manager.gpu}`, '--group-add', String(process.getgid()), '--cpus', '4', '--memory', '6g', '--mount', `type=bind,src=${output},dst=/output`, '--mount', `type=bind,src=${join(root, 'public')},dst=/assets,readonly`, '--entrypoint', '/bin/sleep', manager.image, '900']).promise;
  await manager.finish(runtime, storyboard, evidence.shots, { renderer: evidence.renderer });
  console.log(JSON.stringify({ id, status: job.status, verification: job.verification }));
} catch (error) {
  await manager.update(job, { status: 'failed', error: String(error.message) });
  throw error;
} finally {
  await runProcess('docker', ['rm', '-f', runtime.container]).promise.catch(() => {});
}
