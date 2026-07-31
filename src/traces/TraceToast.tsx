import { useEffect, useState } from 'react'
import type { CareAction } from '../domain/care'
import { summarizeTraces, type TraceSummary } from './summarize'

const STORAGE_KEY = 'tinyou-last-trace-check'
const VISIBLE_MS = 5000

interface TraceToastProps {
  careLog: CareAction[]
  partnerId: string | null
  partnerNickname: string
}

/**
 * 파트너가 다녀간 흔적(밥 주기·쓰다듬기·굿나잇)을 요약해 잠깐 보여주고 사라지는 토스트.
 * careLog가 갱신될 때마다(내 액션·파트너 실시간 알림 모두 포함) `tinyou-last-trace-check` 이후의
 * 파트너 흔적을 다시 집계한다 — 이미 알린 흔적은 checkpoint가 앞으로 이동했으므로 재노출되지 않고,
 * 그 사이 파트너가 새로 남긴 흔적만 새 토스트로 뜬다.
 */
export function TraceToast({ careLog, partnerId, partnerNickname }: TraceToastProps) {
  const [summary, setSummary] = useState<TraceSummary | null>(null)

  useEffect(() => {
    if (!partnerId) return
    const since = localStorage.getItem(STORAGE_KEY)
    const result = summarizeTraces(careLog, partnerId, since)
    if (!result) return
    setSummary(result)
    localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    const timer = setTimeout(() => setSummary(null), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [careLog, partnerId])

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
