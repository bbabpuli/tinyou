-- Realtime: 커플 채널(useCoupleChannel)이 구독할 테이블을 supabase_realtime publication에 추가.
-- 이미 등록돼 있으면(재실행/대시보드에서 먼저 추가된 경우) duplicate_object 에러를 무해하게 삼킨다.
do $$ begin
  alter publication supabase_realtime add table messages, care_actions, profiles;
exception
  when duplicate_object then null;
end $$;
