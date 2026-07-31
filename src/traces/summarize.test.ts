import { expect, test } from 'vitest'
import { summarizeTraces } from './summarize'
import type { CareAction } from '../domain/care'

const act = (type: CareAction['type'], at: string, who = 'partner'): CareAction => ({
  userId: who, type, createdAt: new Date(at),
})

test('since 이후 상대 액션만 집계', () => {
  const r = summarizeTraces(
    [act('feed', '2026-07-31T10:00:00Z'), act('pet', '2026-07-31T01:00:00Z'), act('feed', '2026-07-31T10:30:00Z', 'me')],
    'partner', '2026-07-31T05:00:00Z',
  )
  expect(r?.count).toBe(1)
})

test('goodnight 포함 시 문구 우선', () => {
  const r = summarizeTraces([act('goodnight', '2026-07-31T14:00:00Z')], 'partner', null)
  expect(r?.text).toContain('잘 자라고')
})

test('흔적 없으면 null', () => {
  expect(summarizeTraces([], 'partner', null)).toBeNull()
})
