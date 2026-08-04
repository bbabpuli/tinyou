import type { CareAction } from './care'

export type HungerLevel = 'full' | 'ok' | 'hungry'

export const FULL_HOURS = 4
export const HUNGRY_HOURS = 8

/** careLog에서 마지막 feed 시각. 밥 기록이 없으면 null. */
export function lastFedAt(actions: CareAction[]): Date | null {
  let max: Date | null = null
  for (const a of actions) {
    if (a.type === 'feed' && (max === null || a.createdAt > max)) max = a.createdAt
  }
  return max
}

/** 마지막 밥 시각에서 파생 계산. 저장하지 않는다 (서버 크론 없음, hungry가 최대 — 벌점 없음). */
export function hungerFrom(lastFed: Date | null, now: Date): HungerLevel {
  if (lastFed === null) return 'hungry'
  const hours = (now.getTime() - lastFed.getTime()) / 3600_000
  if (hours < FULL_HOURS) return 'full'
  if (hours < HUNGRY_HOURS) return 'ok'
  return 'hungry'
}

/** 밥주기 게이트: 배고플 때만 밥 가능 (하루 두 끼 리듬). */
export function canFeedNow(actions: CareAction[], now: Date): boolean {
  return hungerFrom(lastFedAt(actions), now) === 'hungry'
}

/** 배고파질 때까지 남은 시간(올림 정수, 시 단위). UI 안내 문구용. */
export function hoursUntilHungry(lastFed: Date | null, now: Date): number {
  if (lastFed === null) return 0
  const hours = (now.getTime() - lastFed.getTime()) / 3600_000
  return Math.max(0, Math.ceil(HUNGRY_HOURS - hours))
}
