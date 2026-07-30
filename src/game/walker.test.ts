import { expect, test } from 'vitest'
import { createWalker } from './walker'

const opts = { initialX: 130, minX: 30, maxX: 230, speedPxPerSec: 40 }

test('walking=true면 초당 speed만큼 전진', () => {
  const w = createWalker(opts)
  w.update(1000, true)
  expect(w.x).toBeCloseTo(170)
  expect(w.facing).toBe(1)
})

test('walking=false면 x 유지 (idle/eat 등에서 위치 보존 — 순간이동 없음)', () => {
  const w = createWalker(opts)
  w.update(1000, false)
  expect(w.x).toBe(130)
})

test('maxX에 닿으면 방향 반전', () => {
  const w = createWalker(opts)
  w.update(3000, true) // 130 + 120 = 250 > 230
  expect(w.x).toBeLessThanOrEqual(230)
  expect(w.facing).toBe(-1)
})

test('minX에 닿으면 다시 오른쪽으로', () => {
  const w = createWalker(opts)
  // 단일 update로 130 -> 230(우측 벽, 반전) -> 30(좌측 벽, 반전) 순서까지 흘려보낸다.
  // (걸음 단위로 폴링하는 while문은 고정 스텝 양자화 때문에 벽 근접값에서 멈춰
  //  x가 임계값 밑으로 절대 내려가지 않는 실제 무한루프가 될 수 있어 피한다 — 검증 완료)
  w.update(7600, true)
  expect(w.facing).toBe(1)
  expect(w.x).toBeGreaterThanOrEqual(30)
})

test('minX >= maxX면 이동 없이 즉시 반환 (무한루프 가드)', () => {
  const w = createWalker({ initialX: 100, minX: 150, maxX: 150, speedPxPerSec: 40 })
  w.update(1000, true)
  expect(w.x).toBe(100)
})

test('큰 dt에도 경계를 벗어나지 않음', () => {
  const w = createWalker(opts)
  w.update(60_000, true)
  expect(w.x).toBeGreaterThanOrEqual(30)
  expect(w.x).toBeLessThanOrEqual(230)
})
