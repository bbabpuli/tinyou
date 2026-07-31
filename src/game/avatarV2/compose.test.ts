import { expect, test } from 'vitest'
import { composeAvatar } from './compose'
import { SPECIES } from './species'

const hamster = SPECIES.hamster

test('결과는 32×32, 모든 문자가 팔레트 키 또는 점', () => {
  const { map, palette } = composeAvatar(hamster, 'lemon', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  expect(map).toHaveLength(32)
  for (const row of map) {
    expect(row).toHaveLength(32)
    for (const ch of row) if (ch !== '.') expect(palette[ch]).toMatch(/^#[0-9a-f]{6}$/i)
  }
})

test('팔레트 스왑: 같은 종·변형에 팔레트만 다르면 B 색만 다름', () => {
  const a = composeAvatar(hamster, 'pink', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  const b = composeAvatar(hamster, 'sky', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  expect(a.map).toEqual(b.map)
  expect(a.palette.B).not.toBe(b.palette.B)
})

test('표정 변형: eyes 인덱스가 다르면 맵이 달라짐', () => {
  const a = composeAvatar(hamster, 'pink', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  const b = composeAvatar(hamster, 'pink', { eyes: 1, mouth: 0, cheeks: 0, accessory: 0 })
  expect(a.map).not.toEqual(b.map)
})

test('변형 인덱스는 스타일 수로 모듈러 (범위 밖 안전)', () => {
  expect(() =>
    composeAvatar(hamster, 'pink', { eyes: 99, mouth: 99, cheeks: 99, accessory: 99 }),
  ).not.toThrow()
})
