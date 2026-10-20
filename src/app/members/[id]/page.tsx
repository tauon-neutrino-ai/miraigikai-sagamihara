import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FieldBars, ScoreBreakdown } from "@/components/charts";
import { QuestionCard } from "@/components/question-card";
import { BackLink, Badge, Card, ScorePill } from "@/components/ui";
import { SCORE_CRITERIA, type ScoreKey } from "@/lib/constants";
import { getMemberDetail } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/members/[id]">): Promise<Metadata> {
  const d = await getMemberDetail(Number((await params).id));
  return { title: d ? `${d.member.display_name} 議員` : "議員" };
}

export default function MemberPage({ params }: PageProps<"/members/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
      <MemberDetail params={params} />
    </Suspense>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

async function MemberDetail({ params }: { params: Promise<{ id: string }> }) {
  const d = await getMemberDetail(Number((await params).id));
  if (!d) notFound();
  const { member: m, positions, questions, legislations } = d;
  const chairs = ["議長", "副議長"].filter((x) => positions.some((p) => p.body === "本会議" && p.position === x));

  // 評価基準ごとの平均
  const avgScores: Partial<Record<ScoreKey, number>> = {};
  for (const c of SCORE_CRITERIA) {
    const vals = questions.map((q) => q.scores[c.key]).filter((v): v is number => v != null);
    if (vals.length) avgScores[c.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const scored = questions.filter((q) => q.score_total != null);
  const best = [...scored].sort((a, b) => (b.score_total ?? 0) - (a.score_total ?? 0)).slice(0, 2);
  const worst = [...scored]
    .sort((a, b) => (a.score_total ?? 0) - (b.score_total ?? 0))
    .filter((q) => !best.includes(q))
    .slice(0, 2);

  return (
    <article className="space-y-8">
      <BackLink href="/members" label="議員の一覧" />
      <header>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold">{m.display_name}</h1>
          {m.kana && <span className="text-sm text-muted">{m.kana}</span>}
          {!m.is_current && <Badge>元議員</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {[m.ward && `${m.ward}選出`, m.faction, m.seat_number && `議席番号 ${m.seat_number}`].filter(Boolean).join("・")}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.stats?.was_chair && <Badge tone="primary">議長経験あり</Badge>}
          {m.stats?.was_vice_chair && <Badge tone="accent">副議長経験あり</Badge>}
          {legislations.length > 0 && <Badge tone="accent">議員立法 {legislations.length}件</Badge>}
        </div>
        {m.committees.length > 0 && <p className="mt-3 text-sm">役職・所属委員会: {m.committees.join("、")}</p>}
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="一般質問・代表質問の回数"
          value={`一般 ${questions.filter((q) => q.question_type === "一般質問").length}回・代表 ${questions.filter((q) => q.question_type === "代表質問").length}回`}
        />
        <Stat label="評価の平均" value={m.stats?.avg_score != null ? <ScorePill score={m.stats.avg_score} /> : "-"} />
        <Stat label="議長・副議長" value={chairs.length ? `${chairs.join("・")}経験あり` : "経験なし"} />
        <Stat label="議員立法（中心的な役割）" value={`${legislations.length}件`} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold">よく質問する分野</h2>
          {m.topFields.length ? <FieldBars data={m.topFields} /> : <p className="text-sm text-muted">まだデータがありません。</p>}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">質問の評価（平均）</h2>
          {scored.length ? <ScoreBreakdown scores={avgScores} /> : <p className="text-sm text-muted">まだデータがありません。</p>}
        </Card>
      </div>

      {best.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 text-lg font-bold">評価の高かった質問</h2>
            <ul className="space-y-3">
              {best.map((q) => (
                <li key={q.id}>
                  <QuestionCard q={q} showMember={false} />
                </li>
              ))}
            </ul>
          </section>
          {worst.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-bold">評価の低かった質問</h2>
              <ul className="space-y-3">
                {worst.map((q) => (
                  <li key={q.id}>
                    <QuestionCard q={q} showMember={false} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">議員立法（議員提案条例）</h2>
        {legislations.length === 0 ? (
          <p className="text-sm text-muted">
            中心的な役割を果たした議員立法の記録はありません（連名で提出に加わっただけのものは数えていません）。
          </p>
        ) : (
          <ul className="space-y-2">
            {legislations.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/legislation#${l.slug}`}
                  className="block rounded-lg border border-border bg-surface p-3 text-sm hover:border-primary"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted">{l.year}年</span>
                    <span className="font-medium">{l.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{l.role}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">一般質問・代表質問の一覧</h2>
        {questions.length === 0 ? (
          <p className="text-sm text-muted">取り込み済みの一般質問・代表質問はありません。</p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q) => (
              <li key={q.id}>
                <QuestionCard q={q} showMember={false} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {m.profile_url && (
        <p className="text-sm">
          <a href={m.profile_url} className="text-primary underline" target="_blank" rel="noreferrer">
            相模原市議会ホームページの議員紹介
          </a>
        </p>
      )}
    </article>
  );
}
