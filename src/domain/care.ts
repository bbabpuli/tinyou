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
