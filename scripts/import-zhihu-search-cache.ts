import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { backup } from 'node:sqlite'
import { ContentStore, digest } from '../server/content/store'
import { contentQuery } from '../server/content/service'
import type { ContentResponse } from '../server/content/types'

const input = resolve(process.argv[2])
const database = resolve(process.argv[3])
if (!existsSync(database)) throw new Error('Expected an existing application cache database')
const rows = JSON.parse(readFileSync(input, 'utf8')) as { query: string; response: ContentResponse }[]
for (const row of rows) {
  contentQuery(row.query)
  if (!Array.isArray(row.response.items) || !Number.isFinite(Date.parse(row.response.fetchedAt))) throw new Error('Invalid search response')
  for (const item of row.response.items) {
    const url = new URL(item.url)
    if (item.source !== 'zhihu' || item.kind !== 'search_summary' || !['www.zhihu.com', 'zhihu.com', 'zhuanlan.zhihu.com'].includes(url.hostname)
      || url.protocol !== 'https:' || url.username || url.password || !item.title || !item.summary) throw new Error('Not a public Zhihu search snapshot')
  }
}
const store = new ContentStore(database)
try {
  await backup(store.db, `${database}.before-seed-${Date.now()}.sqlite3`)
  let imported = 0
  for (const row of rows) {
    const key = `search:zhihu:${digest(contentQuery(row.query))}`
    const current = store.get(key)
    if (current && Date.parse(current.fetchedAt) >= Date.parse(row.response.fetchedAt)) continue
    store.put(key, row.response)
    imported++
  }
  console.log(JSON.stringify({ importedQueries: imported, availableQueries: rows.filter(row => store.get(`search:zhihu:${digest(contentQuery(row.query))}`)).length }))
} finally { store.close() }
