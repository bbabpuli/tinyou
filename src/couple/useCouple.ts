import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CoupleInfo {
  coupleId: string
  myNickname: string
  partner: { userId: string; nickname: string } | null
  /** 초대 코드 — 파트너 대기 화면에서 재열람용. RLS상 소속 방만 읽을 수 있다. */
  inviteCode: string | null
}

export function useCouple(userId: string | undefined) {
  const [couple, setCouple] = useState<CoupleInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const latestUserIdRef = useRef(userId)

  const refresh = useCallback(() => {
    if (!userId) return
    const capturedUserId = userId
    setLoading(true)
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, nickname, couple_id')
        .not('couple_id', 'is', null)

      // Guard against stale responses from prior userId
      if (capturedUserId !== latestUserIdRef.current) return

      // Handle errors: keep previous state, log, and clear loading
      if (error) {
        console.warn('Failed to fetch couple info:', error.message)
        setLoading(false)
        return
      }

      const me = data?.find((p) => p.user_id === userId)
      if (!me?.couple_id) {
        setCouple(null)
        setLoading(false)
        return
      }
      const partner = data?.find((p) => p.user_id !== userId && p.couple_id === me.couple_id)

      // 초대 코드는 파트너 대기 화면에서 다시 보여줘야 하므로 함께 읽어둔다.
      // 실패해도 커플 정보 자체는 유효하므로 null로 두고 진행한다.
      const { data: room, error: roomError } = await supabase
        .from('couples')
        .select('invite_code')
        .eq('id', me.couple_id)
        .maybeSingle()
      if (capturedUserId !== latestUserIdRef.current) return
      if (roomError) console.warn('Failed to fetch invite code:', roomError.message)

      setCouple({
        coupleId: me.couple_id,
        myNickname: me.nickname,
        partner: partner ? { userId: partner.user_id, nickname: partner.nickname } : null,
        inviteCode: room?.invite_code ?? null,
      })
      setLoading(false)
    })()
  }, [userId])

  // Update ref whenever userId changes to guard against stale responses
  useEffect(() => {
    latestUserIdRef.current = userId
  }, [userId])

  useEffect(refresh, [refresh])
  return { couple, loading, refresh }
}
