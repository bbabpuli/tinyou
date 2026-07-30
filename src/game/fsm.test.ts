import { expect, test } from 'vitest'
import { createCharacterFsm } from './fsm'

const fixedRng = () => 0.5 // idle 3000ms, walk 2250ms로 고정됨

test('초기 상태는 idle', () => {
  const fsm = createCharacterFsm(fixedRng)
  expect(fsm.state).toBe('idle')
})

test('feed 입력 → eat 2000ms → happy 1500ms → 평상 복귀', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('feed')
  fsm.update(16)
  expect(fsm.state).toBe('eat')
  fsm.update(2000)
  expect(fsm.state).toBe('happy')
  fsm.update(1500)
  expect(['idle', 'walk']).toContain(fsm.state)
})

test('pet 입력 → petted 1200ms → happy', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('pet')
  fsm.update(16)
  expect(fsm.state).toBe('petted')
  fsm.update(1200)
  expect(fsm.state).toBe('happy')
})

test('액션 중 새 입력은 큐에 대기 후 순차 실행', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('feed')
  fsm.update(16)
  fsm.enqueue('pet') // eat 중에 도착
  fsm.update(2000) // eat 끝 → happy
  expect(fsm.state).toBe('happy')
  fsm.update(1500) // happy 끝 → 큐의 pet 시작
  fsm.update(16)
  expect(fsm.state).toBe('petted')
})

test('평상시 idle↔walk 교대', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.update(3000) // idle 고정 지속시간 소진
  expect(fsm.state).toBe('walk')
  fsm.update(2250)
  expect(fsm.state).toBe('idle')
})

test('기분이 sad/grimy면 평상 상태가 sad', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.setMood('grimy')
  fsm.update(3000) // idle 소진 → 평상 전이
  expect(fsm.state).toBe('sad')
})

test('sad여도 돌봄 액션은 정상 재생 (돌아오면 반겨줌)', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.setMood('sad')
  fsm.enqueue('feed')
  fsm.update(16)
  expect(fsm.state).toBe('eat')
})
