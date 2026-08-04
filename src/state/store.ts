import { create } from 'zustand'
import { canCareToday, canPetStackToday, lastCaredAt, xpFromActions, type CareAction, type CareType } from '../domain/care'
import { canFeedNow } from '../domain/hunger'
import { isPetSpam, PET_BAN_MS, pushPetTap } from '../domain/petSpam'
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
  /** 쓰담 스팸 가드 — 최근 10초 창의 탭 시각들 */
  petTaps: number[]
  /** 이 시각(ms)까지 쓰다듬기 금지. null이면 금지 아님 */
  petBanUntil: number | null
  /** 마지막으로 화낸 시각(ms) — Stage가 화남 말풍선을 띄우는 신호 */
  petAngryAt: number | null
  /** 테스트 주입 지점 — 기본 구현은 supabase insert */
  insertCare: (p: { characterId: string; userId: string; type: CareType }) => Promise<InsertCareResult>
  loadCare(characterId: string, userId: string): Promise<void>
  care(type: CareType, now?: Date): Promise<boolean>
  consumePending(): CareInput | undefined
  reset(): void
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
  petTaps: [],
  petBanUntil: null,
  petAngryAt: null,
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
    // goodnight은 FSM 액션 애니메이션(eat/petted)이 없다 — 취침 장면 재판정으로 반영되므로 큐에 넣지 않는다.
    const isCareInput = (t: CareType): t is CareInput => t === 'feed' || t === 'pet'

    // 게이트: 밥=배고플 때만(두 끼 리듬), 굿나잇=하루 1회, 쓰다듬=스팸 가드만 통과하면 항상
    if (type === 'feed' && !canFeedNow(careLog, now)) return false
    if (type === 'goodnight' && !canCareToday(careLog, userId, type, now)) return false
    if (type === 'pet') {
      // 스팸 가드: 10초 내 10회째부터 화내고 30초 금지 (XP·애니메이션·브로드캐스트 전부 없음)
      const nowMs = now.getTime()
      const { petTaps, petBanUntil } = get()
      if (petBanUntil !== null && nowMs < petBanUntil) {
        set({ petAngryAt: nowMs })
        return false
      }
      const taps = pushPetTap(petTaps, nowMs)
      if (isPetSpam(taps)) {
        set({ petTaps: [], petBanUntil: nowMs + PET_BAN_MS, petAngryAt: nowMs })
        return false
      }
      set({ petTaps: taps, petBanUntil: null })
      if (!canPetStackToday(careLog, userId, now)) {
        // 스택 소진 — 무한 쓰다듬기: 기록·XP 없이 로컬 애니메이션만 재생
        set((s) => ({ pending: [...s.pending, 'pet' as CareInput] }))
        return true
      }
    }

    const action: CareAction = { userId, type, createdAt: now }
    set((s) => ({
      careLog: [...s.careLog, action],
      pending: isCareInput(type) ? [...s.pending, type] : s.pending,
    }))
    const result = await insertCare({ characterId, userId, type })
    if (!result.ok) {
      set((s) => ({
        careLog: s.careLog.filter((a) => a !== action),
        pending: isCareInput(type)
          ? s.pending.filter((p, i) => !(p === type && i === s.pending.lastIndexOf(type)))
          : s.pending,
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
  reset() {
    set({
      userId: null,
      characterId: null,
      careLog: [],
      pending: [],
      petTaps: [],
      petBanUntil: null,
      petAngryAt: null,
    })
  },
}))
