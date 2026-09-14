import { useEffect, useLayoutEffect, useRef } from 'react'

export type ShowcasePayload = Record<string, unknown>
export interface ShowcaseAdapter {
  getState: () => unknown
  execute: (action: string, payload?: ShowcasePayload) => unknown | Promise<unknown>
}
const enabled = import.meta.env.VITE_SHOWCASE === '1' && new URLSearchParams(location.search).get('showcase') === '1'
const adapters = new Map<string, ShowcaseAdapter>()
export const isShowcase = () => enabled
export function registerShowcaseAdapter(name: string, adapter: ShowcaseAdapter) {
  if (!enabled) return () => {}
  adapters.set(name, adapter)
  return () => { if (adapters.get(name) === adapter) adapters.delete(name) }
}
export function useShowcaseAdapter(name: string, adapter: ShowcaseAdapter) {
  const current = useRef(adapter)
  useLayoutEffect(() => { current.current = adapter })
  useEffect(() => registerShowcaseAdapter(name, {
    getState: () => current.current.getState(),
    execute: (action, payload) => current.current.execute(action, payload),
  }), [name])
}
export function adapterState<T = Record<string, unknown>>(name: string): T | undefined {
  return adapters.get(name)?.getState() as T | undefined
}
export function allAdapterStates() {
  return Object.fromEntries([...adapters].map(([name, adapter]) => [name, adapter.getState()]))
}
export async function command(name: string, action: string, payload: ShowcasePayload = {}) {
  const adapter = adapters.get(name)
  if (!adapter) throw new Error(`演示入口尚未就绪：${name}`)
  return adapter.execute(action, payload)
}
export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
export async function waitFor<T>(predicate: () => T | undefined | false | null, label: string, timeout = 45000): Promise<T> {
  const end = performance.now() + timeout
  while (performance.now() < end) {
    const value = predicate()
    if (value) return value
    await sleep(60)
  }
  throw new Error(`等待超时：${label}`)
}
