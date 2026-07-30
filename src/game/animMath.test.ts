import { expect, test } from 'vitest'
import { bobY, chewSquash, hopY, pingPong } from './animMath'

test('bobY: 주기 시작/절반에서 0, 1/4에서 +amplitude', () => {
  expect(bobY(0, 2, 800)).toBeCloseTo(0)
  expect(bobY(200, 2, 800)).toBeCloseTo(2)
  expect(bobY(400, 2, 800)).toBeCloseTo(0)
})

test('chewSquash: 가로+세로 합이 보존되는 스쿼시, progress 0에서 원형', () => {
  expect(chewSquash(0)).toEqual({ sx: 1, sy: 1 })
  const { sx, sy } = chewSquash(1 / 6) // sin(π/2)=1 지점
  expect(sx).toBeCloseTo(1.15)
  expect(sy).toBeCloseTo(0.85)
})

test('pingPong: 전진 → 경계에서 반전', () => {
  // 100px/s, 0~100 구간
  expect(pingPong(500, 100, 0, 100)).toEqual({ x: 50, facing: 1 })
  expect(pingPong(1500, 100, 0, 100)).toEqual({ x: 50, facing: -1 })
  expect(pingPong(2000, 100, 0, 100)).toEqual({ x: 0, facing: 1 })
})

test('hopY: 항상 0 이하 (위로만 점프)', () => {
  for (const t of [0, 100, 250, 400, 777]) {
    expect(hopY(t, 8, 500)).toBeLessThanOrEqual(0)
  }
  expect(hopY(250, 8, 500)).toBeCloseTo(-8)
})
