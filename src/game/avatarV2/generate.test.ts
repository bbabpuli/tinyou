import { expect, test } from 'vitest'
import { generateAvatar } from './generate'

const HAMSTER_YELLOW = ['웃음 많은 사람', '볼 빵빵한 햄스터', '햇살 같은 노란색', '눈 비비는 모습']

test('키워드 반영: 노란 햄스터가 나온다', () => {
  const { map, palette } = generateAvatar(HAMSTER_YELLOW, 0)
  expect(map).toHaveLength(32)
  expect(palette.B).toBe('#fff3a5') // lemon
})

test('다시 뽑기(salt 변경)해도 종·팔레트 고정, 변형만 바뀜', () => {
  const a = generateAvatar(HAMSTER_YELLOW, 0)
  const variants = new Set(
    Array.from({ length: 8 }, (_, s) => JSON.stringify(generateAvatar(HAMSTER_YELLOW, s).map)),
  )
  for (let s = 1; s < 8; s++) {
    expect(generateAvatar(HAMSTER_YELLOW, s).palette.B).toBe(a.palette.B)
  }
  expect(variants.size).toBeGreaterThanOrEqual(2)
})

test('키워드 없으면 해시 폴백으로도 유효한 아바타 (결정적)', () => {
  const a = generateAvatar(['멋진 사람'], 3)
  expect(a).toEqual(generateAvatar(['멋진 사람'], 3))
  expect(a.map).toHaveLength(32)
})

test('기존 진입점(src/game/avatar.ts)도 같은 v2 결과', async () => {
  const legacy = await import('../avatar')
  expect(legacy.generateAvatar(HAMSTER_YELLOW, 0)).toEqual(generateAvatar(HAMSTER_YELLOW, 0))
})
