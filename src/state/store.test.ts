import { beforeEach, expect, test } from 'vitest'
import { sanitizeCareLog, selectActions, selectXp, useGame } from './store'

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

const VALID = { userId: 'me', type: 'feed', createdAt: NOW.toISOString() }

test('sanitizeCareLog: 정상 항목은 그대로 통과', () => {
  const pet = { userId: 'you', type: 'pet', createdAt: NOW.toISOString() }
  expect(sanitizeCareLog([VALID, pet])).toEqual([VALID, pet])
})

test('sanitizeCareLog: 배열이 아니면 빈 배열', () => {
  expect(sanitizeCareLog('쓰레기 문자열')).toEqual([])
  expect(sanitizeCareLog(undefined)).toEqual([])
  expect(sanitizeCareLog(null)).toEqual([])
  expect(sanitizeCareLog({ careLog: [] })).toEqual([])
})

test('sanitizeCareLog: 파싱 불가 날짜 항목 제거 (흰 화면 유발 케이스)', () => {
  expect(sanitizeCareLog([{ ...VALID, createdAt: 'not-a-date' }, VALID])).toEqual([VALID])
  expect(sanitizeCareLog([{ ...VALID, createdAt: 12345 }])).toEqual([])
})

test('sanitizeCareLog: 알 수 없는 type·userId 항목 제거', () => {
  expect(sanitizeCareLog([{ ...VALID, type: 'hug' }])).toEqual([])
  expect(sanitizeCareLog([{ ...VALID, userId: 42 }])).toEqual([])
})

test('sanitizeCareLog: 객체가 아닌 원소 제거', () => {
  expect(sanitizeCareLog([null, 'x', 7, VALID])).toEqual([VALID])
})

test('정리된 로그는 selectActions에서 안전하게 Date로 변환', () => {
  const cleaned = sanitizeCareLog([{ ...VALID, createdAt: 'boom' }, VALID])
  const actions = selectActions({ careLog: cleaned })
  expect(actions.every((a) => !Number.isNaN(a.createdAt.getTime()))).toBe(true)
})
