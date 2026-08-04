import { expect, test } from 'vitest'
import { PALETTES } from '../../game/avatarV2/palettes'
import { darken, DEFAULT_SHELL, shellThemeFor } from './shellTheme'

test('darken: f=1이면 원색, f=0이면 검정', () => {
  expect(darken('#ffb7c9', 1)).toBe('#ffb7c9')
  expect(darken('#ffb7c9', 0)).toBe('#000000')
})

test('darken: 채널별로 비율 적용 + 2자리 패딩', () => {
  expect(darken('#804020', 0.5)).toBe('#402010')
  expect(darken('#100000', 0.5)).toBe('#080000')
})

test('shellThemeFor: 유효한 팔레트 키는 그 색에서 파생', () => {
  const t = shellThemeFor('pink')
  expect(t.base).toBe(PALETTES.pink.B)
  expect(t.deep).toBe(PALETTES.pink.S)
  expect(t.text).toBe(darken(PALETTES.pink.D, 0.55))
})

test('shellThemeFor: null/미지의 키는 크림 기본 셸', () => {
  expect(shellThemeFor(null)).toEqual(DEFAULT_SHELL)
  expect(shellThemeFor(undefined)).toEqual(DEFAULT_SHELL)
  expect(shellThemeFor('neon')).toEqual(DEFAULT_SHELL)
  expect(DEFAULT_SHELL.base).toBe(PALETTES.cream.B)
})
