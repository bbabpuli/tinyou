import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * 쓰다듬 실시간 알림 전용 broadcast 채널.
 *
 * useCoupleChannel과 달리 커플 공용 토픽(`couple:<id>:pets`)을 쓴다 — broadcast는
 * 같은 토픽 구독자에게만 전달되므로, useCoupleChannel의 유저별 유니크 토픽으로는
 * 상대에게 닿지 않는다. postgres_changes를 전혀 붙이지 않는 broadcast 전용 채널이라
 * 공유 토픽 postgres_changes 유실 버그(realtime#1524)와도 무관하다.
 *
 * self: false(기본값이지만 명시)로 내가 보낸 이벤트는 수신하지 않고, 만약을 위해
 * payload.userId로도 한 번 더 거른다. 전송은 best-effort — 채널이 죽어 있으면
 * 조용히 버려지고, 기록된 스택 쓰다듬은 다음 접속 때 TraceToast 요약이 보정한다.
 */
export function usePetChannel(
  coupleId: string | undefined,
  userId: string | undefined,
  onPet: () => void,
): { sendPet: () => void } {
  const onPetRef = useRef(onPet)
  useEffect(() => {
    onPetRef.current = onPet
  })
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  })

  useEffect(() => {
    if (!coupleId || !userId) return
    const channel = supabase
      .channel(`couple:${coupleId}:pets`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'pet' }, (msg) => {
        if ((msg.payload as { userId?: string } | undefined)?.userId !== userId) {
          onPetRef.current()
        }
      })
      .subscribe((status, err) => {
        if (status !== 'SUBSCRIBED') console.warn('[realtime:pets]', status, err)
      })
    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [coupleId, userId])

  const sendPet = () => {
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'pet',
      payload: { userId: userIdRef.current },
    })
  }
  return { sendPet }
}
