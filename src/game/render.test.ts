import { expect, test } from 'vitest'
import type { CharState } from './fsm'
import {
  characterPos,
  renderScene,
  SPRITE_H,
  SPRITE_W,
  STAGE_H,
  STAGE_W,
  type Scene,
} from './render'

const FLOOR_Y = 200
const WALK_MIN_X = 30
const WALK_MAX_X = STAGE_W - 30 - SPRITE_W

const scene = (state: CharState, tMs: number): Scene => ({ state, mood: 'ok', tMs })

/** 좌표계 변환(save/restore/translate/scale)을 반영해 fillRect를 기록하는 가짜 컨텍스트 */
function fakeCtx() {
  const calls: { x: number; y: number; w: number; h: number }[] = []
  let t = { sx: 1, sy: 1, tx: 0, ty: 0 }
  const stack: (typeof t)[] = []
  return {
    calls,
    fillStyle: '',
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
  }
}

/** 배경·바닥(스테이지 전폭)을 제외한 스프라이트 픽셀들의 x 범위 */
function spriteExtent(calls: { x: number; w: number }[]) {
  const px = calls.filter((c) => c.w < STAGE_W)
  return { min: Math.min(...px.map((c) => c.x)), max: Math.max(...px.map((c) => c.x + c.w)) }
}

test('phase 0에서 idle은 바닥 위 중앙 (bob 0)', () => {
  expect(characterPos(scene('idle', 0))).toEqual({
    x: STAGE_W / 2 - SPRITE_W / 2,
    y: FLOOR_Y - SPRITE_H,
    facing: 1,
  })
})

test('phase 0에서 walk은 왼쪽 끝에서 오른쪽으로 출발', () => {
  const pos = characterPos(scene('walk', 0))
  expect(pos.x).toBe(WALK_MIN_X)
  expect(pos.facing).toBe(1)
})

test('phase 0에서 happy는 hop 0 (전이 순간 점프 없음)', () => {
  expect(characterPos(scene('happy', 0)).y).toBe(FLOOR_Y - SPRITE_H)
})

test('walk의 facing은 pingPong 왕복을 따른다', () => {
  expect(characterPos(scene('walk', 2000)).facing).toBe(1) // 오른쪽 진행 구간
  expect(characterPos(scene('walk', 6000)).facing).toBe(-1) // 되돌아오는 구간
})

test('walk 외 상태의 facing은 항상 1', () => {
  for (const s of ['idle', 'happy', 'sad', 'eat'] as CharState[]) {
    expect(characterPos(scene(s, 1234)).facing).toBe(1)
  }
})

test('walk x는 항상 [30, STAGE_W-30-SPRITE_W] 안에 머문다', () => {
  for (let tMs = 0; tMs <= 30_000; tMs += 137) {
    const { x } = characterPos(scene('walk', tMs))
    expect(x).toBeGreaterThanOrEqual(WALK_MIN_X)
    expect(x).toBeLessThanOrEqual(WALK_MAX_X)
  }
})

test('renderScene은 배경과 바닥을 먼저 칠한다', () => {
  const ctx = fakeCtx()
  renderScene(ctx, scene('idle', 0))
  expect(ctx.calls[0]).toEqual({ x: 0, y: 0, w: STAGE_W, h: STAGE_H })
  expect(ctx.calls[1]).toEqual({ x: 0, y: FLOOR_Y, w: STAGE_W, h: STAGE_H - FLOOR_Y })
})

test('좌우 반전(facing -1)도 facing 1과 같은 x 폭 안에 그려진다', () => {
  const right = characterPos(scene('walk', 2000))
  const left = characterPos(scene('walk', 6000))
  expect(right.facing).toBe(1)
  expect(left.facing).toBe(-1)

  const ctxR = fakeCtx()
  renderScene(ctxR, scene('walk', 2000))
  const extR = spriteExtent(ctxR.calls)
  expect(extR).toEqual({ min: right.x, max: right.x + SPRITE_W })

  const ctxL = fakeCtx()
  renderScene(ctxL, scene('walk', 6000))
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

test('eat은 squash 변환을 쓰지만 스프라이트 중심은 유지된다', () => {
  const ctx = fakeCtx()
  renderScene(ctx, scene('eat', 0)) // chewSquash(0) = {1,1} → 변형 없음
  const ext = spriteExtent(ctx.calls)
  const { x } = characterPos(scene('eat', 0))
  expect(ext).toEqual({ min: x, max: x + SPRITE_W })
})
