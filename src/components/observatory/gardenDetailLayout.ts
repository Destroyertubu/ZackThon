/** Pure navigation data: importing this file does not load React or Three.js. */
export const READING_CORNER_POSITION: [number, number, number] = [6.6, 0, 1.7]
export const READING_CHAIR_ROTATION = -.8
export const GARDEN_DETAIL_OBSTACLES = [{
  x: READING_CORNER_POSITION[0], z: READING_CORNER_POSITION[2], radius: .67,
}] as const
