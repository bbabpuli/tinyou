import type { CareAction } from '../domain/care'

export interface TraceSummary {
  count: number
  text: string
}

/**
 * partnerId가 sinceIso 이후 남긴 돌봄 흔적을 집계한다. sinceIso가 null이면 전체 기록을 본다.
 * 흔적이 없으면 null(토스트를 띄우지 않음). goodnight이 하나라도 섞여 있으면 그 문구가
 * 최우선이고, 그 외엔 1건/여러 건에 따라 문구가 갈린다.
 */
export function summarizeTraces(
  actions: CareAction[],
  partnerId: string,
  sinceIso: string | null,
): TraceSummary | null {
  const since = sinceIso ? new Date(sinceIso) : null
  const traces = actions.filter(
    (a) => a.userId === partnerId && (!since || a.createdAt > since),
  )
  if (traces.length === 0) return null

  const hasGoodnight = traces.some((a) => a.type === 'goodnight')
  const text = hasGoodnight
    ? '잘 자라고 인사하고 갔어 🌙'
    : traces.length === 1
      ? '다녀갔어 🍙'
      : `${traces.length}번 다녀갔어`

  return { count: traces.length, text }
}
