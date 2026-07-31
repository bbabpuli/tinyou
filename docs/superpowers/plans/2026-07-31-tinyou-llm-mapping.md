# Tinyou LLM 파츠 매핑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 질문 카드 답변 전체를 Claude Haiku가 의미로 이해해 12종·8팔레트 중 어울리는 조합을 고르게 하고, 실패 시 기존 사전+해시로 자연 강등한다.

**Architecture:** 새 Supabase Edge Function `map-avatar`가 Anthropic Messages API(구조화 출력)를 호출해 `{species, palette}`를 반환한다. 클라이언트는 "분신 만나러 가기" 시점에 1회 호출하고, 결과를 `generateAvatar(answers, salt, mapping)`의 override로 쓰며 `avatar_seed`에 함께 저장해 이후 재렌더를 LLM 없이 결정적으로 만든다.

**Tech Stack:** Supabase Edge Functions (Deno) + `npm:@anthropic-ai/sdk`, Claude Haiku 4.5 구조화 출력(json_schema), React 18 + TypeScript strict, Vitest.

## Global Constraints

- 모델 ID는 정확히 `claude-haiku-4-5` (날짜 접미사 금지)
- Anthropic API 키는 Supabase 함수 시크릿(`ANTHROPIC_API_KEY`)에만 존재 — 클라이언트 코드·레포·로그에 절대 노출 금지
- 답변 원문을 서버 로그(`console.log` 등)에 남기지 않는다 (연인 묘사 = 프라이버시)
- 매핑은 향상이지 의존성이 아님 — Edge Function 실패 시 기존 사전 매칭+해시 폴백으로 캐릭터 생성이 반드시 계속되어야 한다
- `generateAvatar`의 결정성·순수성 유지 (같은 answers+salt+mapping → 항상 같은 결과)
- avatar_seed 직렬화 4KB 캡(기존 upload-character 검증)을 넘지 않는다
- Edge Function은 CORS 프리플라이트(OPTIONS) 처리 필수 (Plan 2 교훈: 누락 시 브라우저 호출 전면 차단)
- 답변 합계 2,000자 초과 요청은 400 거부
- 사용자 노출 문구는 기존 한국어 반말+이모지 톤 유지

## File Structure

- `src/game/avatarV2/generate.ts` — `AvatarMapping` 타입 추가, 세 번째 인자 `mapping` override (수정)
- `src/game/avatarV2/generate.test.ts` — mapping override 단위 테스트 (수정 또는 생성)
- `supabase/functions/map-avatar/index.ts` — 신규 Edge Function (생성)
- `src/character/CharacterCreate.tsx` — 매핑 호출·상태·avatarSeed 확장 (수정)

---

### Task 1: generateAvatar mapping override

**Files:**
- Modify: `src/game/avatarV2/generate.ts`
- Test: `src/game/avatarV2/generate.test.ts` (없으면 생성)

**Interfaces:**
- Consumes: 기존 `matchSpecies`, `matchPalette`, `SPECIES_KEYS`(matching.ts), `PALETTES`(palettes.ts), `composeAvatar`(compose.ts)
- Produces: `export type AvatarMapping = { species?: string; palette?: string }`, `generateAvatar(answers: string[], salt: number, mapping?: AvatarMapping | null)` — Task 3이 이 시그니처를 사용

- [ ] **Step 1: 실패하는 테스트 작성**

`src/game/avatarV2/generate.test.ts`에 추가 (기존 파일이 있으면 describe 블록만 추가):

```ts
import { describe, expect, it } from 'vitest'
import { generateAvatar } from './generate'
import { PALETTES } from './palettes'

describe('generateAvatar mapping override', () => {
  // 사전에 안 걸리는 문장 — 기존 로직으로는 해시 폴백이 되는 입력
  const answers = ['겨울잠 잘 것 같고 안기면 포근한 사람', '', '', '']

  it('mapping이 있으면 종·팔레트를 override한다', () => {
    const withMapping = generateAvatar(answers, 0, { species: 'bear', palette: 'taupe' })
    // taupe 본체색이 실제 팔레트에 등장해야 한다
    expect(Object.values(withMapping.palette)).toContain(PALETTES.taupe.B)
  })

  it('mapping override는 salt가 바뀌어도 유지된다 (다시 뽑기 안정성)', () => {
    const a = generateAvatar(answers, 0, { species: 'bear', palette: 'taupe' })
    const b = generateAvatar(answers, 7, { species: 'bear', palette: 'taupe' })
    // 팔레트(색 집합)는 동일, 변형(map)은 달라질 수 있다
    expect(Object.values(a.palette)).toEqual(Object.values(b.palette))
  })

  it('잘못된 mapping 값은 필드 단위로 무시하고 기존 로직으로 폴백한다', () => {
    const invalid = generateAvatar(answers, 0, { species: 'dragon', palette: 'gold' })
    const fallback = generateAvatar(answers, 0)
    expect(invalid.map).toEqual(fallback.map)
    expect(invalid.palette).toEqual(fallback.palette)
  })

  it('mapping이 null/undefined면 기존과 완전히 동일하다', () => {
    const a = generateAvatar(answers, 3)
    const b = generateAvatar(answers, 3, null)
    expect(a.map).toEqual(b.map)
    expect(a.palette).toEqual(b.palette)
  })

  it('같은 입력이면 항상 같은 결과 (결정성)', () => {
    const a = generateAvatar(answers, 2, { species: 'seal', palette: 'sky' })
    const b = generateAvatar(answers, 2, { species: 'seal', palette: 'sky' })
    expect(a.map).toEqual(b.map)
    expect(a.palette).toEqual(b.palette)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/game/avatarV2/generate.test.ts`
Expected: FAIL (mapping 인자 미지원 — override 미동작으로 assertion 실패 또는 TS 타입 에러)

- [ ] **Step 3: 최소 구현**

`src/game/avatarV2/generate.ts`의 `generateAvatar`를 다음으로 교체 (hashSeed는 그대로):

```ts
import { composeAvatar } from './compose'
import { matchPalette, matchSpecies, SPECIES_KEYS, type SpeciesKey } from './matching'
import { PALETTES, type PaletteKey } from './palettes'
import { SPECIES } from './species'

// LLM(map-avatar)이 고른 종·팔레트. 유효하지 않은 값은 필드 단위로 무시된다.
export type AvatarMapping = { species?: string; palette?: string }

export function generateAvatar(
  answers: string[],
  salt: number,
  mapping?: AvatarMapping | null,
): { map: string[]; palette: Record<string, string> } {
  const joined = answers.map((a) => a.trim()).join('')
  const baseSeed = hashSeed(joined) // 종·팔레트 폴백용 — salt 무관
  const variantSeed = hashSeed(joined + ':' + String(salt)) // 변형용 — salt 반영

  const paletteKeys = Object.keys(PALETTES) as PaletteKey[]
  const mappedSpecies =
    mapping?.species && (SPECIES_KEYS as readonly string[]).includes(mapping.species)
      ? (mapping.species as SpeciesKey)
      : null
  const mappedPalette =
    mapping?.palette && paletteKeys.includes(mapping.palette as PaletteKey)
      ? (mapping.palette as PaletteKey)
      : null

  const speciesKey =
    mappedSpecies ?? matchSpecies(answers) ?? SPECIES_KEYS[baseSeed % SPECIES_KEYS.length]
  const paletteKey =
    mappedPalette ?? matchPalette(answers) ?? paletteKeys[(baseSeed >>> 8) % paletteKeys.length]

  return composeAvatar(SPECIES[speciesKey], paletteKey, {
    eyes: (variantSeed >>> 0) & 0xff,
    mouth: (variantSeed >>> 8) & 0xff,
    cheeks: (variantSeed >>> 16) & 0xff,
    accessory: (variantSeed >>> 24) & 0xff,
  })
}
```

주의: `matching.ts`가 `SpeciesKey` 타입을 export하는지 확인하고, 안 하면 export 추가 (`export type SpeciesKey = ...`는 이미 존재).

- [ ] **Step 4: 전체 테스트 통과 확인**

Run: `npx vitest run`
Expected: 기존 146개 + 신규 5개 전부 PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/avatarV2/generate.ts src/game/avatarV2/generate.test.ts
git commit -m "feat: generateAvatar에 LLM 매핑 override 인자 추가"
```

---

### Task 2: map-avatar Edge Function

**Files:**
- Create: `supabase/functions/map-avatar/index.ts`

**Interfaces:**
- Consumes: 없음 (독립 함수). 종·팔레트 키 목록은 클라이언트 `SPECIES_KEYS`/`PALETTES`와 문자열이 일치해야 한다 (hamster·rabbit·cat·dog·squirrel·frog·bird·axolotl·bear·penguin·duck·seal / pink·mint·lavender·peach·sky·lemon·cream·taupe)
- Produces: `POST /functions/v1/map-avatar` body `{ answers: string[] }` → 200 `{ species: string, palette: string }`, 실패 시 4xx/5xx `{ error: string }`. Task 3이 이 계약을 사용

- [ ] **Step 1: 함수 작성**

`supabase/functions/map-avatar/index.ts`:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const MAX_TOTAL_CHARS = 2000 // 답변 합계 상한 — 남용·비용 가드
const MODEL = 'claude-haiku-4-5'

const SPECIES_KEYS = [
  'hamster', 'rabbit', 'cat', 'dog', 'squirrel', 'frog',
  'bird', 'axolotl', 'bear', 'penguin', 'duck', 'seal',
] as const
const PALETTE_KEYS = [
  'pink', 'mint', 'lavender', 'peach', 'sky', 'lemon', 'cream', 'taupe',
] as const

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const SYSTEM_PROMPT = `너는 연인 묘사를 읽고 그 사람과 가장 어울리는 픽셀 동물 캐릭터를 고르는 큐레이터다.
키워드 표면 매칭이 아니라 묘사 전체의 인상(성격·분위기·체형·습관)으로 판단한다.
단, 답변이 동물을 직접 지목하면(예: "햄스터 같아") 그 동물을 우선한다.

종(species) 후보와 성격:
- hamster: 작고 통통, 볼이 빵빵, 먹는 걸 좋아함, 부지런히 오물오물
- rabbit: 여리고 순함, 겁 많음, 깡총거리는 생기
- cat: 도도하고 독립적, 츤데레, 우아함
- dog: 사교적이고 다정함, 반겨줌, 충직하고 해맑음
- squirrel: 재빠르고 야무짐, 알뜰살뜰 챙김, 호기심
- frog: 엉뚱하고 낙천적, 개성 강함, 통통 튐
- bird: 수다스럽고 명랑함, 아침형, 지저귀듯 조잘조잘
- axolotl: 몽글몽글 신비함, 무표정 속 귀여움, 마이페이스
- bear: 듬직하고 포근함, 큰 덩치, 안기고 싶은 안정감, 잠 많음
- penguin: 뒤뚱뒤뚱 성실함, 추위에 강한 꾸준함, 단체생활
- duck: 태평하고 유유자적, 물 흐르듯 느긋함, 꽥 하고 웃김
- seal: 물살처럼 부드러움, 통통하고 매끈, 애교 많고 잘 웃음

팔레트(palette) 후보와 인상:
- pink: 분홍 — 사랑스럽고 발랄
- mint: 민트·연두 — 싱그럽고 상쾌
- lavender: 연보라 — 차분하고 몽환적
- peach: 살구·주황 — 따뜻하고 활기참
- sky: 하늘·파랑 — 시원하고 맑음
- lemon: 노랑 — 밝고 햇살 같음
- cream: 흰색·아이보리 — 순하고 포근
- taupe: 갈색·회갈 — 듬직하고 차분

반드시 위 키 문자열 그대로 species 하나, palette 하나를 고른다.`

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    species: { type: 'string', enum: [...SPECIES_KEYS] },
    palette: { type: 'string', enum: [...PALETTE_KEYS] },
  },
  required: ['species', 'palette'],
  additionalProperties: false,
} as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'UNAUTHORIZED' })

  let payload: { answers?: unknown }
  try {
    payload = (await req.json()) as { answers?: unknown }
  } catch {
    return json(400, { error: 'BAD_REQUEST' })
  }
  const answers = payload.answers
  if (!Array.isArray(answers) || answers.some((a) => typeof a !== 'string')) {
    return json(400, { error: 'BAD_REQUEST' })
  }
  const texts = (answers as string[]).map((a) => a.trim()).filter(Boolean)
  const total = texts.reduce((n, t) => n + t.length, 0)
  if (texts.length === 0 || total > MAX_TOTAL_CHARS) return json(400, { error: 'BAD_REQUEST' })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json(503, { error: 'MAPPING_UNAVAILABLE' })

  const anthropic = new Anthropic({ apiKey })
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      messages: [{ role: 'user', content: `연인 묘사:\n${texts.join('\n')}` }],
    })
    const text = response.content.find((b) => b.type === 'text')?.text
    if (!text) return json(502, { error: 'MAPPING_FAILED' })
    const mapping = JSON.parse(text) as { species: string; palette: string }
    // 스키마 강제로 이미 enum이 보장되지만, 서버가 최종 권위로 한 번 더 확인
    if (
      !(SPECIES_KEYS as readonly string[]).includes(mapping.species) ||
      !(PALETTE_KEYS as readonly string[]).includes(mapping.palette)
    ) {
      return json(502, { error: 'MAPPING_FAILED' })
    }
    return json(200, mapping)
  } catch {
    // 답변 원문은 로그에 남기지 않는다 (프라이버시)
    return json(502, { error: 'MAPPING_FAILED' })
  }
})
```

- [ ] **Step 2: 배포**

Run: `supabase functions deploy map-avatar --use-api`
Expected: 성공 로그, `supabase functions list`에 map-avatar 표시

- [ ] **Step 3: 라우팅·인증 스모크 (키 불필요)**

```bash
# 프리플라이트 — 200이어야 브라우저 호출 가능
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS \
  https://hhdspjlnxgcwpbughsdb.supabase.co/functions/v1/map-avatar \
  -H 'Access-Control-Request-Method: POST' -H 'Origin: http://localhost:5173'
# 무인증 POST — 401
curl -s -X POST https://hhdspjlnxgcwpbughsdb.supabase.co/functions/v1/map-avatar \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"answers":["테스트"]}'
```

Expected: OPTIONS 200 (또는 204), 무인증 POST `{"error":"UNAUTHORIZED"}`
참고: 시크릿 미설정 상태의 인증된 호출은 503 `MAPPING_UNAVAILABLE` — 시맨틱 검증은 컨트롤러가 시크릿 설정 후 최종 검증에서 수행.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/map-avatar/index.ts
git commit -m "feat: map-avatar Edge Function — Haiku 구조화 출력으로 종·팔레트 선택"
```

---

### Task 3: CharacterCreate 연동

**Files:**
- Modify: `src/character/CharacterCreate.tsx`

**Interfaces:**
- Consumes: Task 1의 `generateAvatar(answers, salt, mapping)` + `AvatarMapping` 타입, Task 2의 `map-avatar` 계약
- Produces: `avatarSeed`가 `{ answers, salt, mapping }` 형태로 upload-character에 전달됨 (mapping은 null 가능)

- [ ] **Step 1: 구현**

`src/character/CharacterCreate.tsx` 변경점:

```tsx
// import 교체
import { generateAvatar, type AvatarMapping } from '../game/avatar'

// 상태 추가 (기존 state들 옆)
const [mapping, setMapping] = useState<AvatarMapping | null>(null)

// 미리보기 effect에서 mapping 전달
const { map, palette } = generateAvatar(answers, attempt, mapping)
// (effect 의존성 배열에 mapping 추가: [answers, attempt, step, mapping])

// generate()를 비동기 매핑 호출로 교체
const generate = async () => {
  setBusy(true)
  setError(null)
  try {
    const { data, error } = await supabase.functions.invoke('map-avatar', {
      body: { answers },
    })
    // 실패는 조용히 폴백 — 매핑은 향상이지 의존성이 아님
    setMapping(!error && data?.species ? { species: data.species, palette: data.palette } : null)
  } catch {
    setMapping(null)
  }
  setBusy(false)
  setStep('preview')
}

// cards 화면 버튼 문구 (busy 중)
{busy ? '분신을 상상하는 중… ✨' : '분신 만나러 가기'}

// confirmName의 avatarSeed에 mapping 포함
body: { imageBase64: base64, name, avatarSeed: { answers, salt: attempt, mapping } },
```

주의: `src/game/avatar.ts` 재-export에 `AvatarMapping` 타입 추가 필요:

```ts
export { generateAvatar, hashSeed } from './avatarV2/generate'
export type { AvatarMapping } from './avatarV2/generate'
```

- [ ] **Step 2: 타입·기존 테스트 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 타입 에러 0, 전 테스트 PASS

- [ ] **Step 3: Commit**

```bash
git add src/character/CharacterCreate.tsx src/game/avatar.ts
git commit -m "feat: 캐릭터 생성 시 map-avatar 매핑 적용 및 avatar_seed 보존"
```

---

## 최종 검증 (컨트롤러 직접 수행 — 시크릿 필요)

1. `supabase secrets set ANTHROPIC_API_KEY=<사용자 제공 키>` (키는 셸 히스토리 주의 — 파일 경유 권장)
2. 인증된 curl (테스트 계정 토큰)로 `{"answers":["겨울잠 잘 것 같고 안기면 포근한 사람"]}` → `{"species":"bear", ...}` 확인
3. E2E: 테스트 계정으로 사전 미등재 문장 입력 → 미리보기 픽셀에서 해당 팔레트 색 존재 확인, 다시 뽑기 후에도 동일 팔레트 유지 확인
4. 폴백 확인: 시크릿 임시 제거(또는 함수명 오타 호출) 상태에서 생성 플로우가 기존 로직으로 계속되는지 확인 후 복구
