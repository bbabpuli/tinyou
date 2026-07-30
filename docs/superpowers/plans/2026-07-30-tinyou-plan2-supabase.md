# Tinyou Plan 2: Supabase 연동 + AI 캐릭터 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 1의 로컬 플레이그라운드를 진짜 커플 앱으로 — 매직링크 로그인, 1:1 초대 방, 질문 카드로 연인 묘사 → Recraft로 픽셀아트 분신 생성, 돌봄 기록의 DB 이전, 그리고 Plan 1에서 파킹한 캐릭터 위치 점프 해소.

**Architecture:** Supabase가 Auth/Postgres(RLS)/Storage/Edge Function을 전담한다. 클라이언트는 anon key로 자기 커플 데이터만 접근(RLS), 이미지 생성은 Edge Function이 service role + Recraft API로 수행해 API 키를 클라이언트에 노출하지 않는다. 렌더 파트는 "캐릭터가 x좌표를 기억하는" Walker 엔티티를 도입해 상태 전환 순간이동을 구조적으로 제거하고, BLOB_MAP 폴백 위에 생성 이미지를 그린다.

**Tech Stack:** 기존(Vite+React+TS, zustand, Vitest) + `@supabase/supabase-js`, Supabase CLI(마이그레이션·함수 배포), Recraft V4.1 API(픽셀아트·투명 PNG).

## Global Constraints

- 기존 Plan 1 제약 유지: TypeScript strict, 날짜 판정은 `dateKeySeoul()` 계열(서버는 `Asia/Seoul` 변환 generated column)만, 캐릭터 사망 없음, 돌봄은 사용자·종류별 하루 1회
- 새 런타임 의존성은 `@supabase/supabase-js` 하나만 추가
- AI 사용은 캐릭터 이미지 생성뿐. 생성 횟수는 **1인당 총 4회**(초기 1 + 재생성 3, 스펙의 비용 가드) — Edge Function이 서버측에서 강제
- Recraft/service role 키는 Supabase 함수 시크릿에만 존재. 클라이언트 번들에는 anon key만
- `.env.local`은 커밋 금지 (`.env.example`만 커밋)
- 커플 방은 정확히 2인. 초대 코드는 6자리 숫자
- 이미지는 Storage 공개 버킷 `characters`에 UUID 경로로 저장 (URL 추측 불가로 프라이버시 확보 — 토이 수준 트레이드오프, 스펙 허용)
- 이 계획 범위 밖: 메시지 배달, Realtime 구독, 꾸미기(unlocks), PWA manifest, 배포, 자율 대화 AI (Plan 3)
- 작업 디렉터리: `/Users/leedongeun/Documents/toy-project/tinyou`

## 사전 조건 (실행 시작 전 사용자 제공 필요)

1. Supabase 프로젝트 (URL + anon key + project ref) — 사용자가 supabase.com에서 생성
2. Recraft API 키 — 사용자가 recraft.ai 가입 후 발급 ($1 크레딧으로도 테스트 충분)
3. 로컬에 Supabase CLI (`brew install supabase/tap/supabase`) + `supabase login`

---

### Task 1: Supabase 클라이언트 셋업

**Files:**
- Create: `src/lib/supabase.ts`, `.env.example`
- Modify: `package.json`(의존성), `.gitignore`, `src/vite-env.d.ts`
- Test: 없음 (설정 태스크 — 빌드 성공이 게이트)

**Interfaces:**
- Consumes: 사용자 제공 `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Produces: `supabase` 싱글턴 (`SupabaseClient`) — 이후 모든 태스크가 import

- [ ] **Step 1: 의존성 설치**

Run: `npm install @supabase/supabase-js`

- [ ] **Step 2: 파일 작성**

`.env.example`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

`.gitignore`에 두 줄 추가:
```
.env.local
supabase/.temp/
```

`src/vite-env.d.ts` (없으면 생성):
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

`src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 .env.local에 필요합니다')
}

export const supabase = createClient(url, anonKey)
```

- [ ] **Step 3: 검증**

Run: `npm test && npm run build`
Expected: 기존 66개 테스트 PASS, 빌드 성공 (`.env.local`이 없어도 빌드는 성공 — throw는 런타임)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: supabase 클라이언트 셋업"
```

---

### Task 2: DB 스키마 마이그레이션 (테이블·RLS·RPC·Storage)

**Files:**
- Create: `supabase/migrations/20260730000001_init.sql`, `supabase/config.toml`(CLI init 산출물)
- Test: SQL 스모크 (Step 4)

**Interfaces:**
- Consumes: 없음
- Produces: 테이블 `profiles`, `couples`, `characters`, `care_actions`; RPC `create_couple(p_nickname text) → text`, `join_couple(p_code text, p_nickname text) → uuid`; 공개 버킷 `characters`. 이후 모든 태스크가 이 스키마에 의존

- [ ] **Step 1: CLI 초기화 및 프로젝트 링크**

Run: `supabase init && supabase link --project-ref <사용자 제공 ref>`
(controller가 ref를 제공한다. `supabase/config.toml`이 생성됨)

- [ ] **Step 2: 마이그레이션 SQL 작성**

`supabase/migrations/20260730000001_init.sql`:
```sql
-- 커플(1:1 방)
create table couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '',
  couple_id uuid references couples(id),
  created_at timestamptz not null default now()
);

-- 분신: 커플당 2개, owner = 키우는 사람, subject = 묘사된 사람
create table characters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  owner_user_id uuid not null references auth.users(id),
  subject_user_id uuid not null references auth.users(id),
  name text,
  image_path text,
  regen_count int not null default 0, -- 생성 시도 횟수 (한도 4 = 초기1 + 재생성3)
  created_at timestamptz not null default now(),
  unique (couple_id, owner_user_id)
);

-- 돌봄 기록. "하루" 판정은 Asia/Seoul (스펙 결정) — 프론트 dateKeySeoul과 동일 기준
create table care_actions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id),
  user_id uuid not null references auth.users(id),
  type text not null check (type in ('feed', 'pet')),
  created_at timestamptz not null default now(),
  care_date date not null generated always as ((created_at at time zone 'Asia/Seoul')::date) stored,
  unique (character_id, user_id, type, care_date)
);

-- RLS: 자기 커플 데이터만
alter table couples enable row level security;
alter table profiles enable row level security;
alter table characters enable row level security;
alter table care_actions enable row level security;

create function my_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from profiles where user_id = auth.uid()
$$;

create policy "profiles: 자신 + 커플 상대 조회" on profiles for select
  using (user_id = auth.uid() or (couple_id is not null and couple_id = my_couple_id()));
create policy "profiles: 자기 행 수정" on profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "couples: 소속 방 조회" on couples for select using (id = my_couple_id());

create policy "characters: 커플 조회" on characters for select using (couple_id = my_couple_id());
create policy "characters: owner 이름 짓기" on characters for update
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
-- insert/이미지 갱신은 Edge Function(service role)만 수행 — 클라이언트 insert 정책 없음

create policy "care: 커플 조회" on care_actions for select
  using (character_id in (select id from characters where couple_id = my_couple_id()));
create policy "care: 본인 기록" on care_actions for insert
  with check (
    user_id = auth.uid()
    and character_id in (select id from characters where couple_id = my_couple_id())
  );

-- 방 만들기: 초대 코드 반환. profiles upsert 포함
create function create_couple(p_nickname text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_couple_id uuid;
begin
  if (select couple_id from profiles where user_id = auth.uid()) is not null then
    raise exception 'ALREADY_IN_COUPLE';
  end if;
  for i in 1..10 loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    begin
      insert into couples (invite_code) values (v_code) returning id into v_couple_id;
      exit;
    exception when unique_violation then
      if i = 10 then raise exception 'CODE_GEN_FAILED'; end if;
    end;
  end loop;
  insert into profiles (user_id, nickname, couple_id) values (auth.uid(), p_nickname, v_couple_id)
    on conflict (user_id) do update set nickname = excluded.nickname, couple_id = excluded.couple_id;
  return v_code;
end $$;

-- 코드로 합류: 정확히 2인 제한
create function join_couple(p_code text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_couple_id uuid;
  v_members int;
begin
  if (select couple_id from profiles where user_id = auth.uid()) is not null then
    raise exception 'ALREADY_IN_COUPLE';
  end if;
  select id into v_couple_id from couples where invite_code = p_code;
  if v_couple_id is null then
    raise exception 'INVALID_CODE';
  end if;
  select count(*) into v_members from profiles where couple_id = v_couple_id;
  if v_members >= 2 then
    raise exception 'COUPLE_FULL';
  end if;
  insert into profiles (user_id, nickname, couple_id) values (auth.uid(), p_nickname, v_couple_id)
    on conflict (user_id) do update set nickname = excluded.nickname, couple_id = excluded.couple_id;
  return v_couple_id;
end $$;

-- 캐릭터 이미지 공개 버킷 (UUID 경로로 추측 불가)
insert into storage.buckets (id, name, public) values ('characters', 'characters', true);
create policy "characters bucket: 공개 읽기" on storage.objects for select
  using (bucket_id = 'characters');
-- 업로드는 Edge Function(service role)만 — insert 정책 없음
```

- [ ] **Step 3: 마이그레이션 적용**

Run: `supabase db push`
Expected: `20260730000001_init.sql` 적용 성공

- [ ] **Step 4: SQL 스모크 (원격 DB에 실행)**

Run: `supabase db query "select tablename from pg_tables where schemaname='public' order by 1"` 로 4개 테이블 확인. 이어서:
```bash
supabase db query "select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname in ('create_couple','join_couple','my_couple_id')"
supabase db query "select id, public from storage.buckets where id='characters'"
supabase db query "select relrowsecurity from pg_class where relname='care_actions'"
```
Expected: RPC 3개, 버킷 public=true, RLS true.
(CLI 버전에 `db query`가 없으면 대시보드 SQL Editor에서 동일 쿼리 실행으로 대체하고 결과를 보고서에 기록)

- [ ] **Step 5: Commit**

```bash
git add supabase .gitignore
git commit -m "feat: DB 스키마·RLS·커플 RPC·Storage 버킷 마이그레이션"
```

---

### Task 3: 인증 — useSession 훅 + 매직링크 로그인 화면

**Files:**
- Create: `src/auth/useSession.ts`, `src/auth/LoginScreen.tsx`
- Test: 수동 (Step 3 — 실제 메일 수신 필요. 로직이 supabase SDK 얇은 래퍼라 유닛 테스트 대상 아님)

**Interfaces:**
- Consumes: `supabase` (Task 1)
- Produces: `useSession(): { session: Session | null; loading: boolean }`, `<LoginScreen />` (이메일 입력 → `signInWithOtp`). Task 8의 App 라우팅이 사용

- [ ] **Step 1: 구현**

`src/auth/useSession.ts`:
```ts
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
```

`src/auth/LoginScreen.tsx`:
```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <h2>티뉴에 어서오세요 🐣</h2>
      {sent ? (
        <p>메일함을 확인해주세요! 로그인 링크를 보냈어요.</p>
      ) : (
        <>
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button disabled={!email.includes('@')} onClick={send}>
            로그인 링크 받기 ✉️
          </button>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 타입·빌드 확인**

Run: `npm test && npm run build`
Expected: PASS (아직 App에 연결 전 — 연결은 Task 8)

- [ ] **Step 3: 수동 스모크 (임시 연결)**

`src/App.tsx`의 `<main>` 최상단에 임시로 `<LoginScreen />`을 추가하고 `npm run dev` → 본인 이메일 입력 → 메일의 링크 클릭 → 리다이렉트 후 개발자도구에서 `localStorage`에 `sb-...-auth-token` 생김 확인. 확인 후 임시 연결 제거.

- [ ] **Step 4: Commit**

```bash
git add src/auth
git commit -m "feat: 매직링크 인증 (useSession, LoginScreen)"
```

---

### Task 4: 커플 방 — useCouple 훅 + 방 만들기/합류 화면

**Files:**
- Create: `src/couple/useCouple.ts`, `src/couple/CoupleSetup.tsx`
- Test: 수동 (RPC 동작은 Task 2 스모크 + Task 8 통합 검증에서. 훅은 SDK 얇은 래퍼)

**Interfaces:**
- Consumes: `supabase`, RPC `create_couple`/`join_couple` (Task 2)
- Produces:
  - `interface CoupleInfo { coupleId: string; myNickname: string; partner: { userId: string; nickname: string } | null }`
  - `useCouple(userId: string | undefined): { couple: CoupleInfo | null; loading: boolean; refresh(): void }`
  - `<CoupleSetup onDone(): void />` — 방 생성(코드 표시) 또는 코드 입력 합류
  - Task 8 라우팅, Task 5/7 캐릭터 플로우가 사용

- [ ] **Step 1: 구현**

`src/couple/useCouple.ts`:
```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CoupleInfo {
  coupleId: string
  myNickname: string
  partner: { userId: string; nickname: string } | null
}

export function useCouple(userId: string | undefined) {
  const [couple, setCouple] = useState<CoupleInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!userId) return
    setLoading(true)
    supabase
      .from('profiles')
      .select('user_id, nickname, couple_id')
      .not('couple_id', 'is', null)
      .then(({ data }) => {
        const me = data?.find((p) => p.user_id === userId)
        if (!me?.couple_id) {
          setCouple(null)
        } else {
          const partner = data?.find((p) => p.user_id !== userId && p.couple_id === me.couple_id)
          setCouple({
            coupleId: me.couple_id,
            myNickname: me.nickname,
            partner: partner ? { userId: partner.user_id, nickname: partner.nickname } : null,
          })
        }
        setLoading(false)
      })
  }, [userId])

  useEffect(refresh, [refresh])
  return { couple, loading, refresh }
}
```

`src/couple/CoupleSetup.tsx`:
```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function CoupleSetup({ onDone }: { onDone: () => void }) {
  const [nickname, setNickname] = useState('')
  const [mode, setMode] = useState<'menu' | 'created' | 'join'>('menu')
  const [code, setCode] = useState('')
  const [myCode, setMyCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setError(null)
    const { data, error } = await supabase.rpc('create_couple', { p_nickname: nickname })
    if (error) setError(error.message)
    else {
      setMyCode(data as string)
      setMode('created')
    }
  }

  const join = async () => {
    setError(null)
    const { error } = await supabase.rpc('join_couple', { p_code: code, p_nickname: nickname })
    if (error) {
      const msg = error.message.includes('INVALID_CODE')
        ? '코드를 다시 확인해주세요'
        : error.message.includes('COUPLE_FULL')
          ? '이미 두 명이 함께하고 있는 방이에요'
          : error.message
      setError(msg)
    } else onDone()
  }

  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <h2>둥지 만들기 🪺</h2>
      <input placeholder="내 닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />
      {mode === 'menu' && (
        <>
          <button disabled={!nickname} onClick={create}>새 둥지 만들기</button>
          <button disabled={!nickname} onClick={() => setMode('join')}>초대 코드로 합류</button>
        </>
      )}
      {mode === 'created' && (
        <>
          <p>연인에게 이 코드를 보내주세요:</p>
          <strong style={{ fontSize: 32, letterSpacing: 4 }}>{myCode}</strong>
          <button onClick={onDone}>연인이 들어왔어요 →</button>
        </>
      )}
      {mode === 'join' && (
        <>
          <input placeholder="6자리 코드" value={code} maxLength={6}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button disabled={code.length !== 6} onClick={join}>합류하기</button>
        </>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: 타입·빌드 확인**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/couple
git commit -m "feat: 커플 방 생성·초대 코드 합류"
```

---

### Task 5: 질문 카드 데이터 + 프롬프트 조합 (TDD)

**Files:**
- Create: `supabase/functions/_shared/prompt.ts`, `src/character/questions.ts`
- Test: `src/character/prompt.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `QUESTIONS: { id: string; title: string; placeholder: string }[]` (4개 카드)
  - `buildCharacterPrompt(answers: string[]): string` — Edge Function(Task 6)과 테스트가 공유. **Deno API 사용 금지** (Vitest에서도 import되는 순수 TS)

- [ ] **Step 1: Write the failing test**

`src/character/prompt.test.ts`:
```ts
import { expect, test } from 'vitest'
import { buildCharacterPrompt } from '../../supabase/functions/_shared/prompt'

test('답변들을 마침표로 연결하고 픽셀아트 스타일 키워드를 포함', () => {
  const p = buildCharacterPrompt(['밝고 웃음이 많은 사람', '햇살 같은 노란색'])
  expect(p).toContain('밝고 웃음이 많은 사람. 햇살 같은 노란색')
  expect(p).toContain('pixel art')
  expect(p).toContain('cute')
})

test('빈 답변·공백은 걸러냄', () => {
  const p = buildCharacterPrompt(['  ', '고양이 같음', ''])
  expect(p).toContain('고양이 같음')
  expect(p).not.toContain('. .')
})

test('답변이 모두 비어도 기본 프롬프트는 유효', () => {
  const p = buildCharacterPrompt([])
  expect(p).toContain('pixel art')
  expect(p.length).toBeGreaterThan(30)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/character/prompt.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`supabase/functions/_shared/prompt.ts`:
```ts
// Edge Function(Deno)과 Vitest가 공유 — Deno/Node 전용 API 사용 금지
export function buildCharacterPrompt(answers: string[]): string {
  const description = answers
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .join('. ')
  const subject = description.length > 0 ? `${description}. ` : ''
  return (
    `cute pixel art character portrait, chibi proportions, ${subject}` +
    `simple shapes, soft pastel colors, friendly face, 64x64 retro game sprite style, ` +
    `single character centered, plain background`
  )
}
```

`src/character/questions.ts`:
```ts
export interface QuestionCard {
  id: string
  title: string
  placeholder: string
}

export const QUESTIONS: QuestionCard[] = [
  { id: 'first-meet', title: '처음 만났을 때 어땠어요?', placeholder: '예) 카페에서 웃는 모습에 반했어요' },
  { id: 'animal', title: '연인을 동물로 표현하면?', placeholder: '예) 볼이 빵빵한 햄스터' },
  { id: 'color-vibe', title: '연인의 색과 분위기는?', placeholder: '예) 햇살 같은 노란색, 포근한 느낌' },
  { id: 'charm', title: '제일 귀여운 순간은?', placeholder: '예) 졸릴 때 눈 비비는 모습' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/character/prompt.test.ts`
Expected: PASS (3개)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/prompt.ts src/character
git commit -m "feat: 질문 카드와 캐릭터 프롬프트 조합"
```

---

### Task 6: Edge Function `generate-character` (Recraft 호출 + 한도 가드 + Storage 저장)

**Files:**
- Create: `supabase/functions/generate-character/index.ts`
- Test: 배포 후 curl 스모크 (Step 4-5). 프롬프트 로직은 Task 5에서 이미 테스트됨

**Interfaces:**
- Consumes: `buildCharacterPrompt` (Task 5), 스키마 (Task 2), 함수 시크릿 `RECRAFT_API_KEY`
- Produces: POST `/functions/v1/generate-character` — body `{ answers: string[] }`, 응답 `{ imageUrl: string; regenCount: number; remaining: number }` 또는 `{ error: string }`(401/403/429). Task 7 UI가 호출

- [ ] **Step 1: Recraft API 스펙 확정**

WebFetch로 https://www.recraft.ai/docs/api-reference/getting-started 를 읽고 아래를 확인해 코드의 상수와 다르면 수정한다 (조사 시점 정보: OpenAI 호환 형식, 엔드포인트 `https://external.api.recraft.ai/v1/images/generations`, 스타일 파라미터로 픽셀아트 계열 지정, PNG 응답 URL 반환):
- 정확한 엔드포인트 경로와 요청 필드명 (`prompt`/`style`/`size`/`response_format`)
- 픽셀아트 스타일의 정확한 식별자 (예: `digital_illustration`의 substyle인지, 독립 style인지)
- 투명 배경 PNG 요청 방법
확인 결과를 보고서에 기록한다.

- [ ] **Step 2: 구현**

`supabase/functions/generate-character/index.ts`:
```ts
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildCharacterPrompt } from '../_shared/prompt.ts'

const MAX_GENERATIONS = 4 // 초기 1 + 재생성 3 (스펙 비용 가드)
// Step 1에서 확인한 값으로 필요 시 수정
const RECRAFT_ENDPOINT = 'https://external.api.recraft.ai/v1/images/generations'
const RECRAFT_STYLE = 'pixel_art'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'UNAUTHORIZED' })

  const { answers } = (await req.json()) as { answers: string[] }
  if (!Array.isArray(answers)) return json(400, { error: 'BAD_REQUEST' })

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 커플·상대 확인 (분신의 subject = 연인)
  const { data: me } = await admin
    .from('profiles').select('couple_id').eq('user_id', user.id).single()
  if (!me?.couple_id) return json(403, { error: 'NO_COUPLE' })
  const { data: partner } = await admin
    .from('profiles').select('user_id')
    .eq('couple_id', me.couple_id).neq('user_id', user.id).maybeSingle()
  if (!partner) return json(403, { error: 'PARTNER_NOT_JOINED' })

  // 생성 한도 가드 (서버측 강제)
  const { data: existing } = await admin
    .from('characters').select('id, regen_count')
    .eq('couple_id', me.couple_id).eq('owner_user_id', user.id).maybeSingle()
  const used = existing?.regen_count ?? 0
  if (used >= MAX_GENERATIONS) return json(429, { error: 'GENERATION_LIMIT' })

  // Recraft 호출
  const recraftRes = await fetch(RECRAFT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RECRAFT_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: buildCharacterPrompt(answers),
      style: RECRAFT_STYLE,
      size: '1024x1024',
    }),
  })
  if (!recraftRes.ok) {
    console.error('recraft error', recraftRes.status, await recraftRes.text())
    return json(502, { error: 'GENERATION_FAILED' })
  }
  const recraftData = await recraftRes.json()
  const imageUrl: string | undefined = recraftData?.data?.[0]?.url
  if (!imageUrl) return json(502, { error: 'GENERATION_FAILED' })

  // 이미지 다운로드 → Storage 업로드
  const imageBytes = await (await fetch(imageUrl)).arrayBuffer()
  const characterId = existing?.id ?? crypto.randomUUID()
  const imagePath = `${characterId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await admin.storage
    .from('characters')
    .upload(imagePath, imageBytes, { contentType: 'image/png' })
  if (uploadError) {
    console.error('upload error', uploadError)
    return json(502, { error: 'UPLOAD_FAILED' })
  }

  // characters upsert (실패한 생성은 카운트하지 않음 — 여기 도달 = 성공)
  const row = {
    id: characterId,
    couple_id: me.couple_id,
    owner_user_id: user.id,
    subject_user_id: partner.user_id,
    image_path: imagePath,
    regen_count: used + 1,
  }
  const { error: upsertError } = await admin.from('characters').upsert(row)
  if (upsertError) {
    console.error('upsert error', upsertError)
    return json(502, { error: 'SAVE_FAILED' })
  }

  const { data: pub } = admin.storage.from('characters').getPublicUrl(imagePath)
  return json(200, {
    imageUrl: pub.publicUrl,
    regenCount: used + 1,
    remaining: MAX_GENERATIONS - (used + 1),
  })
})
```

- [ ] **Step 3: 시크릿 설정 및 배포**

Run:
```bash
supabase secrets set RECRAFT_API_KEY=<사용자 제공 키>
supabase functions deploy generate-character
```
Expected: 배포 성공

- [ ] **Step 4: curl 스모크 — 인증 없음 401**

Run: `curl -s -o /dev/null -w '%{http_code}' -X POST https://<PROJECT>.supabase.co/functions/v1/generate-character -H "Content-Type: application/json" -d '{"answers":[]}'`
Expected: `401`

- [ ] **Step 5: curl 스모크 — 실제 생성 1회**

Task 3에서 로그인한 세션의 access token으로 (개발자도구 `localStorage`의 `sb-...-auth-token`에서 `access_token` 추출; 이 시점에 커플·상대가 없으면 403이 정상이므로, 이 스텝은 Task 8 통합 검증으로 미뤄도 됨 — 미룰 경우 보고서에 명시):
```bash
curl -s -X POST https://<PROJECT>.supabase.co/functions/v1/generate-character \
  -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"answers":["밝고 웃음이 많은 사람","햇살 같은 노란색"]}'
```
Expected: `{"imageUrl":"https://...","regenCount":1,"remaining":3}` — imageUrl 브라우저로 열어 픽셀아트 캐릭터 확인

- [ ] **Step 6: Commit**

```bash
git add supabase/functions
git commit -m "feat: generate-character Edge Function (Recraft·한도 가드·Storage)"
```

---

### Task 7: 캐릭터 생성 플로우 UI (질문 카드 → 생성 → 재생성/이름 짓기)

**Files:**
- Create: `src/character/useCharacters.ts`, `src/character/CharacterCreate.tsx`
- Test: `npm test`(회귀) + 수동 (Task 8 통합 검증에서 확인)

**Interfaces:**
- Consumes: `QUESTIONS` (Task 5), Edge Function (Task 6), `supabase`, 스키마 (Task 2)
- Produces:
  - `interface CharacterRow { id: string; ownerUserId: string; name: string | null; imageUrl: string | null; regenCount: number }`
  - `useCharacters(coupleId: string | undefined, myUserId: string | undefined): { mine: CharacterRow | null; partners: CharacterRow | null; loading: boolean; refresh(): void }` — mine = 내가 키우는 분신(연인 모습), partners = 연인이 키우는 분신(내 모습)
  - `<CharacterCreate onDone(): void />` — 카드 4장 답변 → 생성 → 미리보기 → 재생성(잔여 표시)/이름 확정
  - Task 8 라우팅·Task 9 스테이지가 사용

- [ ] **Step 1: 구현**

`src/character/useCharacters.ts`:
```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CharacterRow {
  id: string
  ownerUserId: string
  name: string | null
  imageUrl: string | null
  regenCount: number
}

function toRow(r: {
  id: string; owner_user_id: string; name: string | null
  image_path: string | null; regen_count: number
}): CharacterRow {
  return {
    id: r.id,
    ownerUserId: r.owner_user_id,
    name: r.name,
    imageUrl: r.image_path
      ? supabase.storage.from('characters').getPublicUrl(r.image_path).data.publicUrl
      : null,
    regenCount: r.regen_count,
  }
}

export function useCharacters(coupleId: string | undefined, myUserId: string | undefined) {
  const [mine, setMine] = useState<CharacterRow | null>(null)
  const [partners, setPartners] = useState<CharacterRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!coupleId || !myUserId) return
    setLoading(true)
    supabase
      .from('characters')
      .select('id, owner_user_id, name, image_path, regen_count')
      .eq('couple_id', coupleId)
      .then(({ data }) => {
        const rows = (data ?? []).map(toRow)
        setMine(rows.find((r) => r.ownerUserId === myUserId) ?? null)
        setPartners(rows.find((r) => r.ownerUserId !== myUserId) ?? null)
        setLoading(false)
      })
  }, [coupleId, myUserId])

  useEffect(refresh, [refresh])
  return { mine, partners, loading, refresh }
}
```

`src/character/CharacterCreate.tsx`:
```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { QUESTIONS } from './questions'

export function CharacterCreate({ onDone }: { onDone: () => void }) {
  const [answers, setAnswers] = useState<string[]>(QUESTIONS.map(() => ''))
  const [step, setStep] = useState<'cards' | 'preview'>('cards')
  const [busy, setBusy] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('generate-character', {
      body: { answers },
    })
    setBusy(false)
    if (error || data?.error) {
      const code = data?.error ?? error?.message ?? ''
      setError(
        code === 'GENERATION_LIMIT' ? '재생성 횟수를 모두 썼어요 🥲'
        : code === 'PARTNER_NOT_JOINED' ? '연인이 아직 방에 들어오지 않았어요'
        : '생성에 실패했어요. 잠시 후 다시 시도해주세요',
      )
      return
    }
    setImageUrl(data.imageUrl)
    setRemaining(data.remaining)
    setStep('preview')
  }

  const confirmName = async () => {
    setBusy(true)
    const { data: session } = await supabase.auth.getUser()
    await supabase
      .from('characters')
      .update({ name })
      .eq('owner_user_id', session.user!.id)
    setBusy(false)
    onDone()
  }

  if (step === 'cards') {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <h2>연인을 들려주세요 💌</h2>
        {QUESTIONS.map((q, i) => (
          <label key={q.id} style={{ display: 'grid', gap: 4, textAlign: 'left' }}>
            {q.title}
            <textarea
              placeholder={q.placeholder}
              value={answers[i]}
              onChange={(e) =>
                setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))
              }
            />
          </label>
        ))}
        <button disabled={busy || answers.every((a) => !a.trim())} onClick={generate}>
          {busy ? '분신을 그리는 중… 🎨' : '분신 만나러 가기'}
        </button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12, textAlign: 'center' }}>
      <h2>연인의 분신이에요!</h2>
      {imageUrl && (
        <img src={imageUrl} alt="분신 미리보기"
          style={{ width: 240, margin: '0 auto', imageRendering: 'pixelated' }} />
      )}
      <button disabled={busy || remaining === 0} onClick={generate}>
        다시 그리기 (남은 횟수 {remaining ?? 0})
      </button>
      <input placeholder="이름 지어주기" value={name} onChange={(e) => setName(e.target.value)} />
      <button disabled={busy || !name.trim()} onClick={confirmName}>
        이 아이로 할래요 💕
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: 타입·빌드 확인**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/character
git commit -m "feat: 질문 카드→생성→재생성·이름 짓기 플로우"
```

---

### Task 8: Walker 엔티티 — 영속 x좌표 (Plan 1 파킹 ① 해소, TDD)

**Files:**
- Create: `src/game/walker.ts`
- Modify: `src/game/render.ts` (characterPos에서 x 계산 제거), `src/ui/Stage.tsx` (walker 통합), `src/game/render.test.ts` (새 계약으로 갱신)
- Test: `src/game/walker.test.ts`

**Interfaces:**
- Consumes: `CharState` (기존 fsm)
- Produces:
  - `createWalker(opts: { initialX: number; minX: number; maxX: number; speedPxPerSec?: number }): Walker`
  - `Walker = { readonly x: number; readonly facing: 1 | -1; update(dtMs: number, walking: boolean): void }`
  - `render.ts`의 `Scene`이 `{ state; mood; tMs; x; facing }`로 확장, `characterPos(scene): { x; y; facing }`는 walk에서도 `scene.x`를 그대로 사용 (pingPong 위치 계산 삭제 — **점프 구조적 소멸**). y 오프셋(bob/hop/처짐)은 기존 유지
  - Task 9 스테이지가 사용

- [ ] **Step 1: Write the failing test**

`src/game/walker.test.ts`:
```ts
import { expect, test } from 'vitest'
import { createWalker } from './walker'

const opts = { initialX: 130, minX: 30, maxX: 230, speedPxPerSec: 40 }

test('walking=true면 초당 speed만큼 전진', () => {
  const w = createWalker(opts)
  w.update(1000, true)
  expect(w.x).toBeCloseTo(170)
  expect(w.facing).toBe(1)
})

test('walking=false면 x 유지 (idle/eat 등에서 위치 보존 — 순간이동 없음)', () => {
  const w = createWalker(opts)
  w.update(1000, false)
  expect(w.x).toBe(130)
})

test('maxX에 닿으면 방향 반전', () => {
  const w = createWalker(opts)
  w.update(3000, true) // 130 + 120 = 250 > 230
  expect(w.x).toBeLessThanOrEqual(230)
  expect(w.facing).toBe(-1)
})

test('minX에 닿으면 다시 오른쪽으로', () => {
  const w = createWalker({ ...opts, initialX: 40 })
  w.update(3000, true) // 오른쪽 이동이 기본이므로 우선 왼쪽으로 만들기
  // facing이 1이면 아직 반전 전 — 강제로 왼쪽 벽까지 보낸다
  while (w.facing === 1) w.update(1000, true)
  while (w.x > 30 + 1) w.update(100, true)
  w.update(1000, true)
  expect(w.facing).toBe(1)
  expect(w.x).toBeGreaterThanOrEqual(30)
})

test('큰 dt에도 경계를 벗어나지 않음', () => {
  const w = createWalker(opts)
  w.update(60_000, true)
  expect(w.x).toBeGreaterThanOrEqual(30)
  expect(w.x).toBeLessThanOrEqual(230)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/walker.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/game/walker.ts`:
```ts
export interface Walker {
  readonly x: number
  readonly facing: 1 | -1
  update(dtMs: number, walking: boolean): void
}

/** 캐릭터의 영속 x좌표. 상태가 바뀌어도 x를 기억해 전이 순간이동을 없앤다. */
export function createWalker(opts: {
  initialX: number
  minX: number
  maxX: number
  speedPxPerSec?: number
}): Walker {
  const { minX, maxX, speedPxPerSec = 40 } = opts
  let x = opts.initialX
  let facing: 1 | -1 = 1

  return {
    get x() { return x },
    get facing() { return facing },
    update(dtMs, walking) {
      if (!walking) return
      let remain = (dtMs / 1000) * speedPxPerSec
      while (remain > 0) {
        const target = facing === 1 ? maxX : minX
        const dist = Math.abs(target - x)
        if (remain < dist) {
          x += facing * remain
          remain = 0
        } else {
          x = target
          remain -= dist
          facing = facing === 1 ? -1 : 1
        }
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/walker.test.ts`
Expected: PASS (5개)

- [ ] **Step 5: render.ts 개편**

`src/game/render.ts`의 `Scene`과 `characterPos`를 수정 (renderScene의 flip·팔레트·눈물 로직은 그대로):
```ts
export interface Scene {
  state: CharState
  mood: Happiness
  /** 상태별 위상 시계(ms) — CharacterFsm.phaseMs */
  tMs: number
  /** Walker가 소유한 영속 x좌표 (모든 상태에서 이 값을 사용) */
  x: number
  facing: 1 | -1
}

export function characterPos(scene: Scene): { x: number; y: number; facing: 1 | -1 } {
  const baseY = FLOOR_Y - SPRITE_H
  switch (scene.state) {
    case 'walk':
      return { x: scene.x, y: baseY + bobY(scene.tMs, 1, 400), facing: scene.facing }
    case 'happy':
      return { x: scene.x, y: baseY + hopY(scene.tMs, 10, 500), facing: 1 }
    case 'sad':
      return { x: scene.x, y: baseY + 4, facing: 1 }
    default:
      return { x: scene.x, y: baseY + bobY(scene.tMs, 2, 900), facing: 1 }
  }
}
```
`pingPong` import는 render.ts에서 제거한다 (walker가 대체). `render.test.ts`를 새 계약으로 갱신: 기존 "walk가 pingPong을 따른다" 테스트 삭제 → "모든 상태에서 x는 scene.x를 그대로 쓴다", "walk의 facing은 scene.facing, 비-walk는 1", "y 오프셋은 상태별로 유지" 어서션으로 대체. flip x-extent 테스트는 유지.

- [ ] **Step 6: Stage.tsx 통합**

`src/ui/Stage.tsx`의 useEffect에서 walker 생성·루프 연결 (STAGE_W·SPRITE_W import 활용):
```ts
const walker = createWalker({ initialX: 160 - SPRITE_W / 2, minX: 30, maxX: 320 - 30 - SPRITE_W })
```
루프 내 `fsm.update(dt)` 다음에 `walker.update(dt, fsm.state === 'walk')`를 호출하고, scene을 `{ state: fsm.state, mood, tMs: fsm.phaseMs, x: walker.x, facing: walker.facing }`으로 구성. 파티클 스폰도 이 scene의 `characterPos` 사용 (기존 코드 유지).

- [ ] **Step 7: 전체 검증**

Run: `npm test && npm run build`
Expected: 전체 PASS (render.test.ts 갱신 포함). 이어서 `npm run dev` → 눈으로: 산책을 시작해도 **제자리에서 걷기 시작**하고, 벽에 닿으면 방향을 바꾸며(왼쪽 볼 때 좌우 반전 확인), 산책을 멈춘 자리에서 idle 숨쉬기로 이어진다 — 순간이동 없음

- [ ] **Step 8: Commit**

```bash
git add src/game src/ui
git commit -m "feat: Walker 영속 x좌표 도입 — 상태 전환 순간이동 제거"
```

---

### Task 9: 생성 이미지 렌더 (BLOB_MAP 대체) + 스토어 DB 이전 (파킹 ② 소멸)

**Files:**
- Create: `src/game/spriteImage.ts`
- Modify: `src/game/render.ts` (이미지 드로우 경로), `src/state/store.ts` (localStorage → DB), `src/ui/Stage.tsx`, `src/ui/Hud.tsx`, `src/ui/CareButtons.tsx`
- Test: `src/state/store.test.ts` 갱신 (DB 클라이언트 주입식으로)

**Interfaces:**
- Consumes: `CharacterRow` (Task 7), `supabase`, `care_actions` 스키마 (Task 2), Walker/Scene (Task 8)
- Produces:
  - `loadCharacterImage(url: string): Promise<HTMLImageElement>` (실패 시 reject — 호출부는 BLOB_MAP 폴백)
  - `Scene.image?: HTMLImageElement` — 있으면 `renderScene`이 BLOB_MAP 대신 이미지를 60×60으로 드로우 (`imageSmoothingEnabled=false` 유지, grimy면 `ctx.filter = 'grayscale(60%)'` 적용 후 복원)
  - 스토어: `useGame` — `careLog: CareAction[]`(Date 그대로, persist 제거), `characterId: string | null`, `loadCare(characterId: string): Promise<void>`, `care(type: CareType): Promise<boolean>`(insert 성공 시 낙관적 반영, 유니크 위반 23505 → false), `consumePending()` 유지. `PLAYER_ID` 상수 삭제 — userId는 `supabase.auth`에서
  - localStorage persist 제거로 **Plan 1 파킹 ②(동일버전 오염 미방어)는 대상 자체가 소멸**

- [ ] **Step 1: 스토어 테스트 갱신 (실패 확인 → 구현)**

`src/state/store.test.ts`를 전면 교체 — supabase 호출부를 주입식으로 분리해 순수 로직만 검증:
```ts
import { beforeEach, expect, test, vi } from 'vitest'
import { useGame } from './store'

const NOW = new Date('2026-07-30T03:00:00Z')

beforeEach(() => {
  useGame.setState({ careLog: [], pending: [], characterId: 'char-1', userId: 'me' })
})

test('care 성공: insert 함수 호출 + 낙관적 반영 + pending', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  expect(await useGame.getState().care('feed', NOW)).toBe(true)
  expect(insert).toHaveBeenCalledWith({ characterId: 'char-1', userId: 'me', type: 'feed' })
  expect(useGame.getState().careLog).toHaveLength(1)
  expect(useGame.getState().pending).toEqual(['feed'])
})

test('오늘 이미 한 종류는 insert 없이 거부', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: true })
  useGame.setState({ insertCare: insert })
  await useGame.getState().care('feed', NOW)
  expect(await useGame.getState().care('feed', NOW)).toBe(false)
  expect(insert).toHaveBeenCalledTimes(1)
})

test('DB 유니크 위반(다른 기기에서 이미 돌봄)이면 false + 롤백', async () => {
  const insert = vi.fn().mockResolvedValue({ ok: false, duplicate: true })
  useGame.setState({ insertCare: insert })
  expect(await useGame.getState().care('feed', NOW)).toBe(false)
  expect(useGame.getState().careLog).toHaveLength(0)
  expect(useGame.getState().pending).toEqual([])
})
```

Run: `npx vitest run src/state/store.test.ts` → Expected: FAIL

- [ ] **Step 2: 스토어 구현**

`src/state/store.ts` 전면 교체:
```ts
import { create } from 'zustand'
import { canCareToday, lastCaredAt, xpFromActions, type CareAction, type CareType } from '../domain/care'
import type { CareInput } from '../game/fsm'
import { supabase } from '../lib/supabase'

export interface InsertCareResult { ok: boolean; duplicate?: boolean }

interface GameStore {
  userId: string | null
  characterId: string | null
  careLog: CareAction[]
  pending: CareInput[]
  /** 테스트 주입 지점 — 기본 구현은 supabase insert */
  insertCare: (p: { characterId: string; userId: string; type: CareType }) => Promise<InsertCareResult>
  loadCare(characterId: string, userId: string): Promise<void>
  care(type: CareType, now?: Date): Promise<boolean>
  consumePending(): CareInput | undefined
}

async function supabaseInsertCare(p: {
  characterId: string; userId: string; type: CareType
}): Promise<InsertCareResult> {
  const { error } = await supabase
    .from('care_actions')
    .insert({ character_id: p.characterId, user_id: p.userId, type: p.type })
  if (!error) return { ok: true }
  return { ok: false, duplicate: error.code === '23505' }
}

export const selectXp = (s: Pick<GameStore, 'careLog'>) => xpFromActions(s.careLog)
export const selectLastCaredAt = (s: Pick<GameStore, 'careLog'>) => lastCaredAt(s.careLog)

export const useGame = create<GameStore>()((set, get) => ({
  userId: null,
  characterId: null,
  careLog: [],
  pending: [],
  insertCare: supabaseInsertCare,
  async loadCare(characterId, userId) {
    const { data } = await supabase
      .from('care_actions')
      .select('user_id, type, created_at')
      .eq('character_id', characterId)
    set({
      characterId,
      userId,
      careLog: (data ?? []).map((r) => ({
        userId: r.user_id,
        type: r.type as CareType,
        createdAt: new Date(r.created_at),
      })),
    })
  },
  async care(type, now = new Date()) {
    const { careLog, characterId, userId, insertCare } = get()
    if (!characterId || !userId) return false
    if (!canCareToday(careLog, userId, type, now)) return false
    const action: CareAction = { userId, type, createdAt: now }
    set((s) => ({ careLog: [...s.careLog, action], pending: [...s.pending, type] }))
    const result = await insertCare({ characterId, userId, type })
    if (!result.ok) {
      set((s) => ({
        careLog: s.careLog.filter((a) => a !== action),
        pending: s.pending.filter((p, i) => !(p === type && i === s.pending.lastIndexOf(type))),
      }))
      return false
    }
    return true
  },
  consumePending() {
    const [head, ...rest] = get().pending
    if (head !== undefined) set({ pending: rest })
    return head
  },
}))
```
`selectActions`는 삭제 (careLog가 이미 Date). `Hud.tsx`/`CareButtons.tsx`에서 `selectActions`/`PLAYER_ID` 참조를 `useGame((s) => s.careLog)`와 `useGame((s) => s.userId)`로 교체 (useMemo 유지, canCareToday에 userId 전달).

Run: `npx vitest run src/state/store.test.ts` → Expected: PASS (3개)

- [ ] **Step 3: spriteImage + renderScene 이미지 경로**

`src/game/spriteImage.ts`:
```ts
export function loadCharacterImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'))
    img.src = url
  })
}
```
`render.ts`: `Scene`에 `image?: HTMLImageElement` 추가. `renderScene`에서 스프라이트 드로우 지점(BLOB_MAP 3곳: eat 스쿼시, flip, 기본)을 헬퍼로 추출:
```ts
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  x: number,
  y: number,
): void {
  if (scene.image) {
    if (scene.mood === 'grimy') ctx.filter = 'grayscale(60%)'
    ctx.drawImage(scene.image, x, y, SPRITE_W, SPRITE_H)
    ctx.filter = 'none'
    return
  }
  const palette = scene.mood === 'grimy' ? PALETTE_GRIMY : PALETTE_NORMAL
  drawPixelMap(ctx, BLOB_MAP, palette, x, y, SCALE)
}
```
기존 3개 드로우 지점을 이 헬퍼 호출로 교체 (translate/scale 래핑은 기존 유지).

- [ ] **Step 4: Stage에 이미지·loadCare 연결**

`Stage.tsx`가 props로 `character: CharacterRow`를 받도록 변경. useEffect에서 `character.imageUrl`이 있으면 `loadCharacterImage`로 로드(실패 시 콘솔 경고 후 BLOB_MAP 폴백), scene에 `image` 포함. Hud에 `character.name` 표시(`Lv.N — 이름 — 기분`).

- [ ] **Step 5: 전체 검증**

Run: `npm test && npm run build`
Expected: 전체 PASS

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: 돌봄 DB 이전·생성 이미지 렌더 (localStorage persist 제거)"
```

---

### Task 10: App 라우팅 조립 + 2계정 통합 검증

**Files:**
- Modify: `src/App.tsx`
- Test: 수동 통합 시나리오 (Step 3) — 이 계획의 최종 게이트

**Interfaces:**
- Consumes: 이전 태스크 전부 (`useSession`/`LoginScreen`/`useCouple`/`CoupleSetup`/`useCharacters`/`CharacterCreate`/`Stage`/`Hud`/`CareButtons`/`useGame`)
- Produces: 완성된 Plan 2 앱 흐름 — 로그인 → 방 → 질문카드 → 분신 탄생 → 돌봄

- [ ] **Step 1: App.tsx 라우팅**

```tsx
import { useEffect } from 'react'
import { LoginScreen } from './auth/LoginScreen'
import { useSession } from './auth/useSession'
import { CharacterCreate } from './character/CharacterCreate'
import { useCharacters } from './character/useCharacters'
import { CoupleSetup } from './couple/CoupleSetup'
import { useCouple } from './couple/useCouple'
import { useGame } from './state/store'
import { CareButtons } from './ui/CareButtons'
import { Hud } from './ui/Hud'
import { Stage } from './ui/Stage'

export function App() {
  const { session, loading: authLoading } = useSession()
  const userId = session?.user.id
  const { couple, loading: coupleLoading, refresh: refreshCouple } = useCouple(userId)
  const { mine, loading: charLoading, refresh: refreshChars } = useCharacters(
    couple?.coupleId,
    userId,
  )
  const loadCare = useGame((s) => s.loadCare)

  useEffect(() => {
    if (mine && userId) void loadCare(mine.id, userId)
  }, [mine, userId, loadCare])

  let body
  if (authLoading || (userId && (coupleLoading || charLoading))) body = <p>불러오는 중…</p>
  else if (!session) body = <LoginScreen />
  else if (!couple) body = <CoupleSetup onDone={refreshCouple} />
  else if (!mine || !mine.name) body = <CharacterCreate onDone={refreshChars} />
  else body = (
    <>
      <Stage character={mine} />
      <Hud character={mine} />
      <CareButtons />
    </>
  )

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, display: 'grid', gap: 12 }}>
      <h1 style={{ fontFamily: 'monospace', textAlign: 'center' }}>Tinyou</h1>
      {body}
    </main>
  )
}
```
(연인 미합류 시 `CharacterCreate`의 생성 버튼이 `PARTNER_NOT_JOINED` 안내를 띄우는 것으로 충분 — 별도 대기 화면은 YAGNI)

- [ ] **Step 2: 타입·빌드**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 3: 2계정 통합 검증 (수동 체크리스트)**

일반 창 + 시크릿 창에 서로 다른 이메일 2개로:
1. A 로그인 → 둥지 만들기(닉네임) → 6자리 코드 확인
2. B 로그인 → 코드로 합류 성공 / 틀린 코드로 "코드를 다시 확인해주세요" 확인
3. A 질문 카드 작성 → 생성 (수십 초) → 픽셀아트 분신 미리보기 → 재생성 1회(잔여 감소) → 이름 확정 → 스테이지에 생성 이미지가 걸어다님 (BLOB이 아니라)
4. B도 동일하게 자기 화면의 분신 생성
5. A가 밥 주기 → B 화면 새로고침 시 A의 분신… 이 아니라 **각자 자기 분신의 돌봄 기록**이 유지되는지, A가 같은 날 다시 밥 주기 시도 시 버튼 비활성인지
6. 같은 계정으로 다른 브라우저에서 밥 주기 중복 시도 → 유니크 위반으로 false 처리(콘솔 에러 없이) 확인
7. 재생성을 한도(4회)까지 소진 → "재생성 횟수를 모두 썼어요" 확인 (Recraft 비용 아끼려면 이 항목은 DB에서 `update characters set regen_count = 4`로 시뮬레이션 가능)
8. 콘솔 에러 0 확인

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: 앱 라우팅 조립 — 로그인→둥지→분신 탄생→돌봄"
```

---

## 후속 계획 (이 문서 범위 아님 — Plan 3)

- 메시지 배달 (분신 말풍선 연기·read_at) + Realtime 구독 (상대 돌봄 실시간 반영)
- 꾸미기 unlocks (레벨 보상)
- PWA manifest·오프라인 토스트, nginx+cloudflared 배포 (pay-pos 패턴), 도메인
- 상대 분신 구경 화면 ("연인 화면 엿보기")

---

## 개정 (2026-07-30): 하이브리드 캐릭터 생성

사용자 결정: Recraft AI 생성 대신 **절차적 도트 파츠 조합**으로 v1 완성 (가입/키/비용 제로). AI 생성은 추후 옵션으로 스키마·함수 구조를 보존한 채 추가 가능. 기존 Task 6은 실행하지 않으며 Task 11·12가 대체한다. UX 개선점: 미리보기·다시 뽑기는 **로컬이라 즉시·무제한**, 서버 업로드(확정)만 한도 4회를 적용한다.

### Task 11: 도트 아바타 생성기 + 로컬 미리보기 (TDD)

**Files:**
- Create: `src/game/avatar.ts`
- Modify: `src/character/CharacterCreate.tsx` (Edge Function invoke 제거 → 로컬 생성 미리보기)
- Test: `src/game/avatar.test.ts`

**Interfaces:**
- Consumes: `drawPixelMap` (src/game/sprite.ts), 답변 배열 (Task 5·7)
- Produces:
  - `generateAvatar(answers: string[], salt: number): { map: string[]; palette: Record<string, string> }` — 16×16 문자 그리드. 같은 입력 → 같은 결과(결정적), salt 변경 → 파츠 변형
  - `hashSeed(text: string): number` — FNV-1a 32비트
  - `<CharacterCreate />` preview 단계: canvas 로컬 렌더 + "다시 뽑기"(salt+1, 무제한) + 이름 입력. 확정 버튼 핸들러는 빈 async 함수 + 주석 `// Task 12: upload-character 연결`로 준비만 (기존 confirmName의 auth/name update 로직 삭제)
  - Task 12가 `generateAvatar`와 preview canvas ref를 사용

- [ ] **Step 1: Write the failing test**

`src/game/avatar.test.ts`:
```ts
import { expect, test } from 'vitest'
import { generateAvatar, hashSeed } from './avatar'

const ANSWERS = ['밝고 웃음이 많은 사람', '햄스터 같음', '노란색', '눈 비비는 모습']

test('hashSeed는 결정적이고 입력이 다르면 대체로 다름', () => {
  expect(hashSeed('abc')).toBe(hashSeed('abc'))
  expect(hashSeed('abc')).not.toBe(hashSeed('abd'))
})

test('같은 답변·salt는 같은 아바타 (결정적)', () => {
  const a = generateAvatar(ANSWERS, 0)
  const b = generateAvatar(ANSWERS, 0)
  expect(a).toEqual(b)
})

test('salt를 바꾸면 0..7 중 서로 다른 아바타가 2종 이상', () => {
  const variants = new Set(
    Array.from({ length: 8 }, (_, s) => JSON.stringify(generateAvatar(ANSWERS, s))),
  )
  expect(variants.size).toBeGreaterThanOrEqual(2)
})

test('맵은 16×16이고 모든 문자는 팔레트 키 또는 점', () => {
  const { map, palette } = generateAvatar(ANSWERS, 3)
  expect(map).toHaveLength(16)
  for (const row of map) {
    expect(row).toHaveLength(16)
    for (const ch of row) {
      if (ch !== '.') expect(palette[ch]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  }
})

test('빈 답변도 유효한 아바타 생성', () => {
  const { map } = generateAvatar([], 0)
  expect(map.join('').replace(/\./g, '').length).toBeGreaterThan(20)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/avatar.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: Write minimal implementation**

`src/game/avatar.ts`:
```ts
/**
 * 절차적 도트 아바타: 답변 텍스트+salt를 해시해 파츠(몸 색·모양·눈·입·볼·액세서리)를
 * 결정적으로 조합한다. 16×16 문자 그리드 + 팔레트 반환 (drawPixelMap과 호환).
 */

export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// 몸 색: {B: 본체, S: 음영, C: 볼}
const BODY_COLORS: { B: string; S: string; C: string }[] = [
  { B: '#ffb7c9', S: '#e896ab', C: '#ff6b9d' }, // 분홍
  { B: '#a8e6cf', S: '#84c7ae', C: '#56b58c' }, // 민트
  { B: '#c9b6e4', S: '#a894c9', C: '#8f6fc0' }, // 라벤더
  { B: '#ffd3a5', S: '#e6b482', C: '#f08c5a' }, // 피치
  { B: '#a5d8ff', S: '#7fb8e6', C: '#5a9cf0' }, // 하늘
  { B: '#fff3a5', S: '#e6d67f', C: '#e6b800' }, // 레몬
]

// 몸 모양 3종 (16×16, B=본체, 하단은 발/여백)
const BODY_SHAPES: string[][] = [
  [ // 둥근 블롭
    '................',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '...BB.BBBB.BB...',
    '................',
    '................',
    '................',
  ],
  [ // 네모 찐빵
    '................',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '..BBBBBBBBBBBB..',
    '...BB.BBBB.BB...',
    '................',
    '................',
    '................',
  ],
  [ // 달걀
    '................',
    '.....BBBBBB.....',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '.BBBBBBBBBBBBBB.',
    '..BBBBBBBBBBBB..',
    '..BBBBBBBBBBBB..',
    '...BB.BBBB.BB...',
    '................',
    '................',
    '................',
  ],
]

type Stamp = [row: number, col: number, ch: string][]

// 눈 4종 (E=눈동자, W=흰자/반짝)
const EYES: Stamp[] = [
  [[6, 4, 'E'], [6, 11, 'E']], // 점눈
  [[6, 4, 'E'], [5, 5, 'W'], [6, 11, 'E'], [5, 10, 'W']], // 반짝
  [[6, 3, 'E'], [6, 4, 'E'], [6, 11, 'E'], [6, 12, 'E']], // 졸린 가로눈
  [[6, 4, 'E'], [6, 10, 'E'], [6, 11, 'E'], [6, 12, 'E']], // 윙크
]

// 입 4종 (M)
const MOUTHS: Stamp[] = [
  [[9, 7, 'M'], [9, 8, 'M']], // 미소
  [[9, 7, 'M'], [9, 8, 'M'], [10, 7, 'M'], [10, 8, 'M']], // 아-
  [[9, 6, 'M'], [10, 7, 'M'], [9, 8, 'M']], // :3
  [[9, 7, 'M']], // 무표정
]

// 볼터치 2종 (C)
const CHEEKS: Stamp[] = [
  [[8, 3, 'C'], [8, 12, 'C']],
  [],
]

// 액세서리 5종 (A)
const ACCESSORIES: Stamp[] = [
  [], // 없음
  [[0, 7, 'A'], [1, 6, 'A'], [1, 8, 'A'], [0, 8, 'A']], // 리본
  [[0, 8, 'A'], [1, 8, 'A'], [0, 7, 'A']], // 새싹
  [[0, 5, 'A'], [0, 6, 'A'], [0, 7, 'A'], [0, 8, 'A'], [0, 9, 'A'], [0, 10, 'A'], [1, 7, 'A'], [1, 8, 'A']], // 모자
  [[0, 7, 'A'], [1, 6, 'A'], [1, 8, 'A'], [2, 7, 'A']], // 별
]

const ACCESSORY_COLORS = ['#f08c5a', '#56b58c', '#5a9cf0', '#e6b800', '#8f6fc0']

export interface Avatar {
  map: string[]
  palette: Record<string, string>
}

export function generateAvatar(answers: string[], salt: number): Avatar {
  const seed = hashSeed(answers.map((a) => a.trim()).join('') + ':' + String(salt))
  const pick = (n: number, shift: number) => (seed >>> shift) % n

  const color = BODY_COLORS[pick(BODY_COLORS.length, 0)]
  const shape = BODY_SHAPES[pick(BODY_SHAPES.length, 4)]
  const eyes = EYES[pick(EYES.length, 8)]
  const mouth = MOUTHS[pick(MOUTHS.length, 12)]
  const cheeks = CHEEKS[pick(CHEEKS.length, 16)]
  const accessory = ACCESSORIES[pick(ACCESSORIES.length, 20)]
  const accessoryColor = ACCESSORY_COLORS[pick(ACCESSORY_COLORS.length, 24)]

  const grid = shape.map((row) => row.split(''))
  const stampAll = (stamp: Stamp) => {
    for (const [r, c, ch] of stamp) grid[r][c] = ch
  }
  // 몸 최하단 픽셀에 음영
  for (let c = 0; c < 16; c++) {
    for (let r = 15; r >= 0; r--) {
      if (grid[r][c] === 'B') {
        grid[r][c] = 'S'
        break
      }
    }
  }
  stampAll(eyes)
  stampAll(mouth)
  stampAll(cheeks)
  stampAll(accessory)

  return {
    map: grid.map((row) => row.join('')),
    palette: {
      B: color.B,
      S: color.S,
      C: color.C,
      E: '#333333',
      W: '#ffffff',
      M: '#a2574f',
      A: accessoryColor,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/avatar.test.ts`
Expected: PASS (5개)

- [ ] **Step 5: CharacterCreate 로컬 미리보기 개편**

`src/character/CharacterCreate.tsx`에서:
- `supabase.functions.invoke('generate-character', ...)` 호출과 error.context 파싱 제거
- 상태 `attempt: number`(초기 0) 추가. preview 단계는 `<canvas ref={canvasRef} width={16} height={16} style={{ width: 240, imageRendering: 'pixelated' }}>`에 `useEffect(() => { ... }, [answers, attempt, step])`로 `generateAvatar(answers, attempt)`를 `drawPixelMap(ctx, map, palette, 0, 0, 1)`로 렌더 (렌더 전 `ctx.clearRect(0,0,16,16)`, `ctx.imageSmoothingEnabled = false`)
- "분신 만나러 가기" = `setStep('preview')` (네트워크 없음), "다시 뽑기" = `setAttempt((a) => a + 1)` (무제한 — 잔여 횟수 표기 제거)
- 확정 버튼 핸들러는 빈 async 함수 + `// Task 12: upload-character 연결` 주석 (기존 confirmName의 auth/update 로직 삭제)
- 미사용 import 정리 — strict 빌드 통과 필수

- [ ] **Step 6: 전체 검증**

Run: `npm test && npm run build`
Expected: 전체 PASS (72개 이상)

- [ ] **Step 7: Commit**

```bash
git add src/game/avatar.ts src/game/avatar.test.ts src/character/CharacterCreate.tsx
git commit -m "feat: 절차적 도트 아바타 생성기와 로컬 미리보기 (하이브리드 개정)"
```

---

### Task 12: upload-character Edge Function + 확정 업로드 연결

**Files:**
- Create: `supabase/functions/upload-character/index.ts`
- Modify: `src/character/CharacterCreate.tsx` (확정 핸들러 구현)
- Test: 배포 후 curl 스모크 + `npm test` 회귀

**Interfaces:**
- Consumes: Task 11의 preview canvas ref, `characters`/`profiles` 스키마 (Task 2). 함수 시크릿 불필요 (외부 API 없음)
- Produces: POST `/functions/v1/upload-character` — body `{ imageBase64: string; name: string }`, 응답 200 `{ imageUrl }` / 401 UNAUTHORIZED / 400 BAD_REQUEST / 403 NO_COUPLE·PARTNER_NOT_JOINED / 413 IMAGE_TOO_LARGE / 415 NOT_PNG / 429 GENERATION_LIMIT. 성공 시 characters upsert(name 포함, regen_count+1, 한도 4)

- [ ] **Step 1: Edge Function 구현**

`supabase/functions/upload-character/index.ts`:
```ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_UPLOADS = 4 // 확정(업로드) 한도 — 로컬 미리보기는 무제한
const MAX_BYTES = 32 * 1024
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: 'UNAUTHORIZED' })

  const { imageBase64, name } = (await req.json()) as { imageBase64?: string; name?: string }
  if (!imageBase64 || !name?.trim()) return json(400, { error: 'BAD_REQUEST' })

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0))
  } catch {
    return json(400, { error: 'BAD_REQUEST' })
  }
  if (bytes.length > MAX_BYTES) return json(413, { error: 'IMAGE_TOO_LARGE' })
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return json(415, { error: 'NOT_PNG' })

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: me } = await admin
    .from('profiles').select('couple_id').eq('user_id', user.id).single()
  if (!me?.couple_id) return json(403, { error: 'NO_COUPLE' })
  const { data: partner } = await admin
    .from('profiles').select('user_id')
    .eq('couple_id', me.couple_id).neq('user_id', user.id).maybeSingle()
  if (!partner) return json(403, { error: 'PARTNER_NOT_JOINED' })

  const { data: existing } = await admin
    .from('characters').select('id, regen_count')
    .eq('couple_id', me.couple_id).eq('owner_user_id', user.id).maybeSingle()
  const used = existing?.regen_count ?? 0
  if (used >= MAX_UPLOADS) return json(429, { error: 'GENERATION_LIMIT' })

  const characterId = existing?.id ?? crypto.randomUUID()
  const imagePath = `${characterId}/${crypto.randomUUID()}.png`
  const { error: uploadError } = await admin.storage
    .from('characters')
    .upload(imagePath, bytes, { contentType: 'image/png' })
  if (uploadError) {
    console.error('upload error', uploadError)
    return json(502, { error: 'UPLOAD_FAILED' })
  }

  const { error: upsertError } = await admin.from('characters').upsert({
    id: characterId,
    couple_id: me.couple_id,
    owner_user_id: user.id,
    subject_user_id: partner.user_id,
    name: name.trim(),
    image_path: imagePath,
    regen_count: used + 1,
  })
  if (upsertError) {
    console.error('upsert error', upsertError)
    return json(502, { error: 'SAVE_FAILED' })
  }

  const { data: pub } = admin.storage.from('characters').getPublicUrl(imagePath)
  return json(200, { imageUrl: pub.publicUrl })
})
```

- [ ] **Step 2: CharacterCreate 확정 핸들러 구현**

Task 11에서 비워둔 확정 핸들러를 구현 (supabase import 복원, canvas는 미리보기 ref 재사용):
```ts
const confirm = async () => {
  setBusy(true)
  setError(null)
  const canvas = canvasRef.current
  if (!canvas) {
    setBusy(false)
    return
  }
  const base64 = canvas.toDataURL('image/png').split(',')[1]
  const { data, error } = await supabase.functions.invoke('upload-character', {
    body: { imageBase64: base64, name },
  })
  setBusy(false)
  let code: string = data?.error ?? ''
  if (error && !code) {
    const ctx = (error as { context?: Response }).context
    if (ctx) {
      try {
        code = ((await ctx.json()) as { error?: string }).error ?? ''
      } catch {
        // 본문이 JSON이 아니면 일반 실패
      }
    }
  }
  if (error || code) {
    setError(
      code === 'GENERATION_LIMIT' ? '확정 가능 횟수를 모두 썼어요 🥲'
      : code === 'PARTNER_NOT_JOINED' ? '연인이 아직 방에 들어오지 않았어요'
      : '저장에 실패했어요. 잠시 후 다시 시도해주세요',
    )
    return
  }
  onDone()
}
```

- [ ] **Step 3: 배포 및 스모크**

Run:
```bash
supabase functions deploy upload-character
curl -s -o /dev/null -w '%{http_code}' -X POST https://hhdspjlnxgcwpbughsdb.supabase.co/functions/v1/upload-character -H "Content-Type: application/json" -d '{}'
```
Expected: 배포 성공, curl `401`

- [ ] **Step 4: 전체 검증**

Run: `npm test && npm run build`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/upload-character src/character/CharacterCreate.tsx
git commit -m "feat: upload-character Edge Function과 확정 업로드 연결"
```
