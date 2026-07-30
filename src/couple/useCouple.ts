import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CoupleInfo {
  coupleId: string
  myNickname: string
  partner: { userId: string; nickname: string } | null
}

export function useCouple(userId: string | undefined) {
  const [couple, setCouple] = useState<CoupleInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!userId) return
    setLoading(true)
    supabase
      .from('profiles')
      .select('user_id, nickname, couple_id')
      .not('couple_id', 'is', null)
      .then(({ data }) => {
        const me = data?.find((p) => p.user_id === userId)
        if (!me?.couple_id) {
          setCouple(null)
        } else {
          const partner = data?.find((p) => p.user_id !== userId && p.couple_id === me.couple_id)
          setCouple({
            coupleId: me.couple_id,
            myNickname: me.nickname,
            partner: partner ? { userId: partner.user_id, nickname: partner.nickname } : null,
          })
        }
        setLoading(false)
      })
  }, [userId])

  useEffect(refresh, [refresh])
  return { couple, loading, refresh }
}
