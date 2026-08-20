import { expect, test } from 'vitest'
import { canCareToday, canPetStackToday, lastCaredAt, petStackToday, xpFromActions, type CareAction } from './care'

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

// 2026-08-04 12:00Z = 서울 21:00. 서울 자정 경계는 15:00Z.
const PET_NOW = new Date('2026-08-04T12:00:00Z')
const petAt = (iso: string, userId = 'me') =>
  ({ userId, type: 'pet' as const, createdAt: new Date(iso) })

test('petStackToday: 오늘(서울) 내 pet 기록만 센다', () => {
  const log = [
    petAt('2026-08-04T10:00:00Z'),            // 오늘(서울 19:00)
    petAt('2026-08-03T14:00:00Z'),            // 어제(서울 23:00) — 제외
    petAt('2026-08-04T11:00:00Z', 'partner'), // 남의 기록 — 제외
    { userId: 'me', type: 'feed' as const, createdAt: new Date('2026-08-04T10:30:00Z') }, // 다른 타입 — 제외
  ]
  expect(petStackToday(log, 'me', PET_NOW)).toBe(1)
})

test('서울 자정 경계: 14:59Z는 같은 날, 15:00Z는 다음 날', () => {
  const now = new Date('2026-08-04T16:00:00Z') // 서울 8/5 01:00
  expect(petStackToday([petAt('2026-08-04T14:59:00Z')], 'me', now)).toBe(0) // 서울 8/4 23:59 — 어제
  expect(petStackToday([petAt('2026-08-04T15:00:00Z')], 'me', now)).toBe(1) // 서울 8/5 00:00 — 오늘
})

test('canPetStackToday: 2회 미만이면 true, 2회부터 false', () => {
  expect(canPetStackToday([], 'me', PET_NOW)).toBe(true)
  expect(canPetStackToday([petAt('2026-08-04T09:00:00Z')], 'me', PET_NOW)).toBe(true)
  expect(canPetStackToday(
    [petAt('2026-08-04T09:00:00Z'), petAt('2026-08-04T10:00:00Z')], 'me', PET_NOW,
  )).toBe(false)
})
