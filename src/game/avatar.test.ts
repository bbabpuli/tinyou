import { expect, test } from 'vitest'
import { generateAvatar, hashSeed } from './avatar'

const ANSWERS = ['밝고 웃음이 많은 사람', '햄스터 같음', '노란색', '눈 비비는 모습']

test('hashSeed는 결정적이고 입력이 다르면 대체로 다름', () => {
  expect(hashSeed('abc')).toBe(hashSeed('abc'))
  expect(hashSeed('abc')).not.toBe(hashSeed('abd'))
})

test('같은 답변·salt는 같은 아바타 (결정적)', () => {
  const a = generateAvatar(ANSWERS, 0)
  const b = generateAvatar(ANSWERS, 0)
  expect(a).toEqual(b)
})

test('salt를 바꾸면 0..7 중 서로 다른 아바타가 2종 이상', () => {
  const variants = new Set(
    Array.from({ length: 8 }, (_, s) => JSON.stringify(generateAvatar(ANSWERS, s))),
  )
  expect(variants.size).toBeGreaterThanOrEqual(2)
})

test('맵은 16×16이고 모든 문자는 팔레트 키 또는 점', () => {
  const { map, palette } = generateAvatar(ANSWERS, 3)
  expect(map).toHaveLength(16)
  for (const row of map) {
    expect(row).toHaveLength(16)
    for (const ch of row) {
      if (ch !== '.') expect(palette[ch]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  }
})

test('빈 답변도 유효한 아바타 생성', () => {
  const { map } = generateAvatar([], 0)
  expect(map.join('').replace(/\./g, '').length).toBeGreaterThan(20)
})
