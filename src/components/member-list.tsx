"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MemberWithStats } from "@/lib/types";
import { Badge, FieldTag, ScorePill } from "./ui";

const SORTS = { kana: "50音順", count: "一般質問・代表質問の多い順", score: "評価の高い順" } as const;

/** 選出区の並び順。区のわからない元議員などは最後にまとめる */
const WARD_ORDER = ["南区", "中央区", "緑区"];
const OTHER_WARD = "選出区不明";

function wardRank(w: string) {
  const i = WARD_ORDER.indexOf(w);
  return i < 0 ? WARD_ORDER.length : i;
}

export function MemberList({ members }: { members: MemberWithStats[] }) {
  const [faction, setFaction] = useState("");
  const [ward, setWard] = useState("");
  const [sort, setSort] = useState<keyof typeof SORTS>("kana");
  const [showFormer, setShowFormer] = useState(false);

  const factions = useMemo(() => [...new Set(members.map((m) => m.faction).filter(Boolean))] as string[], [members]);
  const wards = useMemo(
    () => ([...new Set(members.map((m) => m.ward).filter(Boolean))] as string[]).sort((a, b) => wardRank(a) - wardRank(b)),
    [members],
  );

  const filtered = members
    .filter((m) => (showFormer || m.is_current) && (!faction || m.faction === faction) && (!ward || m.ward === ward))
    .sort((a, b) => {
      if (sort === "count") return (b.stats?.question_count ?? 0) - (a.stats?.question_count ?? 0);
      if (sort === "score") return (b.stats?.avg_score ?? 0) - (a.stats?.avg_score ?? 0);
      return (a.kana ?? a.name).localeCompare(b.kana ?? b.name, "ja");
    });

  // 選出区ごとに分け、区の中で並べ替える
  const groups = new Map<string, MemberWithStats[]>();
  for (const m of filtered) {
    const w = m.ward ?? OTHER_WARD;
    groups.set(w, [...(groups.get(w) ?? []), m]);
  }
  const groupList = [...groups.entries()].sort(([a], [b]) => wardRank(a) - wardRank(b));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <select className="rounded-lg border border-border bg-surface px-2 py-1.5" value={faction} onChange={(e) => setFaction(e.target.value)}>
          <option value="">会派: すべて</option>
          {factions.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select className="rounded-lg border border-border bg-surface px-2 py-1.5" value={ward} onChange={(e) => setWard(e.target.value)}>
          <option value="">選出区: すべて</option>
          {wards.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-border bg-surface px-2 py-1.5"
          value={sort}
          onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}
        >
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showFormer} onChange={(e) => setShowFormer(e.target.checked)} />
          元議員も表示
        </label>
      </div>

      <div className="space-y-8">
        {groupList.map(([w, list]) => (
          <section key={w}>
            <h2 className="mb-3 text-lg font-bold">
              {w}
              <span className="ml-2 text-sm font-normal text-muted">{list.length}人</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/members/${m.id}`}
                    className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition hover:border-primary"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-lg font-bold">{m.display_name}</span>
                      {!m.is_current && <Badge>元議員</Badge>}
                    </div>
                    <p className="text-xs text-muted">
                      {[m.ward, m.faction].filter(Boolean).join("・") || " "}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.stats?.was_chair && <Badge tone="primary">議長経験あり</Badge>}
                      {m.stats?.was_vice_chair && <Badge tone="accent">副議長経験あり</Badge>}
                      {(m.stats?.legislation_count ?? 0) > 0 && (
                        <Badge tone="accent">議員立法 {m.stats?.legislation_count}件</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span>一般質問・代表質問 {m.stats?.question_count ?? 0}回</span>
                      {m.stats?.avg_score != null && <ScorePill score={m.stats.avg_score} showLabel={false} />}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.topFields.slice(0, 3).map((f) => (
                        <FieldTag key={f.field} field={f.field} />
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
