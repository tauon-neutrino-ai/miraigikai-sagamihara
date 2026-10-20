-- 一般質問に加えて、会派を代表して行う代表質問も同じテーブルに入れる
alter table public.general_questions
  add column question_type text not null default '一般質問'
  check (question_type in ('一般質問', '代表質問'));

create index on public.general_questions (question_type);
