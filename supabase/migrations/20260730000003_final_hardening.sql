-- 최종 리뷰 반영 하드닝
--
-- 1) profiles UPDATE 컬럼 스코핑
--    "profiles: 자기 행 수정" RLS 정책은 행만 제한할 뿐 컬럼은 제한하지 않는다.
--    couple_id를 클라이언트가 직접 갱신하면 create_couple/join_couple의 정원(2인) 검사와
--    ALREADY_IN_COUPLE 검사를 우회해 임의의 커플 방에 난입할 수 있으므로 컬럼 권한으로 막는다.
revoke update on table public.profiles from authenticated, anon;
grant update (nickname) on table public.profiles to authenticated;

-- 2) storage 익명 목록 열거 차단
--    characters 버킷은 public=true라 공개 URL 접근은 RLS를 경유하지 않는다(이미지 표시는 무영향).
--    반면 이 SELECT 정책은 storage.objects 목록 API로 전체 경로를 열거할 수 있게 해 준다.
--    경로가 UUID라 추측은 불가하지만 열거는 가능하므로 정책 자체를 제거한다.
drop policy "characters bucket: 공개 읽기" on storage.objects;

-- 3) 초대 코드 하드닝: 만료 시각 컬럼
alter table couples add column code_expires_at timestamptz not null default (now() + interval '24 hours');

-- 4) Plan 3(꾸미기) 기반: 아바타 생성 시드 영속화
alter table characters add column avatar_seed jsonb;

-- 5) create_couple: random() → CSPRNG(pgcrypto gen_random_bytes) + 24시간 만료
--    random()은 예측 가능한 PRNG라 코드 추측이 가능하다. pgcrypto는 extensions 스키마에 있으므로
--    search_path=public인 security definer 함수에서는 반드시 스키마 한정으로 호출한다.
create or replace function create_couple(p_nickname text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_bytes bytea;
  v_n bigint;
  v_couple_id uuid;
begin
  if (select couple_id from profiles where user_id = auth.uid()) is not null then
    raise exception 'ALREADY_IN_COUPLE';
  end if;
  for i in 1..10 loop
    v_bytes := extensions.gen_random_bytes(6);
    v_n := 0;
    for j in 0..5 loop
      v_n := v_n * 256 + get_byte(v_bytes, j);
    end loop;
    v_code := lpad((v_n % 1000000)::text, 6, '0');
    begin
      insert into couples (invite_code, code_expires_at)
        values (v_code, now() + interval '24 hours')
        returning id into v_couple_id;
      exit;
    exception when unique_violation then
      if i = 10 then raise exception 'CODE_GEN_FAILED'; end if;
    end;
  end loop;
  insert into profiles (user_id, nickname, couple_id) values (auth.uid(), p_nickname, v_couple_id)
    on conflict (user_id) do update set nickname = excluded.nickname, couple_id = excluded.couple_id;
  return v_code;
end $$;

-- 6) join_couple: 만료 검사(CODE_EXPIRED) + 2인 충족 시 코드 즉시 무효화
--    invite_code는 not null unique라 null로 지울 수 없으므로 code_expires_at = now()로 즉시 만료시킨다.
--    기존 for update 잠금(TOCTOU 방지)과 ALREADY_IN_COUPLE / INVALID_CODE / COUPLE_FULL 검사는 유지.
create or replace function join_couple(p_code text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_couple_id uuid;
  v_expires_at timestamptz;
  v_members int;
begin
  if (select couple_id from profiles where user_id = auth.uid()) is not null then
    raise exception 'ALREADY_IN_COUPLE';
  end if;
  select id, code_expires_at into v_couple_id, v_expires_at
    from couples where invite_code = p_code for update;
  if v_couple_id is null then
    raise exception 'INVALID_CODE';
  end if;
  if v_expires_at < now() then
    raise exception 'CODE_EXPIRED';
  end if;
  select count(*) into v_members from profiles where couple_id = v_couple_id;
  if v_members >= 2 then
    raise exception 'COUPLE_FULL';
  end if;
  insert into profiles (user_id, nickname, couple_id) values (auth.uid(), p_nickname, v_couple_id)
    on conflict (user_id) do update set nickname = excluded.nickname, couple_id = excluded.couple_id;
  -- 방금 합류로 2인이 채워졌으면 코드를 즉시 무효화한다
  select count(*) into v_members from profiles where couple_id = v_couple_id;
  if v_members >= 2 then
    update couples set code_expires_at = now() where id = v_couple_id;
  end if;
  return v_couple_id;
end $$;
