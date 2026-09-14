import { getRealmDefinition } from '../realmDefinitions'
import WorldCanvas from './WorldCanvas'
import type { JourneyWorldProps } from './types'

export default function JourneyWorld({realmId,...props}:JourneyWorldProps) {
  const world=getRealmDefinition(realmId)
  if(!world)return <div role="alert">这条旅程尚未开放。</div>
  return <WorldCanvas key={world.id} world={world} {...props}/>
}
export { JourneyWorld }
