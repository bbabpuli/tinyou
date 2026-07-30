import { beforeEach, expect, test } from 'vitest'
import { selectActions, selectXp, useGame } from './store'

const NOW = new Date('2026-07-30T03:00:00Z')

beforeEach(() => {
  useGame.setState({ careLog: [], pending: [] })
})

test('care 성공: 로그 추가 + pending 등록 + XP 반영', () => {
  expect(useGame.getState().care('feed', NOW)).toBe(true)
  const s = useGame.getState()
  expect(s.careLog).toHaveLength(1)
  expect(s.pending).toEqual(['feed'])
  expect(selectXp(s)).toBe(10)
})

test('같은 날 같은 종류 재시도는 거부', () => {
  useGame.getState().care('feed', NOW)
  expect(useGame.getState().care('feed', NOW)).toBe(false)
  expect(useGame.getState().careLog).toHaveLength(1)
})

test('다른 종류는 같은 날에도 허용', () => {
  useGame.getState().care('feed', NOW)
  expect(useGame.getState().care('pet', NOW)).toBe(true)
  expect(selectXp(useGame.getState())).toBe(20)
})

test('consumePending은 FIFO로 하나씩 소비', () => {
  useGame.getState().care('feed', NOW)
  useGame.getState().care('pet', NOW)
  expect(useGame.getState().consumePending()).toBe('feed')
  expect(useGame.getState().consumePending()).toBe('pet')
  expect(useGame.getState().consumePending()).toBeUndefined()
})

test('selectActions는 Date로 역직렬화', () => {
  useGame.getState().care('feed', NOW)
  const actions = selectActions(useGame.getState())
  expect(actions[0].createdAt).toEqual(NOW)
  expect(actions[0].userId).toBe('me')
})
