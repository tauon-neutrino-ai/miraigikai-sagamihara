import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import { getSessionSummaries } from "@/lib/data";

export const metadata: Metadata = { title: "会議のまとめ" };

export default async function SessionsPage() {
  const sessions = await getSessionSummaries();
  return (
    <div>
      <PageTitle
        title="会議のまとめ"
        lead="会議ごとに、重要な議案と、複数の議員が取り上げた論点をまとめています。まとめから各議案や質問の詳しいページへ移れます。"
      />
      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/sessions/${s.id}`}
                className="block rounded-xl border border-border bg-surface p-4 transition hover:border-primary"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-lg font-bold">{s.label}</h2>
                  <span className="text-sm text-muted">
                    議案 {s.billCount}件・一般質問／代表質問 {s.questionCount}件
                  </span>
                </div>
                {s.digests.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">まとめは準備中です</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {s.digests
                      .sort((a, b) => (a.kind === "議案" ? -1 : 1) - (b.kind === "議案" ? -1 : 1))
                      .map((d) => (
                        <li key={d.kind} className="flex flex-wrap items-center gap-2">
                          <Badge tone={d.kind === "議案" ? "neutral" : "accent"}>{d.kind === "議案" ? "議案" : "質問"}</Badge>
                          <span>{d.headline}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
