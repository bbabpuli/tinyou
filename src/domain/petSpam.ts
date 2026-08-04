/**
 * 쓰다듬 연타 스팸 가드 — 10초 안에 10회째부터 화내고 30초간 쓰다듬기를 금지한다.
 * XP 스택(care.ts)과 별개인 상호작용 가드: 무한 쓰다듬기를 열어둔 대신 학대(?)는 막는다.
 */

export const PET_SPAM_WINDOW_MS = 10_000
export const PET_SPAM_LIMIT = 10
export const PET_BAN_MS = 30_000

/** 창(10초) 밖으로 벗어난 탭을 버리고 이번 탭을 더한 목록을 돌려준다. */
export function pushPetTap(taps: number[], nowMs: number): number[] {
  return [...taps.filter((t) => nowMs - t < PET_SPAM_WINDOW_MS), nowMs]
}

/** 이번 탭까지 포함해 한도(10회)에 도달했는가 — true면 이번 탭은 화냄으로 처리한다. */
export function isPetSpam(taps: number[]): boolean {
  return taps.length >= PET_SPAM_LIMIT
}
