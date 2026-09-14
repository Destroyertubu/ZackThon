import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve(process.argv[2] ?? 'dist')
const html = await readFile(resolve(output, 'index.html'), 'utf8')
const styles = [...html.matchAll(/href="([^"]+\.css)"/g)].map(match => match[1])
assert.ok(styles.length, 'Production entry must include its stylesheet')
for (const uri of styles) {
  const css = await readFile(resolve(output, uri.replace(/^\//, '')), 'utf8')
  assert.doesNotMatch(css, /@(?:tailwind|apply)\b/, `${uri}: Tailwind/PostCSS configuration was not applied`)
}
console.log(`Production CSS compiled: ${styles.length} entry stylesheet(s)`)
