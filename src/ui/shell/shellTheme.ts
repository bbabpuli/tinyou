import { PALETTES, type PaletteKey } from '../../game/avatarV2/palettes'

/**
 * 셸(기기 플라스틱) 테마 — 내 화면 분신의 팔레트에서 파생한다.
 * LCD 색은 팔레트와 무관하게 고정(index.css의 --lcd-*): 화면은 기기가 바뀌어도 같은 부품이다.
 */
export interface ShellTheme {
  /** 셸 상단(밝은 면) */
  base: string
  /** 셸 하단(그늘 면) — 그라디언트 끝 */
  deep: string
  /** 셸 위에 얹는 텍스트/각인 색 */
  text: string
}

/** #rrggbb를 어둡게. f=0이면 검정, f=1이면 원색. */
export function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) =>
    Math.round(((n >> shift) & 0xff) * f)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(16)}${ch(8)}${ch(0)}`
}

function themeOf(key: PaletteKey): ShellTheme {
  const p = PALETTES[key]
  return { base: p.B, deep: p.S, text: darken(p.D, 0.55) }
}

/** 캐릭터가 없거나 팔레트를 모를 때: 크림 셸 (90년대 장난감 플라스틱) */
export const DEFAULT_SHELL: ShellTheme = themeOf('cream')

export function shellThemeFor(palette: string | null | undefined): ShellTheme {
  if (palette && palette in PALETTES) return themeOf(palette as PaletteKey)
  return DEFAULT_SHELL
}
