import { expect, test } from 'vitest'
import type { CharState } from './fsm'
import {
  characterPos,
  renderScene,
  SPRITE_H,
  SPRITE_IMAGE_SIZE,
  SPRITE_W,
  STAGE_H,
  STAGE_W,
  type Scene,
} from './render'

const FLOOR_Y = 200

const scene = (state: CharState, tMs: number, x = 100, facing: 1 | -1 = 1): Scene => ({
  state,
  mood: 'ok',
  tMs,
  x,
  facing,
})

/** 좌표계 변환(save/restore/translate/scale)을 반영해 fillRect를 기록하는 가짜 컨텍스트 */
function fakeCtx() {
  const calls: { x: number; y: number; w: number; h: number }[] = []
  const images: { x: number; y: number; w: number; h: number }[] = []
  let t = { sx: 1, sy: 1, tx: 0, ty: 0 }
  const stack: (typeof t)[] = []
  return {
    calls,
    images,
    fillStyle: '',
    filter: 'none',
    drawImage(_img: unknown, x: number, y: number, w: number, h: number) {
      const x0 = t.tx + t.sx * x
      const x1 = t.tx + t.sx * (x + w)
      const y0 = t.ty + t.sy * y
      const y1 = t.ty + t.sy * (y + h)
      images.push({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      })
    },
    save() {
      stack.push({ ...t })
    },
    restore() {
      t = stack.pop()!
    },
    translate(x: number, y: number) {
      t.tx += t.sx * x
      t.ty += t.sy * y
    },
    scale(x: number, y: number) {
      t.sx *= x
      t.sy *= y
    },
    fillRect(x: number, y: number, w: number, h: number) {
      const x0 = t.tx + t.sx * x
      const x1 = t.tx + t.sx * (x + w)
      const y0 = t.ty + t.sy * y
      const y1 = t.ty + t.sy * (y + h)
      calls.push({
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      })
    },
  } as unknown as CanvasRenderingContext2D & {
    calls: { x: number; y: number; w: number; h: number }[]
    images: { x: number; y: number; w: number; h: number }[]
  }
}

/** 배경·바닥(스테이지 전폭)을 제외한 스프라이트 픽셀들의 x 범위 */
function spriteExtent(calls: { x: number; w: number }[]) {
  const px = calls.filter((c) => c.w < STAGE_W)
  return { min: Math.min(...px.map((c) => c.x)), max: Math.max(...px.map((c) => c.x + c.w)) }
}

test('모든 상태에서 x는 scene.x를 그대로 쓴다 (Walker 소유 — 전이 순간이동 없음)', () => {
  for (const s of ['idle', 'walk', 'happy', 'sad', 'eat'] as CharState[]) {
    expect(characterPos(scene(s, 0, 77)).x).toBe(77)
    expect(characterPos(scene(s, 1234, 199)).x).toBe(199)
  }
})

test('phase 0에서 idle은 바닥 위 (bob 0)', () => {
  expect(characterPos(scene('idle', 0, 100))).toEqual({
    x: 100,
    y: FLOOR_Y - SPRITE_H,
    facing: 1,
  })
})

test('phase 0에서 happy는 hop 0 (전이 순간 점프 없음)', () => {
  expect(characterPos(scene('happy', 0, 100)).y).toBe(FLOOR_Y - SPRITE_H)
})

test('walk의 facing은 scene.facing을 그대로 따른다', () => {
  expect(characterPos(scene('walk', 2000, 100, 1)).facing).toBe(1)
  expect(characterPos(scene('walk', 6000, 100, -1)).facing).toBe(-1)
})

test('walk 외 상태의 facing은 scene.facing과 무관하게 항상 1', () => {
  for (const s of ['idle', 'happy', 'sad', 'eat'] as CharState[]) {
    expect(characterPos(scene(s, 1234, 100, -1)).facing).toBe(1)
  }
})

test('y 오프셋은 상태별로 유지된다 (walk=bob 1/400, happy=hop 10/500, sad=+4 고정, idle=bob 2/900)', () => {
  const baseY = FLOOR_Y - SPRITE_H
  expect(characterPos(scene('walk', 100, 0)).y).not.toBe(baseY) // bob(100,1,400) != 0
  expect(characterPos(scene('sad', 0, 0)).y).toBe(baseY + 4)
  expect(characterPos(scene('happy', 125, 0)).y).toBeLessThan(baseY) // hop은 항상 위로만 움직임(-)
  expect(characterPos(scene('idle', 0, 0)).y).toBe(baseY) // idle bob(0) = 0
})

test('renderScene은 배경과 바닥을 먼저 칠한다', () => {
  const ctx = fakeCtx()
  renderScene(ctx, scene('idle', 0))
  expect(ctx.calls[0]).toEqual({ x: 0, y: 0, w: STAGE_W, h: STAGE_H })
  expect(ctx.calls[1]).toEqual({ x: 0, y: FLOOR_Y, w: STAGE_W, h: STAGE_H - FLOOR_Y })
})

test('좌우 반전(facing -1)도 facing 1과 같은 x 폭 안에 그려진다', () => {
  const right = characterPos(scene('walk', 2000, 100, 1))
  const left = characterPos(scene('walk', 6000, 100, -1))
  expect(right.facing).toBe(1)
  expect(left.facing).toBe(-1)

  const ctxR = fakeCtx()
  renderScene(ctxR, scene('walk', 2000, 100, 1))
  const extR = spriteExtent(ctxR.calls)
  expect(extR).toEqual({ min: right.x, max: right.x + SPRITE_W })

  const ctxL = fakeCtx()
  renderScene(ctxL, scene('walk', 6000, 100, -1))
  const extL = spriteExtent(ctxL.calls)
  expect(extL).toEqual({ min: left.x, max: left.x + SPRITE_W })
})

test('sad는 눈물 픽셀을 하나 더 그린다', () => {
  const ctxSad = fakeCtx()
  renderScene(ctxSad, scene('sad', 0))
  const ctxIdle = fakeCtx()
  renderScene(ctxIdle, scene('idle', 0))
  expect(ctxSad.calls.length).toBe(ctxIdle.calls.length + 1)
})

test('생성 이미지는 정사각(64×64)으로 바닥 정렬해 그린다 (세로 눌림 왜곡 없음)', () => {
  const ctx = fakeCtx()
  const s: Scene = { ...scene('idle', 0, 100), image: {} as HTMLImageElement }
  renderScene(ctx, s)
  expect(ctx.images).toHaveLength(1)
  const img = ctx.images[0]
  expect(img.w).toBe(SPRITE_IMAGE_SIZE)
  expect(img.h).toBe(SPRITE_IMAGE_SIZE)
  expect(img.w).toBe(img.h) // 정사각 — SPRITE_W×SPRITE_H로 늘리지 않는다
  expect(img.y + img.h).toBe(FLOOR_Y) // 하단(바닥) 정렬
  expect(img.x + img.w / 2).toBe(100 + SPRITE_W / 2) // 스프라이트 박스 중앙 정렬
})

test('eat은 squash 변환을 쓰지만 스프라이트 중심은 유지된다', () => {
  const ctx = fakeCtx()
  renderScene(ctx, scene('eat', 0)) // chewSquash(0) = {1,1} → 변형 없음
  const ext = spriteExtent(ctx.calls)
  const { x } = characterPos(scene('eat', 0))
  expect(ext).toEqual({ min: x, max: x + SPRITE_W })
})
