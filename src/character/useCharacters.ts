import { useCallback, useEffect, useState } from 'react'
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

  const refresh = useCallback(() => {
    if (!coupleId || !myUserId) return
    setLoading(true)
    supabase
      .from('characters')
      .select('id, owner_user_id, name, image_path, regen_count')
      .eq('couple_id', coupleId)
      .then(({ data }) => {
        const rows = (data ?? []).map(toRow)
        setMine(rows.find((r) => r.ownerUserId === myUserId) ?? null)
        setPartners(rows.find((r) => r.ownerUserId !== myUserId) ?? null)
        setLoading(false)
      })
  }, [coupleId, myUserId])

  useEffect(refresh, [refresh])
  return { mine, partners, loading, refresh }
}
