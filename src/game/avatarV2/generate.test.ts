import { describe, expect, it, test } from 'vitest'
import { generateAvatar } from './generate'
import { PALETTES } from './palettes'

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

describe('generateAvatar mapping override', () => {
  // 사전에 안 걸리는 문장 — 기존 로직으로는 해시 폴백이 되는 입력
  const answers = ['겨울잠 잘 것 같고 안기면 포근한 사람', '', '', '']

  it('mapping이 있으면 종·팔레트를 override한다', () => {
    const withMapping = generateAvatar(answers, 0, { species: 'bear', palette: 'taupe' })
    // taupe 본체색이 실제 팔레트에 등장해야 한다
    expect(Object.values(withMapping.palette)).toContain(PALETTES.taupe.B)
  })

  it('mapping override는 salt가 바뀌어도 유지된다 (다시 뽑기 안정성)', () => {
    const a = generateAvatar(answers, 0, { species: 'bear', palette: 'taupe' })
    const b = generateAvatar(answers, 7, { species: 'bear', palette: 'taupe' })
    // 팔레트(색 집합)는 동일, 변형(map)은 달라질 수 있다
    expect(Object.values(a.palette)).toEqual(Object.values(b.palette))
  })

  it('잘못된 mapping 값은 필드 단위로 무시하고 기존 로직으로 폴백한다', () => {
    const invalid = generateAvatar(answers, 0, { species: 'dragon', palette: 'gold' })
    const fallback = generateAvatar(answers, 0)
    expect(invalid.map).toEqual(fallback.map)
    expect(invalid.palette).toEqual(fallback.palette)
  })

  it('mapping이 null/undefined면 기존과 완전히 동일하다', () => {
    const a = generateAvatar(answers, 3)
    const b = generateAvatar(answers, 3, null)
    expect(a.map).toEqual(b.map)
    expect(a.palette).toEqual(b.palette)
  })

  it('같은 입력이면 항상 같은 결과 (결정성)', () => {
    const a = generateAvatar(answers, 2, { species: 'seal', palette: 'sky' })
    const b = generateAvatar(answers, 2, { species: 'seal', palette: 'sky' })
    expect(a.map).toEqual(b.map)
    expect(a.palette).toEqual(b.palette)
  })
})
