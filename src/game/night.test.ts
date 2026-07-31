import { expect, test } from 'vitest'
import { hourSeoul, isGoodnightWindow, isSleepScene } from './night'

test('서울 시각 추출', () => {
  expect(hourSeoul(new Date('2026-07-31T13:00:00Z'))).toBe(22)
  expect(hourSeoul(new Date('2026-07-31T16:30:00Z'))).toBe(1)
})

test('굿나잇 창: 21~03시(서울)', () => {
  expect(isGoodnightWindow(new Date('2026-07-31T12:00:00Z'))).toBe(true)  // 21시
  expect(isGoodnightWindow(new Date('2026-07-31T17:59:00Z'))).toBe(true) // 02:59
  expect(isGoodnightWindow(new Date('2026-07-31T18:00:00Z'))).toBe(false) // 03:00
  expect(isGoodnightWindow(new Date('2026-07-31T05:00:00Z'))).toBe(false) // 14시
})

test('취침 장면: 기록 있고 21~06시', () => {
  const night = new Date('2026-07-31T14:00:00Z') // 23시
  const morning = new Date('2026-07-31T22:30:00Z') // 다음날 07:30
  expect(isSleepScene(night, true)).toBe(true)
  expect(isSleepScene(night, false)).toBe(false)
  expect(isSleepScene(morning, true)).toBe(false)
})
