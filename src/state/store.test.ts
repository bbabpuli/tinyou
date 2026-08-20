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

test('reset은 모든 필드를 초기값으로 되돌린다', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  await useGame.getState().care('feed', NOW)
  await useGame.getState().care('pet', NOW)
  useGame.getState().reset()
  expect(useGame.getState().userId).toBe(null)
  expect(useGame.getState().characterId).toBe(null)
  expect(useGame.getState().careLog).toEqual([])
  expect(useGame.getState().pending).toEqual([])
})

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000)

test('feed: 배부르면(마지막 밥 4h 미만) insert 없이 거부', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({
    insertCare: insert,
    careLog: [{ userId: 'me', type: 'feed', createdAt: hoursAgo(2) }],
  })
  expect(await useGame.getState().care('feed', NOW)).toBe(false)
  expect(insert).not.toHaveBeenCalled()
})

test('feed: 8시간 지나 배고프면 같은 날에도 다시 가능', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({
    insertCare: insert,
    careLog: [{ userId: 'me', type: 'feed', createdAt: hoursAgo(9) }],
  })
  expect(await useGame.getState().care('feed', NOW)).toBe(true)
  expect(insert).toHaveBeenCalledTimes(1)
})

test('pet: 하루 2회까지 기록, 3회째는 insert 없이 애니메이션(pending)만', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  expect(await useGame.getState().care('pet', NOW)).toBe(true)
  expect(await useGame.getState().care('pet', NOW)).toBe(true)
  expect(insert).toHaveBeenCalledTimes(2)
  expect(useGame.getState().careLog).toHaveLength(2)

  expect(await useGame.getState().care('pet', NOW)).toBe(true) // 3회째도 성공으로 응답
  expect(insert).toHaveBeenCalledTimes(2)                      // 하지만 insert 없음
  expect(useGame.getState().careLog).toHaveLength(2)           // 기록도 없음 (XP 안 오름)
  expect(useGame.getState().pending).toEqual(['pet', 'pet', 'pet']) // 애니메이션은 3번 다
})
