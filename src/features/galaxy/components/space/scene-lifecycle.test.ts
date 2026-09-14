/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';

type SceneProps = Parameters<typeof import('../GalaxyScene').default>[0];
type ElementTree = { type?: unknown; props?: Record<string, unknown> };

/** Execute the real scene's hooks/listeners with a renderer boundary, retaining
 * its real Three geometry/materials and transition implementation. No DOM or
 * GPU is required, so lifecycle events can be dispatched deterministically. */
for (const showcase of [false, true]) test(`the actual scene retains search effects through visibility/context pauses and disposes them on unmount (showcase=${showcase})`, async () => {
  const effects: (() => void | (() => void))[] = [];
  const cleanups: (() => void)[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0, renders = 0, rendererDisposals = 0, observerDisconnections = 0;
  let renderedScene: THREE.Scene | undefined;
  let cameraAdapter: { getState: () => { scene: string; ready: boolean; settled: boolean; yaw: number; frames: number; elapsed: number }; execute: (action: string, payload: Record<string, unknown>) => Promise<unknown> } | undefined;
  let cameraRegistrations = 0, cameraUnregistrations = 0;
  class Element extends EventTarget {
    clientWidth = 1280;
    clientHeight = 720;
    dataset: Record<string, string> = {};
    style = { setProperty() {}, removeProperty() {} };
    closest() { return null; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getBoundingClientRect() {
      return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight,
        x: 0, y: 0, width: this.clientWidth, height: this.clientHeight };
    }
    getContext() { return null; }
  }
  const canvas = new Element(), container = new Element(), window = new EventTarget();
  const document = Object.assign(new Element(), {
    hidden: false, activeElement: null, createElement: () => new Element(),
  });
  const harness = {
    effects,
    register(name: string, adapter: typeof cameraAdapter) {
      assert.equal(name, 'camera-galaxy'); cameraAdapter = adapter; cameraRegistrations++;
      return () => { cameraAdapter = undefined; cameraUnregistrations++; };
    },
    makeRenderer: () => ({
      setPixelRatio() {}, setClearColor() {}, setSize() {},
      render(scene: THREE.Scene, camera: THREE.Camera) {
        scene.updateMatrixWorld(true); camera.updateMatrixWorld();
        renderedScene = scene; renders++;
      },
      dispose() { rendererDisposals++; },
    }),
  };
  const replacements: Record<string, unknown> = {
    __galaxyLifecycleHarness: harness,
    window, document, HTMLElement: Element, innerWidth: 1280, devicePixelRatio: 1,
    matchMedia: () => Object.assign(new EventTarget(), { matches: false }),
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
    ResizeObserver: class { observe() {} disconnect() { observerDisconnections++; } },
  };
  const previous = Object.fromEntries(Object.keys(replacements).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(replacements)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  function step(time: number) {
    assert.equal(frames.size, 1, 'only one scene animation loop may be scheduled');
    const [id, callback] = frames.entries().next().value!;
    frames.delete(id); callback(time);
  }
  function attach(tree: unknown) {
    if (Array.isArray(tree)) { tree.forEach(attach); return; }
    if (!tree || typeof tree !== 'object') return;
    const { type, props } = tree as ElementTree;
    if (!props) return;
    if (typeof props.ref === 'object' && props.ref && 'current' in props.ref) {
      props.ref.current = type === 'canvas' ? canvas : container;
    }
    attach(props.children);
  }
  try {
    const mocks: Record<string, string> = {
      react: `const h=()=>globalThis.__galaxyLifecycleHarness;
        export const useEffect=fn=>h().effects.push(fn),useMemo=fn=>fn();
        export const useState=initial=>[typeof initial==='function'?initial():initial,()=>{}];
        export const useRef=value=>({current:value});`,
      'react/jsx-runtime': 'export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment="Fragment";',
      three: `export * from ${JSON.stringify(import.meta.resolve('three'))};
        export function WebGLRenderer(){return globalThis.__galaxyLifecycleHarness.makeRenderer();}`,
      './StellarText': 'export default "StellarText";',
      './RichText': 'export default "RichText";',
      './CosmicBackdrop': 'export default "CosmicBackdrop";',
      '../lib/rich-text': 'export const hasRichSyntax=()=>false;',
      '../../showcase/runtime': `export const isShowcase=()=>${showcase}; export const registerShowcaseAdapter=(name,adapter)=>globalThis.__galaxyLifecycleHarness.register(name,adapter);`,
    };
    const compiled = await build({
      entryPoints: [fileURLToPath(new URL('../GalaxyScene.tsx', import.meta.url))],
      bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'automatic',
      plugins: [{ name: 'scene-lifecycle-boundary', setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          if (args.path.startsWith('file:')) return { path: args.path, external: true };
          if (args.path in mocks || args.path.endsWith('.css')) return { path: args.path, namespace: 'boundary' };
        });
        builder.onLoad({ filter: /.*/, namespace: 'boundary' }, args => ({ contents: mocks[args.path] ?? '', loader: 'js' }));
      } }],
    });
    const { default: Scene } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`) as {
      default: (props: SceneProps) => unknown;
    };
    const props: SceneProps = {
      questions: [{ id: 'lifecycle:question', title: '真实星体', excerpt: '摘要', keywords: [],
        relevance: 1, color: '#a6c8eb', answers: [] }],
      selectedQuestionId: 'lifecycle:question', selectedAnswerId: null, selectedParagraph: null,
      depth: 0, resetToken: 0, flightMode: false, reducedMotion: false, voyage: null,
      onDepthChange() {}, onSelectQuestion() {}, onSelectAnswer() {}, onOpenReader() {}, onSelectParagraph() {},
    };
    attach(Scene(props));
    for (const effect of effects) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    step(1000);
    assert.ok(renderedScene);
    assert.equal(cameraRegistrations, showcase ? 1 : 0);
    assert.equal(container.dataset.showcaseRendered, showcase ? 'true' : undefined);
    if (showcase) {
      assert.equal(cameraAdapter?.getState().ready, true);
      assert.equal(cameraAdapter?.getState().scene, 'galaxy');
      assert.equal(cameraAdapter?.getState().frames, 1);
      assert.equal(cameraAdapter?.getState().elapsed, 0);
    }
    const transition = renderedScene.getObjectByName('knowledge-search-transition');
    assert.ok(transition, 'the actual component must own the transition in its existing scene');
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    transition.traverse(object => {
      if (!(object instanceof THREE.Points || object instanceof THREE.Mesh)) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
    });
    assert.ok(resources.size > 0, 'capture actual resources, including shared plane geometry');
    let releases = 0;
    resources.forEach(resource => resource.addEventListener('dispose', () => releases++));
    props.voyage = { id: 1, phase: 'collapse', startedAt: 1000 };
    step(1200);
    if (showcase) {
      assert.equal(cameraAdapter?.getState().frames, renders);
      assert.equal(cameraAdapter?.getState().elapsed, 0.2, 'render timing must not use the capped 50 ms animation delta');
    }
    const dust = transition.getObjectByName('tidal-stellar-fragments') as THREE.Points;
    const attribute = dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const version = attribute.version;
    assert.equal(transition.visible, true);

    for (let cycle = 0; cycle < 3; cycle++) {
      document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
      assert.equal(frames.size, 0, 'hidden tabs must stop the animation loop');
      assert.equal(releases, 0, 'hiding a live scene must not dispose its transition');
      assert.equal(transition.parent, renderedScene);
      const metricsBeforeResume = cameraAdapter?.getState();
      document.hidden = false; document.dispatchEvent(new Event('visibilitychange'));
      step(1300 + cycle * 100);
      if (showcase) {
        assert.equal(cameraAdapter?.getState().frames, renders);
        assert.equal(cameraAdapter?.getState().elapsed, metricsBeforeResume?.elapsed, 'hidden time must not accumulate as rendering time');
      }
    }
    assert.ok(attribute.version > version, 'the restored transition must keep uploading animated fragments');
    assert.equal(transition.children.length, 4);

    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost);
    assert.equal(lost.defaultPrevented, true, 'the browser must be allowed to restore its WebGL context');
    assert.equal(frames.size, 0);
    assert.equal(releases, 0);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    step(1700);
    assert.equal(transition.visible, true);
    assert.equal(releases, 0);

    props.reducedMotion = true; props.voyage = null;
    step(1800);
    assert.equal(transition.visible, false);
    assert.equal(releases, 0, 'turning off motion retains reusable resources');
    if (showcase) {
      const shot = cameraAdapter!.execute('shot', { yaw: 0.4, pitch: 0.2 });
      step(1816);
      await shot;
      assert.equal(cameraAdapter!.getState().settled, true);
      assert.equal(cameraAdapter!.getState().yaw, 0.4);
      assert.equal(cameraAdapter!.getState().frames, renders);
      assert.ok(Math.abs(cameraAdapter!.getState().elapsed - 0.316) < 1e-9);
    }
    while (cleanups.length) cleanups.pop()!();
    assert.equal(cameraUnregistrations, cameraRegistrations);
    assert.equal(container.dataset.showcaseRendered, undefined);
    assert.equal(releases, resources.size, 'final cleanup releases each resource exactly once');
    assert.equal(transition.parent, null);
    assert.equal(transition.children.length, 0);
    assert.equal(rendererDisposals, 1);
    assert.equal(observerDisconnections, 1);
    assert.equal(frames.size, 0);
    const before = renders;
    document.dispatchEvent(new Event('visibilitychange'));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    assert.equal(frames.size, 0, 'unmounted scene listeners cannot restart rendering');
    assert.equal(renders, before);
  } finally {
    while (cleanups.length) cleanups.pop()!();
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
