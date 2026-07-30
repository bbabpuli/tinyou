import { beforeEach, expect, test, vi } from 'vitest'
import { useGame } from './store'

const NOW = new Date('2026-07-30T03:00:00Z')

beforeEach(() => {
  useGame.setState({ careLog: [], pending: [], characterId: 'char-1', userId: 'me' })
})

test('care 성공: insert 함수 호출 + 낙관적 반영 + pending', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  expect(await useGame.getState().care('feed', NOW)).toBe(true)
  expect(insert).toHaveBeenCalledWith({ characterId: 'char-1', userId: 'me', type: 'feed' })
  expect(useGame.getState().careLog).toHaveLength(1)
  expect(useGame.getState().pending).toEqual(['feed'])
})

test('오늘 이미 한 종류는 insert 없이 거부', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  await useGame.getState().care('feed', NOW)
  expect(await useGame.getState().care('feed', NOW)).toBe(false)
  expect(insert).toHaveBeenCalledTimes(1)
})

test('DB 유니크 위반(다른 기기에서 이미 돌봄)이면 false + 롤백', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: false, duplicate: true })
  useGame.setState({ insertCare: insert })
  expect(await useGame.getState().care('feed', NOW)).toBe(false)
  expect(useGame.getState().careLog).toHaveLength(0)
  expect(useGame.getState().pending).toEqual([])
})

test('consumePending은 FIFO로 하나씩 소비', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  await useGame.getState().care('feed', NOW)
  await useGame.getState().care('pet', NOW)
  expect(useGame.getState().consumePending()).toBe('feed')
  expect(useGame.getState().consumePending()).toBe('pet')
  expect(useGame.getState().consumePending()).toBeUndefined()
})
