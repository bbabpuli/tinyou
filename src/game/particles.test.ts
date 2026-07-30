import { expect, test } from 'vitest'
import { ParticleSystem } from './particles'

test('spawnHearts로 개수만큼 생성', () => {
  const ps = new ParticleSystem(() => 0.5)
  ps.spawnHearts(100, 100, 5)
  expect(ps.count).toBe(5)
})

test('수명(1200ms)이 다하면 제거', () => {
  const ps = new ParticleSystem(() => 0.5)
  ps.spawnHearts(100, 100, 3)
  ps.update(1100)
  expect(ps.count).toBe(3)
  ps.update(200)
  expect(ps.count).toBe(0)
})

test('update마다 위로 떠오름 (y 감소)', () => {
  const ps = new ParticleSystem(() => 0.5)
  ps.spawnHearts(100, 100, 1)
  const before = ps.particles[0].y
  ps.update(500)
  expect(ps.particles[0].y).toBeLessThan(before)
})
