/** Metres; x = sin(angle) * radius, z = cos(angle) * radius. Shared by geometry and navigation. */
export const GARDEN_PERIMETER_BEDS = [
  { id: 'reading-shore', start: .55, end: 1.35, inner: 10.05, outer: 11.55, height: .56 },
  { id: 'home-garden', start: 1.98, end: 2.52, inner: 10.05, outer: 11.55, height: .56 },
  { id: 'woodland-crescent', start: 3.15, end: 6.02, inner: 10.05, outer: 11.55, height: .56 },
] as const

/** Gaps remain open above and below eye level: telescope, galaxy horizon, southern sea. */
export const GARDEN_PERIMETER_PERGOLAS = [
  { start: 1.98, end: 2.52, inner: 9.84, outer: 11.38, height: 3.82, bays: 2 },
  { start: 3.15, end: 4.86, inner: 9.84, outer: 11.38, height: 3.82, bays: 6 },
] as const

export function perimeterPoint(angle: number, radius: number, y = 0): [number, number, number] {
  return [Math.sin(angle) * radius, y, Math.cos(angle) * radius]
}

export const GARDEN_PERIMETER_COLUMNS = GARDEN_PERIMETER_PERGOLAS.flatMap(arc =>
  Array.from({ length: arc.bays + 1 }, (_, i) => perimeterPoint(arc.start + (arc.end - arc.start) * i / arc.bays, 10.28)))

/** Conservative circles cover the true solid band; no proxy protrudes into the central route. */
export const GARDEN_PERIMETER_OBSTACLES = GARDEN_PERIMETER_BEDS.flatMap(arc => {
  const radius = (arc.inner + arc.outer) / 2
  const count = Math.ceil((arc.end - arc.start) * radius / .32)
  return Array.from({ length: count + 1 }, (_, i) => {
    const [x, , z] = perimeterPoint(arc.start + (arc.end - arc.start) * i / count, radius)
    return { x, z, radius: (arc.outer - arc.inner) / 2 + .1 }
  })
})

/** Practical fixture anchors, not extra dynamic lights. The parent owns the scene lighting budget. */
export const GARDEN_PERIMETER_LAMPS = [1.02, 2.19, 3.41, 3.97, 4.54, 5.39, 5.83].map((angle, index) => {
  const hanging = index > 0 && index < 5
  return { position: perimeterPoint(angle, 10.0, hanging ? 3.28 : 1.05), hanging }
})
