import { expect, test } from 'vitest'
import { matchPalette, matchSpecies } from './matching'

test('동물 유의어 매칭', () => {
  expect(matchSpecies(['밝은 사람', '볼이 빵빵한 햄스터 같아'])).toBe('hamster')
  expect(matchSpecies(['햄찌 그 자체'])).toBe('hamster')
  expect(matchSpecies(['멍멍이 같은 사람', ''])).toBe('dog')
  expect(matchSpecies(['리트리버상'])).toBe('dog')
  expect(matchSpecies(['고냥이'])).toBe('cat')
  expect(matchSpecies(['우파루파 닮음'])).toBe('axolotl')
  expect(matchSpecies(['백곰같이 듬직'])).toBe('bear')
})

test('매칭 실패 시 null', () => {
  expect(matchSpecies(['공룡 같아'])).toBeNull()
  expect(matchSpecies([])).toBeNull()
})

test('색 사전 매칭', () => {
  expect(matchPalette(['햇살 같은 노란색'])).toBe('lemon')
  expect(matchPalette(['핑크핑크한 사람'])).toBe('pink')
  expect(matchPalette(['민트초코를 좋아함'])).toBe('mint')
  expect(matchPalette(['하늘 같은 파란 느낌'])).toBe('sky')
  expect(matchPalette(['보라보라'])).toBe('lavender')
  expect(matchPalette(['따뜻한 주황 복숭아'])).toBe('peach')
  expect(matchPalette(['어떤 색인지 모르겠음'])).toBeNull()
})

test('여러 후보면 먼저 등장한 답변 우선', () => {
  expect(matchSpecies(['토끼 같기도 하고', '고양이 같기도'])).toBe('rabbit')
})

test('개구리 vs 개 최장 매칭', () => {
  expect(matchSpecies(['개구리 닮음'])).toBe('frog')
})

test('한 답변 내 동률은 등장 위치 우선', () => {
  expect(matchSpecies(['강아지 반 고양이 반'])).toBe('dog')
  expect(matchSpecies(['고양이 반 강아지 반'])).toBe('cat')
})
