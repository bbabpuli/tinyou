import { expect, test } from 'vitest'
import type { CareAction } from './care'
import { canFeedNow, hoursUntilHungry, hungerFrom, lastFedAt } from './hunger'

const NOW = new Date('2026-08-04T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000)
const feed = (at: Date): CareAction => ({ userId: 'me', type: 'feed', createdAt: at })
const pet = (at: Date): CareAction => ({ userId: 'me', type: 'pet', createdAt: at })

test('밥 기록이 없으면 hungry — 첫 밥은 바로 가능', () => {
  expect(hungerFrom(null, NOW)).toBe('hungry')
  expect(canFeedNow([], NOW)).toBe(true)
})

test('경계값: 4h 미만 full, 4h~8h 미만 ok, 8h부터 hungry', () => {
  expect(hungerFrom(hoursAgo(3.99), NOW)).toBe('full')
  expect(hungerFrom(hoursAgo(4), NOW)).toBe('ok')
  expect(hungerFrom(hoursAgo(7.99), NOW)).toBe('ok')
  expect(hungerFrom(hoursAgo(8), NOW)).toBe('hungry')
})

test('lastFedAt은 feed만 보고 최신 시각을 고른다', () => {
  expect(lastFedAt([])).toBe(null)
  expect(lastFedAt([pet(hoursAgo(1))])).toBe(null)
  expect(lastFedAt([feed(hoursAgo(10)), pet(hoursAgo(1)), feed(hoursAgo(5))]))
    .toEqual(hoursAgo(5))
})

test('canFeedNow는 hungry일 때만 true', () => {
  expect(canFeedNow([feed(hoursAgo(2))], NOW)).toBe(false)
  expect(canFeedNow([feed(hoursAgo(9))], NOW)).toBe(true)
})

test('hoursUntilHungry: 남은 시간 올림, 배고프면 0', () => {
  expect(hoursUntilHungry(null, NOW)).toBe(0)
  expect(hoursUntilHungry(hoursAgo(9), NOW)).toBe(0)
  expect(hoursUntilHungry(hoursAgo(6.5), NOW)).toBe(2) // 1.5h 남음 → 올림 2
  expect(hoursUntilHungry(hoursAgo(0), NOW)).toBe(8)
})
