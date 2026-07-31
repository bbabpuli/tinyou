import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { CharacterRow } from '../character/useCharacters'
import type { CareAction } from '../domain/care'
import { dateKeySeoul } from '../domain/dateKey'
import { happinessFrom, type Happiness } from '../domain/happiness'
import { createCharacterFsm, type CharacterFsm } from '../game/fsm'
import { goodnightDateKeys, isSleepScene } from '../game/night'
import { startLoop } from '../game/loop'
import { pickNextUnread, type Message } from '../messages/useMessages'
import { ParticleSystem } from '../game/particles'
import { characterPos, renderScene, SPRITE_H, SPRITE_W, STAGE_H, STAGE_W } from '../game/render'
import { loadCharacterImage } from '../game/spriteImage'
import { createWalker } from '../game/walker'
import { selectLastCaredAt, useGame } from '../state/store'
import { SpeechBubble } from './SpeechBubble'

const MOOD_REFRESH_MS = 1000

/** careLog에 "오늘(취침 판정 기준일)" 굿나잇 기록이 있는지 — 파트너/본인 구분 없이 캐릭터 전체 기록을 본다 */
function hasGoodnightRecorded(careLog: CareAction[], now: Date): boolean {
  const keys = goodnightDateKeys(now)
  return careLog.some((a) => a.type === 'goodnight' && keys.includes(dateKeySeoul(a.createdAt)))
}

interface StageProps {
  character: CharacterRow
  /** 미읽음 쪽지(오래된 것부터) — 있으면 분신이 편지를 들고 배달 연출에 들어간다 */
  unread: Message[]
  markRead: (id: string) => Promise<void>
}

/** 스테이지 좌표(캔버스 내부 픽셀 기준)를 canvas의 실제 표시 크기(CSS 픽셀) 기준 좌표로 변환한다. */
export function stageToCss(
  pos: { x: number; y: number },
  canvasEl: HTMLCanvasElement,
): { x: number; y: number } {
  const scale = canvasEl.getBoundingClientRect().width / STAGE_W
  return { x: pos.x * scale, y: pos.y * scale }
}

export function Stage({ character, unread, markRead }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // rAF 루프(effect 밖 클로저)가 최신 unread를 보게 하는 스테일 가드 — useCouple/useCharacters의 latestKeyRef와 동일 패턴
  const unreadRef = useRef<Message[]>(unread)
  const fsmRef = useRef<CharacterFsm | null>(null)
  // 캐릭터 박스(스테이지 픽셀 좌표) — 매 프레임 루프에서 갱신, 캔버스 클릭 판정과 말풍선 위치 계산에 쓴다
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [bubbleMsg, setBubbleMsg] = useState<Message | null>(null)

  useEffect(() => {
    unreadRef.current = unread
  }, [unread])

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const fsm = createCharacterFsm()
    fsmRef.current = fsm
    const particles = new ParticleSystem()
    const walker = createWalker({
      initialX: 160 - SPRITE_W / 2,
      minX: 30,
      maxX: STAGE_W - 30 - SPRITE_W,
    })

    // 생성 이미지 — 로드되기 전/실패 시엔 undefined로 남아 BLOB_MAP 폴백을 탄다
    let image: HTMLImageElement | undefined
    let cancelled = false
    if (character.imageUrl) {
      loadCharacterImage(character.imageUrl)
        .then((img) => {
          if (!cancelled) image = img
        })
        .catch((err: unknown) => {
          console.warn('캐릭터 이미지 로드 실패, 기본 스프라이트로 대체합니다', err)
        })
    }

    // 매 프레임 careLog 전체를 재파생하지 않기 위한 캐시 (참조 동일성 + 시간 기반 갱신)
    let lastSeenLog: unknown = null
    let lastCaredAt: Date | null = null
    let moodElapsedMs = Infinity // 첫 프레임에 즉시 계산
    let mood: Happiness = 'ok'
    let sleeping = false

    const stop = startLoop((dt) => {
      const store = useGame.getState()
      const input = store.consumePending()

      if (store.careLog !== lastSeenLog) {
        lastSeenLog = store.careLog
        lastCaredAt = selectLastCaredAt(store)
        moodElapsedMs = Infinity // 돌봄 직후에는 기분·취침 여부를 즉시 반영(굿나잇 인사 후 바로 잠든 모습)
      }
      moodElapsedMs += dt
      if (moodElapsedMs >= MOOD_REFRESH_MS) {
        moodElapsedMs = 0
        const now = new Date()
        mood = happinessFrom(lastCaredAt, now)
        sleeping = isSleepScene(now, hasGoodnightRecorded(store.careLog, now))
      }

      fsm.setMood(mood)
      fsm.setSleeping(sleeping)
      if (input) fsm.enqueue(input)
      // 미읽음 쪽지가 있으면 배달 연출 진입을 매 프레임 요청한다 — 이미 배달 중/액션 중이면 fsm 내부에서 no-op이라 안전
      if (unreadRef.current.length > 0) fsm.startDeliver()
      fsm.update(dt) // enqueue는 전이를 일으키지 않으므로, 스폰 위치는 update 이후 상태로 계산한다
      walker.update(dt, fsm.state === 'walk')
      const scene = {
        state: fsm.state,
        mood,
        tMs: fsm.phaseMs,
        x: walker.x,
        facing: walker.facing,
        image,
        sleeping,
      }
      posRef.current = characterPos(scene)
      if (input) {
        const pos = posRef.current
        particles.spawnHearts(pos.x + SPRITE_W / 2, pos.y, input === 'pet' ? 6 : 3)
      }
      particles.update(dt)
      renderScene(ctx, scene)
      particles.draw(ctx)
    })
    return () => {
      cancelled = true
      stop()
      fsmRef.current = null
    }
  }, [character.imageUrl])

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvasEl = canvasRef.current
    const fsm = fsmRef.current
    if (!canvasEl || !fsm || fsm.state !== 'deliver' || bubbleMsg) return
    const rect = canvasEl.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top
    const topLeft = stageToCss(posRef.current, canvasEl)
    const bottomRight = stageToCss(
      { x: posRef.current.x + SPRITE_W, y: posRef.current.y + SPRITE_H },
      canvasEl,
    )
    const hit = clickX >= topLeft.x && clickX <= bottomRight.x
      && clickY >= topLeft.y && clickY <= bottomRight.y
    if (hit) setBubbleMsg(pickNextUnread(unread))
  }

  const closeBubble = () => {
    const msg = bubbleMsg
    setBubbleMsg(null)
    if (msg) {
      void markRead(msg.id)
      fsmRef.current?.endDeliver()
    }
  }

  const canvasEl = canvasRef.current
  const bubblePos = canvasEl
    ? stageToCss({ x: posRef.current.x + SPRITE_W / 2, y: posRef.current.y }, canvasEl)
    : { x: 0, y: 0 }

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={STAGE_W}
        height={STAGE_H}
        onClick={handleCanvasClick}
        style={{ width: '100%', maxWidth: 480, imageRendering: 'pixelated', borderRadius: 12 }}
      />
      {bubbleMsg && (
        <SpeechBubble x={bubblePos.x} y={bubblePos.y} onClose={closeBubble}>
          {bubbleMsg.body}
        </SpeechBubble>
      )}
    </div>
  )
}
