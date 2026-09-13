import assert from 'node:assert/strict'
import { build } from 'esbuild'

const compiled = await build({
  entryPoints: ['src/components/observatory/gardenRecipes.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false,
})
const {
  GARDEN_RECIPE_STORAGE_KEY, KNOWLEDGE_INGREDIENTS, mixThoughtRecipe,
  readGardenRecipes, writeGardenRecipes,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)

const ids = KNOWLEDGE_INGREDIENTS.map(item => item.id)
const names = new Set(), combinations = []
let cases = 0
for (const first of ids) for (const second of ids) {
  if (first === second) {
    assert.throws(() => mixThoughtRecipe(first, second, 50), 'a cocktail must combine different knowledge domains')
    cases++
    continue
  }
  for (const percent of [10, 50, 60, 90]) {
    const recipe = mixThoughtRecipe(first, second, percent)
    const reversed = mixThoughtRecipe(second, first, 100 - percent)
    assert.equal(recipe.id, reversed.id, 'swapping bottles and proportions must preserve recipe identity')
    assert.equal(recipe.name, reversed.name)
    assert.equal(recipe.prompt, reversed.prompt)
    assert.equal(recipe.firstPercent, percent)
    assert.ok(recipe.prompt.length > 40, 'every pair provides a concrete creative activity')
    names.add(recipe.name); combinations.push(recipe); cases++
  }
}
assert.equal(names.size, 10, 'five ingredients produce ten named pairs')
const sunset = mixThoughtRecipe('literature', 'photography', 60)
assert.equal(sunset.name, '落日大道')
assert.match(sunset.prompt, /以文学为主线/)
assert.match(mixThoughtRecipe('literature', 'photography', 40).prompt, /以摄影为主线/)
assert.match(mixThoughtRecipe('literature', 'photography', 50).prompt, /各占一半/)
assert.equal(mixThoughtRecipe('literature', 'photography', NaN).firstPercent, 50)
assert.equal(mixThoughtRecipe('literature', 'photography', Infinity).firstPercent, 50)
assert.equal(mixThoughtRecipe('literature', 'photography', -30).firstPercent, 10)
assert.equal(mixThoughtRecipe('literature', 'photography', 110).firstPercent, 90)
assert.equal(mixThoughtRecipe('literature', 'photography', 64).firstPercent, 60)
assert.throws(() => mixThoughtRecipe('invalid', 'nature', 60))

const oldDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const values = new Map([['wanderwise-game-v1', '{"backpack":["existing journey"]}']])
const legacyState = values.get('wanderwise-game-v1')
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } })
  assert.deepEqual(readGardenRecipes(), [], 'a new device begins with an empty recipe book')
  for (const invalid of ['not json', 'null', '{}', '42']) {
    values.set(GARDEN_RECIPE_STORAGE_KEY, invalid)
    assert.deepEqual(readGardenRecipes(), [], 'malformed or non-array data must degrade to an empty book')
  }
  values.set(GARDEN_RECIPE_STORAGE_KEY, JSON.stringify([
    null, {}, { first: 'alien', second: 'nature', firstPercent: 60 },
    { first: 'literature', second: 'literature', firstPercent: 60 },
    { first: 'literature', second: 'photography', firstPercent: '60' },
    { first: 'literature', second: 'photography', firstPercent: null },
  ]))
  assert.deepEqual(readGardenRecipes(), [], 'unknown, duplicate and malformed ingredient choices are ignored')
  assert.equal(writeGardenRecipes([sunset, sunset]), true)
  assert.deepEqual(readGardenRecipes(), [sunset], 'saved duplicate proportions appear once')
  const stored = JSON.parse(values.get(GARDEN_RECIPE_STORAGE_KEY))
  assert.deepEqual(Object.keys(stored[0]).sort(), ['first', 'firstPercent', 'second'])
  values.set(GARDEN_RECIPE_STORAGE_KEY, JSON.stringify([{ ...sunset, name: 'Injected title', prompt: 'Injected instructions' }]))
  assert.deepEqual(readGardenRecipes(), [sunset], 'display text comes from the recipe catalog, never cached instructions')
  assert.equal(writeGardenRecipes(combinations), true)
  assert.equal(JSON.parse(values.get(GARDEN_RECIPE_STORAGE_KEY)).length, 12, 'writes cap the recipe book at twelve entries')
  assert.ok(readGardenRecipes().length <= 12)
  assert.equal(values.get('wanderwise-game-v1'), legacyState, 'the existing journey state is untouched')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => { throw new Error('Storage blocked') },
    setItem: () => { throw new Error('Quota exceeded') },
  } })
  assert.deepEqual(readGardenRecipes(), [], 'blocked storage must not break the workshop')
  assert.equal(writeGardenRecipes([sunset]), false, 'quota failures must be visible to the save notice')
  delete globalThis.localStorage
  assert.deepEqual(readGardenRecipes(), [], 'non-browser rendering has a safe fallback')
  assert.equal(writeGardenRecipes([sunset]), false)
} finally {
  if (oldDescriptor) Object.defineProperty(globalThis, 'localStorage', oldDescriptor)
  else delete globalThis.localStorage
}

console.log(`Garden recipes passed: ${cases} pair/proportion cases, 10 named recipes, meaningful ratio changes, normalization, corrupt data, deduplication, 12-recipe limit, storage failures and legacy-state isolation.`)
