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

test('happy 종료와 동시에 큐 액션이 같은 update에서 시작 (앰비언트 글리치 없음)', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('feed')
  fsm.update(16)
  fsm.enqueue('pet')
  fsm.update(2000) // eat 종료 → happy
  fsm.update(1500) // happy 종료 → 큐의 pet이 즉시 시작되어야 함
  expect(fsm.state).toBe('petted')
})

test('큰 dt는 오버플로를 다음 단계로 이월', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('feed')
  fsm.update(16) // eat 시작 (2000ms)
  fsm.update(2500) // eat 소진 + happy에 500ms 이월 → happy 잔여 1000ms
  expect(fsm.state).toBe('happy')
  fsm.update(1000) // happy 정확히 소진
  expect(['idle', 'walk']).toContain(fsm.state)
})

test('phaseMs는 0에서 시작해 dt만큼 누적', () => {
  const fsm = createCharacterFsm(fixedRng)
  expect(fsm.phaseMs).toBe(0)
  fsm.update(16)
  fsm.update(16)
  expect(fsm.phaseMs).toBe(32)
})

test('평상 전이에서 phaseMs가 리셋 (idle→walk 순간 위상 점프 없음)', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.update(2900)
  expect(fsm.state).toBe('idle')
  expect(fsm.phaseMs).toBe(2900)
  fsm.update(100) // idle 3000ms 정확히 소진 → walk 시작
  expect(fsm.state).toBe('walk')
  expect(fsm.phaseMs).toBe(0)
})

test('큐 시작 전이에서 phaseMs 리셋', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.update(1000)
  expect(fsm.phaseMs).toBe(1000)
  fsm.enqueue('feed')
  fsm.update(16) // eat 시작
  expect(fsm.state).toBe('eat')
  expect(fsm.phaseMs).toBe(16) // 리셋 후 이번 프레임분만
})

test('eat→happy 전이에서 phaseMs는 초과분으로 리셋', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('feed')
  fsm.update(16) // eat 시작, 잔여 1984ms
  fsm.update(2000) // eat 소진 + 16ms 초과 → happy
  expect(fsm.state).toBe('happy')
  expect(fsm.phaseMs).toBe(16) // 이월된 초과분만큼만 진행된 상태
})

test('한 update에서 다단 전이해도 phaseMs는 마지막 상태 기준', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('feed')
  fsm.update(16) // eat 시작 (잔여 1984)
  fsm.update(1984 + 1500 + 300) // eat·happy 모두 소진 → 평상 상태로 300ms 진입
  expect(['idle', 'walk']).toContain(fsm.state)
  expect(fsm.phaseMs).toBe(300)
})

test('startDeliver: 평상시 즉시 deliver 진입, 시간 경과에도 유지', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.startDeliver()
  fsm.update(16)
  expect(fsm.state).toBe('deliver')
  fsm.update(10000)
  expect(fsm.state).toBe('deliver')
})

test('endDeliver → happy → 평상 복귀', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.startDeliver()
  fsm.update(16)
  fsm.endDeliver()
  fsm.update(16)
  expect(fsm.state).toBe('happy')
  fsm.update(1500)
  fsm.update(16)
  expect(['idle', 'walk']).toContain(fsm.state)
})

test('액션(eat) 중 startDeliver는 액션 끝난 뒤 진입', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.enqueue('feed')
  fsm.update(16)
  fsm.startDeliver()
  expect(fsm.state).toBe('eat')
  fsm.update(2000) // eat 끝 → happy
  fsm.update(1500) // happy 끝 → deliver 대기 있으면 deliver
  fsm.update(16)
  expect(fsm.state).toBe('deliver')
})

test('진입 전 endDeliver는 pending을 취소', () => {
  const fsm = createCharacterFsm(fixedRng)
  fsm.startDeliver()
  fsm.endDeliver() // 아직 update 전 — 취소
  fsm.update(16)
  expect(fsm.state).not.toBe('deliver')
})
