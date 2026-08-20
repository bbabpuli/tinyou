/** 쓰다듬 실시간 토스트의 병합·표시 판정. UI와 분리된 순수 로직. */

export const PET_MERGE_WINDOW_MS = 30_000
export const PET_TOAST_VISIBLE_MS = 4_000

export interface PetToastState {
  text: string
  lastEventAt: number
}

/** 이벤트 수신: 30초 안에 연달아 오면 새 토스트를 띄우지 않고 잔뜩 문구로 병합한다(연타 스팸 방지). */
export function applyPetEvent(
  state: PetToastState | null,
  nickname: string,
  nowMs: number,
): PetToastState {
  const merged = state !== null && nowMs - state.lastEventAt < PET_MERGE_WINDOW_MS
  return {
    text: merged
      ? `${nickname}님이 잔뜩 쓰다듬고 있어요`
      : `${nickname}님이 쓰다듬었어요`,
    lastEventAt: nowMs,
  }
}

/** 마지막 이벤트 후 4초까지 표시 — 연타 중에는 계속 연장된다. */
export function isPetToastVisible(state: PetToastState | null, nowMs: number): boolean {
  return state !== null && nowMs - state.lastEventAt < PET_TOAST_VISIBLE_MS
}
