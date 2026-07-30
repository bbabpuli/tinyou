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

interface StoredCare {
  userId: string
  type: CareType
  createdAt: string // ISO — localStorage 직렬화용
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
    { name: 'tinyou-playground', partialize: (s) => ({ careLog: s.careLog }) },
  ),
)
