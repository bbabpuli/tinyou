import { dateKeySeoul } from './dateKey'

export type CareType = 'feed' | 'pet' | 'goodnight'

export interface CareAction {
  userId: string
  type: CareType
  createdAt: Date
}

export const XP_PER_CARE = 10

export function canCareToday(
  actions: CareAction[],
  userId: string,
  type: CareType,
  now: Date,
): boolean {
  const today = dateKeySeoul(now)
  return !actions.some(
    (a) => a.userId === userId && a.type === type && dateKeySeoul(a.createdAt) === today,
  )
}

export function xpFromActions(actions: CareAction[]): number {
  return actions.length * XP_PER_CARE
}

export function lastCaredAt(actions: CareAction[]): Date | null {
  if (actions.length === 0) return null
  return actions.reduce((max, a) => (a.createdAt > max ? a.createdAt : max), actions[0].createdAt)
}

export const PET_STACK_PER_DAY = 2

/** 오늘(Asia/Seoul) 기록된 내 쓰다듬 수 — XP 스택 판정용 */
export function petStackToday(actions: CareAction[], userId: string, now: Date): number {
  const today = dateKeySeoul(now)
  return actions.filter(
    (a) => a.userId === userId && a.type === 'pet' && dateKeySeoul(a.createdAt) === today,
  ).length
}

/** 쓰다듬 XP 스택이 남았는가. 소진돼도 쓰다듬기 자체는 무한 허용(기록만 안 함). */
export function canPetStackToday(actions: CareAction[], userId: string, now: Date): boolean {
  return petStackToday(actions, userId, now) < PET_STACK_PER_DAY
}
