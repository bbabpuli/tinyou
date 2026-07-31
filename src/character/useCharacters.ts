import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CharacterRow {
  id: string
  ownerUserId: string
  name: string | null
  imageUrl: string | null
  regenCount: number
}

function toRow(r: {
  id: string; owner_user_id: string; name: string | null
  image_path: string | null; regen_count: number
}): CharacterRow {
  return {
    id: r.id,
    ownerUserId: r.owner_user_id,
    name: r.name,
    imageUrl: r.image_path
      ? supabase.storage.from('characters').getPublicUrl(r.image_path).data.publicUrl
      : null,
    regenCount: r.regen_count,
  }
}

export function useCharacters(coupleId: string | undefined, myUserId: string | undefined) {
  const [mine, setMine] = useState<CharacterRow | null>(null)
  const [partners, setPartners] = useState<CharacterRow | null>(null)
  const [loading, setLoading] = useState(true)
  const latestKeyRef = useRef(`${coupleId}:${myUserId}`)

  // Promise를 반환해 호출자가 리페치 완료를 기다릴 수 있다 (단장 완료 → 배너 조건 재평가 순서 보장)
  const refresh = useCallback(async (): Promise<void> => {
    if (!coupleId || !myUserId) {
      setLoading(false)
      return
    }
    const capturedKey = `${coupleId}:${myUserId}`
    setLoading(true)
    const { data, error } = await supabase
      .from('characters')
      .select('id, owner_user_id, name, image_path, regen_count')
      .eq('couple_id', coupleId)

    // Guard against stale responses from prior coupleId/myUserId
    if (capturedKey !== latestKeyRef.current) {
      return
    }

    // Handle errors: keep previous state, log, and clear loading
    if (error) {
      console.warn('Failed to fetch characters:', error.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []).map(toRow)
    setMine(rows.find((r) => r.ownerUserId === myUserId) ?? null)
    setPartners(rows.find((r) => r.ownerUserId !== myUserId) ?? null)
    setLoading(false)
  }, [coupleId, myUserId])

  // Update ref whenever coupleId or myUserId changes to guard against stale responses
  useEffect(() => {
    latestKeyRef.current = `${coupleId}:${myUserId}`
  }, [coupleId, myUserId])

  useEffect(() => {
    void refresh() // refresh가 Promise를 반환하므로 effect cleanup으로 오인되지 않게 감싼다
  }, [refresh])
  return { mine, partners, loading, refresh }
}
