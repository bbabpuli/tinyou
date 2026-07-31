-- Realtime publication 등록을 테이블별로 분리한다.
-- 20260731000003_realtime.sql은 세 테이블을 한 문장으로 add 하면서 duplicate_object를 삼키기
-- 때문에, 셋 중 하나라도 이미 등록돼 있으면 나머지도 통째로 건너뛴다(부분 등록 상태가 굳어짐).
-- 현재 환경은 셋 다 등록돼 있어 아래 블록은 전부 no-op이지만, 새 환경·부분 등록 환경에서
-- 각 테이블이 독립적으로 보장되도록 블록을 나눠 둔다.
do $$ begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table care_actions;
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table profiles;
exception
  when duplicate_object then null;
end $$;
