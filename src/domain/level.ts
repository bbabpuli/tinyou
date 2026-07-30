export const MAX_LEVEL = 99

/** 레벨 n 도달에 필요한 누적 XP: 30 * n * (n-1) / 2 */
export function cumXpForLevel(level: number): number {
  return (30 * level * (level - 1)) / 2
}

export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xp >= cumXpForLevel(level + 1)) level++
  return level
}

export function xpIntoLevel(xp: number): { current: number; needed: number } {
  const level = levelForXp(xp)
  const base = cumXpForLevel(level)
  const next = cumXpForLevel(level + 1)
  return { current: xp - base, needed: next - base }
}
