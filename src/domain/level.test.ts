import { expect, test } from 'vitest'
import { cumXpForLevel, levelForXp, xpIntoLevel } from './level'

// 곡선: 레벨 n 도달 누적 XP = 30 * n * (n-1) / 2  (레벨2=30, 레벨3=90, 레벨4=180)
test('누적 필요 XP 곡선', () => {
  expect(cumXpForLevel(1)).toBe(0)
  expect(cumXpForLevel(2)).toBe(30)
  expect(cumXpForLevel(3)).toBe(90)
  expect(cumXpForLevel(4)).toBe(180)
})

test('XP → 레벨', () => {
  expect(levelForXp(0)).toBe(1)
  expect(levelForXp(29)).toBe(1)
  expect(levelForXp(30)).toBe(2)
  expect(levelForXp(89)).toBe(2)
  expect(levelForXp(90)).toBe(3)
})

test('레벨 99 캡', () => {
  expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(99)
})

test('레벨 내 진행도', () => {
  // xp=40: 레벨2 (30 필요했음), 다음 레벨까지 90-30=60 중 10 진행
  expect(xpIntoLevel(40)).toEqual({ current: 10, needed: 60 })
})
