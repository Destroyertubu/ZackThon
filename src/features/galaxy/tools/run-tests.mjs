import { build } from 'esbuild'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wanderwise-galaxy-tests-'))
const entries = fs.readdirSync(root, { recursive: true }).filter(name => name.endsWith('.test.ts'))
try {
  const outputs = await Promise.all(entries.map(async (name, index) => {
    const outfile = path.join(directory, `${index}-${path.basename(name, '.ts')}.mjs`)
    await build({ entryPoints: [path.join(root, name)], bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile, logLevel: 'silent' })
    return outfile
  }))
  const result = spawnSync(process.execPath, ['--test', ...outputs], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  fs.rmSync(directory, { recursive: true, force: true })
}
