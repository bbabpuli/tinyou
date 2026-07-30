import type { Happiness } from '../domain/happiness'
import { bobY, chewSquash, hopY } from './animMath'
import type { CharState } from './fsm'
import { BLOB_MAP, drawPixelMap, PALETTE_GRIMY, PALETTE_NORMAL } from './sprite'

export const STAGE_W = 320
export const STAGE_H = 240
const SCALE = 5
export const SPRITE_W = BLOB_MAP[0].length * SCALE
export const SPRITE_H = BLOB_MAP.length * SCALE
const FLOOR_Y = 200

export interface Scene {
  state: CharState
  mood: Happiness
  /** 상태별 위상 시계(ms) — 전역 누적 시간이 아니라 CharacterFsm.phaseMs를 넣는다 (전이 시 순간이동 방지) */
  tMs: number
  /** Walker가 소유한 영속 x좌표 (모든 상태에서 이 값을 그대로 사용 — 전이 시 순간이동 없음) */
  x: number
  facing: 1 | -1
}

/** 캐릭터 기준점(스프라이트 좌상단) 좌표 + 방향 — 파티클 스폰 위치 계산에도 사용 */
export function characterPos(scene: Scene): { x: number; y: number; facing: 1 | -1 } {
  const baseY = FLOOR_Y - SPRITE_H
  switch (scene.state) {
    case 'walk':
      return { x: scene.x, y: baseY + bobY(scene.tMs, 1, 400), facing: scene.facing }
    case 'happy':
      return { x: scene.x, y: baseY + hopY(scene.tMs, 10, 500), facing: 1 }
    case 'sad':
      return { x: scene.x, y: baseY + 4, facing: 1 } // 축 처짐
    default:
      return { x: scene.x, y: baseY + bobY(scene.tMs, 2, 900), facing: 1 }
  }
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  // 배경·바닥
  ctx.fillStyle = '#fdf6f0'
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)
  ctx.fillStyle = '#e8d5c4'
  ctx.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y)

  const palette = scene.mood === 'grimy' ? PALETTE_GRIMY : PALETTE_NORMAL
  const { x, y, facing } = characterPos(scene)

  if (scene.state === 'eat') {
    const { sx, sy } = chewSquash((scene.tMs % 2000) / 2000)
    ctx.save()
    ctx.translate(x + SPRITE_W / 2, y + SPRITE_H)
    ctx.scale(sx * facing, sy) // eat 진입 시 facing은 항상 1이지만 방향 규약을 일관되게 유지
    drawPixelMap(ctx, BLOB_MAP, palette, -SPRITE_W / 2, -SPRITE_H, SCALE)
    ctx.restore()
    return
  }

  if (facing === -1) {
    ctx.save()
    ctx.translate(x + SPRITE_W / 2, 0)
    ctx.scale(-1, 1) // 좌우 반전: walk 중 방향 전환 표현
    drawPixelMap(ctx, BLOB_MAP, palette, -SPRITE_W / 2, y, SCALE)
    ctx.restore()
  } else {
    drawPixelMap(ctx, BLOB_MAP, palette, x, y, SCALE)
  }

  if (scene.state === 'sad') {
    ctx.fillStyle = '#7ec8e3' // 눈물 한 방울
    ctx.fillRect(x + 2 * SCALE, y + 4 * SCALE, SCALE, SCALE * 2)
  }
}
