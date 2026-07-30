import { useEffect, useRef } from 'react'
import { happinessFrom } from '../domain/happiness'
import { createCharacterFsm } from '../game/fsm'
import { startLoop } from '../game/loop'
import { ParticleSystem } from '../game/particles'
import { characterPos, renderScene, STAGE_H, STAGE_W } from '../game/render'
import { selectLastCaredAt, useGame } from '../state/store'

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    const fsm = createCharacterFsm()
    const particles = new ParticleSystem()
    let tMs = 0

    const stop = startLoop((dt) => {
      tMs += dt
      const store = useGame.getState()
      const input = store.consumePending()
      const mood = happinessFrom(selectLastCaredAt(store), new Date())
      fsm.setMood(mood)
      if (input) fsm.enqueue(input)
      fsm.update(dt) // enqueue는 전이를 일으키지 않으므로, 스폰 위치는 update 이후 상태로 계산한다
      if (input) {
        const pos = characterPos({ state: fsm.state, mood, tMs })
        particles.spawnHearts(pos.x + 30, pos.y, input === 'pet' ? 6 : 3)
      }
      particles.update(dt)
      renderScene(ctx, { state: fsm.state, mood, tMs })
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
