-- 발신 시 read_at 위조 차단: 새 메시지는 반드시 미읽음으로 시작
drop policy "messages: 본인 발신" on messages;
create policy "messages: 본인 발신" on messages for insert
  with check (
    sender_user_id = auth.uid()
    and couple_id = my_couple_id()
    and read_at is null
  );
