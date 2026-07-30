import { expect, test } from 'vitest'
import { BLOB_MAP, drawPixelMap, PALETTE_NORMAL } from './sprite'

function fakeCtx() {
  const calls: [number, number, number, number][] = []
  return {
    calls,
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push([x, y, w, h])
    },
  } as unknown as CanvasRenderingContext2D & { calls: [number, number, number, number][] }
}

test('픽셀맵의 non-dot 칸 수만큼 fillRect 호출', () => {
  const ctx = fakeCtx()
  const expected = BLOB_MAP.join('').replace(/\./g, '').length
  drawPixelMap(ctx, BLOB_MAP, PALETTE_NORMAL, 0, 0, 1)
  expect(ctx.calls).toHaveLength(expected)
})

test('scale·offset이 fillRect 좌표에 반영', () => {
  const ctx = fakeCtx()
  drawPixelMap(ctx, ['P'], { P: '#fff' }, 10, 20, 3)
  expect(ctx.calls).toEqual([[10, 20, 3, 3]])
})

test('팔레트에 없는 문자는 그리지 않음', () => {
  const ctx = fakeCtx()
  drawPixelMap(ctx, ['PX'], { P: '#fff' }, 0, 0, 1)
  expect(ctx.calls).toHaveLength(1)
})
