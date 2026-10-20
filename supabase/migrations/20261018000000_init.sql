-- みらい議会＠相模原市 初期スキーマ
-- 公開データは誰でも読めるが、書き込みは service_role（取り込みスクリプト）のみ。

-- 会期（例: 令和8年 6月定例会議）
create table public.sessions (
  id bigint generated always as identity primary key,
  kaigiroku_council_id integer unique,          -- 会議録検索システムの council_id
  year integer not null,                        -- 西暦（その会議が開かれた年）
  name text not null,                           -- 正規化名（例: 6月定例会議 / 第1回臨時会議 / 開会会議）
  label text not null,                          -- 表示名（例: 令和8年 6月定例会議）
  start_date date,
  created_at timestamptz not null default now(),
  unique (year, name)
);

-- 議員
create table public.members (
  id bigint generated always as identity primary key,
  name text not null unique,                    -- 空白を除いた氏名（例: 秋本仁）
  display_name text not null,                   -- 表示名（例: 秋本　仁）
  kana text,
  ward text,                                    -- 選出区
  faction text,                                 -- 所属会派
  seat_number integer,
  committees text[] not null default '{}',
  profile_url text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 役職の履歴（議長・副議長など）
create table public.member_positions (
  id bigint generated always as identity primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  position text not null check (position in ('議長', '副議長', '委員長', '副委員長')),
  body text not null default '本会議',            -- 本会議 or 委員会名
  start_date date,
  end_date date,
  source text,                                  -- どこで確認したか
  unique (member_id, position, body, start_date)
);

-- 議案
create table public.bills (
  id bigint generated always as identity primary key,
  session_id bigint references public.sessions(id) on delete set null,
  bill_kind text not null check (bill_kind in ('市長提出', '議員提出', '委員会提出')),
  number integer not null,                      -- 議案第N号 / 議提議案第N号 のN
  year integer not null,
  title text not null,
  category text,                                -- 条例 / 予算 / 決算 / 人事 / 事件 / 意見書 など
  summary text,                                 -- わかりやすい要約（一言）
  background text,                              -- なぜ必要か
  key_points jsonb not null default '[]',        -- ["ポイント", ...]
  impact text,                                  -- 市民の暮らしへの影響
  fields text[] not null default '{}',          -- 分野タグ
  result text,                                  -- 可決 / 否決 / 同意 / 認定 / 継続審査 など
  decided_on date,
  source_url text,
  source_text_hash text,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, bill_kind, number)
);

-- 議員提出議案（議員立法）の提出者・賛成者
create table public.bill_sponsors (
  bill_id bigint not null references public.bills(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  role text not null check (role in ('提出者', '賛成者')),
  primary key (bill_id, member_id, role)
);

-- 一般質問（1人の議員の1回の一般質問 = 1行）
create table public.general_questions (
  id bigint generated always as identity primary key,
  session_id bigint references public.sessions(id) on delete set null,
  member_id bigint not null references public.members(id) on delete cascade,
  meeting_date date not null,
  kaigiroku_council_id integer not null,
  kaigiroku_schedule_id integer not null,
  first_minute_id integer not null,             -- 会議録上の最初の発言ID
  title text not null,                          -- 質問全体の見出し
  summary text not null,                        -- やさしい要約
  topics jsonb not null default '[]',           -- [{title, field, question, answer, outcome}]
  fields text[] not null default '{}',          -- 分野タグ（topics から集約）
  score_total numeric(3,1),                     -- 5点満点の総合評価
  scores jsonb not null default '{}',           -- {specificity, proposal, followup, outcome, relevance}
  evaluation_comment text,                      -- 評価の理由
  good_points text[] not null default '{}',
  improvement_points text[] not null default '{}',
  source_url text,
  source_text_hash text,
  ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kaigiroku_council_id, kaigiroku_schedule_id, first_minute_id)
);

create index on public.general_questions (member_id, meeting_date desc);
create index on public.bills (session_id);
create index on public.member_positions (member_id);

-- 議員ごとの集計ビュー
create view public.member_stats with (security_invoker = true) as
select
  m.id as member_id,
  count(distinct gq.id) as question_count,
  round(avg(gq.score_total)::numeric, 2) as avg_score,
  exists (select 1 from public.member_positions p
          where p.member_id = m.id and p.position = '議長' and p.body = '本会議') as was_chair,
  exists (select 1 from public.member_positions p
          where p.member_id = m.id and p.position = '副議長' and p.body = '本会議') as was_vice_chair,
  (select count(*) from public.bill_sponsors s
     where s.member_id = m.id and s.role = '提出者') as sponsored_bill_count
from public.members m
left join public.general_questions gq on gq.member_id = m.id
group by m.id;

-- 分野ごとの質問数ビュー
create view public.member_field_counts with (security_invoker = true) as
select gq.member_id, f.field, count(*) as count
from public.general_questions gq, unnest(gq.fields) as f(field)
group by gq.member_id, f.field;

-- RLS: 公開読み取りのみ
alter table public.sessions enable row level security;
alter table public.members enable row level security;
alter table public.member_positions enable row level security;
alter table public.bills enable row level security;
alter table public.bill_sponsors enable row level security;
alter table public.general_questions enable row level security;

create policy "public read" on public.sessions for select using (true);
create policy "public read" on public.members for select using (true);
create policy "public read" on public.member_positions for select using (true);
create policy "public read" on public.bills for select using (true);
create policy "public read" on public.bill_sponsors for select using (true);
create policy "public read" on public.general_questions for select using (true);
