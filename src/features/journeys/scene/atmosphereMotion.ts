import { Color, Vector2 } from 'three'

export type AtmosphereResponse = { id: number; origin: [number, number]; color: string }
export type TideSignal = ReturnType<typeof createTideSignal>

export function createTideSignal() {
  return {
    time: { value: 0 }, pace: { value: 1 }, pulse: { value: 0 }, age: { value: 100 },
    origin: { value: new Vector2(-2, 1.25) }, color: { value: new Color('#87d8d0') },
  }
}

export function triggerTide(signal: TideSignal, response: AtmosphereResponse) {
  signal.origin.value.set(...response.origin)
  signal.color.value.set(response.color)
  signal.age.value = 0
  signal.pulse.value = 1
}

export function setAtmosphereQuiet(signal: TideSignal, quiet: boolean) {
  signal.pace.value = quiet ? .18 : 1
}

/** One bounded clock drives water, cloud, petals and the response travelling offshore. */
export function advanceAtmosphere(signal: TideSignal, delta: number, reducedMotion: boolean) {
  if (reducedMotion) { signal.pulse.value = 0; return }
  const step = Math.max(0, Math.min(delta, .05))
  signal.time.value += step * signal.pace.value
  signal.age.value += step
  signal.pulse.value = Math.exp(-signal.age.value * .48)
}
