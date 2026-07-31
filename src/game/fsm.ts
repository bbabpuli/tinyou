import type { Happiness } from '../domain/happiness'

export type CharState = 'idle' | 'walk' | 'eat' | 'petted' | 'happy' | 'sad' | 'deliver'
export type CareInput = 'feed' | 'pet'

const ACTION_FLOW: Record<CareInput, { state: CharState; ms: number }> = {
  feed: { state: 'eat', ms: 2000 },
  pet: { state: 'petted', ms: 1200 },
}
const HAPPY_MS = 1500
// 'deliver'도 포함: 편지를 들고 있는 동안은 큐/앰비언트 자동 전이를 막아야 한다(원격 종료는 endDeliver로만).
const ACTION_STATES: CharState[] = ['eat', 'petted', 'happy', 'deliver']

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
  /** 편지 배달 연출 진입 요청. 평상시엔 즉시, 액션 중이면 액션(및 큐) 종료 후 자동 진입한다. */
  startDeliver(): void
  /** 편지 배달 연출 종료 → happy 1500ms를 거쳐 평상 상태로 복귀한다. */
  endDeliver(): void
}

export function createCharacterFsm(rng: () => number = Math.random): CharacterFsm {
  let state: CharState = 'idle'
  let mood: Happiness = 'ok'
  let phaseMs = 0
  const queue: CareInput[] = []
  let deliverPending = false // 큐가 항상 pending deliver보다 우선
  let delivering = false

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
    startDeliver() {
      if (delivering) return // 이미 배달 연출 중이면 무시(중복 pending으로 endDeliver 직후 재진입하는 것을 방지)
      deliverPending = true
    },
    endDeliver() {
      if (delivering) {
        delivering = false
        state = 'happy'
        remainMs = HAPPY_MS
        phaseMs = 0
      } else {
        // 아직 deliver에 진입하지 않은 시점(startDeliver 직후, update 전)의 취소 — pending만 지운다.
        deliverPending = false
      }
    },
    update(dtMs) {
      // If not in action and queue has items, start the next one
      const inAction = ACTION_STATES.includes(state)
      if (!inAction && queue.length > 0) {
        const flow = ACTION_FLOW[queue.shift()!]
        state = flow.state
        remainMs = flow.ms
        phaseMs = 0 // 큐 시작은 프레임 시작 시점 전이 → 아래 += dtMs로 이 프레임분만 누적된다
      } else if (!inAction && deliverPending) {
        // 평상시 startDeliver() → 즉시 deliver 진입. remainMs는 무한 대체(앰비언트 전이 없음).
        state = 'deliver'
        remainMs = Number.POSITIVE_INFINITY
        phaseMs = 0
        delivering = true
        deliverPending = false
      }

      remainMs -= dtMs
      phaseMs += dtMs

      // Process all transitions that occur within this update call
      // Durations are always > 0 (or Infinity while delivering, which the loop condition below
      // never satisfies since Infinity - dt stays Infinity), so this terminates.
      while (remainMs <= 0) {
        // 이월 전이: 새 상태는 이미 overshoot만큼 지난 상태이므로 위상도 그만큼에서 시작한다
        const overshoot = Math.abs(remainMs) // remainMs <= 0 — abs로 -0도 0으로 정규화
        if (state === 'eat' || state === 'petted') {
          // Action phase -> happy, carrying overflow
          state = 'happy'
          remainMs += HAPPY_MS
        } else if (state === 'happy') {
          // Happy expired -> check queue, then pending delivery, then ambient, carrying overflow
          if (queue.length > 0) {
            const flow = ACTION_FLOW[queue.shift()!]
            state = flow.state
            remainMs += flow.ms
          } else if (deliverPending) {
            state = 'deliver'
            remainMs = Number.POSITIVE_INFINITY
            delivering = true
            deliverPending = false
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
