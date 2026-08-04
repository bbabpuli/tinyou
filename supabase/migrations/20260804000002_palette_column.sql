-- 셸 테마용 palette 노출 — avatar_seed 프라이버시는 유지한 채 팔레트 키만 연다
--
-- avatar_seed(연인 묘사 원문)는 20260730000004에서 컬럼 grant를 제거했다. 셸 리디자인이
-- 필요한 것은 그 안의 mapping.palette 키 하나뿐이고, 이는 캐릭터 이미지 색으로 이미
-- 커플에게 보이는 정보라 노출해도 프라이버시 손실이 없다. generated column이므로
-- 쓰기 경로(upload-character) 변경 없이 기존·신규 행 모두 자동 파생된다.
alter table public.characters
  add column palette text generated always as (avatar_seed -> 'mapping' ->> 'palette') stored;

grant select (palette) on table public.characters to authenticated;
