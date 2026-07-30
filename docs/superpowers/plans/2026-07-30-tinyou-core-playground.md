# Tinyou Plan 1: 게임 코어 (로컬 플레이그라운드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase 없이 브라우저 로컬에서 완결되는 Tinyou 게임 코어 — 픽셀 캐릭터가 사는 Canvas 스테이지에서 먹이/쓰다듬기 돌봄을 하면 XP·레벨이 오르고, 방치하면 시무룩해지는 플레이그라운드.

**Architecture:** 도메인 로직(날짜 판정·돌봄·레벨·행복도)은 전부 순수 함수로 `src/domain/`에 격리하고 Vitest로 TDD. Canvas 게임(상태머신·애니메이션 수학·파티클)은 `src/game/`에 두고 렌더링을 제외한 로직을 전부 유닛 테스트. React UI와 게임 루프는 zustand 스토어 하나로만 통신한다. 캐릭터는 코드 픽셀맵으로 그린다 (Plan 2에서 AI 생성 이미지로 교체).

**Tech Stack:** Vite + React 18 + TypeScript(strict), zustand, Vitest. 외부 자산·백엔드 없음.

## Global Constraints

- Node 20+, npm 사용. 의존성은 react, react-dom, zustand + dev(vite, typescript, vitest, @vitejs/plugin-react, @types/*) 외 추가 금지
- TypeScript `strict: true`
- 날짜("오늘") 판정은 반드시 `dateKeySeoul()`만 사용 — Asia/Seoul 달력 날짜 기준 (스펙의 타임존 결정)
- 캐릭터는 죽지 않는다. 최악 상태도 `grimy`(꼬질꼬질)까지
- 돌봄은 사용자·종류별 하루 1회 (feed 1 + pet 1)
- 이 계획 범위 밖: Supabase, 인증, AI 이미지 생성, 메시지, 꾸미기, PWA, 배포, `sleep` 상태 (Plan 2/3에서)
- 작업 디렉터리: `/Users/leedongeun/Documents/toy-project/tinyou`

---

### Task 1: Vite + Vitest 스캐폴딩

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `npm run dev`(개발 서버), `npm test`(vitest run) 동작하는 프로젝트 뼈대. 이후 모든 태스크가 이 위에서 작업

- [ ] **Step 1: 프로젝트 파일 작성**

`package.json`:
```json
{
  "name": "tinyou",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tinyou</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`src/App.tsx` (임시 — Task 10에서 교체):
```tsx
export function App() {
  return <h1>Tinyou</h1>
}
```

`.gitignore`:
```
node_modules/
dist/
```

`src/smoke.test.ts`:
```ts
import { expect, test } from 'vitest'

test('vitest runs', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 2: 설치 및 검증**

Run: `npm install && npm test && npm run build`
Expected: 스모크 테스트 1개 PASS, 빌드 성공

- [ ] **Step 3: dev 서버 수동 확인**

Run: `npm run dev` → 브라우저에서 "Tinyou" 표시 확인 후 종료

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: Vite + React + Vitest 스캐폴딩"
```

---

### Task 2: 서울 기준 날짜 키 (`dateKeySeoul`)

**Files:**
- Create: `src/domain/dateKey.ts`
- Test: `src/domain/dateKey.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `dateKeySeoul(date: Date): string` — Asia/Seoul 달력 날짜를 `"YYYY-MM-DD"`로 반환. Task 3의 돌봄 판정이 사용

- [ ] **Step 1: Write the failing test**

`src/domain/dateKey.test.ts`:
```ts
import { expect, test } from 'vitest'
import { dateKeySeoul } from './dateKey'

test('UTC 자정 직전은 서울에선 같은 날 (14:59Z = 23:59 KST)', () => {
  expect(dateKeySeoul(new Date('2026-07-30T14:59:00Z'))).toBe('2026-07-30')
})

test('UTC 15시부터 서울은 다음 날 (15:00Z = 00:00 KST)', () => {
  expect(dateKeySeoul(new Date('2026-07-30T15:00:00Z'))).toBe('2026-07-31')
})

test('연말 경계 (12-31 15:00Z → 서울 새해)', () => {
  expect(dateKeySeoul(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/dateKey.test.ts`
Expected: FAIL — `dateKey` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/domain/dateKey.ts`:
```ts
const seoulFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Asia/Seoul 달력 날짜 키 ("YYYY-MM-DD"). "오늘" 판정은 반드시 이 함수로 통일한다. */
export function dateKeySeoul(date: Date): string {
  return seoulFormatter.format(date)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/dateKey.test.ts`
Expected: PASS (3개)

- [ ] **Step 5: Commit**

```bash
git add src/domain/dateKey.ts src/domain/dateKey.test.ts
git commit -m "feat: Asia/Seoul 기준 날짜 키 유틸"
```

---

### Task 3: 돌봄 판정과 XP (`care`)

**Files:**
- Create: `src/domain/care.ts`
- Test: `src/domain/care.test.ts`

**Interfaces:**
- Consumes: `dateKeySeoul(date: Date): string` (Task 2)
- Produces:
  - `type CareType = 'feed' | 'pet'`
  - `interface CareAction { userId: string; type: CareType; createdAt: Date }`
  - `canCareToday(actions: CareAction[], userId: string, type: CareType, now: Date): boolean`
  - `XP_PER_CARE = 10`, `xpFromActions(actions: CareAction[]): number`
  - `lastCaredAt(actions: CareAction[]): Date | null`
  - Task 5(행복도)·Task 9(스토어)가 사용

- [ ] **Step 1: Write the failing test**

`src/domain/care.test.ts`:
```ts
import { expect, test } from 'vitest'
import { canCareToday, lastCaredAt, xpFromActions, type CareAction } from './care'

const NOW = new Date('2026-07-30T03:00:00Z') // 서울 07-30 12:00

function action(overrides: Partial<CareAction>): CareAction {
  return { userId: 'me', type: 'feed', createdAt: NOW, ...overrides }
}

test('오늘 안 한 돌봄은 가능', () => {
  expect(canCareToday([], 'me', 'feed', NOW)).toBe(true)
})

test('같은 유저·같은 종류를 오늘 이미 했으면 불가', () => {
  const acts = [action({ createdAt: new Date('2026-07-29T22:00:00Z') })] // 서울 07-30 07:00
  expect(canCareToday(acts, 'me', 'feed', NOW)).toBe(false)
})

test('종류가 다르면 가능 (feed 했어도 pet 가능)', () => {
  const acts = [action({})]
  expect(canCareToday(acts, 'me', 'pet', NOW)).toBe(true)
})

test('어제(서울 기준) 한 돌봄은 오늘 다시 가능', () => {
  const acts = [action({ createdAt: new Date('2026-07-29T12:00:00Z') })] // 서울 07-29 21:00
  expect(canCareToday(acts, 'me', 'feed', NOW)).toBe(true)
})

test('다른 유저의 기록은 내 판정에 영향 없음', () => {
  const acts = [action({ userId: 'partner' })]
  expect(canCareToday(acts, 'me', 'feed', NOW)).toBe(true)
})

test('XP는 액션당 10', () => {
  expect(xpFromActions([])).toBe(0)
  expect(xpFromActions([action({}), action({ type: 'pet' })])).toBe(20)
})

test('lastCaredAt은 가장 최근 액션 시각, 없으면 null', () => {
  expect(lastCaredAt([])).toBeNull()
  const old = action({ createdAt: new Date('2026-07-28T00:00:00Z') })
  const recent = action({ createdAt: new Date('2026-07-30T00:00:00Z') })
  expect(lastCaredAt([old, recent])).toEqual(new Date('2026-07-30T00:00:00Z'))
  expect(lastCaredAt([recent, old])).toEqual(new Date('2026-07-30T00:00:00Z'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/care.test.ts`
Expected: FAIL — `care` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/domain/care.ts`:
```ts
import { dateKeySeoul } from './dateKey'

export type CareType = 'feed' | 'pet'

export interface CareAction {
  userId: string
  type: CareType
  createdAt: Date
}

export const XP_PER_CARE = 10

export function canCareToday(
  actions: CareAction[],
  userId: string,
  type: CareType,
  now: Date,
): boolean {
  const today = dateKeySeoul(now)
  return !actions.some(
    (a) => a.userId === userId && a.type === type && dateKeySeoul(a.createdAt) === today,
  )
}

export function xpFromActions(actions: CareAction[]): number {
  return actions.length * XP_PER_CARE
}

export function lastCaredAt(actions: CareAction[]): Date | null {
  if (actions.length === 0) return null
  return actions.reduce((max, a) => (a.createdAt > max ? a.createdAt : max), actions[0].createdAt)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/care.test.ts`
Expected: PASS (7개)

- [ ] **Step 5: Commit**

```bash
git add src/domain/care.ts src/domain/care.test.ts
git commit -m "feat: 돌봄 하루 1회 판정과 XP 계산"
```

---

### Task 4: 레벨 곡선 (`level`)

**Files:**
- Create: `src/domain/level.ts`
- Test: `src/domain/level.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `cumXpForLevel(level: number): number` — 해당 레벨 도달에 필요한 누적 XP
  - `levelForXp(xp: number): number` (1 이상, 99 캡)
  - `xpIntoLevel(xp: number): { current: number; needed: number }` — 현재 레벨 내 진행도 (HUD 게이지용)
  - Task 9(스토어)·Task 10(HUD)이 사용

- [ ] **Step 1: Write the failing test**

`src/domain/level.test.ts`:
```ts
import { expect, test } from 'vitest'
import { cumXpForLevel, levelForXp, xpIntoLevel } from './level'

// 곡선: 레벨 n 도달 누적 XP = 30 * n * (n-1) / 2  (레벨2=30, 레벨3=90, 레벨4=180)
test('누적 필요 XP 곡선', () => {
  expect(cumXpForLevel(1)).toBe(0)
  expect(cumXpForLevel(2)).toBe(30)
  expect(cumXpForLevel(3)).toBe(90)
  expect(cumXpForLevel(4)).toBe(180)
})

test('XP → 레벨', () => {
  expect(levelForXp(0)).toBe(1)
  expect(levelForXp(29)).toBe(1)
  expect(levelForXp(30)).toBe(2)
  expect(levelForXp(89)).toBe(2)
  expect(levelForXp(90)).toBe(3)
})

test('레벨 99 캡', () => {
  expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(99)
})

test('레벨 내 진행도', () => {
  // xp=40: 레벨2 (30 필요했음), 다음 레벨까지 90-30=60 중 10 진행
  expect(xpIntoLevel(40)).toEqual({ current: 10, needed: 60 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/level.test.ts`
Expected: FAIL — `level` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/domain/level.ts`:
```ts
export const MAX_LEVEL = 99

/** 레벨 n 도달에 필요한 누적 XP: 30 * n * (n-1) / 2 */
export function cumXpForLevel(level: number): number {
  return (30 * level * (level - 1)) / 2
}

export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xp >= cumXpForLevel(level + 1)) level++
  return level
}

export function xpIntoLevel(xp: number): { current: number; needed: number } {
  const level = levelForXp(xp)
  const base = cumXpForLevel(level)
  const next = cumXpForLevel(level + 1)
  return { current: xp - base, needed: next - base }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/level.test.ts`
Expected: PASS (4개)

- [ ] **Step 5: Commit**

```bash
git add src/domain/level.ts src/domain/level.test.ts
git commit -m "feat: XP 레벨 곡선"
```

---

### Task 5: 행복도 파생 계산 (`happiness`)

**Files:**
- Create: `src/domain/happiness.ts`
- Test: `src/domain/happiness.test.ts`

**Interfaces:**
- Consumes: 없음 (입력은 Task 3의 `lastCaredAt` 결과)
- Produces:
  - `type Happiness = 'happy' | 'ok' | 'sad' | 'grimy'`
  - `happinessFrom(lastCaredAt: Date | null, now: Date): Happiness`
  - Task 6(FSM 기분)·Task 10(HUD)이 사용

- [ ] **Step 1: Write the failing test**

`src/domain/happiness.test.ts`:
```ts
import { expect, test } from 'vitest'
import { happinessFrom } from './happiness'

const NOW = new Date('2026-07-30T12:00:00Z')

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 3600_000)
}

test('돌봄 기록이 없으면 ok (첫 만남)', () => {
  expect(happinessFrom(null, NOW)).toBe('ok')
})

test('24시간 이내 돌봄 → happy', () => {
  expect(happinessFrom(hoursAgo(1), NOW)).toBe('happy')
  expect(happinessFrom(hoursAgo(24), NOW)).toBe('happy')
})

test('24~48시간 → ok', () => {
  expect(happinessFrom(hoursAgo(25), NOW)).toBe('ok')
  expect(happinessFrom(hoursAgo(48), NOW)).toBe('ok')
})

test('48~96시간 → sad', () => {
  expect(happinessFrom(hoursAgo(49), NOW)).toBe('sad')
  expect(happinessFrom(hoursAgo(96), NOW)).toBe('sad')
})

test('96시간 초과 → grimy (죽지는 않음)', () => {
  expect(happinessFrom(hoursAgo(97), NOW)).toBe('grimy')
  expect(happinessFrom(hoursAgo(24 * 365), NOW)).toBe('grimy')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/happiness.test.ts`
Expected: FAIL — `happiness` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/domain/happiness.ts`:
```ts
export type Happiness = 'happy' | 'ok' | 'sad' | 'grimy'

/** 마지막 돌봄 시각에서 파생 계산. 저장하지 않는다 (스펙: 서버 크론 없음, 사망 없음). */
export function happinessFrom(lastCaredAt: Date | null, now: Date): Happiness {
  if (lastCaredAt === null) return 'ok'
  const hours = (now.getTime() - lastCaredAt.getTime()) / 3600_000
  if (hours <= 24) return 'happy'
  if (hours <= 48) return 'ok'
  if (hours <= 96) return 'sad'
  return 'grimy'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/happiness.test.ts`
Expected: PASS (5개)

- [ ] **Step 5: Commit**

```bash
git add src/domain/happiness.ts src/domain/happiness.test.ts
git commit -m "feat: 방치 시간 기반 행복도 파생 계산"
```

---

### Task 6: 캐릭터 상태머신 (`fsm`)

**Files:**
- Create: `src/game/fsm.ts`
- Test: `src/game/fsm.test.ts`

**Interfaces:**
- Consumes: `Happiness` 타입 (Task 5)
- Produces:
  - `type CharState = 'idle' | 'walk' | 'eat' | 'petted' | 'happy' | 'sad'`
  - `type CareInput = 'feed' | 'pet'`
  - `createCharacterFsm(rng?: () => number): CharacterFsm`
  - `CharacterFsm = { readonly state: CharState; enqueue(input: CareInput): void; setMood(m: Happiness): void; update(dtMs: number): void }`
  - 동작 규칙: `feed` → `eat`(2000ms) → `happy`(1500ms) → 평상 / `pet` → `petted`(1200ms) → `happy`(1500ms) → 평상. 평상시엔 idle↔walk 교대, 기분이 `sad`/`grimy`면 평상 상태가 `sad`
  - Task 10(스테이지)이 사용

- [ ] **Step 1: Write the failing test**

`src/game/fsm.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/fsm.test.ts`
Expected: FAIL — `fsm` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/game/fsm.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/fsm.test.ts`
Expected: PASS (7개)

- [ ] **Step 5: Commit**

```bash
git add src/game/fsm.ts src/game/fsm.test.ts
git commit -m "feat: 캐릭터 상태머신 (돌봄 액션·기분·평상 전이)"
```

---

### Task 7: 애니메이션 수학 (`animMath`)

**Files:**
- Create: `src/game/animMath.ts`
- Test: `src/game/animMath.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `bobY(tMs: number, amplitude?: number, periodMs?: number): number` — idle 숨쉬기 상하 오프셋
  - `chewSquash(progress: number, intensity?: number): { sx: number; sy: number }` — eat 냠냠 스쿼시 스케일
  - `pingPong(tMs: number, speedPxPerSec: number, minX: number, maxX: number): { x: number; facing: 1 | -1 }` — walk 왕복 이동
  - `hopY(tMs: number, height?: number, periodMs?: number): number` — happy 점프 오프셋 (항상 ≤ 0)
  - Task 10(렌더러)이 사용

- [ ] **Step 1: Write the failing test**

`src/game/animMath.test.ts`:
```ts
import { expect, test } from 'vitest'
import { bobY, chewSquash, hopY, pingPong } from './animMath'

test('bobY: 주기 시작/절반에서 0, 1/4에서 +amplitude', () => {
  expect(bobY(0, 2, 800)).toBeCloseTo(0)
  expect(bobY(200, 2, 800)).toBeCloseTo(2)
  expect(bobY(400, 2, 800)).toBeCloseTo(0)
})

test('chewSquash: 가로+세로 합이 보존되는 스쿼시, progress 0에서 원형', () => {
  expect(chewSquash(0)).toEqual({ sx: 1, sy: 1 })
  const { sx, sy } = chewSquash(1 / 6) // sin(π/2)=1 지점
  expect(sx).toBeCloseTo(1.15)
  expect(sy).toBeCloseTo(0.85)
})

test('pingPong: 전진 → 경계에서 반전', () => {
  // 100px/s, 0~100 구간
  expect(pingPong(500, 100, 0, 100)).toEqual({ x: 50, facing: 1 })
  expect(pingPong(1500, 100, 0, 100)).toEqual({ x: 50, facing: -1 })
  expect(pingPong(2000, 100, 0, 100)).toEqual({ x: 0, facing: 1 })
})

test('hopY: 항상 0 이하 (위로만 점프)', () => {
  for (const t of [0, 100, 250, 400, 777]) {
    expect(hopY(t, 8, 500)).toBeLessThanOrEqual(0)
  }
  expect(hopY(250, 8, 500)).toBeCloseTo(-8)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/animMath.test.ts`
Expected: FAIL — `animMath` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/game/animMath.ts`:
```ts
export function bobY(tMs: number, amplitude = 2, periodMs = 800): number {
  return Math.sin((tMs / periodMs) * Math.PI * 2) * amplitude
}

export function chewSquash(progress: number, intensity = 0.15): { sx: number; sy: number } {
  const s = Math.abs(Math.sin(progress * Math.PI * 3)) * intensity
  return { sx: 1 + s, sy: 1 - s }
}

export function pingPong(
  tMs: number,
  speedPxPerSec: number,
  minX: number,
  maxX: number,
): { x: number; facing: 1 | -1 } {
  const range = maxX - minX
  const dist = (tMs / 1000) * speedPxPerSec
  const cycle = dist % (range * 2)
  if (cycle < range) return { x: minX + cycle, facing: 1 }
  return { x: maxX - (cycle - range), facing: -1 }
}

export function hopY(tMs: number, height = 8, periodMs = 500): number {
  return -Math.abs(Math.sin((tMs / periodMs) * Math.PI)) * height
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/animMath.test.ts`
Expected: PASS (4개)

- [ ] **Step 5: Commit**

```bash
git add src/game/animMath.ts src/game/animMath.test.ts
git commit -m "feat: 캐릭터 애니메이션 수학 (bob/squash/pingpong/hop)"
```

---

### Task 8: 하트 파티클 (`particles`)

**Files:**
- Create: `src/game/particles.ts`
- Test: `src/game/particles.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `class ParticleSystem { constructor(rng?: () => number); readonly count: number; spawnHearts(x: number, y: number, count?: number): void; update(dtMs: number): void; draw(ctx: CanvasRenderingContext2D): void }`
  - update는 위치 이동·수명 감소·만료 제거. draw는 분홍 픽셀 하트 (3×3 fillRect 조합)
  - Task 10(스테이지)이 사용

- [ ] **Step 1: Write the failing test**

`src/game/particles.test.ts`:
```ts
import { expect, test } from 'vitest'
import { ParticleSystem } from './particles'

test('spawnHearts로 개수만큼 생성', () => {
  const ps = new ParticleSystem(() => 0.5)
  ps.spawnHearts(100, 100, 5)
  expect(ps.count).toBe(5)
})

test('수명(1200ms)이 다하면 제거', () => {
  const ps = new ParticleSystem(() => 0.5)
  ps.spawnHearts(100, 100, 3)
  ps.update(1100)
  expect(ps.count).toBe(3)
  ps.update(200)
  expect(ps.count).toBe(0)
})

test('update마다 위로 떠오름 (y 감소)', () => {
  const ps = new ParticleSystem(() => 0.5)
  ps.spawnHearts(100, 100, 1)
  const before = ps.particles[0].y
  ps.update(500)
  expect(ps.particles[0].y).toBeLessThan(before)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/particles.test.ts`
Expected: FAIL — `particles` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/game/particles.ts`:
```ts
export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  lifeMs: number
}

const LIFE_MS = 1200
// 5×4 픽셀 하트 (1 = 채움)
const HEART = [
  [0, 1, 0, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
]

export class ParticleSystem {
  particles: Particle[] = []

  constructor(private rng: () => number = Math.random) {}

  get count(): number {
    return this.particles.length
  }

  spawnHearts(x: number, y: number, count = 5): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (this.rng() - 0.5) * 16,
        y,
        vx: (this.rng() - 0.5) * 30,
        vy: -40 - this.rng() * 20,
        lifeMs: LIFE_MS,
      })
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.lifeMs -= dtMs
    }
    this.particles = this.particles.filter((p) => p.lifeMs > 0)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ff6b9d'
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.lifeMs / LIFE_MS + 0.2)
      for (let row = 0; row < HEART.length; row++) {
        for (let col = 0; col < HEART[row].length; col++) {
          if (HEART[row][col]) ctx.fillRect(Math.round(p.x) + col, Math.round(p.y) + row, 1, 1)
        }
      }
    }
    ctx.globalAlpha = 1
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/particles.test.ts`
Expected: PASS (3개)

- [ ] **Step 5: Commit**

```bash
git add src/game/particles.ts src/game/particles.test.ts
git commit -m "feat: 하트 파티클 시스템"
```

---

### Task 9: zustand 게임 스토어 (`store`)

**Files:**
- Create: `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes: `canCareToday`, `xpFromActions`, `lastCaredAt`, `CareAction`, `CareType` (Task 3), `CareInput` (Task 6)
- Produces:
  - `useGame` (zustand 훅). 상태: `careLog: StoredCare[]`(ISO 문자열로 직렬화), `pending: CareInput[]`
  - 액션: `care(type: CareType, now?: Date): boolean` — 성공 시 로그 추가 + pending 푸시, 오늘 이미 했으면 false
  - `consumePending(): CareInput | undefined` — 게임 루프가 소비
  - 셀렉터 함수: `selectActions(s): CareAction[]`, `selectXp(s): number`, `selectLastCaredAt(s): Date | null`
  - `PLAYER_ID = 'me'` (플레이그라운드 고정 유저 — Plan 2에서 auth uid로 교체)
  - localStorage persist 키: `tinyou-playground`
  - Task 10(UI·스테이지)이 사용

- [ ] **Step 1: Write the failing test**

`src/state/store.test.ts`:
```ts
import { beforeEach, expect, test } from 'vitest'
import { selectActions, selectXp, useGame } from './store'

const NOW = new Date('2026-07-30T03:00:00Z')

beforeEach(() => {
  useGame.setState({ careLog: [], pending: [] })
})

test('care 성공: 로그 추가 + pending 등록 + XP 반영', () => {
  expect(useGame.getState().care('feed', NOW)).toBe(true)
  const s = useGame.getState()
  expect(s.careLog).toHaveLength(1)
  expect(s.pending).toEqual(['feed'])
  expect(selectXp(s)).toBe(10)
})

test('같은 날 같은 종류 재시도는 거부', () => {
  useGame.getState().care('feed', NOW)
  expect(useGame.getState().care('feed', NOW)).toBe(false)
  expect(useGame.getState().careLog).toHaveLength(1)
})

test('다른 종류는 같은 날에도 허용', () => {
  useGame.getState().care('feed', NOW)
  expect(useGame.getState().care('pet', NOW)).toBe(true)
  expect(selectXp(useGame.getState())).toBe(20)
})

test('consumePending은 FIFO로 하나씩 소비', () => {
  useGame.getState().care('feed', NOW)
  useGame.getState().care('pet', NOW)
  expect(useGame.getState().consumePending()).toBe('feed')
  expect(useGame.getState().consumePending()).toBe('pet')
  expect(useGame.getState().consumePending()).toBeUndefined()
})

test('selectActions는 Date로 역직렬화', () => {
  useGame.getState().care('feed', NOW)
  const actions = selectActions(useGame.getState())
  expect(actions[0].createdAt).toEqual(NOW)
  expect(actions[0].userId).toBe('me')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: FAIL — `store` 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/state/store.ts`:
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  canCareToday,
  lastCaredAt,
  xpFromActions,
  type CareAction,
  type CareType,
} from '../domain/care'
import type { CareInput } from '../game/fsm'

export const PLAYER_ID = 'me' // Plan 2에서 Supabase auth uid로 교체

interface StoredCare {
  userId: string
  type: CareType
  createdAt: string // ISO — localStorage 직렬화용
}

interface GameStore {
  careLog: StoredCare[]
  pending: CareInput[]
  care(type: CareType, now?: Date): boolean
  consumePending(): CareInput | undefined
}

export function selectActions(s: Pick<GameStore, 'careLog'>): CareAction[] {
  return s.careLog.map((c) => ({ ...c, createdAt: new Date(c.createdAt) }))
}

export function selectXp(s: Pick<GameStore, 'careLog'>): number {
  return xpFromActions(selectActions(s))
}

export function selectLastCaredAt(s: Pick<GameStore, 'careLog'>): Date | null {
  return lastCaredAt(selectActions(s))
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      careLog: [],
      pending: [],
      care(type, now = new Date()) {
        if (!canCareToday(selectActions(get()), PLAYER_ID, type, now)) return false
        set((s) => ({
          careLog: [...s.careLog, { userId: PLAYER_ID, type, createdAt: now.toISOString() }],
          pending: [...s.pending, type],
        }))
        return true
      },
      consumePending() {
        const [head, ...rest] = get().pending
        if (head !== undefined) set({ pending: rest })
        return head
      },
    }),
    { name: 'tinyou-playground', partialize: (s) => ({ careLog: s.careLog }) },
  ),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/store.test.ts`
Expected: PASS (5개). (Node 환경에 localStorage가 없어 persist가 경고를 낼 수 있으나 zustand persist는 storage 부재 시 no-op으로 동작 — 테스트 실패 아님)

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat: 게임 스토어 (돌봄 기록·pending 큐·localStorage persist)"
```

---

### Task 10: 픽셀 렌더러 + 스테이지 + HUD 조립

**Files:**
- Create: `src/game/sprite.ts`, `src/game/render.ts`, `src/game/loop.ts`, `src/ui/Stage.tsx`, `src/ui/Hud.tsx`, `src/ui/CareButtons.tsx`
- Modify: `src/App.tsx`
- Test: `src/game/sprite.test.ts`

**Interfaces:**
- Consumes: Task 5~9의 모든 산출물 (`happinessFrom`, `createCharacterFsm`, `bobY`/`chewSquash`/`pingPong`/`hopY`, `ParticleSystem`, `useGame`/셀렉터)
- Produces:
  - `drawPixelMap(ctx, map: string[], palette: Record<string, string>, x: number, y: number, scale: number): void`
  - `BLOB_MAP: string[]`, `PALETTE_NORMAL`, `PALETTE_GRIMY: Record<string, string>`
  - `startLoop(cb: (dtMs: number) => void): () => void` — rAF 루프, 반환값은 정지 함수
  - `renderScene(ctx, scene: { state: CharState; mood: Happiness; tMs: number }): void`
  - `<Stage />`, `<Hud />`, `<CareButtons />` React 컴포넌트
  - 완성된 플레이그라운드 화면 (Plan 1 최종 산출물)

- [ ] **Step 1: Write the failing test (스프라이트 렌더링 검증)**

`src/game/sprite.test.ts`:
```ts
import { expect, test } from 'vitest'
import { BLOB_MAP, drawPixelMap, PALETTE_NORMAL } from './sprite'

function fakeCtx() {
  const calls: [number, number, number, number][] = []
  return {
    calls,
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push([x, y, w, h])
    },
  } as unknown as CanvasRenderingContext2D & { calls: [number, number, number, number][] }
}

test('픽셀맵의 non-dot 칸 수만큼 fillRect 호출', () => {
  const ctx = fakeCtx()
  const expected = BLOB_MAP.join('').replace(/\./g, '').length
  drawPixelMap(ctx, BLOB_MAP, PALETTE_NORMAL, 0, 0, 1)
  expect(ctx.calls).toHaveLength(expected)
})

test('scale·offset이 fillRect 좌표에 반영', () => {
  const ctx = fakeCtx()
  drawPixelMap(ctx, ['P'], { P: '#fff' }, 10, 20, 3)
  expect(ctx.calls).toEqual([[10, 20, 3, 3]])
})

test('팔레트에 없는 문자는 그리지 않음', () => {
  const ctx = fakeCtx()
  drawPixelMap(ctx, ['PX'], { P: '#fff' }, 0, 0, 1)
  expect(ctx.calls).toHaveLength(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/sprite.test.ts`
Expected: FAIL — `sprite` 모듈 없음

- [ ] **Step 3: sprite 구현**

`src/game/sprite.ts`:
```ts
// 임시 분신: 12×9 분홍 블롭. Plan 2에서 AI 생성 이미지로 교체된다.
export const BLOB_MAP: string[] = [
  '...PPPPPP...',
  '..PPPPPPPP..',
  '.PPWBPPWBPP.',
  '.PPWWPPWWPP.',
  'PPPPPPPPPPPP',
  'PPPPPCCPPPPP',
  'PPPPCCCCPPPP',
  '.PPPPPPPPPP.',
  '..PP..PP....',
]

export const PALETTE_NORMAL: Record<string, string> = {
  P: '#ffb7c9', // 몸통 분홍
  W: '#ffffff', // 눈 흰자
  B: '#333333', // 눈동자
  C: '#ff6b9d', // 볼터치/입
}

export const PALETTE_GRIMY: Record<string, string> = {
  P: '#c9b8bd',
  W: '#eeeeee',
  B: '#555555',
  C: '#a98a94',
}

export function drawPixelMap(
  ctx: CanvasRenderingContext2D,
  map: string[],
  palette: Record<string, string>,
  x: number,
  y: number,
  scale: number,
): void {
  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      const color = palette[map[row][col]]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/sprite.test.ts`
Expected: PASS (3개)

- [ ] **Step 5: loop / render 구현 (수동 검증 대상)**

`src/game/loop.ts`:
```ts
export function startLoop(cb: (dtMs: number) => void): () => void {
  let raf = 0
  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min(now - last, 100) // 탭 복귀 시 폭주 방지
    last = now
    cb(dt)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
```

`src/game/render.ts`:
```ts
import type { Happiness } from '../domain/happiness'
import { bobY, chewSquash, hopY, pingPong } from './animMath'
import type { CharState } from './fsm'
import { BLOB_MAP, drawPixelMap, PALETTE_GRIMY, PALETTE_NORMAL } from './sprite'

export const STAGE_W = 320
export const STAGE_H = 240
const SCALE = 5
const SPRITE_W = BLOB_MAP[0].length * SCALE
const SPRITE_H = BLOB_MAP.length * SCALE
const FLOOR_Y = 200

export interface Scene {
  state: CharState
  mood: Happiness
  tMs: number
}

/** 캐릭터 기준점(스프라이트 좌상단) 좌표 — 파티클 스폰 위치 계산에도 사용 */
export function characterPos(scene: Scene): { x: number; y: number } {
  const centerX = STAGE_W / 2 - SPRITE_W / 2
  const baseY = FLOOR_Y - SPRITE_H
  switch (scene.state) {
    case 'walk': {
      const { x } = pingPong(scene.tMs, 40, 30, STAGE_W - 30 - SPRITE_W)
      return { x, y: baseY + bobY(scene.tMs, 1, 400) }
    }
    case 'happy':
      return { x: centerX, y: baseY + hopY(scene.tMs, 10, 500) }
    case 'sad':
      return { x: centerX, y: baseY + 4 } // 축 처짐
    default:
      return { x: centerX, y: baseY + bobY(scene.tMs, 2, 900) }
  }
}

export function renderScene(ctx: CanvasRenderingContext2D, scene: Scene): void {
  // 배경·바닥
  ctx.fillStyle = '#fdf6f0'
  ctx.fillRect(0, 0, STAGE_W, STAGE_H)
  ctx.fillStyle = '#e8d5c4'
  ctx.fillRect(0, FLOOR_Y, STAGE_W, STAGE_H - FLOOR_Y)

  const palette = scene.mood === 'grimy' ? PALETTE_GRIMY : PALETTE_NORMAL
  const { x, y } = characterPos(scene)

  if (scene.state === 'eat') {
    const { sx, sy } = chewSquash((scene.tMs % 2000) / 2000)
    ctx.save()
    ctx.translate(x + SPRITE_W / 2, y + SPRITE_H)
    ctx.scale(sx, sy)
    drawPixelMap(ctx, BLOB_MAP, palette, -SPRITE_W / 2, -SPRITE_H, SCALE)
    ctx.restore()
    return
  }
  drawPixelMap(ctx, BLOB_MAP, palette, x, y, SCALE)

  if (scene.state === 'sad') {
    ctx.fillStyle = '#7ec8e3' // 눈물 한 방울
    ctx.fillRect(x + 2 * SCALE, y + 4 * SCALE, SCALE, SCALE * 2)
  }
}
```

- [ ] **Step 6: UI 컴포넌트 구현**

`src/ui/Stage.tsx`:
```tsx
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
      if (input) {
        fsm.enqueue(input)
        const pos = characterPos({ state: fsm.state, mood, tMs })
        particles.spawnHearts(pos.x + 30, pos.y, input === 'pet' ? 6 : 3)
      }
      fsm.update(dt)
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
```

`src/ui/Hud.tsx`:
```tsx
import { happinessFrom } from '../domain/happiness'
import { levelForXp, xpIntoLevel } from '../domain/level'
import { selectLastCaredAt, selectXp, useGame } from '../state/store'

const MOOD_LABEL = { happy: '행복해요 🥰', ok: '무난해요 🙂', sad: '시무룩… 🥺', grimy: '꼬질꼬질… 🫠' }

export function Hud() {
  const xp = useGame(selectXp)
  const last = useGame(selectLastCaredAt)
  const level = levelForXp(xp)
  const { current, needed } = xpIntoLevel(xp)
  const mood = happinessFrom(last, new Date())
  return (
    <div style={{ fontFamily: 'monospace', textAlign: 'center' }}>
      <div>Lv.{level} — {MOOD_LABEL[mood]}</div>
      <progress value={current} max={needed} style={{ width: '100%' }} />
    </div>
  )
}
```

`src/ui/CareButtons.tsx`:
```tsx
import { canCareToday } from '../domain/care'
import { PLAYER_ID, selectActions, useGame } from '../state/store'

export function CareButtons() {
  const care = useGame((s) => s.care)
  const actions = useGame(selectActions) // careLog 변경 시 자동 리렌더
  const now = new Date()
  const canFeed = canCareToday(actions, PLAYER_ID, 'feed', now)
  const canPet = canCareToday(actions, PLAYER_ID, 'pet', now)
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      <button disabled={!canFeed} onClick={() => care('feed')}>🍙 밥 주기</button>
      <button disabled={!canPet} onClick={() => care('pet')}>🫳 쓰다듬기</button>
    </div>
  )
}
```

`src/App.tsx` (교체):
```tsx
import { CareButtons } from './ui/CareButtons'
import { Hud } from './ui/Hud'
import { Stage } from './ui/Stage'

export function App() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <h1 style={{ fontFamily: 'monospace', textAlign: 'center' }}>Tinyou</h1>
      <Stage />
      <Hud />
      <CareButtons />
    </main>
  )
}
```

- [ ] **Step 7: 전체 테스트 + 빌드**

Run: `npm test && npm run build`
Expected: 전체 테스트 PASS, 빌드 성공

- [ ] **Step 8: 수동 검증 (`npm run dev`)**

체크리스트:
- 분홍 블롭이 방에서 숨쉬기(bob)·좌우 산책(walk 방향 전환 포함)을 반복한다
- "밥 주기" → 냠냠 스쿼시 2초 → 점프(happy) 1.5초 → 평상 복귀, 하트 파티클
- 같은 날 두 번째 "밥 주기" 버튼은 비활성
- 돌봄 시 XP 게이지 증가, 30XP에서 Lv.2
- 새로고침해도 XP·버튼 상태 유지 (localStorage)
- 개발자도구에서 `localStorage['tinyou-playground']`의 createdAt을 5일 전으로 수정 후 새로고침 → 꼬질 팔레트 + 눈물 + 축 처짐 확인, 쓰다듬으면 정상 액션 재생

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Canvas 스테이지·HUD·돌봄 버튼 조립 (플레이그라운드 완성)"
```

---

### Task 11: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: 전체 태스크 산출물
- Produces: 프로젝트 소개·실행 방법 문서

- [ ] **Step 1: README 작성**

`README.md`:
```markdown
# 티뉴 (Tinyou)

> tiny + you — 연인의 분신을 주머니에 넣고 다니는 커플 다마고치 PWA (개발 중)

연인 둘만의 1:1 방에서, 서로를 묘사한 글로 AI가 만들어 준 **연인의 분신 캐릭터**를
각자 폰에서 키우는 앱. 매일 밥 주고 쓰다듬으면 레벨이 오르고, 연인이 보낸 메시지는
분신이 말풍선으로 배달한다.

## 현재 상태: Plan 1 (로컬 플레이그라운드)

Supabase 연동 전, 브라우저 로컬에서 완결되는 게임 코어:
픽셀 블롭 돌보기 · XP/레벨 · 방치 시 시무룩 (절대 죽지 않음)

## 실행

​```bash
npm install
npm run dev   # 개발 서버
npm test      # 유닛 테스트 (Vitest)
​```

## 문서

- 설계 스펙: `docs/superpowers/specs/2026-07-30-tinyou-design.md`
- 구현 계획: `docs/superpowers/plans/`
```

(주의: 위 코드펜스는 실제 파일에서는 이스케이프(​) 없이 일반 ``` 로 작성)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README 추가"
```

---

## 후속 계획 (이 문서 범위 아님)

- **Plan 2 — Supabase 연동**: 스키마·RLS·매직링크 인증·방 생성/초대·질문 카드·Edge Function AI 캐릭터 생성(픽셀아트, 재생성 3회), `PLAYER_ID`/localStorage를 auth uid/DB로 교체, BLOB_MAP을 생성 이미지로 교체
- **Plan 3 — 소셜 + 배포**: 메시지 배달(분신 말풍선·read_at)·Realtime 구독·꾸미기 unlocks·PWA manifest·오프라인 토스트·nginx+cloudflared 배포(deploy.sh)
