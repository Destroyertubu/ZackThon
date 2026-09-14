// Injected only inside the isolated renderer; never collect personal content.
(() => {
  sessionStorage.setItem('wanderwise-render-runtime', 'rtx');
  const build = document.currentScript?.dataset.cloudBuild || '';
  const badge = document.createElement('output');
  badge.setAttribute('aria-label', '云渲染状态');
  Object.assign(badge.style, {
    position: 'fixed', top: '104px', right: '28px', zIndex: '9999', padding: '7px 0',
    color: '#d4f3e8', background: 'transparent', font: '12px system-ui', pointerEvents: 'none',
  });
  document.body.append(badge);
  let pendingBuild = '', lastInput = Date.now(), verifiedRenderer = '', reporting = false;
  const held = new Set();
  const blocked = () => document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') ||
    !!document.querySelector('[role="dialog"], [aria-modal="true"], canvas[inert]');
  const noteInput = () => { lastInput = Date.now(); };
  for (const type of ['pointermove', 'pointerdown', 'input']) window.addEventListener(type, noteInput, { passive: true });
  window.addEventListener('keydown', event => { noteInput(); held.add(event.code); });
  window.addEventListener('keyup', event => { noteInput(); held.delete(event.code); });
  window.addEventListener('blur', () => held.clear());
  async function report() {
    if (reporting) return;
    reporting = true;
    try {
      const canvas = document.querySelector('canvas[data-world-fps]') || document.querySelector('canvas');
      const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
      if (gl && !verifiedRenderer) {
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        verifiedRenderer = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      }
      const number = key => canvas?.dataset[key] === undefined ? undefined : Number(canvas.dataset[key]);
      const fps = number('worldFps');
      const label = verifiedRenderer.includes('RTX PRO 6000') ? 'RTX PRO 6000' : verifiedRenderer || '等待场景加载';
      badge.textContent = pendingBuild ? '新版已就绪 · 停止操作后自动更新' :
        `云渲染 · ${label}${fps === undefined ? '' : ` · ${fps.toFixed(0)} FPS`} · ${build.slice(0, 8)}`;
      await fetch('/__cloud/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(3000), body: JSON.stringify({
        renderer: verifiedRenderer, fps, p95Ms: number('worldP95Ms'), triangles: number('worldTriangles'),
        drawCalls: number('worldDrawCalls'), path: location.pathname, at: new Date().toISOString(), build,
        landscape: canvas?.dataset.landscape || '', islandCount: number('islandCount'),
        pointerLocked: !!document.pointerLockElement, lookAllowed: !!canvas && !blocked(), width: innerWidth, height: innerHeight,
      }) }).catch(() => {});
      // An open cloud browser does not reload when dist changes. Wait until the
      // player is idle and outside editing/reading dialogs before taking a new build.
      if (pendingBuild && !blocked() && held.size === 0 && Date.now() - lastInput > 5000) location.reload();
    } finally { reporting = false; }
  }
  setInterval(report, 1000);
  document.addEventListener('pointerlockchange', report);
  setInterval(async () => {
    try {
      const response = await fetch('/__cloud/version', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const latest = await response.json();
      if (/^[a-f0-9]{64}$/.test(latest.build) && build && latest.build !== build) pendingBuild = latest.build;
    } catch { /* Keep the session during a service restart. */ }
  }, 15000);
  void report();
})();
