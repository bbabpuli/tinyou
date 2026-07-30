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
