import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  canCareToday,
  lastCaredAt,
  xpFromActions,
  type CareAction,
  type CareType,
} from '../domain/care'
import type { CareInput } from '../game/fsm'

export const PLAYER_ID = 'me' // Plan 2에서 Supabase auth uid로 교체

export interface StoredCare {
  userId: string
  type: CareType
  createdAt: string // ISO — localStorage 직렬화용
}

/**
 * localStorage에서 읽어온 careLog를 방어적으로 정리한다.
 * 손상된 값(잘못된 날짜 등)이 그대로 들어오면 selectActions → dateKeySeoul에서 RangeError가 나
 * 렌더 중 앱 전체가 흰 화면이 되고, 값이 계속 남아 복구도 안 된다.
 */
export function sanitizeCareLog(raw: unknown): StoredCare[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((e): e is StoredCare => {
    if (typeof e !== 'object' || e === null) return false
    const c = e as Record<string, unknown>
    return (
      typeof c.userId === 'string' &&
      (c.type === 'feed' || c.type === 'pet') &&
      typeof c.createdAt === 'string' &&
      !Number.isNaN(Date.parse(c.createdAt))
    )
  })
}

interface GameStore {
  careLog: StoredCare[]
  pending: CareInput[]
  care(type: CareType, now?: Date): boolean
  consumePending(): CareInput | undefined
}

export function selectActions(s: Pick<GameStore, 'careLog'>): CareAction[] {
  return s.careLog.map((c) => ({ ...c, createdAt: new Date(c.createdAt) }))
}

export function selectXp(s: Pick<GameStore, 'careLog'>): number {
  return xpFromActions(selectActions(s))
}

export function selectLastCaredAt(s: Pick<GameStore, 'careLog'>): Date | null {
  return lastCaredAt(selectActions(s))
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      careLog: [],
      pending: [],
      care(type, now = new Date()) {
        if (!canCareToday(selectActions(get()), PLAYER_ID, type, now)) return false
        set((s) => ({
          careLog: [...s.careLog, { userId: PLAYER_ID, type, createdAt: now.toISOString() }],
          pending: [...s.pending, type],
        }))
        return true
      },
      consumePending() {
        const [head, ...rest] = get().pending
        if (head !== undefined) set({ pending: rest })
        return head
      },
    }),
    {
      name: 'tinyou-playground',
      version: 1,
      partialize: (s) => ({ careLog: s.careLog }),
      // 구버전(version 없음) 저장값은 신뢰할 수 없으므로 반드시 통과 검사한다
      migrate: (persisted) => ({
        careLog: sanitizeCareLog((persisted as { careLog?: unknown } | null)?.careLog),
      }),
    },
  ),
)
