-- 보안 수정 1: join_couple TOCTOU 레이스 — invite_code 조회 시 행 잠금으로 동시 합류 직렬화
create or replace function join_couple(p_code text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_couple_id uuid;
  v_members int;
begin
  if (select couple_id from profiles where user_id = auth.uid()) is not null then
    raise exception 'ALREADY_IN_COUPLE';
  end if;
  select id into v_couple_id from couples where invite_code = p_code for update;
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

-- 보안 수정 2: characters UPDATE는 name 컬럼만 허용 (image_path/couple_id/subject_user_id/regen_count는
-- Edge Function(service role)만 변경 — 클라이언트가 regen 한도 등을 우회하지 못하도록 컬럼 스코프 권한 적용)
revoke update on table public.characters from authenticated, anon;
grant update (name) on table public.characters to authenticated;
