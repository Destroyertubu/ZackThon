import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { Question } from '../types'
import { createGalaxyShowcaseAdapter } from '../../showcase/GalaxyAdapterCore'
import type { GalaxyShowcasePort, GalaxyShowcaseState } from '../../showcase/GalaxyAdapterCore'

function fixture(overrides: Partial<GalaxyShowcaseState> = {}) {
  let toggles = 0, flushes = 0, mutations = 0
  const pending: Array<() => void> = []
  const answer = { id: 'answer-1', title: 'Source', author: 'Author', paragraphs: ['A real source quotation.'], excerpt: 'Source excerpt', relevance: 1, url: '', isExcerpt: true }
  const questions = [{ id: 'question-1', title: 'Question', excerpt: 'Question excerpt', keywords: [], relevance: 1, color: '#fff', answers: [answer] }]
  const initial: GalaxyShowcaseState = {
    query: '', queryReady: true, answerReady: true, loading: false, error: '',
    questionId: 'question-1', answerId: 'answer-1', depth: 2, resetToken: 0, drawer: null,
    collectionTab: 'saved', reader: false, reflection: false, reflectionTarget: null,
    reflectionText: '', selectedParagraph: null, saved: false, collection: [], reflections: [], journey: [],
    ...overrides,
  }
  let port: GalaxyShowcasePort
  const commit = (state: GalaxyShowcaseState) => {
    const patch = (value: Partial<GalaxyShowcaseState>) => {
      mutations++
      pending.push(() => commit({ ...state, ...value }))
    }
    port = {
      state, questions, selectedAnswer: answer,
      selectQuestion: id => patch({ questionId: id }),
      selectAnswer: id => patch({ answerId: id }),
      setDepth: depth => patch({ depth }),
      openReader: (index, quote) => patch({ reader: true, selectedParagraph: index ?? null, selectedQuote: quote }),
      toggleSave: () => {
        toggles++
        patch({ saved: !state.saved, collection: state.saved
          ? state.collection.filter(item => item.id !== answer.id || item.type !== 'answer')
          : [{ id: answer.id, type: 'answer', title: answer.title, excerpt: answer.excerpt, questionId: 'question-1', answerId: answer.id, query: '', savedAt: new Date().toISOString() }, ...state.collection] })
      },
      currentAnswerTargetIds: () => [answer.id, 'url:https://example.com/source'],
      removeReflections: ids => patch({ reflections: state.reflections.filter(note => !ids.includes(note.id)) }),
      openReflection: () => patch({ reflection: true, reflectionTarget: { id: answer.id, title: answer.title, quote: state.selectedQuote } }),
      setReflectionText: text => patch({ reflectionText: text }),
      saveReflection: () => patch({ reflection: false, reflectionText: '', reflections: [{ id: 'created-note', targetId: answer.id, targetTitle: answer.title, text: state.reflectionText.trim(), quote: state.reflectionTarget?.quote, query: '', createdAt: new Date().toISOString() }, ...state.reflections] }),
      showDrawer: (drawer, collectionTab) => patch({ drawer, collectionTab }),
      revisit: stop => patch({ questionId: stop.questionId, answerId: stop.answerId ?? answer.id, depth: stop.answerId ? 2 : 1, drawer: null }),
      closeOverlays: () => patch({ reader: false, reflection: false, drawer: null }),
      reset: () => patch({ depth: 0, resetToken: state.resetToken + 1, reader: false, reflection: false, drawer: null }),
      flushPersistence: async () => { flushes++ },
    }
  }
  commit(initial)
  let selectedText = ''
  const adapter = createGalaxyShowcaseAdapter(() => port, {
    tick: async () => { pending.splice(0).forEach(apply => apply()) },
    sceneStatus: () => ({ sceneReady: true, cameraSettled: true, cameraDepth: port.state.depth, cameraResetToken: port.state.resetToken, cameraQuestionId: port.state.questionId, cameraAnswerId: port.state.answerId }),
    selectQuote: (_index, quote) => { selectedText = quote },
  })
  return { adapter, getPort: () => port, counts: () => ({ toggles, flushes, mutations }), selected: () => selectedText }
}

test('the approved snapshot has an attributable excerpt and the exact final source line', async () => {
  // The server has a separate compiler target; load it only in this Node test.
  const serverModule = '../../../../server/galaxy/zhihu.ts'
  const { adaptPublic } = await import(serverModule) as { adaptPublic: (snapshot: unknown, query: string) => Question[] }
  const snapshot = JSON.parse(readFileSync(new URL('../../../../server/galaxy/data/zhihu-public.json', import.meta.url), 'utf8'))
  const topic = adaptPublic(snapshot, '').find(question => question.id === 'topic-learning')!
  const answer = topic.answers.find(item => item.id === 'knowledge-1509654546602856448')!
  assert.equal(topic.kind, 'topic')
  assert.equal(topic.answersExpanded, true)
  assert.equal(answer.author, '窦泽南')
  assert.equal(answer.isExcerpt, true)
  assert.equal(answer.paragraphs[45].split('\n').at(-1), '到安静的户外，听听自然')
  assert.equal(answer.highlights?.some(highlight => highlight.paragraphIndex === 45), false)
})

test('a non-source quote is rejected before any reading or note mutation', async () => {
  const f = fixture()
  await assert.rejects(f.adapter.execute('openReader', { index: 0, quote: 'Invented quotation' }), /exact source substring/)
  assert.equal(f.counts().mutations, 0)
  assert.equal(f.selected(), '')
})

test('queued source selection and reflection use committed state, then preserve quote and identity', async () => {
  const f = fixture()
  const reading = f.adapter.execute('openReader', { index: 0, quote: 'real source quotation' })
  const reflecting = f.adapter.execute('openReflection')
  const typing = f.adapter.execute('setReflectionText', { text: 'My own thought' })
  const saving = f.adapter.execute('saveReflection')
  await Promise.all([reading, reflecting, typing])
  const result = await saving
  assert.equal(f.selected(), 'real source quotation')
  assert.equal(f.getPort().state.reflections[0].quote, 'real source quotation')
  assert.equal(f.getPort().state.reflections[0].text, 'My own thought')
  assert.equal('savedReflectionId' in result && result.savedReflectionId, 'created-note')
  assert.equal(f.counts().flushes, 1)
})

test('ensureSaved is idempotent and overview reset preserves collected and written state', async () => {
  const f = fixture()
  await f.adapter.execute('ensureSaved')
  await f.adapter.execute('ensureSaved')
  await f.adapter.execute('openReflection')
  await f.adapter.execute('setReflectionText', { text: 'Keep this note' })
  await f.adapter.execute('saveReflection')
  await f.adapter.execute('showDrawer', { drawer: 'reflections' })
  assert.equal(f.getPort().state.collectionTab, 'thoughts')
  await f.adapter.execute('reset')
  assert.equal(f.counts().toggles, 1)
  assert.equal(f.getPort().state.saved, true)
  assert.equal(f.getPort().state.reflections[0].text, 'Keep this note')
  assert.equal(f.getPort().state.depth, 0)
  assert.equal(f.getPort().state.drawer, null)
})

test('revisit refuses a missing stop and disposed adapters cannot mutate a later route', async () => {
  const f = fixture()
  await assert.rejects(f.adapter.execute('revisit', { id: 'absent' }), /does not exist/)
  f.adapter.dispose()
  await assert.rejects(f.adapter.execute('ensureSaved'), /disposed/)
  assert.equal(f.counts().mutations, 0)
})

test('demo preparation removes only the current work and its exact demo notes, including reloaded source IDs', async () => {
  const note = { id: 'demo-note', targetId: 'answer-1', targetTitle: 'Source', text: 'Demo thought', quote: 'real source quotation', query: '', createdAt: '2026-09-14T00:00:00.000Z' }
  const ownNote = { ...note, id: 'own-note', text: 'Keep my own thought' }
  const otherQuote = { ...note, id: 'other-quote', quote: 'A real source' }
  const otherWork = { ...note, id: 'other-work-note', targetId: 'answer-2' }
  const saved = { id: 'answer-1', type: 'answer' as const, title: 'Source', excerpt: 'Source excerpt', questionId: 'question-1', answerId: 'answer-1', query: '', savedAt: note.createdAt }
  const otherSaved = { ...saved, id: 'answer-2', answerId: 'answer-2' }
  const f = fixture({ saved: true, collection: [saved, otherSaved], reflections: [note, { ...note, id: 'reloaded-demo', targetId: 'url:https://example.com/source' }, ownNote, otherQuote, otherWork] })
  const result = await f.adapter.execute('resetDemoAnnotation', { text: note.text, quote: note.quote })
  assert.equal(result.saved, false)
  assert.deepEqual(result.collection, [otherSaved])
  assert.deepEqual(result.reflections, [ownNote, otherQuote, otherWork])
  assert.deepEqual('removedReflectionIds' in result && result.removedReflectionIds, ['demo-note', 'reloaded-demo'])
  assert.equal(f.counts().toggles, 1)
  assert.equal(f.counts().flushes, 1)
  await f.adapter.execute('resetDemoAnnotation', { text: note.text, quote: note.quote })
  assert.equal(f.counts().toggles, 1)
  assert.deepEqual(f.getPort().state.reflections, [ownNote, otherQuote, otherWork])
  await f.adapter.execute('ensureSaved')
  assert.equal(f.counts().toggles, 2)
  assert.equal(f.getPort().state.saved, true)
})
