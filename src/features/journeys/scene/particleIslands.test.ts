import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { createParticleIsland, PARTICLE_ISLANDS } from './particleIslands'

test('both particle tiers fit their budget and keep finite, bounded GPU attributes', () => {
  for (const fine of [false, true]) {
    let count = 0
    for (const island of PARTICLE_ISLANDS) {
      const geometry = createParticleIsland(island, fine), position = geometry.attributes.position
      count += position.count
      for (const attr of Object.values(geometry.attributes)) {
        assert.equal(attr.count, position.count)
        assert.ok(Array.from(attr.array).every(Number.isFinite))
      }
      for (let i = 0; i < position.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i)
        assert.ok(geometry.boundingSphere!.containsPoint(p))
        if (geometry.attributes.starData.getX(i) === 2) {
          const lowest = p.y + island.center[1] - geometry.attributes.starMotion.getX(i) - .58
          assert.ok(lowest > 3, 'particle falls must dissolve above all scene sea levels')
        }
      }
      geometry.dispose()
    }
    assert.ok(count < (fine ? 175_000 : 85_000), `particle budget exceeded: ${count}`)
  }
})

test('island fields stay outside the playable area and separate from each other', () => {
  for (const [index, island] of PARTICLE_ISLANDS.entries()) {
    const radius = Math.max(...island.radius) * 1.35
    assert.ok(Math.hypot(island.center[0], island.center[2]) - radius > 45)
    for (const other of PARTICLE_ISLANDS.slice(index + 1)) {
      const distance = Math.hypot(island.center[0] - other.center[0], island.center[2] - other.center[2])
      assert.ok(distance > radius + Math.max(...other.radius) * 1.35, `${island.id} overlaps ${other.id}`)
    }
  }
})

test('re-entering a scene reproduces the same stars instead of popping to new random shapes', () => {
  const a = createParticleIsland(PARTICLE_ISLANDS[0], false), b = createParticleIsland(PARTICLE_ISLANDS[0], false)
  for (const name of Object.keys(a.attributes)) assert.deepEqual(a.attributes[name].array, b.attributes[name].array)
  a.dispose(); b.dispose()
})
