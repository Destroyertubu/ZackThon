(() => {
  const el = id => document.getElementById(id);
  let job;
  const labels = { queued: '正在准备独立空间', starting: '正在准备云端录制', warming: '正在加载镜头', recording: '正在录制', finishing: '正在生成 MP4', completed: '视频已完成', failed: '任务失败', cancelled: '任务已取消' };
  const shots = { opening: '观星台序幕', explore: '探索星海', annotate: '阅读、收藏与批注', footprints: '足迹重访', home: '回到小屋', mix: '思想调酒', montage: '多场景漫游', finale: '星海定格' };
  async function refresh() {
    const response = await fetch('/showcase/api/status', { cache: 'no-store' });
    if (!response.ok) throw new Error('任务状态暂时不可用');
    const data = await response.json();
    job = data.job;
    const running = job && !['completed', 'failed', 'cancelled'].includes(job.status);
    el('start').disabled = Boolean(running); el('cancel').disabled = !running;
    el('start').textContent = job && ['failed', 'cancelled'].includes(job.status) ? '重试生成视频' : '生成演示视频';
    el('state').textContent = job ? labels[job.status] || job.status : '等待开始';
    el('detail').textContent = job ? [job.shotId && `当前镜头：${shots[job.shotId] || job.shotId}`, job.progress && `进度：${job.progress}`, job.attempt === 2 && "当前镜头正在自动重试（1 次）", job.error].filter(Boolean).join('\n') : '每次任务使用新的个人空间。';
    const completed = job?.status === 'completed';
    el('download').hidden = !completed; el('subtitles').hidden = !completed || job.mode === 'smoke'; el('preview').hidden = !completed;
    if (completed) {
      const url = `/showcase/api/jobs/${job.id}/download`;
      el('download').href = url;
      if (el('preview').getAttribute('src') !== url) el('preview').src = url;
      el('subtitles').href = `/showcase/api/jobs/${job.id}/subtitles`;
    }
    let extras = el('extras');
    if (!extras) { extras = document.createElement('p'); extras.id = 'extras'; extras.className = 'actions'; el('download').parentElement.after(extras); }
    extras.hidden = !completed || job.mode === 'smoke';
    if (!extras.hidden && extras.dataset.job !== job.id) {
      extras.replaceChildren(); extras.dataset.job = job.id;
      for (const [artifact, title, filename] of [['clean', '无字幕 MP4', 'output-clean.mp4'], ['audio', '旁白 WAV', 'narration.wav'], ['script', '旁白文稿', 'narration.md'], ['introduction', '作品介绍', 'introduction.md'], ['short', '短版介绍', 'introduction-short.md'], ['storyboard', '分镜表', 'storyboard.json'], ['closing', '结束全景', 'closing.png']]) {
        const link = document.createElement('a'); link.href = `/showcase/api/jobs/${job.id}/${artifact}`; link.textContent = title; link.download = filename; extras.append(link);
      }
    }
  }
  async function mutate(path, body) {
    try {
      const response = await fetch(`/showcase/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '任务操作失败');
      await refresh();
    } catch (error) { el('detail').textContent = error.message; }
  }
  el('start').onclick = () => mutate('start', { mode: 'full' });
  el('cancel').onclick = () => job && mutate(`jobs/${job.id}/cancel`, {});
  void refresh().catch(error => { el('detail').textContent = error.message; });
  setInterval(() => { void refresh().catch(() => {}); }, 2000);
})();
