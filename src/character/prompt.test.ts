import { expect, test } from 'vitest'
import { buildCharacterPrompt } from '../../supabase/functions/_shared/prompt'

test('답변들을 마침표로 연결하고 픽셀아트 스타일 키워드를 포함', () => {
  const p = buildCharacterPrompt(['밝고 웃음이 많은 사람', '햇살 같은 노란색'])
  expect(p).toContain('밝고 웃음이 많은 사람. 햇살 같은 노란색')
  expect(p).toContain('pixel art')
  expect(p).toContain('cute')
})

test('빈 답변·공백은 걸러냄', () => {
  const p = buildCharacterPrompt(['  ', '고양이 같음', ''])
  expect(p).toContain('고양이 같음')
  expect(p).not.toContain('. .')
})

test('답변이 모두 비어도 기본 프롬프트는 유효', () => {
  const p = buildCharacterPrompt([])
  expect(p).toContain('pixel art')
  expect(p.length).toBeGreaterThan(30)
})
