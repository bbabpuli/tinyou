-- avatar_seed(연인 묘사 원문)는 클라이언트 조회 불가 — service role 전용
--
-- characters의 RLS SELECT 정책("characters: 커플 조회")은 행 단위라 커플 상대가
-- avatar_seed를 PostgREST로 직접 읽을 수 있었다. 원문 답변은 Edge Function(service role)만
-- 필요로 하므로 컬럼 스코프 SELECT로 노출면을 제거한다. RLS 행 정책은 기존 그대로 유지.
--
-- care_actions RLS의 서브쿼리 `select id from characters where couple_id = my_couple_id()`는
-- id/couple_id가 계속 grant되므로 정상 동작한다.
revoke select on table public.characters from authenticated, anon;
grant select (id, couple_id, owner_user_id, subject_user_id, name, image_path, regen_count, created_at)
  on table public.characters to authenticated;
