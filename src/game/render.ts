import type { Happiness } from '../domain/happiness'
import { bobY, chewSquash, hopY, pingPong } from './animMath'
import type { CharState } from './fsm'
import { BLOB_MAP, drawPixelMap, PALETTE_GRIMY, PALETTE_NORMAL } from './sprite'

export const STAGE_W = 320
export const STAGE_H = 240
const SCALE = 5
const SPRITE_W = BLOB_MAP[0].length * SCALE
const SPRITE_H = BLOB_MAP.length * SCALE
const FLOOR_Y = 200

export interface Scene {
  state: CharState
  mood: Happiness
  tMs: number
}

/** 캐릭터 기준점(스프라이트 좌상단) 좌표 — 파티클 스폰 위치 계산에도 사용 */
export function characterPos(scene: Scene): { x: number; y: number } {
  const centerX = STAGE_W / 2 - SPRITE_W / 2
  const baseY = FLOOR_Y - SPRITE_H
  switch (scene.state) {
    case 'walk': {
      const { x } = pingPong(scene.tMs, 40, 30, STAGE_W - 30 - SPRITE_W)
      return { x, y: baseY + bobY(scene.tMs, 1, 400) }
    }
    case 'happy':
      return { x: centerX, y: baseY + hopY(scene.tMs, 10, 500) }
    case 'sad':
      return { x: centerX, y: baseY + 4 } // 축 처짐
    default:
      return { x: centerX, y: baseY + bobY(scene.tMs, 2, 900) }
  }
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  // 배경·바닥
  ctx.fillStyle = '#fdf6f0'
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)
  ctx.fillStyle = '#e8d5c4'
  ctx.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y)

  const palette = scene.mood === 'grimy' ? PALETTE_GRIMY : PALETTE_NORMAL
  const { x, y } = characterPos(scene)

  if (scene.state === 'eat') {
    const { sx, sy } = chewSquash((scene.tMs % 2000) / 2000)
    ctx.save()
    ctx.translate(x + SPRITE_W / 2, y + SPRITE_H)
    ctx.scale(sx, sy)
    drawPixelMap(ctx, BLOB_MAP, palette, -SPRITE_W / 2, -SPRITE_H, SCALE)
    ctx.restore()
    return
  }
  drawPixelMap(ctx, BLOB_MAP, palette, x, y, SCALE)

  if (scene.state === 'sad') {
    ctx.fillStyle = '#7ec8e3' // 눈물 한 방울
    ctx.fillRect(x + 2 * SCALE, y + 4 * SCALE, SCALE, SCALE * 2)
  }
}
