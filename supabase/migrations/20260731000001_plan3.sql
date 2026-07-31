-- 메시지: 분신이 배달하는 짧은 마음 (140자)
create table messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id),
  sender_user_id uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 140),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table messages enable row level security;

create policy "messages: 커플 조회" on messages for select
  using (couple_id = my_couple_id());
create policy "messages: 본인 발신" on messages for insert
  with check (sender_user_id = auth.uid() and couple_id = my_couple_id());
create policy "messages: 수신자만 읽음 처리" on messages for update
  using (couple_id = my_couple_id() and sender_user_id <> auth.uid())
  with check (couple_id = my_couple_id() and sender_user_id <> auth.uid());

-- 컬럼 스코프 (Plan 2 패턴): update는 read_at만
revoke update on table public.messages from authenticated, anon;
grant update (read_at) on table public.messages to authenticated;

-- 굿나잇 액션 타입 허용
alter table care_actions drop constraint care_actions_type_check;
alter table care_actions add constraint care_actions_type_check
  check (type in ('feed', 'pet', 'goodnight'));

-- 아바타 v2 단장: 전 캐릭터 업로드 캡 리셋
update characters set regen_count = 0;
