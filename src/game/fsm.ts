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
  enqueue(input: CareInput): void
  setMood(mood: Happiness): void
  update(dtMs: number): void
}

export function createCharacterFsm(rng: () => number = Math.random): CharacterFsm {
  let state: CharState = 'idle'
  let mood: Happiness = 'ok'
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
    enqueue(input) {
      queue.push(input)
    },
    setMood(m) {
      mood = m
    },
    update(dtMs) {
      const inAction = ACTION_STATES.includes(state)
      if (!inAction && queue.length > 0) {
        const flow = ACTION_FLOW[queue.shift()!]
        state = flow.state
        remainMs = flow.ms
        return
      }
      remainMs -= dtMs
      if (remainMs > 0) return
      if (state === 'eat' || state === 'petted') {
        state = 'happy'
        remainMs = HAPPY_MS
        return
      }
      state = nextAmbient()
      remainMs = ambientDurationMs(state)
    },
  }
}
