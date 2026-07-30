import { expect, test } from 'vitest'
import { happinessFrom } from './happiness'

const NOW = new Date('2026-07-30T12:00:00Z')

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 3600_000)
}

test('돌봄 기록이 없으면 ok (첫 만남)', () => {
  expect(happinessFrom(null, NOW)).toBe('ok')
})

test('24시간 이내 돌봄 → happy', () => {
  expect(happinessFrom(hoursAgo(1), NOW)).toBe('happy')
  expect(happinessFrom(hoursAgo(24), NOW)).toBe('happy')
})

test('24~48시간 → ok', () => {
  expect(happinessFrom(hoursAgo(25), NOW)).toBe('ok')
  expect(happinessFrom(hoursAgo(48), NOW)).toBe('ok')
})

test('48~96시간 → sad', () => {
  expect(happinessFrom(hoursAgo(49), NOW)).toBe('sad')
  expect(happinessFrom(hoursAgo(96), NOW)).toBe('sad')
})

test('96시간 초과 → grimy (죽지는 않음)', () => {
  expect(happinessFrom(hoursAgo(97), NOW)).toBe('grimy')
  expect(happinessFrom(hoursAgo(24 * 365), NOW)).toBe('grimy')
})
