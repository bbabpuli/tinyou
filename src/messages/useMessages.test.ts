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
