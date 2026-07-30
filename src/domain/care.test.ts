import { expect, test } from 'vitest'
import { canCareToday, lastCaredAt, xpFromActions, type CareAction } from './care'

const NOW = new Date('2026-07-30T03:00:00Z') // 서울 07-30 12:00

function action(overrides: Partial<CareAction>): CareAction {
  return { userId: 'me', type: 'feed', createdAt: NOW, ...overrides }
}

test('오늘 안 한 돌봄은 가능', () => {
  expect(canCareToday([], 'me', 'feed', NOW)).toBe(true)
})

test('같은 유저·같은 종류를 오늘 이미 했으면 불가', () => {
  const acts = [action({ createdAt: new Date('2026-07-29T22:00:00Z') })] // 서울 07-30 07:00
  expect(canCareToday(acts, 'me', 'feed', NOW)).toBe(false)
})

test('종류가 다르면 가능 (feed 했어도 pet 가능)', () => {
  const acts = [action({})]
  expect(canCareToday(acts, 'me', 'pet', NOW)).toBe(true)
})

test('어제(서울 기준) 한 돌봄은 오늘 다시 가능', () => {
  const acts = [action({ createdAt: new Date('2026-07-29T12:00:00Z') })] // 서울 07-29 21:00
  expect(canCareToday(acts, 'me', 'feed', NOW)).toBe(true)
})

test('다른 유저의 기록은 내 판정에 영향 없음', () => {
  const acts = [action({ userId: 'partner' })]
  expect(canCareToday(acts, 'me', 'feed', NOW)).toBe(true)
})

test('XP는 액션당 10', () => {
  expect(xpFromActions([])).toBe(0)
  expect(xpFromActions([action({}), action({ type: 'pet' })])).toBe(20)
})

test('lastCaredAt은 가장 최근 액션 시각, 없으면 null', () => {
  expect(lastCaredAt([])).toBeNull()
  const old = action({ createdAt: new Date('2026-07-28T00:00:00Z') })
  const recent = action({ createdAt: new Date('2026-07-30T00:00:00Z') })
  expect(lastCaredAt([old, recent])).toEqual(new Date('2026-07-30T00:00:00Z'))
  expect(lastCaredAt([recent, old])).toEqual(new Date('2026-07-30T00:00:00Z'))
})
