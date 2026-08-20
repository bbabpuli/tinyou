# 2026-08-20 — 모바일 접속·로그인 삽질 전 기록

폰(갤럭시)에서 dev 앱 접속·로그인까지 가는 동안 만난 문제들과 해법. 다음에 같은 일 겪으면 이 문서만 보면 된다.

## 1. Supabase 프로젝트 자동 일시정지 (INACTIVE)

- 증상: `supabase db push` 등 모든 DB 연결이 connection timeout. `supabase projects list`에 INACTIVE.
- 원인: 무료 티어는 ~1주 미사용 시 자동 일시정지 (마지막 사용 8/4 → 8/20 접속 시 정지 상태).
- 해법: Management API로 복구. 토큰은 macOS 키체인(서비스 "Supabase CLI", 계정 "supabase").
  ```bash
  TOKEN=$(security find-generic-password -s "Supabase CLI" -a supabase -w)
  curl -X POST "https://api.supabase.com/v1/projects/hhdspjlnxgcwpbughsdb/restore" -H "Authorization: Bearer $TOKEN"
  # 이후 GET /v1/projects/<ref> 폴링 → COMING_UP → RESTORING → ACTIVE_HEALTHY (약 2~3분)
  ```
- 데이터는 그대로 보존된다.

## 2. 워크트리 dev 서버 흰 화면

- 증상: 워크트리에서 `npm run dev` → 200은 뜨는데 브라우저 흰 화면.
- 원인: `.env.local`은 gitignore라 워크트리에 자동으로 안 따라온다 → VITE_SUPABASE_URL 없이 클라이언트 초기화 실패.
- 해법: `cp <메인체크아웃>/.env.local <워크트리>/.env.local` 후 dev 서버 재시작 (Vite는 시작 시에만 env 로드).

## 3. 폰(LAN) 접속 설정

- `npm run dev -- --host` 로 LAN 노출 → `http://<맥IP>:5173` (IP는 `ipconfig getifaddr en0`).
- 폰 로그인 리다이렉트가 되려면 Supabase Auth 설정 필요:
  - `uri_allow_list`에 `http://<IP>:5173`, `http://<IP>:5173/**` 추가
  - **admin generate_link의 redirect_to는 allowlist만으로는 안 먹히는 경우가 있어 site_url 자체를 `http://<IP>:5173`으로 전환**했다 (맥에서도 이 주소로 접속 가능하므로 양쪽 다 동작). localhost는 allowlist에 유지.
  - 설정 변경 후 GoTrue 반영까지 1~3분 걸린다 (성공할 때까지 generate_link 재시도 폴링으로 확인).
- 현재 상태(2026-08-20): site_url = http://192.168.2.14:5173. **공유기 IP 바뀌면 다시 맞춰야 한다.** 배포(Plan 4) 후에는 실도메인으로 교체.

## 4. 이메일 매직링크가 "안 오는" 3중 원인

1. **발송은 됐는데 스팸행**: 기본 발신자 `noreply@mail.app.supabase.io`는 Gmail에서 스팸 처리 잦음. auth 로그(`mail.send`)로 발송 여부 확인 가능.
2. **rate limit**: 기본 SMTP는 **시간당 2통** + 같은 주소 60초 쿨다운(`smtp_max_frequency`). 초과 시 "email rate limit exceeded" / "For security purposes, you can only request this after N seconds".
3. **redirect 불일치**: localhost 화면에서 요청한 메일의 링크는 localhost로 리다이렉트 → 폰에서 열면 로그인 안 됨. 링크는 "요청한 기기의 origin"으로 돌아간다.
- 근본 해결은 Plan 4의 Resend 커스텀 SMTP.

## 5. 카톡 미리보기 봇이 일회용 매직링크를 소모 ★핵심 교훈

- 증상: admin generate_link로 만든 링크를 카톡 "나에게 보내기"로 폰에 옮겨 클릭 → 로그인 안 되고 로그인 화면으로 떨어짐.
- 원인: edge 로그로 확인 — 사람이 클릭하기 전에 **`kakaotalk-scrap/1.0`(미리보기 크롤러)이 먼저 GET** → 일회용 토큰 소진. 이후 클릭은 otp_expired.
- 슬랙·iMessage·문자 미리보기도 동일한 문제를 일으킨다.
- 해법: 링크를 메신저에 태우지 말 것. dev 서버 `public/go.html`에 meta refresh로 링크를 심고 폰에서 `192.168.2.14:5173/go.html`만 직접 타이핑하게 함 (짧아서 타이핑 가능, 봇 개입 없음). **로그인 완료 후 go*.html은 즉시 삭제.**
- 실유저 온보딩 설계 시: 미리보기가 밟아도 살아남는 방식(OTP 코드 입력, 또는 토큰해시+명시적 "로그인" 버튼 확인 페이지) 필요 → next-steps에 반영.

## 6. admin generate_link 사용법 (REST)

```bash
# service_role 키는 Management API로 조회 가능 (reveal=true)
curl -s "https://api.supabase.com/v1/projects/<ref>/api-keys?reveal=true" -H "Authorization: Bearer $TOKEN"
# 링크 발급 — redirect_to는 options 안이 아니라 **최상위 필드** (options.redirect_to는 무시됨)
curl -X POST "https://<ref>.supabase.co/auth/v1/verify... /auth/v1/admin/generate_link" \
  -H "apikey: $SR" -H "Authorization: Bearer $SR" \
  -d '{"type":"magiclink","email":"dongdong@tinyou.test","redirect_to":"http://192.168.2.14:5173"}'
```
- 같은 유저로 재발급하거나 그 유저가 로그인 폼에 이메일을 넣으면 기존 토큰이 무효화된다.
- 링크 유효 1시간(`mailer_otp_exp`), 일회용.

## 7. 진단 도구: Management API 로그 조회

- `GET /v1/projects/<ref>/analytics/endpoints/logs.all?sql=<BigQuery SQL>&iso_timestamp_start=...&iso_timestamp_end=...`
- **시간창 파라미터(iso_timestamp_*) 없이 SQL만 보내면 조용히 빈 결과**가 온다 — 반드시 명시.
- auth 로그: `from auth_logs` (mail.send 이벤트, actor_username 등). 게이트웨이: `from edge_logs` + unnest(metadata/request/response/headers)로 path·status·user_agent.
