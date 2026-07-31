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
/**
 * 생성 이미지는 16×16 도트를 정수 4배(64×64)로 확대해 정사각으로 그린다.
 * 스프라이트 박스(60×45)에 맞춰 늘리면 세로가 눌려 왜곡되므로, 가로는 박스 중앙에 맞추고
 * 세로는 박스 하단(= FLOOR_Y)에 맞춘다. 이미지가 박스보다 19px 위로 더 커지는 건 의도된 것.
 */
export const SPRITE_IMAGE_SIZE = 64

export interface Scene {
  state: CharState
  mood: Happiness
  /** 상태별 위상 시계(ms) — 전역 누적 시간이 아니라 CharacterFsm.phaseMs를 넣는다 (전이 시 순간이동 방지) */
  tMs: number
  /** Walker가 소유한 영속 x좌표 (모든 상태에서 이 값을 그대로 사용 — 전이 시 순간이동 없음) */
  x: number
  facing: 1 | -1
  /** AI 생성 캐릭터 이미지 — 있으면 BLOB_MAP 대신 이걸 드로우한다 */
  image?: HTMLImageElement
  /** 취침 장면 — 배경을 어둡게 오버레이하고 분신 위에 이불을 덮은 정적 포즈로 그린다 */
  sleeping?: boolean
}

/** 취침 오버레이 색(반투명 남보라) — 배경을 밤 분위기로 어둡게 덮는다 */
const SLEEP_OVERLAY = 'rgba(58, 52, 82, 0.55)'
/** 이불 색 — 도트 팔레트의 S(하늘/차분한 톤) 계열 */
const BLANKET_COLOR = '#8fb3d9'

/** 캐릭터 기준점(스프라이트 좌상단) 좌표 + 방향 — 파티클 스폰 위치 계산에도 사용 */
export function characterPos(scene: Scene): { x: number; y: number; facing: 1 | -1 } {
  const baseY = FLOOR_Y - SPRITE_H
  if (scene.sleeping) return { x: scene.x, y: baseY, facing: 1 } // 정적 포즈 — bob 없이 고정
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

/** 캐릭터 한 마리를 그린다 — scene.image가 있으면 생성 이미지, 없으면 BLOB_MAP 폴백 */
function drawCharacter(ctx: CanvasRenderingContext2D, scene: Scene, x: number, y: number): void {
  if (scene.image) {
    if (scene.mood === 'grimy') ctx.filter = 'grayscale(60%)'
    // 정사각 유지 + 하단(바닥) 정렬. 호출부(eat 스쿼시·좌우 반전)도 이 함수를 거치므로
    // 변환 좌표계 안에서도 같은 정사각 기준이 그대로 적용된다.
    ctx.drawImage(
      scene.image,
      x + (SPRITE_W - SPRITE_IMAGE_SIZE) / 2,
      y + SPRITE_H - SPRITE_IMAGE_SIZE,
      SPRITE_IMAGE_SIZE,
      SPRITE_IMAGE_SIZE,
    )
    ctx.filter = 'none'
    return
  }
  const palette = scene.mood === 'grimy' ? PALETTE_GRIMY : PALETTE_NORMAL
  drawPixelMap(ctx, BLOB_MAP, palette, x, y, SCALE)
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  // 배경·바닥
  ctx.fillStyle = '#fdf6f0'
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)
  ctx.fillStyle = '#e8d5c4'
  ctx.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y)

  if (scene.sleeping) {
    ctx.fillStyle = SLEEP_OVERLAY
    ctx.fillRect(0, 0, STAGE_W, STAGE_H)
  }

  const { x, y, facing } = characterPos(scene)

  if (scene.state === 'eat') {
    const { sx, sy } = chewSquash((scene.tMs % 2000) / 2000)
    ctx.save()
    ctx.translate(x + SPRITE_W / 2, y + SPRITE_H)
    ctx.scale(sx * facing, sy) // eat 진입 시 facing은 항상 1이지만 방향 규약을 일관되게 유지
    drawCharacter(ctx, scene, -SPRITE_W / 2, -SPRITE_H)
    ctx.restore()
    return
  }

  if (facing === -1) {
    ctx.save()
    ctx.translate(x + SPRITE_W / 2, 0)
    ctx.scale(-1, 1) // 좌우 반전: walk 중 방향 전환 표현
    drawCharacter(ctx, scene, -SPRITE_W / 2, y)
    ctx.restore()
  } else {
    drawCharacter(ctx, scene, x, y)
  }

  if (scene.sleeping) {
    // 이불(S 색 사각) — 분신 하반신을 덮는 정적 포즈
    const blanketH = SPRITE_H * 0.4
    ctx.fillStyle = BLANKET_COLOR
    ctx.fillRect(x, y + SPRITE_H - blanketH, SPRITE_W, blanketH)
    // 쪽지 도착 단서는 봉투 스탬프 대신 자동 오픈되는 말풍선이 맡는다 (2026-07-31 봉투 제거)
    return
  }

  if (scene.state === 'sad') {
    ctx.fillStyle = '#7ec8e3' // 눈물 한 방울
    ctx.fillRect(x + 2 * SCALE, y + 4 * SCALE, SCALE, SCALE * 2)
  }
}
