-- 밥·쓰다듬은 하루 여러 번 기록 가능해야 한다 (배고픔 게이트·쓰다듬 2회 스택은
-- 클라이언트 파생 계산이 담당). 굿나잇만 하루 1회를 DB에서 계속 강제한다.
alter table care_actions
  drop constraint care_actions_character_id_user_id_type_care_date_key;

create unique index care_actions_goodnight_daily
  on care_actions (character_id, user_id, care_date)
  where type = 'goodnight';
