import { expect, test } from 'vitest'
import { isPetSpam, PET_SPAM_LIMIT, PET_SPAM_WINDOW_MS, pushPetTap } from './petSpam'

const T0 = 1_000_000

test('pushPetTap: 창(10초) 밖 탭은 버리고 이번 탭을 더한다', () => {
  const old = T0 - PET_SPAM_WINDOW_MS // 정확히 10초 전 — 창 밖
  const recent = T0 - PET_SPAM_WINDOW_MS + 1 // 9.999초 전 — 창 안
  expect(pushPetTap([old, recent], T0)).toEqual([recent, T0])
})

test('isPetSpam: 10회 미만은 정상, 10회부터 스팸', () => {
  const nine = Array.from({ length: PET_SPAM_LIMIT - 1 }, (_, i) => T0 + i)
  expect(isPetSpam(nine)).toBe(false)
  expect(isPetSpam([...nine, T0 + 100])).toBe(true)
})

test('시나리오: 빠른 연타 10번째에 스팸 판정', () => {
  let taps: number[] = []
  for (let i = 0; i < 9; i++) {
    taps = pushPetTap(taps, T0 + i * 500)
    expect(isPetSpam(taps)).toBe(false)
  }
  taps = pushPetTap(taps, T0 + 9 * 500)
  expect(isPetSpam(taps)).toBe(true)
})

test('시나리오: 천천히(1.2초 간격) 쓰다듬으면 영영 스팸이 아니다', () => {
  let taps: number[] = []
  for (let i = 0; i < 30; i++) {
    taps = pushPetTap(taps, T0 + i * 1200)
    expect(isPetSpam(taps)).toBe(false)
  }
})
