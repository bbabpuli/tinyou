import { expect, test } from 'vitest'
import { SPECIES } from './index'

const ALLOWED = new Set(['.', 'O', 'B', 'S', 'W', 'E', 'C', 'M', 'A', 'D'])

for (const [key, sp] of Object.entries(SPECIES)) {
  test(`${key}: 32×32 그리드, 허용 문자만`, () => {
    expect(sp.baseMap).toHaveLength(32)
    for (const row of sp.baseMap) {
      expect(row).toHaveLength(32)
      for (const ch of row) expect(ALLOWED.has(ch)).toBe(true)
    }
  })
  test(`${key}: 바닥 정렬 — row 29에 몸이 닿고 row 30-31은 비어있음`, () => {
    expect(sp.baseMap[29].replace(/\./g, '').length).toBeGreaterThan(0)
    expect(sp.baseMap[30].replace(/\./g, '')).toBe('')
    expect(sp.baseMap[31].replace(/\./g, '')).toBe('')
  })
  test(`${key}: 앵커가 몸 위에 있음 (B/W/S)`, () => {
    const on = (r: number, c: number) => ['B', 'W', 'S'].includes(sp.baseMap[r][c])
    for (const [r, c] of sp.anchors.eyes) expect(on(r, c)).toBe(true)
    expect(on(...sp.anchors.mouth)).toBe(true)
    for (const [r, c] of sp.anchors.cheeks) expect(on(r, c)).toBe(true)
  })
  test(`${key}: 외곽선 존재 (O가 40픽셀 이상)`, () => {
    const count = sp.baseMap.join('').split('O').length - 1
    expect(count).toBeGreaterThanOrEqual(40)
  })
}
