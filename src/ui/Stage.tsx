import { useEffect, useRef } from 'react'
import { happinessFrom, type Happiness } from '../domain/happiness'
import { createCharacterFsm } from '../game/fsm'
import { startLoop } from '../game/loop'
import { ParticleSystem } from '../game/particles'
import { characterPos, renderScene, SPRITE_W, STAGE_H, STAGE_W } from '../game/render'
import { selectLastCaredAt, useGame } from '../state/store'

const MOOD_REFRESH_MS = 1000

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const fsm = createCharacterFsm()
    const particles = new ParticleSystem()

    // 매 프레임 careLog 전체를 재파생하지 않기 위한 캐시 (참조 동일성 + 시간 기반 갱신)
    let lastSeenLog: unknown = null
    let lastCaredAt: Date | null = null
    let moodElapsedMs = Infinity // 첫 프레임에 즉시 계산
    let mood: Happiness = 'ok'

    const stop = startLoop((dt) => {
      const store = useGame.getState()
      const input = store.consumePending()

      if (store.careLog !== lastSeenLog) {
        lastSeenLog = store.careLog
        lastCaredAt = selectLastCaredAt(store)
        moodElapsedMs = Infinity // 돌봄 직후에는 기분을 즉시 반영
      }
      moodElapsedMs += dt
      if (moodElapsedMs >= MOOD_REFRESH_MS) {
        moodElapsedMs = 0
        mood = happinessFrom(lastCaredAt, new Date())
      }

      fsm.setMood(mood)
      if (input) fsm.enqueue(input)
      fsm.update(dt) // enqueue는 전이를 일으키지 않으므로, 스폰 위치는 update 이후 상태로 계산한다
      const scene = { state: fsm.state, mood, tMs: fsm.phaseMs }
      if (input) {
        const pos = characterPos(scene)
        particles.spawnHearts(pos.x + SPRITE_W / 2, pos.y, input === 'pet' ? 6 : 3)
      }
      particles.update(dt)
      renderScene(ctx, scene)
      particles.draw(ctx)
    })
    return stop
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={STAGE_W}
      height={STAGE_H}
      style={{ width: '100%', maxWidth: 480, imageRendering: 'pixelated', borderRadius: 12 }}
    />
  )
}
