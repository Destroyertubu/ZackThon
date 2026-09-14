import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'

const target = process.argv[3] ? path.resolve(process.argv[3]) : fileURLToPath(new URL('../', import.meta.url))
const source = process.argv[2] ? path.resolve(process.argv[2]) : fileURLToPath(new URL('../../../../../Wanderwise-upstream-20260914/src/', import.meta.url))
const files = ['styles.css', 'fonts.css', 'components/galaxy.css', 'components/cosmic-backdrop.css', 'components/background-music.css', 'components/rich-text.css', 'components/search-voyage.css'].filter(name => fs.existsSync(path.join(source, name)))
const roots = files.map(name => ({ name, root: postcss.parse(fs.readFileSync(path.join(source, name), 'utf8')) }))
const animations = new Map()
for (const { root } of roots) root.walkAtRules(/keyframes$/i, rule => animations.set(rule.params, `ww-galaxy-${rule.params}`))
for (const { name, root } of roots) {
  root.walkAtRules(/keyframes$/i, rule => { rule.params = animations.get(rule.params) })
  root.walkDecls(declaration => {
    if (/^(?:-webkit-)?animation(?:-name)?$/.test(declaration.prop)) {
      declaration.value = declaration.value.replace(/[a-zA-Z][\w-]*/g, word => animations.get(word) ?? word)
    }
    declaration.value = declaration.value.replaceAll('/fonts/', '/galaxy/fonts/').replaceAll('/textures/', '/galaxy/textures/')
      .replaceAll('DM Sans', 'Wanderwise Galaxy Sans').replaceAll('Noto Sans SC', 'Wanderwise Galaxy CJK').replaceAll('Zhuque Fangsong', 'Wanderwise Galaxy Fangsong')
  })
  root.walkRules(rule => {
    let parent = rule.parent
    while (parent) {
      if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return
      parent = parent.parent
    }
    rule.selector = selectorParser(selectors => {
      selectors.each(selector => {
        const first = selector.nodes[0]
        if (first?.value === ':root' || (first?.type === 'tag' && ['html', 'body'].includes(first.value))) {
          first.replaceWith(selectorParser.className({ value: 'galaxy-page' }))
        } else {
          selector.prepend(selectorParser.combinator({ value: ' ' }))
          selector.prepend(selectorParser.className({ value: 'galaxy-page' }))
        }
      })
    }).processSync(rule.selector)
  })
  fs.mkdirSync(path.dirname(path.join(target, name)), { recursive: true })
  fs.writeFileSync(path.join(target, name), `/* Scoped from Wood3307/Wanderwise. See UPSTREAM.md for the pinned version. */\n${root.toString()}`)
}
