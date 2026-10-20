"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FIELDS } from "@/lib/constants";
import type { Bill } from "@/lib/types";
import { Badge, FieldTag, ResultBadge } from "./ui";

const KINDS = ["すべて", "市長提出", "議員提出"] as const;

export function BillList({ bills }: { bills: Bill[] }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("すべて");
  const [field, setField] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => [...new Set(bills.map((b) => b.category).filter(Boolean))] as string[], [bills]);

  const filtered = bills.filter(
    (b) =>
      (kind === "すべて" || b.bill_kind === kind) &&
      (!field || b.fields.includes(field as (typeof FIELDS)[number])) &&
      (!category || b.category === category) &&
      (!query || `${b.title}${b.summary ?? ""}`.includes(query)),
  );

  // 会議ごとにまとめる（新しい順）
  const groups = new Map<string, Bill[]>();
  for (const b of filtered) {
    const key = b.session?.label ?? `${b.year}年`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 ${kind === k ? "bg-primary text-white" : "bg-surface"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <select className="rounded-lg border border-border bg-surface px-2 py-1.5" value={field} onChange={(e) => setField(e.target.value)}>
          <option value="">分野: すべて</option>
          {FIELDS.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        <select
          className="rounded-lg border border-border bg-surface px-2 py-1.5"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">種類: すべて</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="キーワードで探す"
          className="min-w-40 flex-1 rounded-lg border border-border bg-surface px-3 py-1.5"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && <p className="text-sm text-muted">条件に合う議案はありません。</p>}

      <div className="space-y-8">
        {[...groups.entries()].map(([label, list]) => (
          <section key={label}>
            <h2 className="mb-3 text-lg font-bold">{label}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/bills/${b.id}`}
                    className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition hover:border-primary"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge tone={b.bill_kind === "市長提出" ? "neutral" : "primary"}>
                        {b.bill_kind === "市長提出" ? `議案第${b.number}号` : `議提議案第${b.number}号`}
                      </Badge>
                      {b.category && <Badge>{b.category}</Badge>}
                      <span className="ml-auto">
                        <ResultBadge result={b.result} />
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold">{b.title}</h3>
                    <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">{b.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.fields.map((f) => (
                        <FieldTag key={f} field={f} />
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
