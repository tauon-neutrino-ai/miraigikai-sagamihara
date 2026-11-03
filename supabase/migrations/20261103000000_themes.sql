-- テーマ深掘り（例: アイススケート場問題）
-- data/themes.json の設定をもとに、npm run theme で議案と会議録の関係部分から AI がまとめる。
create table public.themes (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  description text,
  content jsonb not null default '{}',          -- 概要・現状・疑問への答え・経緯・議員の立場など
  question_ids bigint[] not null default '{}',  -- 材料にした質問
  bill_ids bigint[] not null default '{}',      -- 材料にした議案
  source_hash text,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.themes enable row level security;
create policy "public read" on public.themes for select using (true);
