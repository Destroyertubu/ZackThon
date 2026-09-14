import test from 'node:test'
import assert from 'node:assert/strict'
import { REALM_DEFINITIONS } from '../src/features/journeys/realmDefinitions'
import { groundHeight, safePose } from '../src/features/journeys/scene/navigation'
import { getQualityProfile } from '../src/state/gameStore'
const sunset=REALM_DEFINITIONS.find(w=>w.id==='sunset-boulevard')!
test('all station identities recover a stranded save at their own safe stop',()=>{
  for(const world of REALM_DEFINITIONS)for(const station of world.stations){
    const recovered=safePose(world,{position:[700,1.7,900],yaw:.37,pitch:.2},station.id)
    assert.ok(Math.hypot(recovered.position[0]-station.position[0],recovered.position[2]-station.position[2])<3.1)
    assert.notEqual(groundHeight(world,recovered.position[0],recovered.position[2]),null)
    assert.deepEqual(safePose(world,recovered,station.id),recovered)
  }
})
test('galaxy return keeps valid third-station position and heading; stale entrance relocates to third station',()=>{
  const pose={position:[-.6,1.7,-1.8] as [number,number,number],yaw:.73,pitch:-.23}
  assert.deepEqual(safePose(sunset,pose,'exception'),pose)
  const recovered=safePose(sunset,sunset.spawn,'exception')
  assert.deepEqual(recovered.position,[-1,1.7,-2])
})
test('unknown/missing and non-finite saves fail safely, C without save still uses entry',()=>{
  assert.deepEqual(safePose(sunset),sunset.spawn)
  assert.deepEqual(safePose(sunset,{position:[NaN,0,0],yaw:0,pitch:0}),sunset.spawn)
  assert.notEqual(groundHeight(sunset,...[safePose(sunset,{position:[8,1.7,-1],yaw:0,pitch:0},'removed-station').position[0],safePose(sunset,{position:[8,1.7,-1],yaw:0,pitch:0},'removed-station').position[2]]),null)
})
test('quality preference and explicit cloud flag share bounded reflection budgets',()=>{
  assert.equal(getQualityProfile('fine',false).reflectionHz,15)
  assert.equal(getQualityProfile('fine',true).reflectionHz,30)
  assert.equal(getQualityProfile('fine',true).dprMax,1)
  assert.equal(getQualityProfile('smooth',true).reflectionHz,0)
  assert.equal(getQualityProfile('smooth',true).waterWaves,4)
})
