import { expect, test } from 'vitest'
import { dateKeySeoul } from './dateKey'

test('UTC 자정 직전은 서울에선 같은 날 (14:59Z = 23:59 KST)', () => {
  expect(dateKeySeoul(new Date('2026-07-30T14:59:00Z'))).toBe('2026-07-30')
})

test('UTC 15시부터 서울은 다음 날 (15:00Z = 00:00 KST)', () => {
  expect(dateKeySeoul(new Date('2026-07-30T15:00:00Z'))).toBe('2026-07-31')
})

test('연말 경계 (12-31 15:00Z → 서울 새해)', () => {
  expect(dateKeySeoul(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01')
})
