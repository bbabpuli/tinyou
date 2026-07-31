import { useEffect, useRef, useState } from 'react'
import type { CareAction, CareType } from '../domain/care'
import { supabase } from '../lib/supabase'
import { summarizeTraces, type TraceSummary } from './summarize'

const STORAGE_KEY = 'tinyou-last-trace-check'
const VISIBLE_MS = 5000

interface TraceToastProps {
  /**
   * 상대(파트너)의 캐릭터 id. 흔적은 "상대가 자기 화면에서 자기 분신을 돌본 기록"이므로 내
   * careLog(store)가 아니라 파트너 캐릭터의 care_actions를 직접 조회해야 한다 — 내 careLog엔
   * 파트너 액션이 없다. 아직 파트너 캐릭터가 없으면(단장 전 등) null.
   */
  partnerCharacterId: string | null
  partnerId: string
  partnerNickname: string
}

interface CareActionRow {
  user_id: string
  type: string
  created_at: string
}

/**
 * 파트너 캐릭터의 care_actions를 조회해 파트너가 남긴 돌봄 흔적을 요약해 잠깐 보여주고 사라지는
 * 토스트. RLS는 같은 커플의 care_actions를 전부 select할 수 있게 허용하므로 파트너 캐릭터 id로
 * 직접 조회한다.
 */
export function TraceToast({ partnerCharacterId, partnerId, partnerNickname }: TraceToastProps) {
  const [summary, setSummary] = useState<TraceSummary | null>(null)
  const latestCharacterIdRef = useRef(partnerCharacterId)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Update ref whenever partnerCharacterId changes to guard against stale responses
  useEffect(() => {
    latestCharacterIdRef.current = partnerCharacterId
  }, [partnerCharacterId])

  useEffect(() => {
    if (!partnerCharacterId) return
    const capturedCharacterId = partnerCharacterId
    const since = localStorage.getItem(STORAGE_KEY)

    let query = supabase
      .from('care_actions')
      .select('user_id, type, created_at')
      .eq('character_id', partnerCharacterId)
      .eq('user_id', partnerId)
    if (since) query = query.gt('created_at', since)

    query.then(({ data, error }: { data: CareActionRow[] | null; error: { message: string } | null }) => {
      // Guard against stale responses from a prior partnerCharacterId
      if (capturedCharacterId !== latestCharacterIdRef.current) return
      if (error) {
        console.warn('흔적 조회 실패:', error.message)
        return
      }
      const actions: CareAction[] = (data ?? []).map((r) => ({
        userId: r.user_id,
        type: r.type as CareType,
        createdAt: new Date(r.created_at),
      }))
      const result = summarizeTraces(actions, partnerId, since)
      if (!result) return
      setSummary(result)
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      timerRef.current = setTimeout(() => setSummary(null), VISIBLE_MS)
    })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [partnerCharacterId, partnerId])

  if (!summary) return null

  return (
    <div
      onClick={() => setSummary(null)}
      style={{
        textAlign: 'center',
        background: '#fff3cd',
        border: '2px solid #4a3f35',
        borderRadius: 10,
        padding: '8px 12px',
        fontFamily: 'monospace',
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      {partnerNickname}가 {summary.text}
    </div>
  )
}
