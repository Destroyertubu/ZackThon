/* Adapter for the pinned Selkies client: retain its coalescing, touch and key
 * handling; lock the viewing cursor too so it sends m2 relative mouse packets. */
(() => {
  const preference = 'wanderwise-cloud-stream-quality';
  let mode = localStorage.getItem(preference) === 'fine' ? 'fine' : 'smooth';
  let status = {}, lastPath = '', autoLook = true, requesting = false, installed = false, keepRemoteInterface = false;
  let lastRestoreAt = 0;
  const toolbar = document.createElement('nav');
  toolbar.setAttribute('aria-label', '云端漫游控制');
  Object.assign(toolbar.style, { position: 'fixed', bottom: '6px', right: '18px', zIndex: '10000', display: 'flex', gap: '16px',
    font: '12px system-ui', color: '#d4eadf', textShadow: '0 1px 3px #000' });
  function button(label, action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    Object.assign(b.style, { border: '0', padding: '5px 0', color: 'inherit', background: 'transparent', font: 'inherit', cursor: 'pointer' });
    b.addEventListener('click', action); toolbar.append(b); return b;
  }
  const message = (type, data = {}) => window.postMessage({ type, ...data }, location.origin);
  const input = () => window.webrtcInput;
  const remoteKey = code => { input()?.send(`kd,${code}`); input()?.send(`ku,${code}`); };
  const restoreRemoteLook = () => { remoteKey(102); lastRestoreAt = Date.now(); };
  const fresh = () => Date.now() - Date.parse(status.at || '') < 8000;
  const surface = () => input()?.element;
  function applyMode() {
    message('settings', { settings: { framerate: 60, video_bitrate: mode === 'fine' ? 16000 : 8000,
      rate_control_mode: 'cbr', video_streaming_mode: true, video_fullcolor: false } });
    quality.textContent = mode === 'fine' ? '精细画面 · 切换流畅' : '流畅优先 · 切换精细';
    localStorage.setItem(preference, mode);
  }
  async function enterLook() {
    const target = surface();
    if (!target || requesting || document.pointerLockElement || !fresh() || !status.lookAllowed) return;
    requesting = true;
    try {
      target.focus({ preventScroll: true });
      try { await target.requestPointerLock({ unadjustedMovement: true }); }
      catch (error) { if (error.name !== 'NotSupportedError') throw error; await target.requestPointerLock(); }
      // Send before the next movement frame; server processes the F then m2 in order.
      restoreRemoteLook(); autoLook = true;
    } catch { hint.textContent = '按 F 恢复鼠标漫游'; }
    finally { requesting = false; }
  }
  function releaseLook() {
    autoLook = false;
    if (document.pointerLockElement) document.exitPointerLock();
    remoteKey(65307);
  }
  function releaseForInterface() {
    autoLook = false;
    if (document.pointerLockElement) { keepRemoteInterface = true; document.exitPointerLock(); }
  }
  const hint = button('F 漫游 · Esc 释放鼠标', () => { if (document.pointerLockElement) releaseLook(); else void enterLook(); });
  const quality = button('流畅优先 · 切换精细', () => {
    mode = mode === 'smooth' ? 'fine' : 'smooth'; applyMode();
    surface()?.focus({ preventScroll: true });
  });
  const metrics = document.createElement('output'); metrics.style.alignSelf = 'center'; toolbar.append(metrics);
  document.body.append(toolbar);
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    hint.textContent = locked ? '正在漫游 · Esc 释放鼠标' : 'F 漫游 · Esc 释放鼠标';
    if (!locked) {
      autoLook = false;
      // Opening a reading/mixing panel must not immediately close it with Esc.
      if (!keepRemoteInterface) remoteKey(65307);
      keepRemoteInterface = false;
    }
  });
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || toolbar.contains(event.target)) return;
    // Selkies uses an invisible text host for game keys. Only visible local UI
    // fields are excluded; remote dialogs are checked through the status bridge.
    if (event.target !== surface() && event.target?.closest?.('input,textarea,select,[contenteditable="true"]') && event.target.id !== 'keyboard-input-assist') return;
    if (event.code === 'Escape') { releaseLook(); return; }
    if (event.code === 'KeyE' || event.code === 'KeyH') {
      autoLook = false;
      // E/H still reach the game through Selkies. Release the viewer for the UI.
      if (document.pointerLockElement) setTimeout(releaseForInterface, 0);
      return;
    }
    if (event.code === 'KeyF' || (autoLook && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code))) void enterLook();
  }, true);
  let checking = false;
  async function tick() {
    if (checking) return; checking = true;
    try {
      const response = await fetch('/cloud/status', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (response.ok) status = await response.json();
      if (status.path && status.path !== lastPath) {
        lastPath = status.path; autoLook = true;
        if (installed && !document.pointerLockElement) remoteKey(65307);
      }
      if (!installed && input()?.inputAttached && window.selkiesTransport?.readyState === 1) {
        installed = true; applyMode();
        // Until the viewer locks too, keep absolute desktop motion out of camera look.
        remoteKey(65307);
      }
      const rtt = window.network_stats?.latency_ms;
      const fps = window.fps;
      metrics.textContent = `${Number.isFinite(fps) ? `${Math.round(fps)} 帧` : ''}${Number.isFinite(rtt) ? ` · 网络往返 ${Math.round(rtt)} ms` : ''}`;
      if (fresh() && !status.lookAllowed && document.pointerLockElement) releaseForInterface();
      // A route may create its canvas before mounting the game input controller.
      // Confirm the remote lock instead of losing an F sent during that gap.
      if (fresh() && status.lookAllowed && !status.pointerLocked && document.pointerLockElement && Date.now() - lastRestoreAt >= 1200) restoreRemoteLook();
    } catch { /* Existing stream stays usable if diagnostics briefly time out. */ }
    finally { checking = false; }
  }
  setInterval(tick, 1000); void tick();
})();
