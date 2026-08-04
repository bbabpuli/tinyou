# 티뉴 (Tinyou) — 설계 스펙

- 날짜: 2026-07-30
- 상태: 승인됨 (사용자 승인 완료)
- 형태: PWA (반응 좋으면 Capacitor로 앱 포장)
- 이름: **Tinyou** (tiny + you, "작은 너") — 레포/슬러그 `tinyou`

## 한 줄 컨셉

연인 둘만의 1:1 방에서, 각자 연인을 묘사한 글로 AI가 만들어 준 **연인의 분신 캐릭터**를
내 폰에서 다마고치처럼 키우는 앱. 연인이 보낸 진짜 메시지는 분신이 말풍선으로 연기하며
배달한다. v2에서 분신끼리 배틀.

## 핵심 결정 요약

| 항목 | 결정 |
|---|---|
| 목표 | 만들면서 재미 (완성도·수익보다 제작 과정의 즐거움 우선) |
| 플랫폼 | PWA 우선, 이후 Capacitor 앱 포장 |
| 캐릭터 구조 | 내 화면에 사는 것은 **연인의 분신** (내가 연인을 묘사해 생성, 내가 키움) |
| 대화 | **진짜 메시지 배달만.** 분신이 연인 페르소나로 자율 대화하는 AI 챗봇 아님 |
| AI 사용 범위 | 캐릭터 이미지 생성에만 사용 (일회성). 대화용 LLM 없음 |
| 비주얼 | 픽셀아트. AI 생성도 픽셀아트 스타일로 고정 |
| 렌더링 | Canvas 2D 직접 렌더링 (게임 루프 직접 구현) |
| 백엔드 | Supabase (Postgres + Auth + Realtime), 서버 크론 없음 |
| 성장 | 데일리 돌봄으로 XP·레벨업, 보상은 꾸미기 아이템 해금 |
| 펫 사망 | 없음. 방치 시 시무룩해질 뿐, 돌아오면 회복 |
| 배틀 | v2로 연기. v1은 레벨 데이터만 축적 |

## 사용자 흐름

### 온보딩
1. A가 가입(Supabase 이메일 매직링크, 비밀번호 없음) → "방 만들기" → 6자리 초대 코드 생성
2. B가 링크/코드로 합류 → 1:1 방 완성 (방은 정확히 2인, 초과 입장 불가)
3. 각자 질문 카드 3~4개에 답변: "처음 만났을 때 어땠어요?", "연인을 동물/색/분위기로
   표현하면?" 등
4. 답변을 프롬프트로 조합 → 이미지 생성 API 호출 → 픽셀아트 캐릭터 생성
5. 마음에 안 들면 재생성 (1인당 최대 3회, 비용 가드)
6. 이름 지어주기 → 내 화면에 연인의 분신이 입주

### 데일리 루프 (하루 30초 × 2회 감각)
- 메인 화면 = 분신이 사는 방 (Canvas 스테이지). 분신은 돌아다니고, 자고, 반응함
- 각자 하루 **먹이 주기 1회 + 쓰다듬기 1회**. 돌봄마다 XP 획득
- 메시지 보내기: 자유 텍스트 + 이모지 → 상대 화면의 분신(= 나의 분신)이 말풍선으로
  연기하며 배달. 읽으면 read_at 기록
- 상대가 내 분신을 돌본 흔적 표시 ("OO가 아침에 밥 줬어!")
- 방치 시: 마지막 돌봄 시각에서 파생 계산으로 시무룩·꼬질꼬질 연출. 사망 없음

### 성장
- XP 누적 → 레벨업 → 꾸미기 아이템 해금 (모자·안경 등, 캐릭터 이미지 위 레이어 렌더)
- 레벨은 v2 배틀 스탯(HP 등)의 기반이 되도록 축적만 해 둠

## 아키텍처

```
[React UI 셸]  ← zustand store →  [Canvas 게임 루프]
      │
      └──────── Supabase JS ────────► Postgres + Auth + Realtime
                                        (이미지 생성은 Edge Function 경유)
```

- **프론트**: Vite + React + TypeScript, `vite-plugin-pwa`
- **Canvas 스테이지** (직접 구현):
  - `GameLoop` — requestAnimationFrame 기반 update(dt)/render 사이클
  - `Character` 엔티티 — 상태머신 (idle / walk / sleep / eat / petted / happy / sad),
    상태별 애니메이션
  - `SpriteAnimator` — AI 생성 원본 이미지 + 코드 애니메이션(바운스, 플립, 스쿼시) 조합.
    AI가 프레임별 스프라이트시트를 만들 수는 없으므로 단일 이미지를 변형해 생동감 부여
  - `Particles` — 하트, 반짝이 이펙트
  - 꾸미기 아이템은 캐릭터 위 레이어로 합성 렌더
- **React ↔ Canvas 경계**: zustand 스토어 하나로 통신. UI 버튼 → 스토어에 액션 큐잉 →
  게임 루프가 연출 재생 + Supabase 기록. Canvas는 React 리렌더와 독립적으로 동작
- **AI 이미지 생성**: Supabase Edge Function이 이미지 생성 API를 호출 (API 키를
  클라이언트에 노출하지 않기 위함). 픽셀아트 스타일 프롬프트 고정, 생성 결과는
  Supabase Storage에 저장. 사용할 이미지 생성 API는 구현 계획 단계에서
  픽셀아트 품질을 비교해 선정한다 (후보: OpenAI gpt-image, Google Imagen 등)
  - **IP 모방 방지 가드 (필수)**: 시스템 프롬프트에 "기존 캐릭터·상표 IP(포켓몬,
    산리오, 디즈니 등)를 모방하지 않는 오리지널 캐릭터만 생성" 지시를 고정 포함.
    유저 답변에 특정 캐릭터명이 들어와도(예: "피카츄 닮았어") 외형 특징(색·분위기)만
    추출하고 캐릭터 자체를 재현하지 않는다. 현재 구현(Plan 1~3)은 프리셋 종
    enum 매핑 + 코드 렌더 방식이라 이 리스크가 구조적으로 없음 — 실제 생성 API
    도입 시점에 이 가드를 프롬프트에 반영할 것

## 데이터 모델 (Supabase Postgres)

| 테이블 | 핵심 컬럼 | 역할 |
|---|---|---|
| `profiles` | user_id, nickname, couple_id | 유저 정보 + 방 소속 |
| `couples` | id, invite_code | 1:1 방 (정확히 2인) |
| `characters` | id, couple_id, owner_user_id, subject_user_id, name, image_url, xp, regen_count | 분신. 방당 2개. owner = 키우는 사람, subject = 묘사된 사람 |
| `care_actions` | character_id, user_id, type(feed/pet), created_at | 돌봄 기록 |
| `messages` | couple_id, sender_user_id, body, emoji, created_at, read_at | 진짜 메시지 |
| `unlocks` | character_id, item_id, unlocked_at, equipped | 꾸미기 아이템 해금·착용 |

- **파생 계산 원칙**: 행복도·레벨·시무룩 여부는 저장하지 않고 `care_actions` 기록과
  마지막 돌봄 시각에서 접속 시점에 순수 함수로 계산. 서버 크론 불필요, 테스트 용이
- **동기화**: 접속 시 fetch + Supabase Realtime 구독 (messages, care_actions insert).
  상대 접속 중 액션은 실시간 반영
- **보안**: RLS로 자기 couple_id 데이터만 접근. 초대 코드 검증은 RPC 함수로 처리

## 에러 처리 / 오프라인

- 오프라인·요청 실패 시: 분신은 마지막 수신 상태로 계속 상호작용 가능 (Canvas는 로컬),
  기록성 액션만 "연결되면 다시 시도" 토스트. 오프라인 큐는 만들지 않음 (YAGNI)
- 돌봄 중복 방지: DB 유니크 제약 (character_id + user_id + type + 날짜)이 최종 방어,
  프론트 버튼 비활성화가 1차 방어. "하루" 판정은 Asia/Seoul 기준 달력 날짜로 통일
  (프론트 계산·DB 제약 모두 동일 기준)
- 이미지 생성 실패: 재시도 안내. 재생성 횟수(regen_count)는 성공 시에만 차감
- 인증 만료: 로그인 화면으로, 캐릭터 상태 비노출

## 테스트

- **순수 함수 유닛 테스트 (Vitest)**: 레벨 계산, 행복도 파생, 시무룩 판정, 돌봄 가능
  여부 판정 — 핵심 로직 전부
- **상태머신 전이 테스트**: feed → eat → happy → idle 등
- Canvas 렌더링은 눈으로 확인 (픽셀 애니메이션은 보면서 만드는 것 자체가 목적)

## MVP 범위

**v1 포함**: 가입·방 생성·초대 → 질문 카드 → AI 캐릭터 생성(재생성 3회) → 돌봄 의례 →
메시지 배달 → XP/레벨 → 꾸미기 해금·착용

**v1 제외**: 배틀(v2, 별도 브레인스토밍), 푸시 알림(앱 포장 단계), 캐릭터 이미지
진화(AI 재생성형 성장), 다인 그룹, 자율 대화 AI

## 배포 / 인프라 (pay-pos 패턴 재사용)

개인 토이 프로젝트 pay-pos(`~/Documents/toy-project/pay-pos`)의 운영 구성을 그대로 따른다.

- **저장소**: 개인 GitHub 계정 `bbabpuli/tinyou` (weknew 무관)
- **호스팅**: pay-pos와 같은 Oracle Cloud VM (`ubuntu@140.245.60.65`,
  SSH 키 `~/Downloads/ssh-key-2026-06-30.key`)에 Docker Compose 스택 추가
- **구성**: 프론트가 정적 PWA(Vite 빌드 산출물)이므로 pay-pos보다 가벼움 —
  `nginx`(정적 서빙) + `cloudflared`(Cloudflare Tunnel) 컨테이너 2개.
  포트 개방·인증서 불필요 (pay-pos의 cloudflared 패턴 그대로)
- **도메인**: Cloudflare에 등록 (예: tinyou.app 등 — 구매 시 확정). 터널
  Public Hostname → `http://nginx:80`
- **배포 스크립트**: pay-pos `deploy.sh` 패턴 재사용 — 로컬에서
  `git push origin main` → SSH로 VM에서 `git pull` + `docker compose up -d --build`
  + 헬스체크(HTTP 200 확인)
- **백엔드**: 별도 서버 없음. Supabase(무료 티어)가 DB/Auth/Realtime/Edge
  Function/Storage 전담. VM은 정적 파일만 서빙
- **시크릿**: 이미지 생성 API 키는 Supabase Edge Function 환경변수로만 보관.
  VM `.env`에는 `CLOUDFLARE_TUNNEL_TOKEN`만 필요

## 비용

- 이미지 생성: 커플당 최대 8회 (2인 × 초기 1 + 재생성 3) 일회성 호출
- 대화 LLM: 없음
- Supabase: 무료 티어로 충분
- VM: 기존 pay-pos VM 공유 (추가 비용 없음), 도메인 구매비만 발생
