// This script is injected only by the isolated RTX origin proxy.
sessionStorage.setItem('wanderwise-render-runtime', 'rtx');
// A visible, session-local diagnostic. No personal materials leave this browser.
const badge = document.createElement('output');
badge.setAttribute('aria-label', '云渲染状态');
Object.assign(badge.style, {
  position: 'fixed', top: '104px', right: '28px', zIndex: '9999',
  padding: '7px 0',
  color: '#d4f3e8', background: 'transparent', font: '12px system-ui', pointerEvents: 'none',
});
badge.textContent = '云渲染 · 正在确认绘图设备';
document.body.append(badge);
let verifiedRenderer = '';
setInterval(() => {
  const canvas = document.querySelector('canvas[data-world-fps]');
  const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
  if (gl) {
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    verifiedRenderer = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  }
  const fps = canvas ? Number(canvas.dataset.worldFps) : undefined;
  const label = verifiedRenderer.includes('RTX PRO 6000') ? 'RTX PRO 6000' : verifiedRenderer || '等待场景加载';
  badge.textContent = `云渲染 · ${label}${fps === undefined ? '' : ` · ${fps.toFixed(0)} FPS`}`;
  fetch('/__cloud/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    renderer: verifiedRenderer, fps, triangles: canvas ? Number(canvas.dataset.worldTriangles) : undefined,
    drawCalls: canvas ? Number(canvas.dataset.worldDrawCalls) : undefined, path: location.pathname, at: new Date().toISOString(),
  }) }).catch(() => {});
}, 3000);
