# 배고픔 지수 + 무한 쓰다듬기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 밥주기를 "하루 1회"에서 "배고플 때만(마지막 밥 후 8시간)"으로 바꾸고, 쓰다듬기를 "하루 2회 XP 스택 + 이후 무한(기록 없음)"으로 바꾸며, 쓰다듬을 때마다 상대에게 앱 내 실시간 토스트를 보낸다.

**Architecture:** 배고픔은 `happiness.ts`와 동일한 타임스탬프 파생 계산(`src/domain/hunger.ts` 신규, 서버 크론 없음). 쓰다듬 스택은 careLog의 오늘 pet 기록 수로 판정. 실시간 알림은 커플 공용 토픽의 broadcast 전용 Realtime 채널(신규 훅)로 보내고, 30초 병합 윈도는 순수 함수로 분리해 테스트한다. DB는 마이그레이션 1건: 하루 1회 유니크 제약을 굿나잇 전용 부분 인덱스로 교체.

**Tech Stack:** React 18 + TypeScript + Vite, zustand, Supabase (Postgres/Realtime), Vitest

**Spec:** `docs/superpowers/specs/2026-08-04-hunger-pet-design.md`

## Global Constraints

- 서버 크론 없음 — 모든 상태는 careLog 타임스탬프에서 파생 계산
- 배고픔 단계: `full`(0~4h 미만) / `ok`(4~8h 미만) / `hungry`(8h~). 밥 기록 없으면 `hungry`
- 쓰다듬 XP 스택: 하루(Asia/Seoul) 최대 2회만 DB 기록. 이후 무한 쓰다듬(로컬 애니메이션만)
- 토스트 문구: 첫 이벤트 `"{닉네임}님이 쓰다듬었어요 🥰"`, 30초 내 추가 이벤트 `"{닉네임}님이 잔뜩 쓰다듬고 있어요 🥰"`
- "오늘" 판정은 반드시 `dateKeySeoul` 사용
- XP 계산식(기록당 10) 무변경. 레벨 커브 무변경
- 테스트 실행: `npx vitest run <파일>` (전체: `npm test`)
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: DB 마이그레이션 — 하루 1회 유니크 제약 교체

**Files:**
- Create: `supabase/migrations/20260804000001_care_unique_goodnight_only.sql`

**Interfaces:**
- Produces: `care_actions`에 feed/pet 하루 2+회 insert 가능, goodnight은 하루 1회 유니크 유지

**배경:** `20260730000001_init.sql:36`의 `unique (character_id, user_id, type, care_date)`가
모든 타입의 하루 1회를 DB에서 강제한다. 밥 2회·쓰다듬 2회를 허용하려면 제거해야 하고,
굿나잇만 부분 유니크 인덱스로 유지한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 밥·쓰다듬은 하루 여러 번 기록 가능해야 한다 (배고픔 게이트·쓰다듬 2회 스택은
-- 클라이언트 파생 계산이 담당). 굿나잇만 하루 1회를 DB에서 계속 강제한다.
alter table care_actions
  drop constraint care_actions_character_id_user_id_type_care_date_key;

create unique index care_actions_goodnight_daily
  on care_actions (character_id, user_id, care_date)
  where type = 'goodnight';
```

- [ ] **Step 2: 제약 이름 확인 후 원격 적용**

제약 이름이 다를 수 있으니 먼저 확인:
```bash
supabase db push --dry-run
```
실패 시 실제 제약 이름 조회(Supabase 대시보드 SQL Editor 또는):
```bash
echo "select conname from pg_constraint where conrelid = 'care_actions'::regclass and contype = 'u';" | supabase db query 2>/dev/null || true
```
이름이 다르면 SQL의 제약 이름을 맞춘 뒤:
```bash
supabase db push
```
Expected: 마이그레이션 적용 성공 (프로젝트 ref `hhdspjlnxgcwpbughsdb`, 이미 링크됨)

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260804000001_care_unique_goodnight_only.sql
git commit -m "feat: care_actions 하루 1회 유니크를 굿나잇 전용으로 축소"
```

---

### Task 2: 배고픔 도메인 (`hunger.ts`)

**Files:**
- Create: `src/domain/hunger.ts`
- Test: `src/domain/hunger.test.ts`

**Interfaces:**
- Consumes: `CareAction` (from `src/domain/care.ts` — `{ userId: string; type: 'feed'|'pet'|'goodnight'; createdAt: Date }`)
- Produces:
  - `type HungerLevel = 'full' | 'ok' | 'hungry'`
  - `lastFedAt(actions: CareAction[]): Date | null`
  - `hungerFrom(lastFed: Date | null, now: Date): HungerLevel`
  - `canFeedNow(actions: CareAction[], now: Date): boolean`
  - `hoursUntilHungry(lastFed: Date | null, now: Date): number` (올림 정수, 배고프면 0)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/domain/hunger.test.ts`

```typescript
import { expect, test } from 'vitest'
import type { CareAction } from './care'
import { canFeedNow, hoursUntilHungry, hungerFrom, lastFedAt } from './hunger'

const NOW = new Date('2026-08-04T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000)
const feed = (at: Date): CareAction => ({ userId: 'me', type: 'feed', createdAt: at })
const pet = (at: Date): CareAction => ({ userId: 'me', type: 'pet', createdAt: at })

test('밥 기록이 없으면 hungry — 첫 밥은 바로 가능', () => {
  expect(hungerFrom(null, NOW)).toBe('hungry')
  expect(canFeedNow([], NOW)).toBe(true)
})

test('경계값: 4h 미만 full, 4h~8h 미만 ok, 8h부터 hungry', () => {
  expect(hungerFrom(hoursAgo(3.99), NOW)).toBe('full')
  expect(hungerFrom(hoursAgo(4), NOW)).toBe('ok')
  expect(hungerFrom(hoursAgo(7.99), NOW)).toBe('ok')
  expect(hungerFrom(hoursAgo(8), NOW)).toBe('hungry')
})

test('lastFedAt은 feed만 보고 최신 시각을 고른다', () => {
  expect(lastFedAt([])).toBe(null)
  expect(lastFedAt([pet(hoursAgo(1))])).toBe(null)
  expect(lastFedAt([feed(hoursAgo(10)), pet(hoursAgo(1)), feed(hoursAgo(5))]))
    .toEqual(hoursAgo(5))
})

test('canFeedNow는 hungry일 때만 true', () => {
  expect(canFeedNow([feed(hoursAgo(2))], NOW)).toBe(false)
  expect(canFeedNow([feed(hoursAgo(9))], NOW)).toBe(true)
})

test('hoursUntilHungry: 남은 시간 올림, 배고프면 0', () => {
  expect(hoursUntilHungry(null, NOW)).toBe(0)
  expect(hoursUntilHungry(hoursAgo(9), NOW)).toBe(0)
  expect(hoursUntilHungry(hoursAgo(6.5), NOW)).toBe(2) // 1.5h 남음 → 올림 2
  expect(hoursUntilHungry(hoursAgo(0), NOW)).toBe(8)
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/domain/hunger.test.ts`
Expected: FAIL — `Cannot find module './hunger'` 류

- [ ] **Step 3: 최소 구현** — `src/domain/hunger.ts`

```typescript
import type { CareAction } from './care'

export type HungerLevel = 'full' | 'ok' | 'hungry'

export const FULL_HOURS = 4
export const HUNGRY_HOURS = 8

/** careLog에서 마지막 feed 시각. 밥 기록이 없으면 null. */
export function lastFedAt(actions: CareAction[]): Date | null {
  let max: Date | null = null
  for (const a of actions) {
    if (a.type === 'feed' && (max === null || a.createdAt > max)) max = a.createdAt
  }
  return max
}

/** 마지막 밥 시각에서 파생 계산. 저장하지 않는다 (서버 크론 없음, hungry가 최대 — 벌점 없음). */
export function hungerFrom(lastFed: Date | null, now: Date): HungerLevel {
  if (lastFed === null) return 'hungry'
  const hours = (now.getTime() - lastFed.getTime()) / 3600_000
  if (hours < FULL_HOURS) return 'full'
  if (hours < HUNGRY_HOURS) return 'ok'
  return 'hungry'
}

/** 밥주기 게이트: 배고플 때만 밥 가능 (하루 두 끼 리듬). */
export function canFeedNow(actions: CareAction[], now: Date): boolean {
  return hungerFrom(lastFedAt(actions), now) === 'hungry'
}

/** 배고파질 때까지 남은 시간(올림 정수, 시 단위). UI 안내 문구용. */
export function hoursUntilHungry(lastFed: Date | null, now: Date): number {
  if (lastFed === null) return 0
  const hours = (now.getTime() - lastFed.getTime()) / 3600_000
  return Math.max(0, Math.ceil(HUNGRY_HOURS - hours))
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/domain/hunger.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/domain/hunger.ts src/domain/hunger.test.ts
git commit -m "feat: 배고픔 파생 계산 도메인 (full/ok/hungry, 8h 두 끼 리듬)"
```

---

### Task 3: 쓰다듬 스택 도메인 (`care.ts`)

**Files:**
- Modify: `src/domain/care.ts` (기존 export 유지, 추가만)
- Test: `src/domain/care.test.ts` (기존 테스트 유지, 추가만)

**Interfaces:**
- Consumes: `dateKeySeoul` (from `./dateKey`), 기존 `CareAction`
- Produces:
  - `PET_STACK_PER_DAY = 2`
  - `petStackToday(actions: CareAction[], userId: string, now: Date): number` — 오늘(서울) 기록된 내 pet 수
  - `canPetStackToday(actions: CareAction[], userId: string, now: Date): boolean` — 위 값 < 2

- [ ] **Step 1: 실패하는 테스트 추가** — `src/domain/care.test.ts` 끝에 append

```typescript
import { canPetStackToday, petStackToday } from './care'

// 2026-08-04 12:00Z = 서울 21:00. 서울 자정 경계는 15:00Z.
const PET_NOW = new Date('2026-08-04T12:00:00Z')
const petAt = (iso: string, userId = 'me') =>
  ({ userId, type: 'pet' as const, createdAt: new Date(iso) })

test('petStackToday: 오늘(서울) 내 pet 기록만 센다', () => {
  const log = [
    petAt('2026-08-04T10:00:00Z'),            // 오늘(서울 19:00)
    petAt('2026-08-03T14:00:00Z'),            // 어제(서울 23:00) — 제외
    petAt('2026-08-04T11:00:00Z', 'partner'), // 남의 기록 — 제외
    { userId: 'me', type: 'feed' as const, createdAt: new Date('2026-08-04T10:30:00Z') }, // 다른 타입 — 제외
  ]
  expect(petStackToday(log, 'me', PET_NOW)).toBe(1)
})

test('서울 자정 경계: 14:59Z는 같은 날, 15:00Z는 다음 날', () => {
  const now = new Date('2026-08-04T16:00:00Z') // 서울 8/5 01:00
  expect(petStackToday([petAt('2026-08-04T14:59:00Z')], 'me', now)).toBe(0) // 서울 8/4 23:59 — 어제
  expect(petStackToday([petAt('2026-08-04T15:00:00Z')], 'me', now)).toBe(1) // 서울 8/5 00:00 — 오늘
})

test('canPetStackToday: 2회 미만이면 true, 2회부터 false', () => {
  expect(canPetStackToday([], 'me', PET_NOW)).toBe(true)
  expect(canPetStackToday([petAt('2026-08-04T09:00:00Z')], 'me', PET_NOW)).toBe(true)
  expect(canPetStackToday(
    [petAt('2026-08-04T09:00:00Z'), petAt('2026-08-04T10:00:00Z')], 'me', PET_NOW,
  )).toBe(false)
})
```

(파일 상단에 이미 같은 모듈 import가 있으면 거기에 심볼만 합친다.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/domain/care.test.ts`
Expected: FAIL — `petStackToday is not a function` 류. 기존 테스트는 계속 PASS여야 한다.

- [ ] **Step 3: 최소 구현** — `src/domain/care.ts`에 추가

```typescript
export const PET_STACK_PER_DAY = 2

/** 오늘(Asia/Seoul) 기록된 내 쓰다듬 수 — XP 스택 판정용 */
export function petStackToday(actions: CareAction[], userId: string, now: Date): number {
  const today = dateKeySeoul(now)
  return actions.filter(
    (a) => a.userId === userId && a.type === 'pet' && dateKeySeoul(a.createdAt) === today,
  ).length
}

/** 쓰다듬 XP 스택이 남았는가. 소진돼도 쓰다듬기 자체는 무한 허용(기록만 안 함). */
export function canPetStackToday(actions: CareAction[], userId: string, now: Date): boolean {
  return petStackToday(actions, userId, now) < PET_STACK_PER_DAY
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/domain/care.test.ts`
Expected: PASS (기존 + 신규 3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/domain/care.ts src/domain/care.test.ts
git commit -m "feat: 쓰다듬 하루 2회 XP 스택 판정"
```

---

### Task 4: store 게이트 교체

**Files:**
- Modify: `src/state/store.ts:64-86` (`care` 액션)
- Test: `src/state/store.test.ts` (기존 테스트 유지, 추가만)

**Interfaces:**
- Consumes: `canFeedNow` (Task 2), `canPetStackToday` (Task 3), 기존 `canCareToday`
- Produces: `care('feed')`는 배고플 때만 true, `care('pet')`은 스택 소진 후에도 true(단 insert·careLog 기록 없이 pending만 추가), `care('goodnight')`는 기존 하루 1회 유지

- [ ] **Step 1: 실패하는 테스트 추가** — `src/state/store.test.ts` 끝에 append

```typescript
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000)

test('feed: 배부르면(마지막 밥 4h 미만) insert 없이 거부', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({
    insertCare: insert,
    careLog: [{ userId: 'me', type: 'feed', createdAt: hoursAgo(2) }],
  })
  expect(await useGame.getState().care('feed', NOW)).toBe(false)
  expect(insert).not.toHaveBeenCalled()
})

test('feed: 8시간 지나 배고프면 같은 날에도 다시 가능', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({
    insertCare: insert,
    careLog: [{ userId: 'me', type: 'feed', createdAt: hoursAgo(9) }],
  })
  expect(await useGame.getState().care('feed', NOW)).toBe(true)
  expect(insert).toHaveBeenCalledTimes(1)
})

test('pet: 하루 2회까지 기록, 3회째는 insert 없이 애니메이션(pending)만', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  expect(await useGame.getState().care('pet', NOW)).toBe(true)
  expect(await useGame.getState().care('pet', NOW)).toBe(true)
  expect(insert).toHaveBeenCalledTimes(2)
  expect(useGame.getState().careLog).toHaveLength(2)

  expect(await useGame.getState().care('pet', NOW)).toBe(true) // 3회째도 성공으로 응답
  expect(insert).toHaveBeenCalledTimes(2)                      // 하지만 insert 없음
  expect(useGame.getState().careLog).toHaveLength(2)           // 기록도 없음 (XP 안 오름)
  expect(useGame.getState().pending).toEqual(['pet', 'pet', 'pet']) // 애니메이션은 3번 다
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/state/store.test.ts`
Expected: 신규 3개 FAIL (feed는 canCareToday에 막혀 두 번째 거부, pet 3회째 거부). 기존 5개 중 "오늘 이미 한 종류는 insert 없이 거부"는 feed만 쓰므로 계속 PASS.

- [ ] **Step 3: 구현** — `src/state/store.ts`의 `care`를 다음으로 교체

```typescript
  async care(type, now = new Date()) {
    const { careLog, characterId, userId, insertCare } = get()
    if (!characterId || !userId) return false
    // goodnight은 FSM 액션 애니메이션(eat/petted)이 없다 — 취침 장면 재판정으로 반영되므로 큐에 넣지 않는다.
    const isCareInput = (t: CareType): t is CareInput => t === 'feed' || t === 'pet'

    // 게이트: 밥=배고플 때만(두 끼 리듬), 굿나잇=하루 1회, 쓰다듬=항상 통과
    if (type === 'feed' && !canFeedNow(careLog, now)) return false
    if (type === 'goodnight' && !canCareToday(careLog, userId, type, now)) return false
    if (type === 'pet' && !canPetStackToday(careLog, userId, now)) {
      // 스택 소진 — 무한 쓰다듬기: 기록·XP 없이 로컬 애니메이션만 재생
      set((s) => ({ pending: [...s.pending, 'pet' as CareInput] }))
      return true
    }

    const action: CareAction = { userId, type, createdAt: now }
    set((s) => ({
      careLog: [...s.careLog, action],
      pending: isCareInput(type) ? [...s.pending, type] : s.pending,
    }))
    const result = await insertCare({ characterId, userId, type })
    if (!result.ok) {
      set((s) => ({
        careLog: s.careLog.filter((a) => a !== action),
        pending: isCareInput(type)
          ? s.pending.filter((p, i) => !(p === type && i === s.pending.lastIndexOf(type)))
          : s.pending,
      }))
      return false
    }
    return true
  },
```

import 라인 수정:

```typescript
import { canCareToday, canPetStackToday, lastCaredAt, xpFromActions, type CareAction, type CareType } from '../domain/care'
import { canFeedNow } from '../domain/hunger'
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS (기존 5 + 신규 3)

- [ ] **Step 5: 전체 테스트로 회귀 확인**

Run: `npm test`
Expected: 전체 그린 (CareButtons 등 UI는 아직 canCareToday를 쓰지만 컴파일·기존 테스트에 영향 없음)

- [ ] **Step 6: 커밋**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat: store 돌봄 게이트 교체 — 밥은 배고플 때만, 쓰다듬은 2스택+무한"
```

---

### Task 5: 쓰다듬 토스트 병합 로직 (순수 함수)

**Files:**
- Create: `src/traces/petToast.ts`
- Test: `src/traces/petToast.test.ts`

**Interfaces:**
- Produces:
  - `PET_MERGE_WINDOW_MS = 30_000`, `PET_TOAST_VISIBLE_MS = 4_000`
  - `interface PetToastState { text: string; lastEventAt: number }`
  - `applyPetEvent(state: PetToastState | null, nickname: string, nowMs: number): PetToastState`
  - `isPetToastVisible(state: PetToastState | null, nowMs: number): boolean`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/traces/petToast.test.ts`

```typescript
import { expect, test } from 'vitest'
import { applyPetEvent, isPetToastVisible, PET_MERGE_WINDOW_MS, PET_TOAST_VISIBLE_MS } from './petToast'

const T0 = 1_000_000

test('첫 이벤트: 단건 문구', () => {
  const s = applyPetEvent(null, '동글', T0)
  expect(s.text).toBe('동글님이 쓰다듬었어요 🥰')
  expect(s.lastEventAt).toBe(T0)
})

test('30초 안에 또 오면 잔뜩 문구로 병합', () => {
  const s1 = applyPetEvent(null, '동글', T0)
  const s2 = applyPetEvent(s1, '동글', T0 + 5_000)
  expect(s2.text).toBe('동글님이 잔뜩 쓰다듬고 있어요 🥰')
})

test('병합 윈도(30s)가 지나면 다시 단건 문구', () => {
  const s1 = applyPetEvent(null, '동글', T0)
  const s2 = applyPetEvent(s1, '동글', T0 + PET_MERGE_WINDOW_MS)
  expect(s2.text).toBe('동글님이 쓰다듬었어요 🥰')
})

test('표시 시간: 마지막 이벤트 후 4초까지만 보인다', () => {
  const s = applyPetEvent(null, '동글', T0)
  expect(isPetToastVisible(s, T0)).toBe(true)
  expect(isPetToastVisible(s, T0 + PET_TOAST_VISIBLE_MS - 1)).toBe(true)
  expect(isPetToastVisible(s, T0 + PET_TOAST_VISIBLE_MS)).toBe(false)
  expect(isPetToastVisible(null, T0)).toBe(false)
})

test('연타 중에는 표시가 계속 연장된다', () => {
  const s1 = applyPetEvent(null, '동글', T0)
  const s2 = applyPetEvent(s1, '동글', T0 + 3_000)
  expect(isPetToastVisible(s2, T0 + 6_000)).toBe(true) // 마지막 이벤트 기준 3초 경과
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/traces/petToast.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현** — `src/traces/petToast.ts`

```typescript
/** 쓰다듬 실시간 토스트의 병합·표시 판정. UI와 분리된 순수 로직. */

export const PET_MERGE_WINDOW_MS = 30_000
export const PET_TOAST_VISIBLE_MS = 4_000

export interface PetToastState {
  text: string
  lastEventAt: number
}

/** 이벤트 수신: 30초 안에 연달아 오면 새 토스트를 띄우지 않고 잔뜩 문구로 병합한다(연타 스팸 방지). */
export function applyPetEvent(
  state: PetToastState | null,
  nickname: string,
  nowMs: number,
): PetToastState {
  const merged = state !== null && nowMs - state.lastEventAt < PET_MERGE_WINDOW_MS
  return {
    text: merged
      ? `${nickname}님이 잔뜩 쓰다듬고 있어요 🥰`
      : `${nickname}님이 쓰다듬었어요 🥰`,
    lastEventAt: nowMs,
  }
}

/** 마지막 이벤트 후 4초까지 표시 — 연타 중에는 계속 연장된다. */
export function isPetToastVisible(state: PetToastState | null, nowMs: number): boolean {
  return state !== null && nowMs - state.lastEventAt < PET_TOAST_VISIBLE_MS
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/traces/petToast.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/traces/petToast.ts src/traces/petToast.test.ts
git commit -m "feat: 쓰다듬 토스트 30초 병합·4초 표시 순수 로직"
```

---

### Task 6: 쓰다듬 broadcast 채널 + 토스트 컴포넌트 + App 배선

**Files:**
- Create: `src/realtime/usePetChannel.ts`
- Create: `src/traces/PetToast.tsx`
- Modify: `src/App.tsx` (배선)

**Interfaces:**
- Consumes: `applyPetEvent`/`isPetToastVisible`/`PetToastState` (Task 5), `useTick` (from `../hooks/useTick`), `supabase` (from `../lib/supabase`)
- Produces:
  - `usePetChannel(coupleId: string | undefined, userId: string | undefined, onPet: () => void): { sendPet: () => void }`
  - `<PetToast state={PetToastState | null} />`
  - `<CareButtons onPetSent={() => void} />`용 `sendPet` (버튼 연결은 Task 7)

훅·컴포넌트 배선은 기존 `useCoupleChannel`/`TraceToast`처럼 유닛 테스트 없이 간다
(로직은 Task 5 순수 함수가 커버). 수동 검증은 Task 7 Step 5에서 일괄 수행.

- [ ] **Step 1: 채널 훅 작성** — `src/realtime/usePetChannel.ts`

```typescript
import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/**
 * 쓰다듬 실시간 알림 전용 broadcast 채널.
 *
 * useCoupleChannel과 달리 커플 공용 토픽(`couple:<id>:pets`)을 쓴다 — broadcast는
 * 같은 토픽 구독자에게만 전달되므로, useCoupleChannel의 유저별 유니크 토픽으로는
 * 상대에게 닿지 않는다. postgres_changes를 전혀 붙이지 않는 broadcast 전용 채널이라
 * 공유 토픽 postgres_changes 유실 버그(realtime#1524)와도 무관하다.
 *
 * self: false(기본값이지만 명시)로 내가 보낸 이벤트는 수신하지 않고, 만약을 위해
 * payload.userId로도 한 번 더 거른다. 전송은 best-effort — 채널이 죽어 있으면
 * 조용히 버려지고, 기록된 스택 쓰다듬은 다음 접속 때 TraceToast 요약이 보정한다.
 */
export function usePetChannel(
  coupleId: string | undefined,
  userId: string | undefined,
  onPet: () => void,
): { sendPet: () => void } {
  const onPetRef = useRef(onPet)
  useEffect(() => {
    onPetRef.current = onPet
  })
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef(userId)
  useEffect(() => {
    userIdRef.current = userId
  })

  useEffect(() => {
    if (!coupleId || !userId) return
    const channel = supabase
      .channel(`couple:${coupleId}:pets`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'pet' }, (msg) => {
        if ((msg.payload as { userId?: string } | undefined)?.userId !== userId) {
          onPetRef.current()
        }
      })
      .subscribe((status, err) => {
        if (status !== 'SUBSCRIBED') console.warn('[realtime:pets]', status, err)
      })
    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [coupleId, userId])

  const sendPet = () => {
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'pet',
      payload: { userId: userIdRef.current },
    })
  }
  return { sendPet }
}
```

- [ ] **Step 2: 토스트 컴포넌트 작성** — `src/traces/PetToast.tsx`

```tsx
import { useTick } from '../hooks/useTick'
import { isPetToastVisible, type PetToastState } from './petToast'

/** 쓰다듬 실시간 토스트 — 상태 관리(applyPetEvent)는 App이, 표시 판정·소멸은 여기서. */
export function PetToast({ state }: { state: PetToastState | null }) {
  useTick(1000) // 이벤트가 멎으면 표시 시간이 끝났을 때 리렌더로 사라져야 한다
  if (!isPetToastVisible(state, Date.now())) return null
  return (
    <div
      role="status"
      style={{ padding: '8px 12px', borderRadius: 8, background: '#ffe4ef', textAlign: 'center' }}
    >
      {state!.text}
    </div>
  )
}
```

- [ ] **Step 3: App 배선** — `src/App.tsx` 수정

import 추가:

```typescript
import { usePetChannel } from './realtime/usePetChannel'
import { PetToast } from './traces/PetToast'
import { applyPetEvent, type PetToastState } from './traces/petToast'
```

`MainApp` 안, `useCoupleChannel(...)` 호출 아래에 (훅은 조건 분기보다 위에 있어야 한다):

```typescript
  // 쓰다듬 실시간 토스트 — 수신 상태는 여기서 들고, 표시 판정은 PetToast가 한다
  const [petToast, setPetToast] = useState<PetToastState | null>(null)
  const partnerNickname = couple?.partner?.nickname
  const { sendPet } = usePetChannel(couple?.coupleId, userId, () => {
    setPetToast((s) => applyPetEvent(s, partnerNickname ?? '연인', Date.now()))
  })
```

본문 JSX의 `<TraceToast ... />` 바로 아래에:

```tsx
      <PetToast state={petToast} />
```

`<CareButtons />`를 `<CareButtons onPetSent={sendPet} />`로 교체
(prop은 Task 7에서 추가되므로, 이 시점엔 타입 에러가 난다 — Task 7 Step 1을 먼저
적용하기 전까지 커밋하지 않고 Task 7과 함께 진행해도 된다. 순서대로 간다면
여기서는 `<CareButtons />`를 그대로 두고 Task 7에서 교체하라.)

- [ ] **Step 4: 컴파일 확인**

Run: `npm run build`
Expected: 타입 에러 없음 (CareButtons prop 교체를 Task 7로 미뤘다면)

- [ ] **Step 5: 커밋**

```bash
git add src/realtime/usePetChannel.ts src/traces/PetToast.tsx src/App.tsx
git commit -m "feat: 쓰다듬 broadcast 채널 + 실시간 토스트 배선"
```

---

### Task 7: UI — CareButtons 게이트/캡션, Hud 배고픔 라벨, Stage 꼬르륵

**Files:**
- Modify: `src/ui/CareButtons.tsx` (전면 교체 수준)
- Modify: `src/ui/Hud.tsx:8,21-27`
- Modify: `src/ui/Stage.tsx` (배지 추가), `src/index.css` (keyframes)
- Modify: `src/App.tsx` (`<CareButtons onPetSent={sendPet} />` 교체 — Task 6에서 미룬 것)

**Interfaces:**
- Consumes: `canFeedNow`/`hoursUntilHungry`/`lastFedAt`/`hungerFrom` (Task 2), `canPetStackToday` (Task 3), `sendPet` (Task 6)
- Produces: `CareButtons`가 `onPetSent?: () => void` prop을 받는다

- [ ] **Step 1: CareButtons 교체** — `src/ui/CareButtons.tsx`

```tsx
import { useMemo } from 'react'
import { canCareToday, canPetStackToday } from '../domain/care'
import { canFeedNow, hoursUntilHungry, lastFedAt } from '../domain/hunger'
import { isGoodnightWindow } from '../game/night'
import { useTick } from '../hooks/useTick'
import { useGame } from '../state/store'

export function CareButtons({ onPetSent }: { onPetSent?: () => void }) {
  useTick(60_000) // 배고픔·자정(Asia/Seoul)·굿나잇 창이 시간만으로 바뀌므로 클릭 없이도 재반영돼야 한다
  const care = useGame((s) => s.care)
  const careLog = useGame((s) => s.careLog)
  const userId = useGame((s) => s.userId)
  const now = new Date()
  const feedable = useMemo(() => !!userId && canFeedNow(careLog, now), [careLog, userId, now])
  const untilHungry = useMemo(() => hoursUntilHungry(lastFedAt(careLog), now), [careLog, now])
  const petStackLeft = useMemo(
    () => !!userId && canPetStackToday(careLog, userId, now),
    [careLog, userId, now],
  )
  const showGoodnight = isGoodnightWindow(now)
  const canGoodnight = useMemo(
    () => !!userId && canCareToday(careLog, userId, 'goodnight', now),
    [careLog, userId, now],
  )
  const handlePet = async () => {
    if (await care('pet')) onPetSent?.()
  }
  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button disabled={!feedable} onClick={() => care('feed')}>🍙 밥 주기</button>
        <button disabled={!userId} onClick={handlePet}>🫳 쓰다듬기</button>
        {showGoodnight && (
          <button disabled={!canGoodnight} onClick={() => care('goodnight')}>🌙 굿나잇 인사</button>
        )}
      </div>
      {!feedable && userId && (
        <small style={{ color: '#888' }}>아직 배불러요 — 약 {untilHungry}시간 후에 배고파져요</small>
      )}
      {!petStackLeft && (
        <small style={{ color: '#888' }}>오늘 쓰다듬기 XP는 다 모았어요 — 그래도 계속 쓰다듬을 수 있어요 🫶</small>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Hud 배고픔 라벨** — `src/ui/Hud.tsx`

import 추가:

```typescript
import { hungerFrom, lastFedAt } from '../domain/hunger'
```

`MOOD_LABEL` 아래에:

```typescript
const HUNGER_LABEL = { full: '배불러요 🍚', ok: '출출해요 🍙', hungry: '배고파요 🥣' }
```

컴포넌트 안 `const mood = ...` 아래에:

```typescript
  const hunger = hungerFrom(lastFedAt(careLog), new Date())
```

상태 라인을 다음으로 교체:

```tsx
      <div>Lv.{level} — {name} — {MOOD_LABEL[mood]} — {HUNGER_LABEL[hunger]}</div>
```

- [ ] **Step 3: Stage 꼬르륵 배지** — `src/ui/Stage.tsx`, `src/index.css`

`Stage` 컴포넌트에 import 추가: `hungerFrom, lastFedAt` (from `../domain/hunger`),
`useTick` (from `../hooks/useTick`).

컴포넌트 본문 상단(다른 훅들 옆)에:

```typescript
  useTick(60_000) // 배고픔 배지는 시간만으로 나타나고 사라진다
  const careLog = useGame((s) => s.careLog)
  const hungry = hungerFrom(lastFedAt(careLog), new Date()) === 'hungry'
```

wrapper `<div style={{ position: 'relative' }}>` 안, `<canvas ... />` 아래에:

```tsx
      {hungry && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 12,
            fontFamily: 'monospace',
            fontSize: 12,
            animation: 'tinyou-growl 6s ease-in-out infinite',
          }}
        >
          꼬르륵…
        </span>
      )}
```

`src/index.css` 끝에 (이따금 나타나는 연출 — 6초 주기 중 약 2초만 보임):

```css
@keyframes tinyou-growl {
  0%, 55%, 100% { opacity: 0; }
  65%, 90% { opacity: 1; }
}
```

- [ ] **Step 4: App의 CareButtons prop 연결** — `src/App.tsx`

`<CareButtons />` → `<CareButtons onPetSent={sendPet} />`

- [ ] **Step 5: 전체 검증**

```bash
npm test && npm run build
```
Expected: 전체 테스트 그린 + 빌드 성공

수동 검증 (dev 서버 `npm run dev`, 두 브라우저 프로필로 동글·기기 로그인):
1. 밥 준 직후 밥 버튼 비활성 + "아직 배불러요 — 약 8시간 후…" 캡션
2. 쓰다듬 3번 연타 → 3번 다 하트 애니메이션, Hud XP는 +20에서 멈춤, 스택 소진 캡션 표시
3. A가 쓰다듬 → B 화면에 즉시 "…님이 쓰다듬었어요 🥰", 연타 시 "잔뜩…" 문구로 병합
4. Hud에 배고픔 라벨, 8시간 경과 캐릭터(또는 careLog 조작)에서 Stage 꼬르륵 배지 확인

- [ ] **Step 6: 커밋**

```bash
git add src/ui/CareButtons.tsx src/ui/Hud.tsx src/ui/Stage.tsx src/index.css src/App.tsx
git commit -m "feat: 배고픔 게이트 UI + 무한 쓰다듬 캡션 + 꼬르륵 연출"
```

---

## Self-Review 결과 (플랜 작성 시 수행)

- 스펙 커버리지: 배고픔 3단계/게이트(Task 2·4·7), 쓰다듬 2스택+무한(Task 3·4·7), broadcast 토스트+30초 병합(Task 5·6), TraceToast 보정(기존 코드 그대로 — 변경 불필요), 스키마 변경(Task 1), 테스트 목록(각 Task) — 전부 매핑됨
- 스펙의 "+10 XP 이펙트"는 Hud XP 증가로 이미 보이므로 별도 이펙트는 만들지 않고 스택 소진 캡션으로 대체 (YAGNI)
- 타입 일관성: `PetToastState`/`applyPetEvent`/`isPetToastVisible`/`canFeedNow`/`canPetStackToday`/`sendPet` 시그니처가 Task 간 동일함을 확인
