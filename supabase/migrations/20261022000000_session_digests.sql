-- 会議ごとのまとめ（議案のまとめ・代表質問/一般質問のまとめ）
-- npm run digest で、取り込み済みの議案・質問の要約から AI が作る。
create table public.session_digests (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.sessions(id) on delete cascade,
  kind text not null check (kind in ('議案', '質問')),
  headline text not null,                       -- 見出し（例: 決算の認定と物価高騰対策が中心）
  overview text not null,                       -- 全体のまとめ（数行）
  items jsonb not null default '[]',            -- 議案: [{title, description, bill_ids, contested}] / 質問: [{theme, field, description, response, question_ids}]
  source_hash text,                             -- 元にした要約の内容（変わったら作り直す）
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, kind)
);

alter table public.session_digests enable row level security;
create policy "public read" on public.session_digests for select using (true);
