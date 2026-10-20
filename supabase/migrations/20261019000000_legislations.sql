-- 議員立法（議員提案条例）
-- 連名の議員提出議案（意見書など）は数えず、条例づくりで中心的な役割を果たした議員だけを記録する。
-- データは data/legislations.json を手で編集し、npm run sync:legislations で反映する。

create table public.legislations (
  id bigint generated always as identity primary key,
  slug text not null unique,                    -- data/legislations.json のキー
  title text not null,                          -- 条例名
  year integer not null,                        -- 成立した年
  proposer_type text not null check (proposer_type in ('会派', '委員会', '超党派・共同')),
  proposer_group text,                          -- 提案した会派・委員会名
  summary text,                                 -- どんな条例か
  background text,                              -- 提案の経緯
  co_proposers text,                            -- その他の提出者（数えない。記録として残す）
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 中心的な役割を果たした議員（ここに入った議員だけを「議員立法」として数える）
create table public.legislation_leaders (
  legislation_id bigint not null references public.legislations(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  role text not null,                           -- 例: 起草を主導
  primary key (legislation_id, member_id)
);

alter table public.legislations enable row level security;
alter table public.legislation_leaders enable row level security;
create policy "public read" on public.legislations for select using (true);
create policy "public read" on public.legislation_leaders for select using (true);

-- 議員ごとの集計: 連名の提出者数ではなく、議員立法で中心的役割を果たした件数を数える
drop view public.member_stats;
create view public.member_stats with (security_invoker = true) as
select
  m.id as member_id,
  count(distinct gq.id) as question_count,
  round(avg(gq.score_total)::numeric, 2) as avg_score,
  exists (select 1 from public.member_positions p
          where p.member_id = m.id and p.position = '議長' and p.body = '本会議') as was_chair,
  exists (select 1 from public.member_positions p
          where p.member_id = m.id and p.position = '副議長' and p.body = '本会議') as was_vice_chair,
  (select count(*) from public.legislation_leaders l where l.member_id = m.id) as legislation_count
from public.members m
left join public.general_questions gq on gq.member_id = m.id
group by m.id;
