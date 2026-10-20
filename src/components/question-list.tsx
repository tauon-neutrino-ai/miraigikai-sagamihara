"use client";

import { useMemo, useState } from "react";
import { FIELDS } from "@/lib/constants";
import type { GeneralQuestion } from "@/lib/types";
import { QuestionCard } from "./question-card";

const SORTS = { date: "新しい順", high: "評価の高い順", low: "評価の低い順" } as const;

export function QuestionList({ questions }: { questions: GeneralQuestion[] }) {
  const [type, setType] = useState("");
  const [field, setField] = useState("");
  const [session, setSession] = useState("");
  const [sort, setSort] = useState<keyof typeof SORTS>("date");
  const [query, setQuery] = useState("");

  const sessions = useMemo(
    () => [...new Set(questions.map((q) => q.session?.label).filter(Boolean))] as string[],
    [questions],
  );

  const filtered = questions
    .filter(
      (q) =>
        (!type || q.question_type === type) &&
        (!field || q.fields.includes(field as (typeof FIELDS)[number])) &&
        (!session || q.session?.label === session) &&
        (!query || `${q.title}${q.summary}${q.member?.display_name ?? ""}`.replace(/\s/g, "").includes(query.replace(/\s/g, ""))),
    )
    .sort((a, b) => {
      if (sort === "date") return b.meeting_date.localeCompare(a.meeting_date);
      const d = (a.score_total ?? 0) - (b.score_total ?? 0);
      return sort === "high" ? -d : d;
    });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <select className="rounded-lg border border-border bg-surface px-2 py-1.5" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">種類: すべて</option>
          <option>一般質問</option>
          <option>代表質問</option>
        </select>
        <select className="rounded-lg border border-border bg-surface px-2 py-1.5" value={session} onChange={(e) => setSession(e.target.value)}>
          <option value="">会議: すべて</option>
          {sessions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select className="rounded-lg border border-border bg-surface px-2 py-1.5" value={field} onChange={(e) => setField(e.target.value)}>
          <option value="">分野: すべて</option>
          {FIELDS.map((f) => (
            <option key={f}>{f}</option>
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
        <input
          type="search"
          placeholder="キーワード・議員名で探す"
          className="min-w-40 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <p className="mb-3 text-xs text-muted">{filtered.length} 件</p>
      <ul className="space-y-3">
        {filtered.slice(0, 200).map((q) => (
          <li key={q.id}>
            <QuestionCard q={q} />
          </li>
        ))}
      </ul>
      {filtered.length > 200 && <p className="mt-3 text-xs text-muted">先頭の200件を表示しています。条件をしぼってください。</p>}
    </div>
  );
}
