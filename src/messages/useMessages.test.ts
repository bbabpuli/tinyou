import { expect, test } from 'vitest'
import { pickNextUnread, type Message } from './useMessages'

const msg = (id: string, at: string, read: boolean): Message => ({
  id, senderUserId: 'p', body: 'hi', createdAt: new Date(at), readAt: read ? new Date() : null,
})

test('미읽음 중 가장 오래된 것부터', () => {
  const list = [msg('b', '2026-07-31T10:00:00Z', false), msg('a', '2026-07-31T09:00:00Z', false)]
  expect(pickNextUnread(list)?.id).toBe('a')
})

test('미읽음 없으면 null', () => {
  expect(pickNextUnread([msg('a', '2026-07-31T09:00:00Z', true)])).toBeNull()
  expect(pickNextUnread([])).toBeNull()
})

test('excludeIds에 든 쪽지는 건너뛰고 다음으로 오래된 것을 고른다 (말풍선 회전)', () => {
  const list = [
    msg('a', '2026-07-31T09:00:00Z', false),
    msg('b', '2026-07-31T10:00:00Z', false),
    msg('c', '2026-07-31T11:00:00Z', false),
  ]
  expect(pickNextUnread(list, new Set(['a']))?.id).toBe('b')
  expect(pickNextUnread(list, new Set(['a', 'b']))?.id).toBe('c')
})

test('전부 exclude면 null (마지막 쪽지는 클릭까지 유지되는 근거)', () => {
  const list = [msg('a', '2026-07-31T09:00:00Z', false)]
  expect(pickNextUnread(list, new Set(['a']))).toBeNull()
})

test('excludeIds는 서버 read_at 반영이 늦어도 로컬에서 재표시를 막는다', () => {
  // 서버 refresh 지연으로 이미 보여준 'a'가 아직 미읽음으로 남아있는 상황
  const stale = [msg('a', '2026-07-31T09:00:00Z', false), msg('b', '2026-07-31T10:00:00Z', false)]
  expect(pickNextUnread(stale, new Set(['a']))?.id).toBe('b')
})
