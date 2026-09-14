/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

function compileSharedText() {
  return build({
    entryPoints: [fileURLToPath(new URL('../StellarText.tsx', import.meta.url))],
    bundle: true, write: false, metafile: true, format: 'esm', platform: 'browser',
    jsx: 'automatic', packages: 'external', loader: { '.css': 'empty' },
    plugins: [{ name: 'shared-react-runtime', setup(builder) {
      builder.onResolve({ filter: /^react(?:\/|$)/ }, args => ({ path: import.meta.resolve(args.path), external: true }));
    } }],
  });
}

test('shared living words preserve literal text, while the galaxy can supply formatted content', async () => {
  // Compile with the application's automatic JSX runtime even when the test
  // command uses the root solution tsconfig rather than tsconfig.app.json.
  const compiled = await compileSharedText();
  const { default: StellarText } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`) as {
    default: typeof import('../StellarText').default;
  };
  const plain = renderToStaticMarkup(createElement(StellarText, {
    text: '一行 **原样文字** 与 $2$，<script>不执行</script>', phase: 'enter', reducedMotion: true,
  }));
  assert.ok(plain.includes('一行 **原样文字** 与 $2$，&lt;script&gt;不执行&lt;/script&gt;'));
  assert.ok(!plain.includes('<canvas'), 'reduced motion needs no particle canvas');
  const formatted = renderToStaticMarkup(createElement(StellarText, {
    text: '**真实星体**', phase: 'enter', reducedMotion: false,
    content: createElement('strong', null, '真实星体'),
  }));
  assert.ok(formatted.includes('<strong>真实星体</strong>'));
  assert.ok(!formatted.includes('**真实星体**'));
  assert.ok(formatted.includes('stellar-text-dust'));
});

test('the shared particle-text dependency graph does not load galaxy Markdown or KaTeX', async () => {
  const compiled = await compileSharedText();
  const inputs = Object.keys(compiled.metafile!.inputs);
  assert.ok(inputs.some(path => path.endsWith('glyph-mask.ts')));
  assert.ok(!inputs.some(path => /(?:RichText|rich-text|katex|markdown-it)/i.test(path)),
    'heavy rich-text presentation belongs only to the lazy galaxy scene');
  const output = compiled.outputFiles[0].text;
  assert.ok(!/from ["'](?:katex|markdown-it)/.test(output));
});
