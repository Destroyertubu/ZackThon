import { useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useGameStore } from '@/state/gameStore'
import { flushPersonalData, usePersonalStore } from '@/features/personal/store'
import { adapterState, allAdapterStates, command, sleep, waitFor } from './runtime'

const TOPIC = 'topic-learning'
const WORK = 'knowledge-1509654546602856448'
const QUOTE = '到安静的户外，听听自然'
type ShotId = 'opening' | 'explore' | 'annotate' | 'footprints' | 'home' | 'mix' | 'montage' | 'finale'
type Pose = { position: [number, number, number]; target: [number, number, number]; fov?: number }
type GalaxyState = { queryReady: boolean; questionId: string; answerId: string; depth: number; reader: unknown; saved: boolean;
  reflectionText: string; reflections: { id: string; text: string }[]; journey: { id: string }[]; error: string | null }
type TreeState = { ready: boolean; treeOpen: boolean; topicId: string | null; topics: { id: string; leaves: { id: string; title: string }[] }[] }
const poses: Record<string, Pose> = {
  opening: { position: [6.6, 2.9, 9.1], target: [-1.8, 3.2, -2.7], fov: 63 },
  openingEnd: { position: [4.4, 2.25, 7.3], target: [-1.4, 3, -3.2], fov: 63 },
  tree: { position: [2.8, 2.15, 6.3], target: [-2, 3.5, -2], fov: 68 },
  home: { position: [2.8, 1.8, 3.7], target: [-.8, 1.35, -1.8], fov: 66 },
  bar: { position: [-3.9, 1.8, 1.35], target: [-6.65, 1.58, 1.4], fov: 60 },
  barEnd: { position: [-4.1, 1.85, 2.1], target: [-6.65, 1.58, 1.4], fov: 60 },
  sunset: { position: [1, 1.7, 17], target: [-4, 2.5, 10], fov: 61 },
  sunsetEnd: { position: [.2, 1.7, 12], target: [-3, 2.5, 3], fov: 61 },
  coast: { position: [2, 1.7, -1.8], target: [10, -.2, -6], fov: 61 },
  islands: { position: [-9, 2.3, -5], target: [-69, 12, -48], fov: 65 },
  moonpool: { position: [.3, 1.7, 4.1], target: [-2.6, .35, 1.1], fov: 65 },
}

function visible<T extends Element>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)].filter(node => node.getClientRects().length > 0)
}
function clickText(selector: string, text: string) {
  const node = visible<HTMLElement>(selector).find(element => element.textContent?.includes(text))
  if (!node) throw new Error(`没有找到实际操作入口：${text}`)
  node.click()
}

export default function ShowcaseDirector() {
  const navigate = useNavigate(), navigation = useRef(navigate)
  useLayoutEffect(() => { navigation.current = navigate })
  useEffect(() => {
    let alive = true, running = false, cancelled = false, overlay: HTMLImageElement | null = null
    const state = { ready: false, shotId: '' as string, status: 'booting', error: null as string | null,
      noteId: '', sourceId: '', journeyId: '', events: [] as { event: string; at: number; detail?: unknown }[] }
    let thought = ''
    let mixBaselineJourneyIds: Set<string> | null = null
    const durations: Record<string, number> = {}
    const log = (event: string, detail?: unknown) => state.events.push({ event, at: Date.now(), detail })
    const snapshot = () => ({ ...state, route: location.pathname, adapters: allAdapterStates(), personal: {
      ready: usePersonalStore.getState().ready, collections: usePersonalStore.getState().data.collections.length,
      notes: usePersonalStore.getState().data.notes.length, journeys: usePersonalStore.getState().data.journeys.length,
    } })
    const verify = (condition: unknown, message: string) => { if (!condition) throw new Error(message) }
    const galaxy = () => adapterState<GalaxyState>('galaxy')
    async function pause(ms: number) { if (cancelled || !alive) throw new Error('演示已取消'); await sleep(Math.max(0, ms)) }
    async function holdFrame() {
      if (!running || !adapterState('camera')) return
      const data = await command('camera', 'capture') as string
      overlay?.remove(); overlay = document.createElement('img'); overlay.className = 'showcase-transition'
      overlay.src = data; overlay.alt = ''; document.body.append(overlay)
    }
    async function reveal() {
      if (!overlay) return
      const previous = overlay; overlay = null
      previous.style.opacity = '0'; await pause(370); previous.remove()
    }
    async function sceneReady(scene: string) {
      await waitFor(() => {
        const camera = adapterState<{ scene: string; ready: boolean }>('camera')
        return camera?.scene === scene && camera.ready
      }, `${scene} 场景与镜头`)
      await document.fonts.ready
      await pause(700)
    }
    async function setPose(pose: Pose) { await command('camera', 'pose', pose); await pause(100) }
    async function go(path: string, scene?: string, pose?: Pose) {
      useGameStore.getState().closePanel()
      if (location.pathname !== path) { await holdFrame(); navigation.current(path) }
      if (scene) { await sceneReady(scene); if (pose) await setPose(pose) }
      else {
        await waitFor(() => galaxy()?.queryReady, '星空公开内容')
        await command('galaxy', 'ready'); await document.fonts.ready
      }
      await reveal()
    }
    async function contentTarget() {
      await go('/galaxy')
      if (galaxy()?.questionId !== TOPIC) await command('galaxy', 'selectQuestion', { id: TOPIC })
      if (galaxy()?.answerId !== WORK) await command('galaxy', 'selectAnswer', { id: WORK })
      await command('galaxy', 'setDepth', { depth: 2 })
    }
    async function prepareShot(id: string) {
      if (running) throw new Error('当前镜头仍在录制')
      if (!(id in durations)) throw new Error(`未知分镜：${id}`)
      cancelled = false; state.shotId = id; state.status = 'preparing'; state.error = null
      document.documentElement.dataset.showcaseShot = id
      try {
        await waitFor(() => usePersonalStore.getState().ready, '独立个人空间')
        if (id === 'opening') { await go('/observatory', 'observatory', poses.opening) }
        if (id === 'explore') { await go('/galaxy'); await command('galaxy', 'reset') }
        if (id === 'annotate') {
          await contentTarget(); await command('galaxy', 'closeOverlays')
          // This renderer has a fresh private profile; reset only the exact demonstration annotation on a retry.
          await command('galaxy', 'resetDemoAnnotation', { text: thought, quote: QUOTE })
          state.noteId = ''; state.sourceId = ''
        }
        if (id === 'footprints') { await go('/galaxy'); await command('galaxy', 'closeOverlays') }
        if (id === 'home') {
          const note = usePersonalStore.getState().data.notes.find(item => item.id === state.noteId)
          verify(note, '小屋镜头需要刚才保存的真实批注')
          await go('/home', 'home', poses.home)
          verify(usePersonalStore.getState().data.notes.find(item => item.id === state.noteId) === note, '小屋预热不应修改批注')
          await go('/observatory', 'observatory', poses.tree)
        }
        if (id === 'mix') {
          const count = usePersonalStore.getState().data.journeys.length
          await go('/showcase/warmup', 'world', poses.sunset)
          verify(usePersonalStore.getState().data.journeys.length === count, '场景预热不应创建旅程')
          // Unmount JourneyPage before retracting a failed take, otherwise its
          // ordinary direct-entry effect would create a replacement journey.
          if (!mixBaselineJourneyIds) {
            mixBaselineJourneyIds = new Set(usePersonalStore.getState().data.journeys.map(trip => trip.id))
          } else {
            const removed = usePersonalStore.getState().data.journeys.filter(trip =>
              !mixBaselineJourneyIds!.has(trip.id) && trip.realmId === 'sunset-boulevard' && trip.personalText.includes(thought))
            if (removed.length) {
              const ids = new Set(removed.map(trip => trip.id))
              usePersonalStore.setState(current => ({ data: { ...current.data,
                journeys: current.data.journeys.filter(trip => !ids.has(trip.id)),
                returnAnchor: ids.has(current.data.returnAnchor?.journeyId ?? '') ? null : current.data.returnAnchor,
              } }))
              await flushPersonalData()
              log('mix-retry-reset', [...ids])
            }
          }
          state.journeyId = ''
          await go('/observatory', 'observatory', poses.bar); await command('observatory', 'closeTree')
        }
        if (id === 'montage') {
          verify(usePersonalStore.getState().data.journeys.some(trip => trip.id === state.journeyId), '蒙太奇需要刚才调制的真实旅程')
          await go(`/journey/sunset-boulevard?trip=${encodeURIComponent(state.journeyId)}`, 'world', poses.sunset)
        }
        if (id === 'finale') {
          await go('/galaxy'); await command('galaxy', 'reset')
          await command('camera-galaxy', 'shot', { yaw: -.06, pitch: .16, pan: [0, 0, 0] })
        }
        await pause(600); state.status = 'prepared'; log('prepared', id)
        return snapshot()
      } catch (error) { state.status = 'failed'; state.error = String(error); throw error }
    }
    async function playShot(id: string) {
      if (state.shotId !== id || state.status !== 'prepared' || running) throw new Error('镜头必须先准备完成')
      running = true; state.status = 'recording'; log('started', id)
      const start = performance.now()
      const at = async (seconds: number, action?: () => unknown | Promise<unknown>) => {
        await pause(seconds * 1000 - (performance.now() - start)); if (action) await action()
      }
      try {
        switch (id as ShotId) {
          case 'opening':
            await command('camera', 'move', { to: poses.openingEnd, duration: 11 })
            break
          case 'explore':
            await at(4, () => command('galaxy', 'selectQuestion', { id: TOPIC }))
            await at(5, () => command('galaxy', 'setDepth', { depth: 1 }))
            await at(15, () => command('galaxy', 'selectAnswer', { id: WORK }))
            await at(17, () => command('galaxy', 'setDepth', { depth: 2 }))
            break
          case 'annotate': {
            await at(1, () => command('galaxy', 'openReader', { index: 45, quote: QUOTE }))
            await at(9, () => command('galaxy', 'ensureSaved'))
            await at(13, () => command('galaxy', 'openReflection'))
            await at(15)
            for (let n = 1; n <= thought.length; n++) { await command('galaxy', 'setReflectionText', { text: thought.slice(0, n) }); await pause(90) }
            await at(23, () => command('galaxy', 'saveReflection'))
            const note = await waitFor(() => usePersonalStore.getState().data.notes.find(n => n.text === thought && n.quote === QUOTE), '真实批注写入共同资料库')
            state.noteId = note.id; state.sourceId = note.sourceId ?? ''
            verify(galaxy()?.saved, '作品收藏尚未成功')
            log('saved-and-annotated', { noteId: note.id, sourceId: state.sourceId })
            await at(28, () => command('galaxy', 'showDrawer', { drawer: 'reflections' }))
            break
          }
          case 'footprints':
            await at(1, () => command('galaxy', 'showDrawer', { drawer: 'journey' }))
            verify((galaxy()?.journey.length ?? 0) > 0, '没有本次真实探索足迹')
            await at(11, () => command('galaxy', 'revisit'))
            await at(17, () => command('galaxy', 'closeOverlays'))
            log('revisited', galaxy()?.questionId)
            break
          case 'home': {
            verify(state.noteId && state.sourceId, '缺少先前镜头保存的真实笔记')
            await at(1, () => command('observatory', 'openTree'))
            const tree = adapterState<TreeState>('observatory')!
            const record = usePersonalStore.getState().data.collections.find(c => c.sourceId === state.sourceId)
            const topic = tree.topics.find(t => t.leaves.some(l => l.id === record?.id))
            verify(topic && record, '星树没有找到刚才的收藏')
            await at(3, () => command('observatory', 'selectTopic', { id: topic!.id }))
            await at(7, () => command('observatory', 'closeTree'))
            await at(8, () => go('/home', 'home', poses.home))
            await at(14, () => { useGameStore.getState().openPanel('cabinet') })
            await waitFor(() => visible('.ms-panel-nav button').length, '小屋资料柜')
            await at(16, () => clickText('.ms-panel-nav button', '手记'))
            await waitFor(() => visible('.ms-index-item').length, '小屋手记')
            const note = usePersonalStore.getState().data.notes.find(n => n.id === state.noteId)!
            const button = visible<HTMLElement>('.ms-index-item').find(el => el.textContent?.includes(note.text.slice(0, 20)))
            verify(button, '小屋未显示同一条批注'); button!.click()
            await waitFor(() => visible<HTMLElement>('.ms-quote').some(el => el.textContent === QUOTE), '跨场景引文一致')
            verify(performance.now() - start <= 18000, '小屋手记展示需要保留至少六秒')
            log('home-note-confirmed', state.noteId)
            break
          }
          case 'mix': {
            await command('camera', 'move', { to: poses.barEnd, duration: 4 })
            await at(4, () => command('observatory', 'openWorkshop'))
            await waitFor(() => visible('.garden-workshop').length, '思想调酒台')
            await at(6, () => {
              const summary = visible<HTMLElement>('.garden-personal-materials summary')[0]
              verify(summary, '调酒台没有可带入的个人笔记'); summary.click()
              const note = usePersonalStore.getState().data.notes.find(n => n.id === state.noteId)!
              const label = visible<HTMLLabelElement>('.garden-personal-materials label').find(el => el.textContent?.includes(note.title))
              const checkbox = label?.querySelector<HTMLInputElement>('input')
              verify(checkbox, '没有找到本次真实笔记'); if (!checkbox!.checked) checkbox!.click()
            })
            await at(10, () => clickText('.garden-mix-button', '调制这一杯'))
            await at(14, holdFrame)
            await waitFor(() => location.pathname === '/journey/sunset-boulevard', '调酒自动进入落日大道')
            await sceneReady('world'); await setPose(poses.sunset); await reveal()
            const trip = usePersonalStore.getState().data.journeys.find(j => j.id === new URLSearchParams(location.search).get('trip'))
            verify(trip?.personalText.includes(thought), '新旅程没有带入所选批注')
            state.journeyId = trip!.id; log('mixed-and-arrived', trip!.id)
            break
          }
          case 'montage':
            await command('camera', 'move', { to: poses.sunsetEnd, duration: 5 })
            await at(5, () => setPose(poses.coast))
            await at(8, () => go('/observatory', 'observatory', poses.islands))
            await at(13, () => setPose(poses.moonpool))
            await command('observatory', 'resonate')
            break
          case 'finale':
            // The recorder replaces seconds 9–14 with the actual final star-sea still.
            await at(6, () => command('camera-galaxy', 'shot', { yaw: -.04, pitch: .14, pan: [0, 0, 0] }))
            break
        }
        const duration = durations[id]
        if (performance.now() - start > duration * 1000 + 500) throw new Error(`镜头操作超出预定时长：${id}`)
        await at(duration)
        state.status = 'recorded'; log('recorded', { id, elapsed: (performance.now() - start) / 1000 })
        return snapshot()
      } catch (error) { state.status = 'failed'; state.error = String(error); log('failed', state.error); throw error }
      finally { running = false; overlay?.remove(); overlay = null }
    }
    const api = { snapshot, prepareShot, playShot, command,
      cancel: () => { cancelled = true; state.status = 'cancelled' } }
    window.__showcase = api
    const preventUserInput = (event: Event) => { if (event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation() } }
    const eventNames = ['keydown', 'keyup', 'pointermove', 'pointerdown', 'pointerup', 'wheel']
    eventNames.forEach(name => window.addEventListener(name, preventUserInput, { capture: true, passive: false }))
    document.exitPointerLock?.(); (document.activeElement as HTMLElement | null)?.blur()
    void (async () => {
      try {
        const response = await fetch('/showcase/storyboard.json')
        if (!response.ok) throw new Error('分镜清单未部署')
        const manifest = await response.json() as { content: { demoNote: string }; shots: { id: string; duration: number }[] }
        thought = manifest.content.demoNote
        verify(typeof thought === 'string' && thought.length > 0, '分镜缺少演示批注')
        for (const shot of manifest.shots) durations[shot.id] = shot.duration
        verify(Object.values(durations).reduce((a, b) => a + b, 0) === 180, '分镜总时长必须是180秒')
        await waitFor(() => usePersonalStore.getState().ready, '个人空间初始化')
        useGameStore.getState().setQualityMode('fine')
        state.ready = true; state.status = 'idle'; log('ready')
      } catch (error) { state.status = 'failed'; state.error = String(error) }
    })()
    return () => {
      alive = false; cancelled = true; overlay?.remove()
      eventNames.forEach(name => window.removeEventListener(name, preventUserInput, true))
      if (window.__showcase === api) delete window.__showcase
    }
  }, [])
  return null
}

declare global {
  interface Window {
    __showcase?: {
      snapshot: () => unknown
      prepareShot: (id: string) => Promise<unknown>
      playShot: (id: string) => Promise<unknown>
      command: typeof command
      cancel: () => void
    }
  }
}
