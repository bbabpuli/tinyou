import { expect, test } from 'vitest'
import { applyPetEvent, isPetToastVisible, PET_MERGE_WINDOW_MS, PET_TOAST_VISIBLE_MS } from './petToast'

const T0 = 1_000_000

test('첫 이벤트: 단건 문구', () => {
  const s = applyPetEvent(null, '동글', T0)
  expect(s.text).toBe('동글님이 쓰다듬었어요')
  expect(s.lastEventAt).toBe(T0)
})

test('30초 안에 또 오면 잔뜩 문구로 병합', () => {
  const s1 = applyPetEvent(null, '동글', T0)
  const s2 = applyPetEvent(s1, '동글', T0 + 5_000)
  expect(s2.text).toBe('동글님이 잔뜩 쓰다듬고 있어요')
})

test('병합 윈도(30s)가 지나면 다시 단건 문구', () => {
  const s1 = applyPetEvent(null, '동글', T0)
  const s2 = applyPetEvent(s1, '동글', T0 + PET_MERGE_WINDOW_MS)
  expect(s2.text).toBe('동글님이 쓰다듬었어요')
})

test('표시 시간: 마지막 이벤트 후 4초까지만 보인다', () => {
  const s = applyPetEvent(null, '동글', T0)
  expect(isPetToastVisible(s, T0)).toBe(true)
  expect(isPetToastVisible(s, T0 + PET_TOAST_VISIBLE_MS - 1)).toBe(true)
  expect(isPetToastVisible(s, T0 + PET_TOAST_VISIBLE_MS)).toBe(false)
  expect(isPetToastVisible(null, T0)).toBe(false)
})

test('연타 중에는 표시가 계속 연장된다', () => {
  const s1 = applyPetEvent(null, '동글', T0)
  const s2 = applyPetEvent(s1, '동글', T0 + 3_000)
  expect(isPetToastVisible(s2, T0 + 6_000)).toBe(true) // 마지막 이벤트 기준 3초 경과
})
