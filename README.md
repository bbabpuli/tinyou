# 티뉴 (Tinyou)

> tiny + you — 연인의 분신을 주머니에 넣고 다니는 커플 다마고치 PWA (개발 중)

연인 둘만의 1:1 방에서, 서로를 묘사한 글로 AI가 만들어 준 **연인의 분신 캐릭터**를
각자 폰에서 키우는 앱. 매일 밥 주고 쓰다듬으면 레벨이 오르고, 연인이 보낸 메시지는
분신이 말풍선으로 배달한다.

## 현재 상태: Plan 1 (로컬 플레이그라운드)

Supabase 연동 전, 브라우저 로컬에서 완결되는 게임 코어:
픽셀 블롭 돌보기 · XP/레벨 · 방치 시 시무룩 (절대 죽지 않음)

## 실행

```bash
npm install
npm run dev   # 개발 서버
npm test      # 유닛 테스트 (Vitest)
```

## 문서

- 설계 스펙: `docs/superpowers/specs/2026-07-30-tinyou-design.md`
- 구현 계획: `docs/superpowers/plans/`
