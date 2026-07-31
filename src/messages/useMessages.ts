import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Message {
  id: string
  senderUserId: string
  body: string
  createdAt: Date
  readAt: Date | null
}

interface MessageRow {
  id: string
  sender_user_id: string
  body: string
  created_at: string
  read_at: string | null
}

function toMessage(r: MessageRow): Message {
  return {
    id: r.id,
    senderUserId: r.sender_user_id,
    body: r.body,
    createdAt: new Date(r.created_at),
    readAt: r.read_at ? new Date(r.read_at) : null,
  }
}

/**
 * 미읽음(readAt null) 중 가장 오래된 것을 고른다 — Stage 배달 오케스트레이션이 다음에 배달할 쪽지를 정할 때 쓰는 순수 함수.
 * excludeIds: 말풍선 회전에서 이미 보여준 쪽지 — markRead의 서버 refresh가 늦어도 재표시를 막는 로컬 가드.
 */
export function pickNextUnread(
  messages: Message[],
  excludeIds?: ReadonlySet<string>,
): Message | null {
  const unread = messages.filter((m) => m.readAt === null && !excludeIds?.has(m.id))
  if (unread.length === 0) return null
  return unread.reduce((oldest, m) => (m.createdAt < oldest.createdAt ? m : oldest))
}

export function useMessages(coupleId: string | undefined, userId: string | undefined) {
  // inbox = 내가 받은 쪽지 최근 30개(읽음 포함, 최신순). unread는 그중 미읽음만 오래된 것부터.
  const [inbox, setInbox] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const latestKeyRef = useRef(`${coupleId}:${userId}`)

  const refresh = useCallback(() => {
    if (!coupleId || !userId) {
      setLoading(false)
      return
    }
    const capturedKey = `${coupleId}:${userId}`
    setLoading(true)
    supabase
      .from('messages')
      .select('id, sender_user_id, body, created_at, read_at')
      .eq('couple_id', coupleId)
      .neq('sender_user_id', userId) // 받은 것만 — 보낸 쪽지는 markRead 대상이 아니다(RLS도 수신자만 update 허용)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        // Guard against stale responses from prior coupleId/userId
        if (capturedKey !== latestKeyRef.current) return

        if (error) {
          console.warn('Failed to fetch messages:', error.message)
          setLoading(false)
          return
        }
        setInbox((data ?? []).map(toMessage))
        setLoading(false)
      })
  }, [coupleId, userId])

  // Update ref whenever coupleId/userId changes to guard against stale responses
  useEffect(() => {
    latestKeyRef.current = `${coupleId}:${userId}`
  }, [coupleId, userId])

  useEffect(refresh, [refresh])

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      if (!coupleId || !userId) return false
      const { error } = await supabase
        .from('messages')
        .insert({ couple_id: coupleId, sender_user_id: userId, body })
      if (error) {
        console.warn('Failed to send message:', error.message)
        return false
      }
      refresh() // 낙관적 갱신 없이 서버 상태를 다시 읽는다
      return true
    },
    [coupleId, userId, refresh],
  )

  const markRead = useCallback(
    async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        console.warn('Failed to mark message read:', error.message)
        return
      }
      refresh()
    },
    [refresh],
  )

  const unread = inbox
    .filter((m) => m.readAt === null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  return { unread, inbox, send, markRead, refresh, loading }
}
