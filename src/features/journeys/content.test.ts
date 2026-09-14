import assert from 'node:assert/strict'
import test from 'node:test'
import { REALM_DEFINITIONS, getRealmForRecipe } from './realmDefinitions'
import { ACTIVITIES, realmSources } from './content'
import { mixThoughtRecipe } from '../../components/observatory/gardenRecipes'
import { activityResult } from './activityResult'

test('all ten ingredient pairs have distinct activities, five prompts and six traceable sources',()=>{
  const modes=new Set<string>()
  for(const realm of REALM_DEFINITIONS){
    const activity=ACTIVITIES[realm.id];modes.add(activity.mode)
    assert.equal(activity.steps.length,5);assert.equal(realm.stations.length,5)
    const sources=realmSources(realm);assert.equal(new Set(sources.map(s=>s.id)).size,6)
    for(const source of sources){assert.ok(source.author&&source.summary&&source.readingGuide);assert.equal(new URL(source.url).protocol,'https:');assert.match(source.remoteId!,/^curated-/)}
    for(const percent of [10,50,90]){
      const recipe=mixThoughtRecipe(realm.pair[0],realm.pair[1],percent)
      assert.equal(getRealmForRecipe(recipe)?.id,realm.id)
      assert.equal(getRealmForRecipe(mixThoughtRecipe(realm.pair[1],realm.pair[0],100-percent))?.id,realm.id)
      assert.ok(realmSources(realm,recipe)[0].tags?.includes(percent>=50?recipe.first:recipe.second))
    }
  }
  assert.equal(modes.size,10)
})
test('saved outputs keep Chinese activity meaning while photos stay in the journey',()=>{
  const text=activityResult({'station-note:opening':'等候的树影',caption0:'一束侧光',photo0:'data:image/jpeg;base64,abc',title:'忽略标题',rhythm0:'10001000',tone0:'2',sent:'both'},[{id:'opening',title:'看见一束光'}])
  assert.match(text,/看见一束光：等候的树影/);assert.match(text,/开场画面：一束侧光/)
  assert.match(text,/风与叶 · 八拍：● ○ ○ ○ ● ○ ○ ○/);assert.match(text,/第 1 音：E/);assert.match(text,/决定寄出：两封一起寄出/)
  assert.doesNotMatch(text,/data:|caption0|rhythm0|station-note|忽略标题/)
  assert.equal(activityResult({title:'仅有标题',photo0:'data:test'}),'')
})
