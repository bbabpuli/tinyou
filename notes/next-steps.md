# 티뉴 — 다음 작업 인수인계 (2026-07-31 기준)

이 문서 하나로 다음 세션에서 바로 이어갈 수 있게 정리했다. 우선순위 순.

## 현재 상태 스냅샷

- main = PR #13까지 머지 (154 테스트 그린). 실사용 커플: 동글·기기
- 오늘 머지: #8 LLM 파츠 매핑(키 미설정으로 휴면), #10 말풍선 회전+단장 배너 픽스, #11 말풍선 자동 오픈, #12 다 읽으면 배달 종료, #13 봉투 스탬프 제거
- 말풍선 최종 UX: 쪽지 도착 → 말풍선 자동 오픈(탭 불필요) → 여러 통이면 4초 회전(넘어간 건 읽음 처리) → 마지막은 클릭까지 유지 → 클릭 시 소멸
- dev 서버: 레포 루트에서 `npm run dev` → localhost:5173 (Supabase Site URL도 이 주소)

## 운영 메모 (매번 필요한 것)

- git push/PR 전: `gh auth switch --user bbabpuli` (dongeun0303으로 바뀌어 있을 때 있음)
- Supabase: ref `hhdspjlnxgcwpbughsdb` (서울). CLI 로그인·링크 완료. 비TTY 배포는 `supabase functions deploy <name> --use-api`
- E2E: `scripts/e2e/` (스크래치패드에서 이관). 실행법:
  ```bash
  npm i --no-save puppeteer-core   # 시스템 Chrome 사용
  TINYOU_SR_KEY=<service_role 키> node scripts/e2e/e2e-plan3.mjs        # 전체 회귀
  TINYOU_SR_KEY=<service_role 키> node scripts/e2e/e2e-bubble-rotate.mjs # 말풍선 표적(선행: e2e-plan3로 커플 생성)
  ```
  service_role 키는 Supabase 대시보드 → Settings → API. 절대 커밋 금지

## 1순위 — Plan 4 배포 (💳 카드 필요: 도메인)

실유저 로그인이 막혀 있는 게 최대 구멍: Supabase 기본 SMTP는 팀 멤버에게만 발송된다.
지금은 admin generate_link 우회 중. 순서:

1. 도메인 구매 (tinyou.app 후보)
2. pay-pos VM(ubuntu@140.245.60.65)에 nginx 정적 서빙 + cloudflared 터널 — `~/Documents/toy-project/pay-pos`의 deploy.sh 패턴 복제
3. Resend 가입 → 커스텀 SMTP를 Supabase Auth에 연결 (실유저 메일 로그인 해금)
4. Supabase Site URL을 실도메인으로 변경 (지금 localhost:5173)
5. PWA: manifest + 아이콘 + service worker (홈 화면 설치)

프로세스: brainstorming(짧게, pay-pos 패턴 승계 확인) → 스펙 → 플랜 → 이슈 → SDD.

## 2순위 — LLM 키 활성화 묶음 (💳 카드 필요: $5 크레딧)

Claude Code 회사 구독과 별개로 console.anthropic.com 개인 계정 + $5 선불 충전 필요.
쪽지 1통·생성 1회 모두 1원 안팎이라 $5로 사실상 몇 년 치.

활성화 절차:
1. console.anthropic.com → API 키 발급 + **Limits에서 월 지출 한도 설정** (map-avatar는 호출 캡이 없어 이게 방어선 — 최종 리뷰어 지적)
2. `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (Claude 세션에서는 `! ` 접두로 직접 입력하면 대화에 안 남음)
3. 검증: 캐릭터 생성에서 "겨울잠 잘 것 같고 안기면 포근한 사람" → 곰이 나오는지. 다시 뽑기 시 종·색 유지 확인
   (키 없는 동안은 map-avatar가 503 → 사전+해시 폴백으로 정상 동작 중)

같이 붙일 것 — **쪽지 기분 반응** (사용자 아이디어, 승인됨):
- `messages.mood` 컬럼 추가 (⚠️ Plan 2 교훈: 컬럼 추가 시 명시적 grant 필수)
- 전송 시 Edge Function에서 Haiku 구조화 출력으로 mood enum(기쁨/설렘/위로/장난/서운함 등) 분류 → 저장
- 말풍선 닫힌 뒤 FSM happy/sad 상태 재사용해 분신 반응 연출. 배달 시 LLM 재호출 없음

## 3순위 — 도트 다듬기 라운드

"못생겼어" 피드백의 남은 절반 (종 선택은 LLM 매핑으로 해결, 생김새는 미해결):
- 햄스터 비대칭, 새/오리 실루엣 구분 안 됨, 우파루파 겉아가미 디테일 등 종별 손질
- 레퍼런스: `docs/reference/sticker-style-reference.jpg` ("바들바들 동물콘" 스타일)
- 갤러리 dev 페이지 `localhost:5173/?gallery`로 12종×8팔레트 한눈 확인 가능

## 4순위 — Tier1 상호작용

리서치 완료분(`docs/research/2026-07-31-interaction-research.md`)에서 미구현 3종:
- 커플 스트릭 (그레이스 1일, 죄책감 완화 카피)
- 간식 보내기 (밥과 구분되는 상호 돌봄)
- 기념일 이벤트
(굿나잇·흔적 요약은 Plan 3에서 구현 완료)

## 5순위 — 꾸미기 UI

overlays 슬롯은 아바타 v2에 준비돼 있음(compose.ts). 레벨업 보상과 연결.

## 파킹된 마이너 (최종 리뷰 트리아지: 전부 보류 가능 판정)

- 말풍선 9-patch 손그림 테두리 (지금은 CSS border)
- map-avatar: 클라 textarea에 maxLength 없음(서버 2,000자 캡만), 종·팔레트 키 3곳 중복(주석 상호참조 권장), upload-character의 MAX_SEED_BYTES가 바이트가 아닌 UTF-16 단위
- generate.test.ts에 mapping 한 필드만 유효한 케이스 미검증 (3줄이면 추가 가능)
- avatar_seed를 읽는 코드가 아직 없음 (꾸미기에서 쓸 예정)

## 참고 문서

- 스펙: `docs/superpowers/specs/` (2026-07-30 마스터, 07-31 Plan 3, 07-31 LLM 매핑)
- 플랜: `docs/superpowers/plans/`
- 리서치: `docs/research/2026-07-31-interaction-research.md`
