import { LAND_DEFINITION } from '../realmDefinitions'
import WorldCanvas from './WorldCanvas'
import type { WorldSceneProps } from './types'

export default function LandWorld(props:WorldSceneProps) { return <WorldCanvas world={LAND_DEFINITION} {...props}/> }
export { LandWorld }
