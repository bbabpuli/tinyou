import { create } from 'zustand'
import { canCareToday, lastCaredAt, xpFromActions, type CareAction, type CareType } from '../domain/care'
import type { CareInput } from '../game/fsm'
import { supabase } from '../lib/supabase'

export interface InsertCareResult {
  ok: boolean
  duplicate?: boolean
}

interface GameStore {
  userId: string | null
  characterId: string | null
  careLog: CareAction[]
  pending: CareInput[]
  /** 테스트 주입 지점 — 기본 구현은 supabase insert */
  insertCare: (p: { characterId: string; userId: string; type: CareType }) => Promise<InsertCareResult>
  loadCare(characterId: string, userId: string): Promise<void>
  care(type: CareType, now?: Date): Promise<boolean>
  consumePending(): CareInput | undefined
}

async function supabaseInsertCare(p: {
  characterId: string
  userId: string
  type: CareType
}): Promise<InsertCareResult> {
  const { error } = await supabase
    .from('care_actions')
    .insert({ character_id: p.characterId, user_id: p.userId, type: p.type })
  if (!error) return { ok: true }
  return { ok: false, duplicate: error.code === '23505' }
}

export const selectXp = (s: Pick<GameStore, 'careLog'>) => xpFromActions(s.careLog)
export const selectLastCaredAt = (s: Pick<GameStore, 'careLog'>) => lastCaredAt(s.careLog)

export const useGame = create<GameStore>()((set, get) => ({
  userId: null,
  characterId: null,
  careLog: [],
  pending: [],
  insertCare: supabaseInsertCare,
  async loadCare(characterId, userId) {
    const { data, error } = await supabase
      .from('care_actions')
      .select('user_id, type, created_at')
      .eq('character_id', characterId)
    if (error) {
      console.warn('loadCare failed', error.message)
      return
    }
    set({
      characterId,
      userId,
      careLog: (data ?? []).map((r) => ({
        userId: r.user_id,
        type: r.type as CareType,
        createdAt: new Date(r.created_at),
      })),
    })
  },
  async care(type, now = new Date()) {
    const { careLog, characterId, userId, insertCare } = get()
    if (!characterId || !userId) return false
    if (!canCareToday(careLog, userId, type, now)) return false
    const action: CareAction = { userId, type, createdAt: now }
    set((s) => ({ careLog: [...s.careLog, action], pending: [...s.pending, type] }))
    const result = await insertCare({ characterId, userId, type })
    if (!result.ok) {
      set((s) => ({
        careLog: s.careLog.filter((a) => a !== action),
        pending: s.pending.filter((p, i) => !(p === type && i === s.pending.lastIndexOf(type))),
      }))
      return false
    }
    return true
  },
  consumePending() {
    const [head, ...rest] = get().pending
    if (head !== undefined) set({ pending: rest })
    return head
  },
}))
