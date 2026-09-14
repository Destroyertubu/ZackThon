import type { Answer, JourneyStop, Question, Reflection, SavedItem } from '../galaxy/types'

export interface GalaxyShowcaseState {
  query: string
  queryReady: boolean
  answerReady: boolean
  loading: boolean
  error: string
  questionId: string | null
  answerId: string | null
  depth: number
  resetToken: number
  drawer: string | null
  collectionTab: 'saved' | 'thoughts'
  reader: boolean
  reflection: boolean
  reflectionTarget: { id: string; title: string; quote?: string } | null
  reflectionText: string
  selectedParagraph: number | null
  selectedQuote?: string
  saved: boolean
  collection: SavedItem[]
  reflections: Reflection[]
  journey: JourneyStop[]
}

export interface GalaxyShowcasePort {
  state: GalaxyShowcaseState
  questions: Question[]
  selectedAnswer?: Answer
  selectQuestion: (id: string) => void
  selectAnswer: (id: string) => void
  setDepth: (depth: number) => void
  openReader: (index?: number, quote?: string) => void
  toggleSave: () => void
  currentAnswerTargetIds: () => string[]
  removeReflections: (ids: string[]) => void
  openReflection: () => void
  setReflectionText: (text: string) => void
  saveReflection: () => void
  showDrawer: (drawer: 'collection' | 'journey', tab: 'saved' | 'thoughts') => void
  revisit: (stop: Pick<JourneyStop, 'questionId' | 'answerId' | 'query'>) => void
  closeOverlays: () => void
  reset: () => void
  flushPersistence: () => Promise<void>
}

type SceneStatus = {
  sceneReady: boolean; cameraSettled: boolean
  cameraDepth: number; cameraResetToken: number; cameraQuestionId: string | null; cameraAnswerId: string | null
}
type AdapterOptions = {
  sceneStatus?: () => SceneStatus
  selectQuote?: (index: number, quote: string) => void
  tick?: () => Promise<void>
}

function sceneStatus(): SceneStatus {
  const scene = document.querySelector<HTMLElement>('.galaxy-scene')
  return {
    sceneReady: scene?.dataset.showcaseRendered === 'true',
    cameraSettled: scene?.dataset.showcaseSettled === 'true',
    cameraDepth: Number(scene?.dataset.showcaseDepth ?? NaN),
    cameraResetToken: Number(scene?.dataset.showcaseReset ?? NaN),
    cameraQuestionId: scene?.dataset.showcaseQuestion || null,
    cameraAnswerId: scene?.dataset.showcaseAnswer || null,
  }
}

/** Select the rendered source itself; never manufacture a visual quotation. */
export function selectVisibleGalaxyQuote(index: number, quote: string) {
  const paragraph = document.querySelector<HTMLElement>(`.reading-room [data-paragraph="${index}"]`)
  if (!paragraph) throw new Error(`Reading paragraph ${index} is not mounted`)
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let combined = ''
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    nodes.push(node)
    combined += node.data
  }
  const start = combined.indexOf(quote)
  if (start < 0) throw new Error('The requested quote is not present in the rendered source')
  const range = document.createRange()
  let offset = 0
  let started = false
  for (const node of nodes) {
    const end = offset + node.length
    if (!started && start < end) {
      range.setStart(node, start - offset)
      started = true
    }
    if (started && start + quote.length <= end) {
      range.setEnd(node, start + quote.length - offset)
      break
    }
    offset = end
  }
  if (range.toString() !== quote) throw new Error('Rendered source selection does not match the quote')
  const selection = window.getSelection()
  if (!selection) throw new Error('Browser source selection is unavailable')
  selection.removeAllRanges()
  selection.addRange(range)
  const scroll = paragraph.closest<HTMLElement>('.reader-scroll')
  if (scroll) {
    const bounds = scroll.getBoundingClientRect()
    const selected = range.getBoundingClientRect()
    scroll.scrollTop += selected.top - bounds.top - bounds.height / 2 + selected.height / 2
  }
}

/** Every mutation reads the latest committed React port and awaits its result. */
export function createGalaxyShowcaseAdapter(getPort: () => GalaxyShowcasePort, options: AdapterOptions = {}) {
  let active = true
  let queue: Promise<unknown> = Promise.resolve()
  const tick = options.tick ?? (() => new Promise<void>(resolve => setTimeout(resolve, 16)))
  const status = options.sceneStatus ?? sceneStatus
  const selectQuote = options.selectQuote ?? selectVisibleGalaxyQuote
  const getState = () => {
    const port = getPort()
    return {
      ...port.state,
      ...status(),
      questions: port.questions.map(question => ({
        id: question.id, title: question.title, kind: question.kind,
        answers: question.answers.map(answer => ({
          id: answer.id, title: answer.title, author: answer.author,
          paragraphCount: answer.paragraphs.length, isExcerpt: answer.isExcerpt,
        })),
      })),
    }
  }
  const wait = async (predicate: () => boolean, label: string, timeout = 15_000) => {
    const started = Date.now()
    // A committed render/DOM frame must follow a mutation, even if its old state matches.
    await tick()
    while (active) {
      if (predicate()) return
      if (Date.now() - started > timeout) throw new Error(`Galaxy showcase timed out: ${label}`)
      await tick()
    }
    throw new Error('Galaxy showcase was disposed')
  }
  const settled = async () => {
    await wait(() => {
      const camera = status(), state = getPort().state
      return camera.sceneReady && camera.cameraSettled && Math.abs(camera.cameraDepth - state.depth) < 0.0001
        && camera.cameraResetToken === state.resetToken
        && camera.cameraQuestionId === state.questionId && camera.cameraAnswerId === state.answerId
    }, 'camera settling')
  }
  const run = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!active) throw new Error('Galaxy showcase was disposed')
    if (action === 'state') return getState()
    if (action === 'ready') {
      const timeout = typeof payload.timeoutMs === 'number' ? Math.max(1000, Math.min(60_000, payload.timeoutMs)) : 30_000
      await wait(() => getPort().state.queryReady && status().sceneReady, 'query and first frame', timeout)
      await settled()
      return getState()
    }
    if (!getPort().state.queryReady) throw new Error('Galaxy content is not ready')
    switch (action) {
      case 'selectQuestion': {
        const id = String(payload.id ?? payload.questionId ?? '')
        if (!getPort().questions.some(question => question.id === id)) throw new Error(`Unknown question: ${id}`)
        getPort().selectQuestion(id)
        await wait(() => getPort().state.questionId === id, 'question selection')
        await settled()
        break
      }
      case 'selectAnswer': {
        const id = String(payload.id ?? payload.answerId ?? '')
        const question = getPort().questions.find(item => item.id === getPort().state.questionId)
        if (!question?.answers.some(answer => answer.id === id)) throw new Error(`Answer is not in the selected question: ${id}`)
        getPort().selectAnswer(id)
        await wait(() => getPort().state.answerId === id && getPort().state.answerReady, 'answer selection')
        await settled()
        break
      }
      case 'setDepth': {
        const value = Number(payload.depth ?? payload.value)
        if (!Number.isFinite(value) || value < 0 || value > 2) throw new Error('Depth must be between 0 and 2')
        if (value >= 1.65 && !getPort().selectedAnswer) throw new Error('No answer is selected')
        const duration = typeof payload.durationMs === 'number' ? Math.max(0, Math.min(15_000, payload.durationMs)) : 0
        const from = getPort().state.depth
        const started = Date.now()
        while (active && duration > 0 && Date.now() - started < duration) {
          const t = Math.min(1, (Date.now() - started) / duration)
          getPort().setDepth(from + (value - from) * t * t * (3 - 2 * t))
          await tick()
        }
        if (!active) throw new Error('Galaxy showcase was disposed')
        getPort().setDepth(value)
        await wait(() => Math.abs(getPort().state.depth - value) < 0.0001, 'depth')
        await settled()
        break
      }
      case 'openReader': {
        const answer = getPort().selectedAnswer
        const index = Number(payload.index ?? payload.paragraphIndex ?? 45)
        if (getPort().state.depth < 1.65 || !answer) throw new Error('Enter an answer before reading')
        if (!Number.isInteger(index) || index < 0 || index >= answer.paragraphs.length) throw new Error('Invalid source paragraph')
        const quote = typeof payload.quote === 'string' ? payload.quote : answer.paragraphs[index]
        if (!quote.trim() || !answer.paragraphs[index].includes(quote)) throw new Error('Quote is not an exact source substring')
        getPort().openReader(index, quote)
        await wait(() => getPort().state.reader && getPort().state.selectedParagraph === index && getPort().state.selectedQuote === quote, 'reader and source paragraph')
        await tick()
        selectQuote(index, quote)
        break
      }
      case 'ensureSaved': {
        if (getPort().state.depth < 0.65) throw new Error('Enter a question or answer before saving')
        if (!getPort().state.saved) getPort().toggleSave()
        await wait(() => getPort().state.saved, 'collection save')
        await getPort().flushPersistence()
        break
      }
      case 'resetDemoAnnotation': {
        const text = payload.text, quote = payload.quote
        if (getPort().state.depth < 1.65 || !getPort().selectedAnswer) throw new Error('Enter the demo answer before preparing its annotation')
        if (typeof text !== 'string' || !text.trim() || typeof quote !== 'string' || !quote.trim()) throw new Error('An exact demo text and quote are required')
        const targetIds = new Set(getPort().currentAnswerTargetIds())
        const removedReflectionIds = getPort().state.reflections
          .filter(note => targetIds.has(note.targetId) && note.text === text.trim() && note.quote === quote)
          .map(note => note.id)
        if (getPort().state.saved) {
          getPort().toggleSave()
          await wait(() => !getPort().state.saved, 'demo collection removal')
        }
        if (removedReflectionIds.length) {
          getPort().removeReflections(removedReflectionIds)
          await wait(() => !getPort().state.reflections.some(note => removedReflectionIds.includes(note.id)), 'demo reflection removal')
        }
        await getPort().flushPersistence()
        return { ...getState(), removedReflectionIds }
      }
      case 'openReflection': {
        if (getPort().state.depth < 0.65) throw new Error('Enter a question or answer before reflecting')
        const quote = getPort().state.selectedQuote
        getPort().openReflection()
        await wait(() => getPort().state.reflection && (!quote || getPort().state.reflectionTarget?.quote === quote), 'reflection source')
        break
      }
      case 'setReflectionText': {
        if (!getPort().state.reflection) throw new Error('Open the reflection editor first')
        const text = payload.text
        if (typeof text !== 'string' || text.length > 5000) throw new Error('Reflection text must be at most 5000 characters')
        getPort().setReflectionText(text)
        await wait(() => getPort().state.reflectionText === text, 'reflection text')
        break
      }
      case 'saveReflection': {
        const before = getPort().state
        if (!before.reflection || !before.reflectionText.trim()) throw new Error('No reflection is ready to save')
        const ids = new Set(before.reflections.map(note => note.id))
        getPort().saveReflection()
        await wait(() => !getPort().state.reflection && getPort().state.reflections.some(note => !ids.has(note.id) && note.text === before.reflectionText.trim() && note.quote === before.reflectionTarget?.quote), 'reflection persistence')
        await getPort().flushPersistence()
        const note = getPort().state.reflections.find(item => !ids.has(item.id))
        return { ...getState(), savedReflectionId: note?.id }
      }
      case 'showDrawer': {
        const drawer = payload.drawer ?? payload.name ?? 'collection'
        if (!['collection', 'reflections', 'journey'].includes(String(drawer))) throw new Error('Unsupported showcase drawer')
        const target = drawer === 'journey' ? 'journey' : 'collection'
        const tab = drawer === 'reflections' ? 'thoughts' : 'saved'
        getPort().closeOverlays()
        await wait(() => !getPort().state.reader && !getPort().state.reflection, 'closing reader')
        getPort().showDrawer(target, tab)
        await wait(() => getPort().state.drawer === target && getPort().state.collectionTab === tab, 'drawer')
        break
      }
      case 'revisit': {
        const id = payload.id ?? payload.stopId
        const stop = id ? getPort().state.journey.find(item => item.id === id) : [...getPort().state.journey].reverse().find(item => item.type === (payload.type ?? 'question'))
        if (!stop) throw new Error('Requested journey stop does not exist')
        // Recording uses the loaded snapshot; a revisit must not silently launch a new search.
        const question = getPort().questions.find(item => item.id === stop.questionId)
        if (stop.query !== getPort().state.query || !question || (stop.answerId && !question.answers.some(answer => answer.id === stop.answerId))) throw new Error('Journey stop is not present in the current snapshot')
        getPort().revisit(stop)
        await wait(() => getPort().state.questionId === stop.questionId && (!stop.answerId || getPort().state.answerId === stop.answerId) && getPort().state.depth === (stop.answerId ? 2 : 1) && !getPort().state.drawer, 'journey revisit')
        await settled()
        break
      }
      case 'closeOverlays':
        getPort().closeOverlays()
        await wait(() => !getPort().state.drawer && !getPort().state.reader && !getPort().state.reflection, 'overlay closing')
        break
      case 'reset':
        getPort().reset()
        await wait(() => getPort().state.depth === 0 && !getPort().state.drawer && !getPort().state.reader && !getPort().state.reflection, 'overview reset')
        await settled()
        break
      default: throw new Error(`Unknown galaxy showcase action: ${action}`)
    }
    return getState()
  }
  return {
    getState,
    execute(action: string, payload?: Record<string, unknown>) {
      const next = queue.then(() => run(action, payload))
      queue = next.catch(() => undefined)
      return next
    },
    dispose() { active = false },
  }
}
