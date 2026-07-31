# Tinyou Plan 3: 감성 코어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 아바타 v2(12종 동물·키워드 매핑·32×32), 말풍선 메시지(+쪽지함), Realtime, 상대 흔적 요약, 굿나잇 의례, 로그아웃 — 스펙 `docs/superpowers/specs/2026-07-31-tinyou-plan3-design.md`의 감성 코어 전부.

**Architecture:** 아바타는 `src/game/avatarV2/`의 파츠 합성 엔진(종 베이스맵 + 오버레이 + 팔레트 스왑)으로 교체하되 `generateAvatar(answers, salt)` 시그니처를 유지해 상위 코드를 보존한다. 도트 품질은 `?gallery` 데브 페이지에서 전 조합을 렌더해 눈으로 반복 검증한다. 메시지·굿나잇은 기존 Supabase 패턴(RLS·컬럼 스코프 grant·파생 계산)을 승계하고, Realtime은 향상(enhancement)으로만 얹어 실패 시 기존 fetch로 강등된다.

**Tech Stack:** 기존 스택 그대로 (Vite+React+TS, zustand, Vitest, Supabase). 새 런타임 의존성 없음. 도트 한글 폰트 1종 셀프호스팅.

## Global Constraints

- TypeScript strict, 새 런타임 의존성 금지. 폰트·이미지는 셀프호스팅(외부 CDN 금지)
- `generateAvatar(answers: string[], salt: number): { map: string[]; palette: Record<string, string> }` 시그니처·결정성 유지 (v2 내부 교체)
- 다시 뽑기(salt 변경) 시 **종·팔레트는 고정**(답변에서 결정), 표정·소품만 변형
- 메시지 140자, "메신저 대체 아님" — 쪽지함은 받은 것 최근 30개만
- DB 컬럼 추가 시 명시적 grant 필수 (Plan 2 교훈 — characters/profiles는 컬럼 스코프 상태)
- 서버 크론 없음(파생 계산), 캐릭터 사망 없음, 시간 판정은 Asia/Seoul 유틸로 통일
- Realtime은 향상일 뿐 — 구독 실패해도 기존 fetch 동작 유지
- Supabase: ref hhdspjlnxgcwpbughsdb, CLI 로그인·링크됨, 비TTY(배포는 `--use-api`)
- 작업 디렉터리: `/Users/leedongeun/Documents/toy-project/tinyou`

## 아바타 v2 도트 격자 규격 (전 태스크 공통)

- 그리드: **32행 × 32열** 문자열 배열. 허용 문자: `.`(투명) `O`(외곽선) `B`(본체) `S`(음영) `W`(흰 배/눈흰자) `E`(눈) `C`(볼) `M`(입) `A`(액세서리) `D`(종 고유 디테일 — 부리·주둥이 등)
- 고정 색: `O #4a3f35`, `E #333333`, `W #ffffff`, `M #a2574f`. 팔레트 색: `B/S/C/D`는 팔레트가 결정 (`D`는 팔레트의 `detail` 색)
- 종 실루엣 요구: 외곽선 `O`로 닫힌 형태, 바닥 기준 하단 정렬(발이 row 29에 닿게), 좌우 중앙 배치, 몸 하단 1픽셀 띠는 `S` 음영
- 오버레이 앵커: 각 종이 `anchors: { eyes: [r,c][], mouth: [r,c], cheeks: [r,c][], accessory: [r,c] }`를 정의 — 눈·입·볼 스탬프는 이 좌표 기준 상대 배치, 반드시 몸(`B/W`) 위에 얹힐 것 (구조 테스트로 강제)

---

### Task 1: 키워드 매핑 사전 (종·색) — TDD

**Files:**
- Create: `src/game/avatarV2/palettes.ts`, `src/game/avatarV2/matching.ts`
- Test: `src/game/avatarV2/matching.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `PALETTES: Record<PaletteKey, { B: string; S: string; C: string; D: string }>` — 8키: `'pink'|'mint'|'lavender'|'peach'|'sky'|'lemon'|'cream'|'taupe'`
  - `SPECIES_KEYS = ['hamster','rabbit','cat','dog','squirrel','frog','bird','axolotl','bear','penguin','duck','seal'] as const`, `type SpeciesKey`
  - `matchSpecies(answers: string[]): SpeciesKey | null` — 동물 유의어 부분 문자열 매칭 (전체 답변 순회, 먼저 발견된 것)
  - `matchPalette(answers: string[]): PaletteKey | null` — 색 사전 매칭
  - Task 5의 generate가 사용

- [ ] **Step 1: Write the failing test**

`src/game/avatarV2/matching.test.ts`:
```ts
import { expect, test } from 'vitest'
import { matchPalette, matchSpecies } from './matching'

test('동물 유의어 매칭', () => {
  expect(matchSpecies(['밝은 사람', '볼이 빵빵한 햄스터 같아'])).toBe('hamster')
  expect(matchSpecies(['햄찌 그 자체'])).toBe('hamster')
  expect(matchSpecies(['멍멍이 같은 사람', ''])).toBe('dog')
  expect(matchSpecies(['리트리버상'])).toBe('dog')
  expect(matchSpecies(['고냥이'])).toBe('cat')
  expect(matchSpecies(['우파루파 닮음'])).toBe('axolotl')
  expect(matchSpecies(['백곰같이 듬직'])).toBe('bear')
})

test('매칭 실패 시 null', () => {
  expect(matchSpecies(['공룡 같아'])).toBeNull()
  expect(matchSpecies([])).toBeNull()
})

test('색 사전 매칭', () => {
  expect(matchPalette(['햇살 같은 노란색'])).toBe('lemon')
  expect(matchPalette(['핑크핑크한 사람'])).toBe('pink')
  expect(matchPalette(['민트초코를 좋아함'])).toBe('mint')
  expect(matchPalette(['하늘 같은 파란 느낌'])).toBe('sky')
  expect(matchPalette(['보라보라'])).toBe('lavender')
  expect(matchPalette(['따뜻한 주황 복숭아'])).toBe('peach')
  expect(matchPalette(['어떤 색인지 모르겠음'])).toBeNull()
})

test('여러 후보면 먼저 등장한 답변 우선', () => {
  expect(matchSpecies(['토끼 같기도 하고', '고양이 같기도'])).toBe('rabbit')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/avatarV2/matching.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/game/avatarV2/palettes.ts`:
```ts
export type PaletteKey =
  | 'pink' | 'mint' | 'lavender' | 'peach' | 'sky' | 'lemon' | 'cream' | 'taupe'

export const PALETTES: Record<PaletteKey, { B: string; S: string; C: string; D: string }> = {
  pink:     { B: '#ffb7c9', S: '#e896ab', C: '#ff6b9d', D: '#d97a94' },
  mint:     { B: '#a8e6cf', S: '#84c7ae', C: '#56b58c', D: '#5fae90' },
  lavender: { B: '#c9b6e4', S: '#a894c9', C: '#8f6fc0', D: '#9a7fc4' },
  peach:    { B: '#ffd3a5', S: '#e6b482', C: '#f08c5a', D: '#d99a66' },
  sky:      { B: '#a5d8ff', S: '#7fb8e6', C: '#5a9cf0', D: '#6fa8dd' },
  lemon:    { B: '#fff3a5', S: '#e6d67f', C: '#e6b800', D: '#d4bd55' },
  cream:    { B: '#f5e9d7', S: '#dcc9ac', C: '#d9a066', D: '#c9b190' },
  taupe:    { B: '#cbb8a9', S: '#a9927f', C: '#8f7261', D: '#9c8471' },
}
```

`src/game/avatarV2/matching.ts`:
```ts
import type { PaletteKey } from './palettes'

export const SPECIES_KEYS = [
  'hamster', 'rabbit', 'cat', 'dog', 'squirrel', 'frog',
  'bird', 'axolotl', 'bear', 'penguin', 'duck', 'seal',
] as const
export type SpeciesKey = (typeof SPECIES_KEYS)[number]

const SPECIES_SYNONYMS: Record<SpeciesKey, string[]> = {
  hamster: ['햄스터', '햄찌', '햄토리'],
  rabbit: ['토끼', '토깽', '래빗', '버니'],
  cat: ['고양이', '고냥', '냥이', '냐옹', '캣'],
  dog: ['강아지', '멍멍이', '개', '댕댕', '리트리버', '푸들', '시바', '말티즈'],
  squirrel: ['다람쥐', '람쥐', '청설모'],
  frog: ['개구리', '청개구리', '두꺼비'],
  bird: ['새', '참새', '병아리', '앵무', '올빼미', '부엉이'],
  axolotl: ['우파루파', '아홀로틀', '도롱뇽'],
  bear: ['곰', '백곰', '반달곰', '곰돌이', '테디'],
  penguin: ['펭귄', '펭구', '펭'],
  duck: ['오리', '덕', '꽥꽥'],
  seal: ['물개', '물범', '바다표범', '하프물범'],
}

const COLOR_DICT: [PaletteKey, string[]][] = [
  ['pink', ['분홍', '핑크', '벚꽃']],
  ['mint', ['민트', '초록', '녹색', '연두']],
  ['lavender', ['보라', '라벤더', '퍼플', '연보라']],
  ['peach', ['주황', '오렌지', '복숭아', '피치', '살구']],
  ['sky', ['파랑', '파란', '하늘', '블루', '바다']],
  ['lemon', ['노랑', '노란', '햇살', '레몬', '금색']],
  ['cream', ['하양', '흰', '크림', '아이보리', '베이지']],
  ['taupe', ['갈색', '브라운', '초코', '커피']],
]

function firstMatch<T>(answers: string[], entries: [T, string[]][]): T | null {
  for (const answer of answers) {
    for (const [key, words] of entries) {
      if (words.some((w) => answer.includes(w))) return key
    }
  }
  return null
}

export function matchSpecies(answers: string[]): SpeciesKey | null {
  return firstMatch(
    answers,
    (Object.entries(SPECIES_SYNONYMS) as [SpeciesKey, string[]][]),
  )
}

export function matchPalette(answers: string[]): PaletteKey | null {
  return firstMatch(answers, COLOR_DICT)
}
```
(주의: `firstMatch`는 답변 순서를 우선해야 한다 — 위 구현처럼 바깥 루프가 answers여야 "먼저 등장한 답변 우선" 테스트가 통과한다. `dog`의 '개'는 '개구리'와 겹치므로 SPECIES_SYNONYMS 매칭 시 **긴 단어부터** 검사하도록 각 종의 단어 검사 전에 후보 전체를 길이 내림차순으로 정렬한 통합 리스트로 구현해도 좋다 — 어느 쪽이든 `개구리`가 dog로 매칭되지 않아야 한다. 테스트에 다음을 추가하라: `expect(matchSpecies(['개구리 닮음'])).toBe('frog')`)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/avatarV2/matching.test.ts`
Expected: PASS (전부)

- [ ] **Step 5: Commit**

```bash
git add src/game/avatarV2
git commit -m "feat: 아바타 v2 종·색 키워드 매핑 사전"
```

---

### Task 2: 파츠 합성 엔진 + 햄스터 1종 + 갤러리 페이지

**Files:**
- Create: `src/game/avatarV2/types.ts`, `src/game/avatarV2/compose.ts`, `src/game/avatarV2/overlays.ts`, `src/game/avatarV2/species/hamster.ts`, `src/game/avatarV2/species/index.ts`, `src/ui/AvatarGallery.tsx`
- Modify: `src/App.tsx` (`?gallery` 쿼리 시 갤러리 렌더 — 라우팅 최상단 1줄 분기)
- Test: `src/game/avatarV2/compose.test.ts`, `src/game/avatarV2/species/species.test.ts`

**Interfaces:**
- Consumes: `PALETTES`, `PaletteKey`, `SpeciesKey` (Task 1)
- Produces:
  - `interface Species { key: SpeciesKey; baseMap: string[]; anchors: Anchors }`, `interface Anchors { eyes: [number, number][]; mouth: [number, number]; cheeks: [number, number][]; accessory: [number, number] }`
  - `SPECIES: Record<SpeciesKey, Species>` (이 태스크에서는 hamster만 등록; 3·4가 채움)
  - `composeAvatar(species: Species, paletteKey: PaletteKey, variant: Variant): { map: string[]; palette: Record<string, string> }`, `interface Variant { eyes: number; mouth: number; cheeks: number; accessory: number }` (인덱스는 overlays 배열 길이로 모듈러)
  - `overlays.ts`: `EYE_STYLES: Stamp[][4]`, `MOUTH_STYLES: Stamp[][4]`, `CHEEK_STYLES: Stamp[][2]`, `ACCESSORY_STYLES: Stamp[][5]` — `type Stamp = [dr: number, dc: number, ch: string][]` (앵커 기준 상대 좌표)
  - `species.test.ts`는 SPECIES 전체를 순회하는 **구조 검증 공용 테스트** — 3·4에서 종이 늘면 자동 커버
  - 갤러리: `http://localhost:5173/?gallery` — 등록된 전 종 × 8팔레트 × 표정 변형 그리드 렌더

- [ ] **Step 1: Write the failing tests**

`src/game/avatarV2/compose.test.ts`:
```ts
import { expect, test } from 'vitest'
import { composeAvatar } from './compose'
import { SPECIES } from './species'

const hamster = SPECIES.hamster

test('결과는 32×32, 모든 문자가 팔레트 키 또는 점', () => {
  const { map, palette } = composeAvatar(hamster, 'lemon', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  expect(map).toHaveLength(32)
  for (const row of map) {
    expect(row).toHaveLength(32)
    for (const ch of row) if (ch !== '.') expect(palette[ch]).toMatch(/^#[0-9a-f]{6}$/i)
  }
})

test('팔레트 스왑: 같은 종·변형에 팔레트만 다르면 B 색만 다름', () => {
  const a = composeAvatar(hamster, 'pink', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  const b = composeAvatar(hamster, 'sky', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  expect(a.map).toEqual(b.map)
  expect(a.palette.B).not.toBe(b.palette.B)
})

test('표정 변형: eyes 인덱스가 다르면 맵이 달라짐', () => {
  const a = composeAvatar(hamster, 'pink', { eyes: 0, mouth: 0, cheeks: 0, accessory: 0 })
  const b = composeAvatar(hamster, 'pink', { eyes: 1, mouth: 0, cheeks: 0, accessory: 0 })
  expect(a.map).not.toEqual(b.map)
})

test('변형 인덱스는 스타일 수로 모듈러 (범위 밖 안전)', () => {
  expect(() =>
    composeAvatar(hamster, 'pink', { eyes: 99, mouth: 99, cheeks: 99, accessory: 99 }),
  ).not.toThrow()
})
```

`src/game/avatarV2/species/species.test.ts` (공용 구조 검증 — 종 추가 시 자동 적용):
```ts
import { expect, test } from 'vitest'
import { SPECIES } from './index'

const ALLOWED = new Set(['.', 'O', 'B', 'S', 'W', 'E', 'C', 'M', 'A', 'D'])

for (const [key, sp] of Object.entries(SPECIES)) {
  test(`${key}: 32×32 그리드, 허용 문자만`, () => {
    expect(sp.baseMap).toHaveLength(32)
    for (const row of sp.baseMap) {
      expect(row).toHaveLength(32)
      for (const ch of row) expect(ALLOWED.has(ch)).toBe(true)
    }
  })
  test(`${key}: 바닥 정렬 — row 29에 몸이 닿고 row 30-31은 비어있음`, () => {
    expect(sp.baseMap[29].replace(/\./g, '').length).toBeGreaterThan(0)
    expect(sp.baseMap[30].replace(/\./g, '')).toBe('')
    expect(sp.baseMap[31].replace(/\./g, '')).toBe('')
  })
  test(`${key}: 앵커가 몸 위에 있음 (B/W/S)`, () => {
    const on = (r: number, c: number) => ['B', 'W', 'S'].includes(sp.baseMap[r][c])
    for (const [r, c] of sp.anchors.eyes) expect(on(r, c)).toBe(true)
    expect(on(...sp.anchors.mouth)).toBe(true)
    for (const [r, c] of sp.anchors.cheeks) expect(on(r, c)).toBe(true)
  })
  test(`${key}: 외곽선 존재 (O가 40픽셀 이상)`, () => {
    const count = sp.baseMap.join('').split('O').length - 1
    expect(count).toBeGreaterThanOrEqual(40)
  })
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/game/avatarV2`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 엔진·오버레이·햄스터 구현**

`src/game/avatarV2/types.ts`:
```ts
import type { SpeciesKey } from './matching'

export type Stamp = [dr: number, dc: number, ch: string][]

export interface Anchors {
  eyes: [number, number][]
  mouth: [number, number]
  cheeks: [number, number][]
  accessory: [number, number]
}

export interface Species {
  key: SpeciesKey
  baseMap: string[]
  anchors: Anchors
}

export interface Variant {
  eyes: number
  mouth: number
  cheeks: number
  accessory: number
}
```

`src/game/avatarV2/overlays.ts` (앵커 상대 스탬프 — 눈은 anchors.eyes의 각 좌표에 동일 적용):
```ts
import type { Stamp } from './types'

// 눈 4종: 점/반짝/졸린/윙크(두번째 눈만 가로선 — compose에서 인덱스 1 이상 눈에 wink 변형 적용)
export const EYE_STYLES: Stamp[] = [
  [[0, 0, 'E']],
  [[0, 0, 'E'], [-1, 1, 'W']],
  [[0, -1, 'E'], [0, 0, 'E'], [0, 1, 'E']],
  [[0, 0, 'E']], // 윙크는 compose에서 eyes[1]에만 가로선으로 대체
]
export const WINK_STAMP: Stamp = [[0, -1, 'E'], [0, 0, 'E'], [0, 1, 'E']]

export const MOUTH_STYLES: Stamp[] = [
  [[0, 0, 'M'], [0, 1, 'M']],                                // 미소
  [[0, 0, 'M'], [0, 1, 'M'], [1, 0, 'M'], [1, 1, 'M']],      // 아-
  [[0, -1, 'M'], [1, 0, 'M'], [0, 1, 'M']],                  // :3
  [[0, 0, 'M']],                                             // 무표정
]

export const CHEEK_STYLES: Stamp[] = [
  [[0, 0, 'C'], [0, 1, 'C']],
  [],
]

export const ACCESSORY_STYLES: Stamp[] = [
  [],                                                        // 없음
  [[0, 0, 'A'], [-1, -1, 'A'], [-1, 1, 'A'], [0, 1, 'A']],   // 리본
  [[0, 0, 'A'], [-1, 0, 'A'], [-2, 1, 'A']],                 // 새싹
  [[0, -2, 'A'], [0, -1, 'A'], [0, 0, 'A'], [0, 1, 'A'], [0, 2, 'A'], [-1, -1, 'A'], [-1, 0, 'A'], [-1, 1, 'A']], // 모자
  [[0, 0, 'A'], [-1, -1, 'A'], [-1, 1, 'A'], [-2, 0, 'A']],  // 별핀
]
```

`src/game/avatarV2/compose.ts`:
```ts
import { PALETTES, type PaletteKey } from './palettes'
import { ACCESSORY_STYLES, CHEEK_STYLES, EYE_STYLES, MOUTH_STYLES, WINK_STAMP } from './overlays'
import type { Species, Stamp, Variant } from './types'

const FIXED = { O: '#4a3f35', E: '#333333', W: '#ffffff', M: '#a2574f', A: '#f08c5a' }

function stamp(grid: string[][], anchor: [number, number], s: Stamp): void {
  for (const [dr, dc, ch] of s) {
    const r = anchor[0] + dr
    const c = anchor[1] + dc
    if (r >= 0 && r < 32 && c >= 0 && c < 32) grid[r][c] = ch
  }
}

export function composeAvatar(
  species: Species,
  paletteKey: PaletteKey,
  variant: Variant,
): { map: string[]; palette: Record<string, string> } {
  const grid = species.baseMap.map((row) => row.split(''))
  const eyeStyle = EYE_STYLES[variant.eyes % EYE_STYLES.length]
  const isWink = variant.eyes % EYE_STYLES.length === 3

  species.anchors.eyes.forEach((anchor, i) => {
    stamp(grid, anchor, isWink && i === 1 ? WINK_STAMP : eyeStyle)
  })
  stamp(grid, species.anchors.mouth, MOUTH_STYLES[variant.mouth % MOUTH_STYLES.length])
  for (const anchor of species.anchors.cheeks) {
    stamp(grid, anchor, CHEEK_STYLES[variant.cheeks % CHEEK_STYLES.length])
  }
  stamp(grid, species.anchors.accessory, ACCESSORY_STYLES[variant.accessory % ACCESSORY_STYLES.length])

  const p = PALETTES[paletteKey]
  return {
    map: grid.map((row) => row.join('')),
    palette: { ...FIXED, B: p.B, S: p.S, C: p.C, D: p.D },
  }
}
```

`src/game/avatarV2/species/hamster.ts` — 아래는 시작점 도트다. **갤러리에서 보고 다듬어라** (통통한 볼·작은 귀·짧은 팔이 핵심):
```ts
import type { Species } from '../types'

export const hamster: Species = {
  key: 'hamster',
  baseMap: [
    '................................',
    '................................',
    '................................',
    '................................',
    '.......OOO..........OOO........',
    '......OBBBO........OBBBO.......',
    '......OBSBBO......OBBSBO.......',
    '.....OOBBBBOOOOOOOOBBBBOO......',
    '....OBBBBBBBBBBBBBBBBBBBBO.....',
    '...OBBBBBBBBBBBBBBBBBBBBBBO....',
    '..OBBBBBBBBBBBBBBBBBBBBBBBBO...',
    '..OBBBBBBBBBBBBBBBBBBBBBBBBO...',
    '.OBBBBBBBBBBBBBBBBBBBBBBBBBBO..',
    '.OBBBBBBBBBBBBBBBBBBBBBBBBBBO..',
    '.OBBBBBBWWBBBBBBBBBBWWBBBBBBO..',
    '.OBBBBBBWWBBBBBBBBBBWWBBBBBBO..',
    '.OBBBBBBBBBBBWWBBBBBBBBBBBBBO..',
    '.OBBBBBBBBBBWWWWBBBBBBBBBBBBO..',
    '.OBBBBBBBBBBWWWWBBBBBBBBBBBBO..',
    '.OBBBBBBBBBBBWWBBBBBBBBBBBBBO..',
    '.OBBBBBBBBBBBBBBBBBBBBBBBBBBO..',
    '.OBBBOBBBBBBBBBBBBBBBBBBOBBBO..',
    '.OBBOOBBBBBBBBBBBBBBBBBBOOBBO..',
    '..OBBBBBBBBBBBBBBBBBBBBBBBBO...',
    '..OBBBBBBBBBBBBBBBBBBBBBBBBO...',
    '...OBBBBBBBBBBBBBBBBBBBBBBO....',
    '....OBBBBSSSSSSSSSSSSBBBBO.....',
    '.....OOBBBSSSSSSSSSSBBBOO......',
    '.......OOBBOO....OOBBOO........',
    '........OOOO......OOOO.........',
    '................................',
    '................................',
  ],
  anchors: {
    eyes: [[15, 9], [15, 21]],
    mouth: [18, 15],
    cheeks: [[17, 5], [17, 25]],
    accessory: [3, 15],
  },
}
```

`src/game/avatarV2/species/index.ts`:
```ts
import type { SpeciesKey } from '../matching'
import type { Species } from '../types'
import { hamster } from './hamster'

// Task 3·4가 나머지 11종을 추가한다. 등록 즉시 species.test.ts 구조 검증이 자동 적용됨
export const SPECIES = { hamster } as Partial<Record<SpeciesKey, Species>> as Record<SpeciesKey, Species>
export const REGISTERED_SPECIES = Object.values(SPECIES) as Species[]
```
(주의: 이 캐스트는 3·4 완료 전까지의 임시 타협이다. Task 4 마지막 스텝에서 12종이 다 차면 캐스트를 제거하고 `Record<SpeciesKey, Species>` 리터럴로 바꾼다)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/game/avatarV2`
Expected: PASS (compose 4 + hamster 구조 4)

- [ ] **Step 5: 갤러리 페이지**

`src/ui/AvatarGallery.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { composeAvatar } from '../game/avatarV2/compose'
import { PALETTES, type PaletteKey } from '../game/avatarV2/palettes'
import { REGISTERED_SPECIES } from '../game/avatarV2/species'
import { drawPixelMap } from '../game/sprite'

function Cell({ speciesIdx, palette, variant }: { speciesIdx: number; palette: PaletteKey; variant: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 32, 32)
    const sp = REGISTERED_SPECIES[speciesIdx]
    const { map, palette: colors } = composeAvatar(sp, palette, {
      eyes: variant, mouth: variant, cheeks: variant, accessory: variant,
    })
    drawPixelMap(ctx, map, colors, 0, 0, 1)
  }, [speciesIdx, palette, variant])
  return <canvas ref={ref} width={32} height={32} style={{ width: 96, imageRendering: 'pixelated' }} />
}

export function AvatarGallery() {
  const paletteKeys = Object.keys(PALETTES) as PaletteKey[]
  return (
    <main style={{ padding: 16 }}>
      {REGISTERED_SPECIES.map((sp, si) => (
        <section key={sp.key}>
          <h3 style={{ fontFamily: 'monospace' }}>{sp.key}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {paletteKeys.map((pk) =>
              [0, 1, 2, 3, 4].map((v) => <Cell key={`${pk}-${v}`} speciesIdx={si} palette={pk} variant={v} />),
            )}
          </div>
        </section>
      ))}
    </main>
  )
}
```
`src/App.tsx` 컴포넌트 첫 줄에:
```tsx
if (new URLSearchParams(window.location.search).has('gallery')) return <AvatarGallery />
```
(import 추가. 훅 호출보다 앞이면 안 되므로 실제로는 훅들 위가 아니라 **별도 컴포넌트 분기**로: `export function App() { if (...) return <AvatarGallery />; return <MainApp /> }` 형태로 기존 본문을 `MainApp`으로 감싼다)

- [ ] **Step 6: 검증**

Run: `npm test && npm run build`, 이어서 `npm run dev` 기동 → 컨트롤러가 `?gallery` 스크린샷으로 햄스터 40칸(8팔레트×5변형) 눈검증
Expected: 전체 PASS, 햄스터가 귀·볼·음영·외곽선을 갖춘 형태로 식별 가능

- [ ] **Step 7: Commit**

```bash
git add src/game/avatarV2 src/ui/AvatarGallery.tsx src/App.tsx
git commit -m "feat: 아바타 v2 합성 엔진·햄스터·갤러리"
```

---

### Task 3: 종 제작 1차 — 토끼·고양이·강아지·다람쥐·개구리

**Files:**
- Create: `src/game/avatarV2/species/rabbit.ts`, `cat.ts`, `dog.ts`, `squirrel.ts`, `frog.ts`
- Modify: `src/game/avatarV2/species/index.ts` (등록)
- Test: 기존 `species.test.ts`가 자동 커버

**Interfaces:**
- Consumes: `Species`/`Anchors` 타입, 격자 규격(플랜 상단), 햄스터 예시 (Task 2)
- Produces: `SPECIES`에 5종 추가 등록

- [ ] **Step 1: 종별 도트 제작** — 햄스터 파일을 복제해 시작하고, 종별 필수 특징을 반영한다 (32×32·바닥 정렬·앵커 규칙은 구조 테스트가 강제):
  - **rabbit**: 길고 곧은 귀 2개(rows 1~8, 귀 안쪽 W), 몸은 세로로 갸름, 앞니 W 1~2픽셀
  - **cat**: 삼각 귀(안쪽 D), 수염(양옆 O 가로선 2~3픽셀), 꼬리 한쪽 위로 말림
  - **dog**: 늘어진 귀(측면 D 덩어리), 주둥이 W 타원 + 코 O 2×2, 혀 C 1픽셀(입 아래)
  - **squirrel**: 등 뒤로 크게 말린 꼬리(몸 폭의 절반 이상, S 음영 줄무늬), 작은 둥근 귀
  - **frog**: 머리 위로 돌출한 눈두덩 2개(그 위에 anchors.eyes), 넓은 입, 몸은 낮고 넓게

- [ ] **Step 2: 구조 테스트 통과 확인**

Run: `npx vitest run src/game/avatarV2/species`
Expected: 6종 × 4 구조 테스트 PASS

- [ ] **Step 3: 갤러리 눈검증**

`npm run dev` → `?gallery` — 컨트롤러가 스크린샷으로 6종 × 8팔레트 확인. 종이 실루엣만으로 구별 가능해야 함. 미달 종은 다듬어 재확인

- [ ] **Step 4: Commit**

```bash
git add src/game/avatarV2/species
git commit -m "feat: 아바타 v2 종 5종 추가 (토끼·고양이·강아지·다람쥐·개구리)"
```

---

### Task 4: 종 제작 2차 — 새·우파루파·곰·펭귄·오리·물개 + 레지스트리 확정

**Files:**
- Create: `src/game/avatarV2/species/bird.ts`, `axolotl.ts`, `bear.ts`, `penguin.ts`, `duck.ts`, `seal.ts`
- Modify: `src/game/avatarV2/species/index.ts` (12종 등록 + 임시 캐스트 제거)
- Test: 기존 `species.test.ts` 자동 커버 + index 타입 확정

**Interfaces:**
- Consumes: Task 2·3과 동일
- Produces: **완성된 `SPECIES: Record<SpeciesKey, Species>`** (캐스트 없는 리터럴) — Task 5가 의존

- [ ] **Step 1: 종별 도트 제작**:
  - **bird**: 병아리형 — 둥근 몸, 부리 D 삼각형, 날개 스텁, 머리 위 더듬털 1~2픽셀
  - **axolotl**: 머리 양옆 겉아가미 3갈래씩(C 색), 웃는 넓은 입, 매끈한 몸
  - **bear**: 둥근 귀 2개(안쪽 D), 주둥이 W 타원 + 코 O, 몸집을 가장 크게(가로 폭 최대)
  - **penguin**: 배 전체 W, 부리 D, 날개는 몸에 붙은 형태, 발 D
  - **duck**: 납작 부리 D(가로로 넓게), 머리 깃 1픽셀, 몸통 둥글게
  - **seal**: 지느러미 팔, 꼬리 지느러미, 수염 O 점, 몸은 눕듯 낮고 길게

- [ ] **Step 2: index.ts 캐스트 제거** — 12종 리터럴 등록으로 `Record<SpeciesKey, Species>` 타입이 캐스트 없이 성립하는지 `npm run build`로 확인

- [ ] **Step 3: 테스트·갤러리**

Run: `npm test` (12종 × 4 구조 테스트 포함 전체 PASS) → 갤러리 12종 스크린샷 눈검증 (컨트롤러)

- [ ] **Step 4: Commit**

```bash
git add src/game/avatarV2/species
git commit -m "feat: 아바타 v2 12종 완성"
```

---

### Task 5: generateAvatar v2 교체 + 기존 캐릭터 단장 플로우

**Files:**
- Create: `src/game/avatarV2/generate.ts`
- Modify: `src/game/avatar.ts` (v2 위임 re-export로 교체), `src/character/CharacterCreate.tsx` (canvas 16→32, 프리필 prop), `src/App.tsx` (단장 배너 분기), `src/character/useCharacters.ts` (avatarSeed 반환 — select에 avatar_seed는 **불가**(컬럼 미grant)이므로 재생성 플로우는 답변 재입력이 아니라 기존 seed를 서버에서 받아야 함 → **Edge Function `upload-character`에 GET 모드 추가 대신, 단장 플로우는 답변 프리필 없이 새로 작성하는 것으로 단순화한다. 프리필은 하지 않는다** — 스펙의 "기존 답변 프리필" 문구를 이 결정으로 대체(사유: avatar_seed는 프라이버시상 클라이언트 미노출이 우선))
- Test: `src/game/avatarV2/generate.test.ts`

**Interfaces:**
- Consumes: Task 1~4 전부, 기존 `hashSeed` (src/game/avatar.ts에서 이동)
- Produces:
  - `generateAvatar(answers: string[], salt: number): { map: string[]; palette: Record<string, string> }` — **기존 시그니처 그대로**, 내부가 v2
  - 규칙: 종 = `matchSpecies(answers) ?? 해시 폴백`, 팔레트 = `matchPalette(answers) ?? 해시 폴백`, variant 4필드 = 해시(salt 반영) — **salt는 variant에만 영향**
  - CharacterCreate: canvas 32×32 (`width={32} height={32}`, 표시 240px 유지), 업로드 경로 무변경 (PNG 32×32 — Edge Function 32KB 캡 여유)
  - App: 이름 있는 캐릭터의 `regenCount === 0`이면 "분신이 새 모습으로 단장하고 싶어해요 ✨" 배너 → 클릭 시 CharacterCreate 진입(cards부터)

- [ ] **Step 1: Write the failing test**

`src/game/avatarV2/generate.test.ts`:
```ts
import { expect, test } from 'vitest'
import { generateAvatar } from './generate'

const HAMSTER_YELLOW = ['웃음 많은 사람', '볼 빵빵한 햄스터', '햇살 같은 노란색', '눈 비비는 모습']

test('키워드 반영: 노란 햄스터가 나온다', () => {
  const { map, palette } = generateAvatar(HAMSTER_YELLOW, 0)
  expect(map).toHaveLength(32)
  expect(palette.B).toBe('#fff3a5') // lemon
})

test('다시 뽑기(salt 변경)해도 종·팔레트 고정, 변형만 바뀜', () => {
  const a = generateAvatar(HAMSTER_YELLOW, 0)
  const variants = new Set(
    Array.from({ length: 8 }, (_, s) => JSON.stringify(generateAvatar(HAMSTER_YELLOW, s).map)),
  )
  for (let s = 1; s < 8; s++) {
    expect(generateAvatar(HAMSTER_YELLOW, s).palette.B).toBe(a.palette.B)
  }
  expect(variants.size).toBeGreaterThanOrEqual(2)
})

test('키워드 없으면 해시 폴백으로도 유효한 아바타 (결정적)', () => {
  const a = generateAvatar(['멋진 사람'], 3)
  expect(a).toEqual(generateAvatar(['멋진 사람'], 3))
  expect(a.map).toHaveLength(32)
})

test('기존 진입점(src/game/avatar.ts)도 같은 v2 결과', async () => {
  const legacy = await import('../avatar')
  expect(legacy.generateAvatar(HAMSTER_YELLOW, 0)).toEqual(generateAvatar(HAMSTER_YELLOW, 0))
})
```

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run src/game/avatarV2/generate.test.ts`

- [ ] **Step 3: 구현**

`src/game/avatarV2/generate.ts`:
```ts
import { composeAvatar } from './compose'
import { matchPalette, matchSpecies, SPECIES_KEYS } from './matching'
import { PALETTES, type PaletteKey } from './palettes'
import { SPECIES } from './species'

export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function generateAvatar(
  answers: string[],
  salt: number,
): { map: string[]; palette: Record<string, string> } {
  const joined = answers.map((a) => a.trim()).join('')
  const baseSeed = hashSeed(joined)          // 종·팔레트 폴백용 — salt 무관
  const variantSeed = hashSeed(joined + ':' + String(salt)) // 변형용 — salt 반영

  const paletteKeys = Object.keys(PALETTES) as PaletteKey[]
  const speciesKey = matchSpecies(answers) ?? SPECIES_KEYS[baseSeed % SPECIES_KEYS.length]
  const paletteKey = matchPalette(answers) ?? paletteKeys[(baseSeed >>> 8) % paletteKeys.length]

  return composeAvatar(SPECIES[speciesKey], paletteKey, {
    eyes: (variantSeed >>> 0) & 0xff,
    mouth: (variantSeed >>> 8) & 0xff,
    cheeks: (variantSeed >>> 16) & 0xff,
    accessory: (variantSeed >>> 24) & 0xff,
  })
}
```
`src/game/avatar.ts`는 본문을 삭제하고:
```ts
export { generateAvatar, hashSeed } from './avatarV2/generate'
```
기존 `avatar.test.ts`(v1 기준)는 삭제하고, 16×16을 전제하던 어서션이 있는지 전 테스트 grep으로 확인해 32×32로 갱신. `CharacterCreate.tsx`의 canvas `width={16} height={16}` → `32`/`32`, drawPixelMap scale 1 유지.

- [ ] **Step 4: 단장 배너** — `App.tsx`의 Stage 렌더 분기 위에: `mine && mine.name && mine.regenCount === 0`이면 상단 배너 컴포넌트(같은 파일 내 함수) "분신이 새 모습으로 단장하고 싶어해요 ✨ [단장하러 가기]" → state `redecorating: true`면 `<CharacterCreate onDone={() => { setRedecorating(false); refreshChars() }} />` 렌더. (regen_count 리셋은 Task 6 마이그레이션이 수행 — 리셋되면 regenCount 0이 되어 배너가 뜬다. 새 v2 확정 시 regen_count 1이 되어 배너 소멸)

- [ ] **Step 5: 전체 검증** — `npm test && npm run build`, dev 서버에서 생성 플로우 수동 확인(컨트롤러 E2E가 최종 검증)

- [ ] **Step 6: Commit**

```bash
git add src/game src/character src/App.tsx
git commit -m "feat: generateAvatar v2 교체·단장 배너"
```

---

### Task 6: DB 마이그레이션 — messages·goodnight·regen 리셋

**Files:**
- Create: `supabase/migrations/20260731000001_plan3.sql`
- Test: `supabase db push` + 스모크 쿼리

**Interfaces:**
- Consumes: 기존 스키마 (couples/profiles/characters/care_actions)
- Produces: `messages` 테이블(RLS·컬럼 grant), care_actions type에 `goodnight` 허용, 전 캐릭터 `regen_count=0`

- [ ] **Step 1: SQL 작성**

```sql
-- 메시지: 분신이 배달하는 짧은 마음 (140자)
create table messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  sender_user_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table messages enable row level security;

create policy "messages: 커플 조회" on messages for select
  using (couple_id = my_couple_id());
create policy "messages: 본인 발신" on messages for insert
  with check (sender_user_id = auth.uid() and couple_id = my_couple_id());
create policy "messages: 수신자만 읽음 처리" on messages for update
  using (couple_id = my_couple_id() and sender_user_id <> auth.uid())
  with check (couple_id = my_couple_id() and sender_user_id <> auth.uid());

-- 컬럼 스코프 (Plan 2 패턴): update는 read_at만
revoke update on table public.messages from authenticated, anon;
grant update (read_at) on table public.messages to authenticated;

-- 굿나잇 액션 타입 허용
alter table care_actions drop constraint care_actions_type_check;
alter table care_actions add constraint care_actions_type_check
  check (type in ('feed', 'pet', 'goodnight'));

-- 아바타 v2 단장: 전 캐릭터 업로드 캡 리셋
update characters set regen_count = 0;
```

- [ ] **Step 2: 적용·스모크**

Run: `supabase db push` 후:
```bash
supabase db query "select policyname from pg_policies where tablename='messages'"          # 3개
supabase db query "select column_name from information_schema.column_privileges where table_name='messages' and grantee='authenticated' and privilege_type='UPDATE'"  # read_at만
supabase db query "select pg_get_constraintdef(oid) from pg_constraint where conname='care_actions_type_check'"  # goodnight 포함
supabase db query "select max(regen_count) from characters"  # 0
```
(제약 이름이 `care_actions_type_check`가 아니면 먼저 `select conname from pg_constraint where conrelid='care_actions'::regclass and contype='c'`로 실명 확인 후 SQL 수정. `db query` 미지원 CLI면 Management API query 엔드포인트 사용 — Plan 2 Task 2 방식)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat: messages 테이블·goodnight 타입·regen 리셋 마이그레이션"
```

---

### Task 7: 도트 폰트 + SpeechBubble 컴포넌트

**Files:**
- Create: `public/fonts/` (폰트 파일+라이선스 사본), `src/ui/SpeechBubble.tsx`, `src/index.css`(@font-face — 없으면 생성해 main.tsx에서 import)
- Test: `npm test` 회귀 + 갤러리식 수동 확인

**Interfaces:**
- Consumes: 없음
- Produces: `<SpeechBubble x={number} y={number} onClose(): void>{children}</SpeechBubble>` — Canvas 스테이지 컨테이너 기준 절대배치 말풍선. 흰 배경·2px 도트풍 테두리·하단 꼬리·도트 폰트. 탭/클릭 시 onClose. Task 8·9가 사용

- [ ] **Step 1: 폰트 준비** — 웹서치로 "DungGeunMo 둥근모꼴 폰트 라이선스"를 확인한다. 둥근모꼴+Fixedsys(DungGeunMo)는 무료 배포 가능 라이선스로 알려져 있으나 **반드시 공식 배포처의 라이선스 문구를 확인**하고, 허용이면 woff2를 받아 `public/fonts/DungGeunMo.woff2` + `public/fonts/LICENSE-DungGeunMo.txt`(원문 사본)로 셀프호스팅한다. 라이선스가 부적합하면 대안(Galmuri 시리즈 — SIL OFL)으로 대체하고 보고서에 기록한다

- [ ] **Step 2: 스타일·컴포넌트**

`src/index.css`:
```css
@font-face {
  font-family: 'PixelKR';
  src: url('/fonts/DungGeunMo.woff2') format('woff2');
  font-display: swap;
}
```

`src/ui/SpeechBubble.tsx`:
```tsx
import type { ReactNode } from 'react'

export function SpeechBubble({
  x, y, onClose, children,
}: { x: number; y: number; onClose: () => void; children: ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%)',
        maxWidth: 220,
        background: '#ffffff',
        border: '3px solid #4a3f35',
        borderRadius: 12,
        padding: '8px 12px',
        fontFamily: 'PixelKR, monospace',
        fontSize: 14,
        lineHeight: 1.5,
        cursor: 'pointer',
        boxShadow: '2px 2px 0 #4a3f3533',
        wordBreak: 'break-all',
      }}
    >
      {children}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -12,
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '12px solid #4a3f35',
        }}
      />
    </div>
  )
}
```
Stage를 감싸는 relative 컨테이너가 필요하다: `Stage.tsx`의 canvas를 `<div style={{ position: 'relative' }}>`로 감싸고, 말풍선 좌표는 canvas 표시 크기 기준(캐릭터 x·y를 CSS 픽셀로 변환하는 헬퍼 `stageToCss(pos, canvasEl)`를 Stage에 추가해 Task 8·9가 쓰게 export — `canvas.getBoundingClientRect().width / STAGE_W` 배율 곱)

- [ ] **Step 3: 검증·Commit** — `npm test && npm run build` 후:

```bash
git add public/fonts src/ui/SpeechBubble.tsx src/index.css src/main.tsx src/ui/Stage.tsx
git commit -m "feat: 도트 폰트 셀프호스팅·말풍선 컴포넌트"
```

---

### Task 8: FSM deliver 상태 + 메시지 배달 연출 (TDD)

**Files:**
- Modify: `src/game/fsm.ts`, `src/game/render.ts`(편지 들고 있는 표시), `src/ui/Stage.tsx`
- Test: `src/game/fsm.test.ts`에 추가

**Interfaces:**
- Consumes: 기존 FSM(phaseMs·큐·오버플로 이월), SpeechBubble·stageToCss (Task 7)
- Produces:
  - `CharState`에 `'deliver'` 추가. `CharacterFsm`에 `startDeliver(): void`(평상시에만 진입, 액션 중이면 큐 뒤 자동 진입), `endDeliver(): void`(→ happy 1500ms)
  - deliver 중에는 앰비언트 전이 없음(말풍선 읽는 동안 유지), 캐릭터는 중앙 이동 없이 제자리(위치는 Walker 소유 원칙 유지) + 렌더에서 머리 위 ✉️ 픽셀 아이콘(render.ts에 6×5 봉투 스탬프)
  - Stage: `deliverRequest: boolean` prop… 대신 store 경유(Task 9의 pendingMessage). 이 태스크에서는 FSM·렌더만

- [ ] **Step 1: Write the failing test** (`fsm.test.ts`에 추가)

```ts
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
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/game/fsm.test.ts`

- [ ] **Step 3: 구현** — fsm에 `let deliverPending = false; let delivering = false` 플래그: `startDeliver()`는 pending 마킹, update 루프에서 액션·큐가 비었을 때 pending이면 `state='deliver'`(remainMs는 무한 대체로 `Number.POSITIVE_INFINITY`, phaseMs는 정상 누적), `endDeliver()`는 delivering 해제 후 `state='happy'; remainMs=1500; phaseMs=0`. deliver 중 enqueue된 care는 큐에 대기(deliver 종료 후 소비). render.ts: `state === 'deliver'`면 캐릭터 위 [머리 y-6] 위치에 6×5 봉투(테두리 O·몸 W·접힘선 O) `drawPixelMap` 스탬프

- [ ] **Step 4: PASS 확인·Commit**

```bash
git add src/game
git commit -m "feat: FSM deliver 상태와 편지 연출"
```

---

### Task 9: 메시지 — 보내기·배달·읽음·쪽지함

**Files:**
- Create: `src/messages/useMessages.ts`, `src/messages/SendNote.tsx`, `src/messages/Inbox.tsx`
- Modify: `src/ui/Stage.tsx`(배달 오케스트레이션), `src/App.tsx`(SendNote·Inbox 배치)
- Test: `src/messages/useMessages.test.ts`(순수 로직 부분)

**Interfaces:**
- Consumes: `supabase`, messages 스키마(Task 6), FSM deliver(Task 8), SpeechBubble(Task 7), `useGame`의 userId
- Produces:
  - `useMessages(coupleId, userId)`: `{ unread: Message[]; inbox: Message[]; send(body: string): Promise<boolean>; markRead(id: string): Promise<void>; refresh(): void }` — `Message { id; senderUserId; body; createdAt: Date; readAt: Date | null }`. inbox = 받은 것 최근 30개(read 포함), unread = 그중 read_at null (오래된 것부터)
  - `pickNextUnread(unread: Message[]): Message | null` — 순수 함수(오래된 것 우선), 테스트 대상
  - SendNote: 입력(140 maxLength)+전송 버튼, 성공 시 "분신이 배달하러 갔어요 💌" 토스트
  - 배달 플로우(Stage): unread 있으면 `fsm.startDeliver()` → 봉투 탭(canvas 클릭 판정: 캐릭터 박스 내) → SpeechBubble에 body 표시 → 닫기 탭 → `markRead` → `fsm.endDeliver()` → 다음 unread 있으면 반복
  - Inbox: 접기/펼치기 목록 ("💌 쪽지함 (n)")

- [ ] **Step 1: Write the failing test**

`src/messages/useMessages.test.ts`:
```ts
import { expect, test } from 'vitest'
import { pickNextUnread, type Message } from './useMessages'

const msg = (id: string, at: string, read: boolean): Message => ({
  id, senderUserId: 'p', body: 'hi', createdAt: new Date(at), readAt: read ? new Date() : null,
})

test('미읽음 중 가장 오래된 것부터', () => {
  const list = [msg('b', '2026-07-31T10:00:00Z', false), msg('a', '2026-07-31T09:00:00Z', false)]
  expect(pickNextUnread(list)?.id).toBe('a')
})

test('미읽음 없으면 null', () => {
  expect(pickNextUnread([msg('a', '2026-07-31T09:00:00Z', true)])).toBeNull()
  expect(pickNextUnread([])).toBeNull()
})
```

- [ ] **Step 2: fail 확인** → **Step 3: 구현** — useMessages는 useCouple 패턴(에러 보존·스테일 가드 latestKeyRef) 준수. `send`: insert 후 낙관적 없이 refresh. `markRead`: `update({ read_at: new Date().toISOString() }).eq('id', id)`. Stage 오케스트레이션: `unreadRef`를 rAF 루프 밖 React 상태로 두고, 캐릭터 클릭 판정은 canvas onClick에서 `stageToCss` 역변환으로 캐릭터 박스 검사

- [ ] **Step 4: PASS·빌드 확인** — `npm test && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/messages src/ui/Stage.tsx src/App.tsx
git commit -m "feat: 쪽지 보내기·분신 배달·읽음·쪽지함"
```

---

### Task 10: Realtime 채널 + 대기 화면 자동 진행

**Files:**
- Create: `src/realtime/useCoupleChannel.ts`
- Modify: `src/App.tsx`(구독 연결), `src/couple/WaitingPartner.tsx`(자동 진행 안내 문구), `src/ui/Stage.tsx` 또는 관련 훅 refresh 연결
- Test: `npm test` 회귀 (구독은 E2E 검증)

**Interfaces:**
- Consumes: `supabase`, couple 스키마
- Produces: `useCoupleChannel(coupleId: string | undefined, handlers: { onMessage?(): void; onCare?(): void; onProfile?(): void }): void` — `supabase.channel('couple:' + coupleId)`에 postgres_changes 3구독(INSERT messages / INSERT care_actions / UPDATE·INSERT profiles, 모두 `filter: 'couple_id=eq.' + coupleId` — profiles는 couple_id 필터), cleanup에서 `removeChannel`. 구독 성패와 무관하게 handlers는 기존 fetch/refresh 함수를 그대로 재사용 (실패 시 무해)

- [ ] **Step 1: 구현** — App에서 `useCoupleChannel(couple?.coupleId, { onMessage: refreshMessages, onCare: refreshCare, onProfile: refreshCouple })`. WaitingPartner의 "들어왔는지 확인" 버튼은 유지하되 문구에 "(자동으로도 넘어가요)" 추가. Supabase Realtime은 **기본으로 테이블이 publication에 없을 수 있음** — 마이그레이션 추가 없이 대시보드 대신 SQL로: `supabase/migrations/20260731000002_realtime.sql`에 `alter publication supabase_realtime add table messages, care_actions, profiles;` 작성 후 `db push` (이미 등록돼 있으면 무해한 에러 — `if exists` 불가하므로 `do $$ begin ... exception when duplicate_object then null; end $$;` 블록으로 감싼다)

- [ ] **Step 2: 검증** — `npm test && npm run build`, 실동작은 컨트롤러 E2E(두 브라우저 동시 접속: A 돌봄 → B 화면 몇 초 내 반영, A 쪽지 → B 분신 즉시 배달 진입)

- [ ] **Step 3: Commit**

```bash
git add src/realtime supabase/migrations src/App.tsx src/couple
git commit -m "feat: Realtime 커플 채널·대기 화면 자동 진행"
```

---

### Task 11: 상대 흔적 요약 + 굿나잇 의례 (TDD)

**Files:**
- Create: `src/traces/summarize.ts`, `src/game/night.ts`, `src/traces/TraceToast.tsx`
- Modify: `src/ui/CareButtons.tsx`(굿나잇 버튼), `src/game/render.ts`(어두운 방·취침), `src/ui/Stage.tsx`, `src/domain/care.ts`(CareType에 'goodnight')
- Test: `src/traces/summarize.test.ts`, `src/game/night.test.ts`

**Interfaces:**
- Consumes: `care_actions`(goodnight 허용 — Task 6), `dateKeySeoul`, `CareAction`
- Produces:
  - `CareType = 'feed' | 'pet' | 'goodnight'` (도메인 확장 — canCareToday 등 기존 함수 자동 적용)
  - `summarizeTraces(actions: CareAction[], partnerId: string, sinceIso: string | null): { count: number; text: string } | null` — 상대(partnerId)의 since 이후 액션 집계. null이면 토스트 없음. 문구: 1건 "OO가 다녀갔어 🍙", 여러 건 "OO가 N번 다녀갔어", goodnight 포함 시 "잘 자라고 인사하고 갔어 🌙" 우선
  - `hourSeoul(date: Date): number`, `isGoodnightWindow(now: Date): boolean`(21~23시 또는 0~2시), `isSleepScene(now: Date, hasGoodnightToday: boolean): boolean`(기록 있고 21시~06시. 단 0~06시 구간의 "오늘 기록"은 **전날 밤 기록도 포함** — dateKeySeoul(now)과 dateKeySeoul(now-9h) 두 날짜의 goodnight을 검사)
  - localStorage 키 `tinyou-last-trace-check` (ISO) — 토스트 표시 후 갱신
  - 렌더: sleep 장면이면 배경을 어둡게(#3a3452 계열 오버레이), 분신은 눈 감고 이불(S 색 사각) 덮은 정적 포즈, 굿나잇 버튼은 창 밖이면 hidden

- [ ] **Step 1: Write the failing tests**

`src/game/night.test.ts`:
```ts
import { expect, test } from 'vitest'
import { hourSeoul, isGoodnightWindow, isSleepScene } from './night'

test('서울 시각 추출', () => {
  expect(hourSeoul(new Date('2026-07-31T13:00:00Z'))).toBe(22)
  expect(hourSeoul(new Date('2026-07-31T16:30:00Z'))).toBe(1)
})

test('굿나잇 창: 21~03시(서울)', () => {
  expect(isGoodnightWindow(new Date('2026-07-31T12:00:00Z'))).toBe(true)  // 21시
  expect(isGoodnightWindow(new Date('2026-07-31T17:59:00Z'))).toBe(true) // 02:59
  expect(isGoodnightWindow(new Date('2026-07-31T18:00:00Z'))).toBe(false) // 03:00
  expect(isGoodnightWindow(new Date('2026-07-31T05:00:00Z'))).toBe(false) // 14시
})

test('취침 장면: 기록 있고 21~06시', () => {
  const night = new Date('2026-07-31T14:00:00Z') // 23시
  const morning = new Date('2026-07-31T22:30:00Z') // 다음날 07:30
  expect(isSleepScene(night, true)).toBe(true)
  expect(isSleepScene(night, false)).toBe(false)
  expect(isSleepScene(morning, true)).toBe(false)
})
```

`src/traces/summarize.test.ts`:
```ts
import { expect, test } from 'vitest'
import { summarizeTraces } from './summarize'
import type { CareAction } from '../domain/care'

const act = (type: CareAction['type'], at: string, who = 'partner'): CareAction => ({
  userId: who, type, createdAt: new Date(at),
})

test('since 이후 상대 액션만 집계', () => {
  const r = summarizeTraces(
    [act('feed', '2026-07-31T10:00:00Z'), act('pet', '2026-07-31T01:00:00Z'), act('feed', '2026-07-31T10:30:00Z', 'me')],
    'partner', '2026-07-31T05:00:00Z',
  )
  expect(r?.count).toBe(1)
})

test('goodnight 포함 시 문구 우선', () => {
  const r = summarizeTraces([act('goodnight', '2026-07-31T14:00:00Z')], 'partner', null)
  expect(r?.text).toContain('잘 자라고')
})

test('흔적 없으면 null', () => {
  expect(summarizeTraces([], 'partner', null)).toBeNull()
})
```

- [ ] **Step 2: fail 확인** → **Step 3: 구현** (hourSeoul은 `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: 'numeric', hourCycle: 'h23' })` 파싱) → **Step 4: UI/렌더 연결** — CareButtons에 조건부 🌙 버튼(care('goodnight')), Stage에서 `isSleepScene`이면 Scene에 `sleeping: true` 추가해 renderScene이 어두운 오버레이+이불 렌더, FSM은 sleeping 중 walk 억제(setMood처럼 `setSleeping(bool)` — 앰비언트가 idle 고정) → **Step 5: `npm test && npm run build`**

- [ ] **Step 6: Commit**

```bash
git add src/traces src/game src/ui src/domain
git commit -m "feat: 상대 흔적 요약·굿나잇 의례"
```

---

### Task 12: 설정(로그아웃) + E2E 확장 + 통합 검증

**Files:**
- Create: `src/ui/SettingsCorner.tsx`
- Modify: `src/App.tsx`, `src/state/store.ts`(reset 액션)
- Test: E2E (컨트롤러) + `npm test` 회귀

**Interfaces:**
- Consumes: `supabase.auth.signOut`, `useGame`
- Produces: 우상단 ⚙️ → "로그아웃" — signOut + `useGame.getState().reset()`(careLog/pending/characterId/userId 초기화) + localStorage의 trace-check 키 제거. E2E 시나리오 확장본이 이 플랜의 최종 게이트

- [ ] **Step 1: 구현** — store에 `reset(): void` 추가(초기값 셋). SettingsCorner: 고정 위치 버튼 + 클릭 시 confirm 후 로그아웃

- [ ] **Step 2: E2E 확장 (컨트롤러 수행)** — 기존 `scratchpad/e2e-tinyou.mjs`에 추가할 시나리오:
  1. A 답변에 "햄스터"+"노란색" 포함 → 확정 후 스테이지 아바타가 lemon 팔레트인지 canvas 픽셀 샘플로 검증
  2. 다시 뽑기 2회 — 종 실루엣 유지(전후 map의 외곽 바운딩박스 유사) 확인은 스크린샷 눈검증
  3. A가 쪽지 전송 → B 페이지에서 분신 봉투 상태 → 캐릭터 클릭 → 말풍선 텍스트 일치 → 닫기 → read_at 반영(DB 확인)
  4. B 동시 접속 상태에서 A 돌봄 → B 화면 수초 내 반영(Realtime)
  5. 굿나잇: 시스템 시간 조작 대신 DB에 goodnight 행을 admin으로 삽입해 어두운 방 렌더 확인(21시 이후에만 가능하므로 E2E에서는 isSleepScene 유닛테스트+수동으로 대체 가능 — 보고서에 명시)
  6. 로그아웃 → 로그인 화면 복귀 + 상태 초기화

- [ ] **Step 3: 전체 검증** — `npm test && npm run build` + E2E 전 항목

- [ ] **Step 4: Commit**

```bash
git add src/ui src/App.tsx src/state
git commit -m "feat: 설정·로그아웃, Plan 3 통합"
```

---

## 후속 (Plan 4 — 이 문서 범위 아님)

배포(nginx+cloudflared·도메인·Site URL 변경)·커스텀 SMTP(Resend)·PWA·커플 스트릭·간식 보내기·기념일 이벤트·꾸미기 UI·재생성 시 구 Storage 오브젝트 정리
