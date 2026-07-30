export type Happiness = 'happy' | 'ok' | 'sad' | 'grimy'

/** 마지막 돌봄 시각에서 파생 계산. 저장하지 않는다 (스펙: 서버 크론 없음, 사망 없음). */
export function happinessFrom(lastCaredAt: Date | null, now: Date): Happiness {
  if (lastCaredAt === null) return 'ok'
  const hours = (now.getTime() - lastCaredAt.getTime()) / 3600_000
  if (hours <= 24) return 'happy'
  if (hours <= 48) return 'ok'
  if (hours <= 96) return 'sad'
  return 'grimy'
}
