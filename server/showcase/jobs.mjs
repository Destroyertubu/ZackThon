import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, readdir, chmod, stat, copyFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { parseStoryboard } from './auth.mjs';

const terminal = status => ['completed', 'failed', 'cancelled'].includes(status);
export async function writeWorkerManifest(path, content) {
  await writeFile(path, content, { mode: 0o640 });
  // systemd's UMask applies even to an explicit write mode. Only the
  // task's manifest is group-readable; authentication/state files stay private.
  await chmod(path, 0o640);
}
const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(new Error('Task cancelled'));
  const abort = () => { clearTimeout(timer); reject(new Error('Task cancelled')); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  signal?.addEventListener('abort', abort, { once: true });
});

export function runProcess(binary, args, { signal, timeout = 120_000, onOutput, input } = {}) {
  const child = spawn(binary, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  // The browser action may fail as the recorder exits; EPIPE is reported via
  // the process result instead of becoming an uncaught event on stdin.
  child.stdin.on('error', () => {});
  let output = '', finished = false;
  const promise = new Promise((resolve, reject) => {
    const stop = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      const text = chunk.toString(); output = (output + text).slice(-12000); onOutput?.(text);
    });
    child.on('close', code => {
      finished = true; clearTimeout(timer); signal?.removeEventListener('abort', stop);
      if (code === 0 && !signal?.aborted) resolve(output);
      else reject(new Error(signal?.aborted ? 'Task cancelled' : `${binary} exited ${code}: ${output.slice(-1800)}`));
    });
    if (input !== undefined) child.stdin.end(input);
    if (signal?.aborted) stop();
  });
  // A recorder may finish while the director Promise is still running.
  promise.catch(() => {});
  return { child, promise, done: () => finished };
}

export class JobManager {
  constructor({ root, state, createViewer, image = 'wanderwise-showcase:20260914', gpu = 'GPU-e796262d-3449-6af1-586d-8460d8836d1b', dri = '/dev/dri/renderD130' }) {
    Object.assign(this, { root, state, createViewer, image, gpu, dri });
    this.jobs = new Map(); this.active = null;
  }
  async initialize() {
    await mkdir(join(this.state, 'jobs'), { recursive: true, mode: 0o700 });
    for (const entry of await readdir(join(this.state, 'jobs'))) {
      if (!/^[a-f0-9-]{36}$/.test(entry)) continue;
      try {
        const job = JSON.parse(await readFile(join(this.state, 'jobs', entry, 'job.json'), 'utf8'));
        if (!terminal(job.status)) { job.status = 'failed'; job.error = '服务重启中断任务，请重新生成。'; }
        this.jobs.set(job.id, job);
        await this.persist(job);
      } catch { /* Ignore incomplete metadata, never guess a downloadable artifact. */ }
    }
    // Only resources bearing our own label and name prefix can be reclaimed.
    try {
      const names = await runProcess('docker', ['ps', '-aq', '--filter', 'label=com.wanderwise.showcase=recording', '--filter', 'name=^/wanderwise-showcase-']).promise;
      for (const id of names.trim().split(/\s+/).filter(Boolean)) await runProcess('docker', ['rm', '-f', id]).promise;
    } catch { /* Start will report Docker availability explicitly. */ }
  }
  publicJob(job) {
    if (!job) return null;
    const { id, mode, status, createdAt, updatedAt, shotId, progress, attempt, renderer, encoder, error, duration, verification } = job;
    return { id, mode, status, createdAt, updatedAt, shotId, progress, attempt, renderer, encoder, error, duration, verification };
  }
  latest() { return this.active?.job || [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]; }
  async persist(job) {
    job.updatedAt = new Date().toISOString();
    const target = join(this.state, 'jobs', job.id, 'job.json');
    await writeFile(`${target}.tmp`, JSON.stringify(job, null, 2), { mode: 0o600 });
    await rename(`${target}.tmp`, target);
  }
  async update(job, values) { Object.assign(job, values); await this.persist(job); }
  async start(mode = 'full') {
    if (this.active) throw Object.assign(new Error('已有任务正在执行。'), { status: 409 });
    if (!['full', 'smoke'].includes(mode)) throw Object.assign(new Error('未知录制类型。'), { status: 400 });
    const job = { id: randomUUID(), mode, status: 'queued', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const runtime = { job, abort: new AbortController(), queue: [], pending: new Map(), heartbeat: null, container: `wanderwise-showcase-${job.id.slice(0, 12)}` };
    // Reserve synchronously before filesystem awaits, so two POSTs cannot race.
    this.active = runtime; this.jobs.set(job.id, job);
    try {
      await mkdir(join(this.state, 'jobs', job.id), { recursive: true, mode: 0o700 });
      await this.persist(job);
      runtime.finished = this.execute(runtime).catch(async error => {
        await this.update(job, { status: runtime.abort.signal.aborted ? 'cancelled' : 'failed', error: runtime.abort.signal.aborted ? undefined : String(error.message).slice(0, 2500), lastBrowser: runtime.lastResult || runtime.heartbeat });
      }).finally(async () => {
        for (const item of runtime.pending.values()) item.reject(new Error('Task ended'));
        runtime.pending.clear();
        try { await runProcess('docker', ['rm', '-f', runtime.container], { timeout: 15_000 }).promise; } catch { /* Already removed. */ }
        try { await runtime.closeViewer?.(); }
        finally { if (this.active === runtime) this.active = null; }
      });
      return job;
    } catch (error) { this.active = null; throw error; }
  }
  async cancel(id) {
    const runtime = this.active;
    if (!runtime || runtime.job.id !== id) throw Object.assign(new Error('任务当前没有运行。'), { status: 409 });
    runtime.abort.abort();
    for (const item of runtime.pending.values()) item.reject(new Error('Task cancelled'));
    await runProcess('docker', ['rm', '-f', runtime.container], { timeout: 15_000 }).promise.catch(() => {});
    await runtime.finished;
  }
  next(runtime) { return runtime.queue.shift(); }
  heartbeat(runtime, value) {
    runtime.heartbeat = value;
    if (!runtime.collectRenderSamples) return;
    const adapters = value?.snapshot?.adapters || {};
    const metrics = adapters.camera || adapters['camera-galaxy'];
    runtime.renderSamples.push({ at: Date.now(), route: value.route, ...(metrics ? { scene: metrics.scene || 'galaxy', frames: metrics.frames, elapsed: metrics.elapsed, ready: metrics.ready, assetsLoading: metrics.assetsLoading } : {}) });
    if (runtime.renderSamples.length > 200) runtime.renderSamples.shift();
  }
  result(runtime, value) {
    runtime.lastResult = value.result;
    const pending = runtime.pending.get(value.id);
    if (!pending) return;
    runtime.pending.delete(value.id);
    if (value.ok) pending.resolve(value.result);
    else pending.reject(new Error(`页面动作失败：${String(value.error).slice(0, 500)}`));
  }
  command(runtime, action, shotId, timeout = 100_000) {
    const signal = runtime.abort?.signal;
    if (signal?.aborted) return Promise.reject(new Error('Task cancelled'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const remove = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); runtime.pending.delete(id); runtime.queue = runtime.queue.filter(item => item.id !== id); };
      const abort = () => { remove(); reject(new Error('Task cancelled')); };
      const timer = setTimeout(() => { remove(); reject(new Error(`页面命令超时：${action} ${shotId || ''}`)); }, timeout);
      signal?.addEventListener('abort', abort, { once: true });
      runtime.pending.set(id, { resolve: value => { remove(); resolve(value); }, reject: error => { remove(); reject(error); } });
      runtime.queue.push({ id, action, shotId });
    });
  }
  async docker(runtime, args, options = {}) {
    return runProcess('docker', ['exec', runtime.container, ...args], { signal: runtime.abort.signal, ...options }).promise;
  }
  encoderArgs(encoder) {
    return encoder === 'h264_nvenc' ? ['-c:v', encoder, '-preset', 'p4', '-b:v', '16M', '-maxrate', '20M', '-bufsize', '32M'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
  }
  async gpuSnapshot() {
    try {
      return { at: new Date().toISOString(), csv: (await runProcess('nvidia-smi', ['--id', this.gpu, '--query-gpu=name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw', '--format=csv,noheader,nounits'], { timeout: 5000 }).promise).trim(), columns: ['name', 'gpuPercent', 'memoryPercent', 'memoryUsedMiB', 'memoryTotalMiB', 'temperatureC', 'powerW'] };
    } catch { return { at: new Date().toISOString(), unavailable: true }; }
  }
  async record(runtime, shot, index) {
    const { job } = runtime, signal = runtime.abort.signal;
    const gpuBefore = await this.gpuSnapshot();
    const raw = `/output/raw-${index}.mp4`, target = `/output/clip-${index}.mp4`;
    let progressTime = 0, progressAt = 0, accumulated = '', inputStartedAt;
    let firstResolve, firstReject;
    const first = new Promise((resolve, reject) => { firstResolve = resolve; firstReject = reject; });
    const recording = runProcess('docker', ['exec', '-i', runtime.container, 'ffmpeg', '-hide_banner', '-loglevel', 'info', '-nostats', '-stats_period', '0.1', '-y', '-thread_queue_size', '512', '-f', 'x11grab', '-draw_mouse', '0', '-video_size', '1920x1080', '-framerate', '30', '-i', ':30.0', '-an', ...this.encoderArgs(job.encoder), '-pix_fmt', 'yuv420p', '-t', String(shot.duration + 10), '-progress', 'pipe:1', raw], {
      signal, timeout: (shot.duration + 25) * 1000,
      onOutput: chunk => {
        accumulated = (accumulated + chunk).slice(-8000);
        const inputStart = accumulated.match(/Duration: N\/A, start: (\d+\.\d+)/);
        if (inputStart) inputStartedAt = Number(inputStart[1]) * 1000;
        const matches = [...accumulated.matchAll(/out_time_us=(\d+)/g)];
        if (matches.length) { progressTime = Number(matches.at(-1)[1]) / 1e6; progressAt = Date.now(); firstResolve(); accumulated = ''; }
      },
    });
    recording.promise.catch(firstReject);
    let offset = 0, play, timing, browser;
    try {
      await Promise.race([first, sleep(20_000, signal).then(() => { throw new Error('录制器没有输出首帧'); })]);
      offset = Math.max(0, progressTime + (Date.now() - progressAt) / 1000);
      const started = Date.now();
      runtime.renderSamples = []; runtime.collectRenderSamples = true;
      const prematureEnd = recording.promise.then(() => { throw new Error(`镜头 ${shot.id} 的录制器提前停止`); });
      if (job.mode !== 'smoke') {
        play = this.command(runtime, 'play', shot.id, (shot.duration + 12) * 1000);
        const result = await Promise.race([play, prematureEnd]);
        browser = result;
        const event = result?.snapshot?.events?.findLast(event => event.event === 'started' && event.detail === shot.id);
        if (!Number.isFinite(event?.at) || event.at < started - 100 || event.at > Date.now()) throw new Error(`镜头 ${shot.id} 缺少实际开始时间，无法精确裁切`);
        if (!Number.isFinite(inputStartedAt) || inputStartedAt < 1e12) throw new Error('录制器缺少真实X11采集起始时间');
        offset = (event.at - inputStartedAt) / 1000;
        if (offset < 0 || offset > 10) throw new Error('浏览器与录制器时钟未对齐');
        timing = { inputStartedAt, recorderReadyAt: started, playStartedAt: event.at, captureOffsetSeconds: offset, dispatchDelaySeconds: (event.at - started) / 1000 };
      }
      const remaining = shot.duration * 1000 - (Date.now() - started);
      if (remaining > 0) await Promise.race([sleep(remaining, signal), prematureEnd]);
      if (Date.now() - started > (shot.duration + 4) * 1000) throw new Error(`镜头 ${shot.id} 超出预定时长，停止产片。`);
      await sleep(250, signal);
      if (recording.done()) { await recording.promise; throw new Error(`镜头 ${shot.id} 的录制器已停止`); }
      recording.child.stdin.write('q\n');
      await recording.promise;
    } catch (error) {
      runtime.collectRenderSamples = false;
      // An exec client exiting does not necessarily stop its FFmpeg in Docker.
      // Quiesce only this task's recorder and page action before any retry.
      recording.child.kill('SIGTERM');
      await this.docker(runtime, ['pkill', '-TERM', '-x', 'ffmpeg'], { timeout: 5000 }).catch(() => {});
      await recording.promise.catch(() => {});
      await play?.catch(() => {});
      throw error;
    }
    runtime.collectRenderSamples = false;
    const renderSummary = {};
    for (let i = 1; i < runtime.renderSamples.length; i++) {
      const before = runtime.renderSamples[i - 1], after = runtime.renderSamples[i];
      if (before.route !== after.route || before.scene !== after.scene || !(after.frames > before.frames) || !(after.elapsed > before.elapsed)) continue;
      const key = `${after.route}:${after.scene}`;
      const total = renderSummary[key] ||= { frames: 0, seconds: 0, fps: 0 };
      total.frames += after.frames - before.frames; total.seconds += after.elapsed - before.elapsed; total.fps = total.frames / total.seconds;
    }
    await this.docker(runtime, ['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-ss', offset.toFixed(3), '-i', raw, '-vf', 'setpts=PTS-STARTPTS', '-frames:v', String(Math.round(shot.duration * 30)), '-an', '-r', '30', ...this.encoderArgs(job.encoder), '-pix_fmt', 'yuv420p', target]);
    const probe = JSON.parse(await this.docker(runtime, ['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height,pix_fmt', '-of', 'json', target]));
    if (Math.abs(Number(probe.format.duration) - shot.duration) > 0.15) throw new Error(`镜头 ${shot.id} 录制不完整`);
    return { index, id: shot.id, offset, timing, expectedDuration: shot.duration, probe, browser: browser || await this.command(runtime, 'inspect', undefined, 15_000), renderSamples: runtime.renderSamples, renderSummary, gpuBefore, gpuAfter: await this.gpuSnapshot() };
  }
  async executeShot(runtime, shot, index, total) {
    const attempts = [];
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (runtime.abort.signal.aborted) throw new Error('Task cancelled');
      const startedAt = new Date().toISOString();
      await this.update(runtime.job, { status: 'warming', shotId: shot.id, progress: `${index + 1}/${total}`, attempt });
      try {
        // prepareShot restores the exact demonstration state before redoing a
        // real action. Its result must succeed again; failed media is replaced.
        await this.command(runtime, 'prepare', runtime.job.mode === 'smoke' ? 'opening' : shot.id);
        await this.update(runtime.job, { status: 'recording' });
        const result = await this.record(runtime, shot, index);
        attempts.push({ attempt, startedAt, status: 'completed' });
        return { ...result, attempts };
      } catch (error) {
        attempts.push({ attempt, startedAt, status: 'failed', error: String(error.message).slice(0, 1800) });
        runtime.job.shotAttempts = [...(runtime.job.shotAttempts || []), { id: shot.id, ...attempts.at(-1) }];
        await this.persist(runtime.job);
        if (runtime.abort.signal.aborted || attempt === 2) throw error;
      }
    }
  }
  async execute(runtime) {
    const { job } = runtime, signal = runtime.abort.signal;
    const directory = join(this.state, 'jobs', job.id), ipc = join(this.state, 'ipc', job.id.slice(0, 12)), output = join(directory, 'output');
    let storyboard;
    if (job.mode === 'full') {
      storyboard = parseStoryboard(JSON.parse(await readFile(join(this.root, 'docs/showcase/storyboard.json'), 'utf8')));
      for (const file of ['public/showcase/narration.wav', 'public/showcase/subtitles.srt']) await stat(join(this.root, file));
    } else storyboard = { shots: [{ id: 'gpu-smoke', duration: 10 }], duration: 10 };
    await mkdir(ipc, { recursive: true, mode: 0o2770 }); await chmod(ipc, 0o2770);
    await mkdir(output, { recursive: true, mode: 0o2770 }); await chmod(output, 0o2770);
    const { close } = await this.createViewer(runtime, ipc);
    runtime.closeViewer = close;
    await this.update(job, { status: 'starting', duration: storyboard.duration });
    const hostGid = process.getgid(), renderGid = (await stat(this.dri)).gid;
    await runProcess('docker', ['run', '-d', '--name', runtime.container, '--label', 'com.wanderwise.showcase=recording', '--init', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges=true', '--runtime', 'nvidia', '--gpus', `device=${this.gpu}`, '--device', this.dri, '--group-add', String(hostGid), '--group-add', String(renderGid), '--shm-size', '2g', '--memory', '12g', '--cpus', '6', '--pids-limit', '1024', '--mount', `type=bind,src=${ipc},dst=/run/showcase`, '--mount', `type=bind,src=${output},dst=/output`, '--mount', `type=bind,src=${join(this.root, 'public')},dst=/assets,readonly`, '--log-opt', 'max-size=5m', '--log-opt', 'max-file=2', this.image], { signal, timeout: 120_000 }).promise;
    const readyDeadline = Date.now() + 100_000;
    while ((!runtime.heartbeat?.renderer || !runtime.heartbeat?.canvasCount) && Date.now() < readyDeadline) await sleep(500, signal);
    const diagnostic = await this.command(runtime, 'inspect', undefined, 15_000);
    if (!/NVIDIA|RTX/i.test(diagnostic.renderer) || /llvmpipe|software|swiftshader/i.test(diagnostic.renderer)) throw new Error(`录制实例未通过真实 GPU 验证：${diagnostic.renderer || '未发现 WebGL'}`);
    if (diagnostic.width !== 1920 || diagnostic.height !== 1080) throw new Error(`浏览器尺寸不正确：${diagnostic.width}×${diagnostic.height}`);
    await this.update(job, { renderer: diagnostic.renderer });
    let encoder = 'h264_nvenc';
    try { await this.docker(runtime, ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=size=1920x1080:rate=30', '-frames:v', '1', '-c:v', 'h264_nvenc', '-f', 'null', '-'], { timeout: 20_000 }); }
    catch { if (signal.aborted) throw new Error('Task cancelled'); encoder = 'libx264'; }
    await this.update(job, { encoder });
    const evidence = [];
    for (const [index, shot] of storyboard.shots.entries()) {
      evidence.push(await this.executeShot(runtime, shot, index, storyboard.shots.length));
      await writeFile(join(output, 'evidence.partial.json'), JSON.stringify({ renderer: diagnostic.renderer, encoder: job.encoder, shots: evidence }, null, 2), { mode: 0o600 });
    }
    await this.finish(runtime, storyboard, evidence, diagnostic);
  }
  async finish(runtime, storyboard, evidence, diagnostic) {
    const { job } = runtime;
    const output = join(this.state, 'jobs', job.id, 'output');
    await this.update(job, { status: 'finishing' });
    if (job.mode === 'smoke') {
      await copyFile(join(output, 'clip-0.mp4'), join(output, 'output.mp4'));
    } else {
      const last = storyboard.shots.length - 1;
      const motionDuration = storyboard.shots[last].duration - 5;
      if (motionDuration <= 0) throw new Error('Final shot must contain five seconds of freeze');
      await this.docker(runtime, ['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-i', `/output/clip-${last}.mp4`, '-t', String(motionDuration), '-an', ...this.encoderArgs(job.encoder), '-pix_fmt', 'yuv420p', '/output/finale-motion.mp4']);
      await this.docker(runtime, ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-0.04', '-i', '/output/finale-motion.mp4', '-frames:v', '1', '-update', '1', '/output/closing.png']);
      await this.docker(runtime, ['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-loop', '1', '-framerate', '30', '-i', '/output/closing.png', '-t', '5', '-an', ...this.encoderArgs(job.encoder), '-pix_fmt', 'yuv420p', '/output/freeze.mp4']);
      await writeWorkerManifest(join(output, 'concat.txt'), storyboard.shots.map((_, index) => index === last ? "file 'finale-motion.mp4'" : `file 'clip-${index}.mp4'`).join('\n') + "\nfile 'freeze.mp4'\n");
      const duration = String(job.duration), music = '/assets/galaxy/audio/day-one.mp3';
      await this.docker(runtime, ['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-f', 'concat', '-safe', '0', '-i', '/output/concat.txt', '-i', '/assets/showcase/narration.wav', '-stream_loop', '-1', '-i', music, '-filter_complex', `[1:a]apad,atrim=duration=${duration},volume=1.0[n];[2:a]volume=0.10,afade=t=out:st=${job.duration - 5}:d=5[m];[n][m]amix=inputs=2:duration=first:normalize=0[a]`, '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', duration, '-movflags', '+faststart', '/output/output-clean.mp4'], { timeout: 180_000 });
      await this.docker(runtime, ['ffmpeg', '-hide_banner', '-loglevel', 'warning', '-y', '-i', '/output/output-clean.mp4', '-vf', "subtitles=/assets/showcase/subtitles.srt:force_style='FontName=Noto Sans CJK SC,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=1.5,Shadow=0,MarginV=36,Alignment=2'", ...this.encoderArgs(job.encoder), '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', '/output/output.mp4'], { timeout: 300_000 });
      for (const file of ['subtitles.srt', 'narration.wav', 'narration.md', 'introduction.md', 'introduction-short.md', 'storyboard.json']) await copyFile(join(this.root, 'public/showcase', file), join(output, file));
    }
    const probeArtifact = async file => JSON.parse(await this.docker(runtime, ['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,pix_fmt,r_frame_rate,nb_frames', '-of', 'json', `/output/${file}`]));
    const verification = await probeArtifact('output.mp4');
    const cleanVerification = job.mode === 'full' ? await probeArtifact('output-clean.mp4') : undefined;
    for (const probe of [verification, cleanVerification].filter(Boolean)) {
      const video = probe.streams.find(stream => stream.codec_type === 'video');
      if (video?.codec_name !== 'h264' || video.width !== 1920 || video.height !== 1080 || video.pix_fmt !== 'yuv420p' || video.r_frame_rate !== '30/1' || Number(video.nb_frames) !== Math.round(job.duration * 30) || Math.abs(Number(probe.format.duration) - job.duration) > 0.05) throw new Error('成片格式、帧数或时长验证未通过');
      if (job.mode === 'full' && !probe.streams.some(stream => stream.codec_name === 'aac')) throw new Error('成片缺少旁白音轨');
    }
    await writeFile(join(output, 'evidence.json'), JSON.stringify({ renderer: diagnostic.renderer, encoder: job.encoder, shots: evidence, verification, cleanVerification, packagingRecovery: job.packagingRecovery }, null, 2), { mode: 0o600 });
    await this.update(job, { status: 'completed', error: undefined, verification });
  }
}
