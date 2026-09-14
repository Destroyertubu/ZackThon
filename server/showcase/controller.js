(() => {
  // Firefox thumbnail pages may revisit SPA routes in an anonymous browser.
  // Check only at installation: this controller persists across SPA navigation.
  if (new URLSearchParams(location.search).get('showcase') !== '1') return;
  if (window.__showcaseControllerAttached) return;
  window.__showcaseControllerAttached = true;
  const errors = [];
  const remember = error => { errors.push(String(error).slice(0, 400)); if (errors.length > 15) errors.shift(); };
  window.addEventListener('error', event => remember(event.message || `Resource failed: ${event.target?.src || event.target?.href || 'unknown'}`), true);
  window.addEventListener('unhandledrejection', event => remember(event.reason?.message || event.reason));
  window.addEventListener('securitypolicyviolation', event => remember(`CSP ${event.violatedDirective}: ${event.blockedURI}`));
  for (const level of ['warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => { remember(`${level}: ${args.map(value => typeof value === 'string' ? value : value?.message || String(value)).join(' ')}`); original(...args); };
  }
  const style = document.createElement('style');
  style.textContent = 'html,body,body *{cursor:none!important}';
  document.head.append(style);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const diagnostics = () => {
    let renderer = '';
    for (const canvas of document.querySelectorAll('canvas')) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) continue;
      const extension = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = extension ? String(gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
      break;
    }
    let snapshot;
    try { snapshot = window.__showcase?.snapshot(); } catch (error) { snapshot = { error: String(error) }; }
    return { renderer, width: innerWidth, height: innerHeight, route: location.pathname, apiReady: Boolean(window.__showcase), canvasCount: document.querySelectorAll('canvas').length, errors: [...errors], snapshot };
  };
  const send = (path, body) => fetch(`/__showcase/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  setInterval(() => { void send('heartbeat', diagnostics()).catch(() => {}); }, 2000);
  const execute = async command => {
    if (command.action === 'inspect') return diagnostics();
    const deadline = performance.now() + 90_000;
    while (!window.__showcase && performance.now() < deadline) await delay(100);
    const api = window.__showcase;
    if (!api) throw new Error('Showcase API did not become ready');
    if (command.action === 'prepare') {
      await api.prepareShot(command.shotId);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await delay(750);
    } else if (command.action === 'play') {
      await api.playShot(command.shotId);
    } else if (command.action === 'command') {
      if (typeof api.command !== 'function') throw new Error('Showcase command API unavailable');
      await api.command(command.name, command.operation, command.payload);
    } else if (command.action !== 'snapshot') throw new Error('Unknown showcase command');
    const result = diagnostics();
    if (result.snapshot?.error) throw new Error(String(result.snapshot.error));
    return result;
  };
  void (async () => {
    while (true) {
      try {
        const response = await fetch('/__showcase/next', { cache: 'no-store' });
        if (response.status === 204) { await delay(150); continue; }
        if (!response.ok) { await delay(500); continue; }
        const command = await response.json();
        let result;
        try { result = { id: command.id, ok: true, result: await execute(command) }; }
        catch (error) { result = { id: command.id, ok: false, error: String(error?.message || error), result: diagnostics() }; }
        // Never execute an action again merely because its acknowledgement was lost.
        for (let attempt = 0; attempt < 6; attempt++) {
          try { if ((await send('result', result)).ok) break; } catch { /* retry acknowledgement */ }
          await delay(250);
        }
      } catch { await delay(500); }
    }
  })();
})();
