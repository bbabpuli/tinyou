import type { Happiness } from '../domain/happiness'

export type CharState = 'idle' | 'walk' | 'eat' | 'petted' | 'happy' | 'sad'
export type CareInput = 'feed' | 'pet'

const ACTION_FLOW: Record<CareInput, { state: CharState; ms: number }> = {
  feed: { state: 'eat', ms: 2000 },
  pet: { state: 'petted', ms: 1200 },
}
const HAPPY_MS = 1500
const ACTION_STATES: CharState[] = ['eat', 'petted', 'happy']

export interface CharacterFsm {
  readonly state: CharState
  /**
   * 현재 상태에 머문 시간(ms). 상태가 바뀔 때마다 0(또는 이월 초과분)으로 리셋된다.
   * 애니메이션은 전역 시계가 아니라 이 값을 위상으로 써야 전이 순간 튀지 않는다.
   */
  readonly phaseMs: number
  enqueue(input: CareInput): void
  setMood(mood: Happiness): void
  update(dtMs: number): void
}

export function createCharacterFsm(rng: () => number = Math.random): CharacterFsm {
  let state: CharState = 'idle'
  let mood: Happiness = 'ok'
  let phaseMs = 0
  const queue: CareInput[] = []

  function ambientDurationMs(s: CharState): number {
    return s === 'walk' ? 1500 + rng() * 1500 : 2000 + rng() * 2000
  }

  let remainMs = ambientDurationMs('idle')

  function nextAmbient(): CharState {
    if (mood === 'sad' || mood === 'grimy') return 'sad'
    return state === 'walk' ? 'idle' : 'walk'
  }

  return {
    get state() {
      return state
    },
    get phaseMs() {
      return phaseMs
    },
    enqueue(input) {
      queue.push(input)
    },
    setMood(m) {
      mood = m
    },
    update(dtMs) {
      // If not in action and queue has items, start the next one
      const inAction = ACTION_STATES.includes(state)
      if (!inAction && queue.length > 0) {
        const flow = ACTION_FLOW[queue.shift()!]
        state = flow.state
        remainMs = flow.ms
        phaseMs = 0 // 큐 시작은 프레임 시작 시점 전이 → 아래 += dtMs로 이 프레임분만 누적된다
      }

      remainMs -= dtMs
      phaseMs += dtMs

      // Process all transitions that occur within this update call
      // Durations are always > 0, so this terminates
      while (remainMs <= 0) {
        // 이월 전이: 새 상태는 이미 overshoot만큼 지난 상태이므로 위상도 그만큼에서 시작한다
        const overshoot = Math.abs(remainMs) // remainMs <= 0 — abs로 -0도 0으로 정규화
        if (state === 'eat' || state === 'petted') {
          // Action phase -> happy, carrying overflow
          state = 'happy'
          remainMs += HAPPY_MS
        } else if (state === 'happy') {
          // Happy expired -> check queue or ambient, carrying overflow
          if (queue.length > 0) {
            const flow = ACTION_FLOW[queue.shift()!]
            state = flow.state
            remainMs += flow.ms
          } else {
            state = nextAmbient()
            remainMs += ambientDurationMs(state)
          }
        } else {
          // Ambient state (idle/walk/sad) -> toggle, carrying overflow
          state = nextAmbient()
          remainMs += ambientDurationMs(state)
        }
        phaseMs = overshoot
      }
    },
  }
}
