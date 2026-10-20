import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ScoreBreakdown } from "@/components/charts";
import { BackLink, Badge, Card, FieldTag, ScorePill, formatDate } from "@/components/ui";
import { getQuestion } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/questions/[id]">): Promise<Metadata> {
  const q = await getQuestion(Number((await params).id));
  return {
    title: q ? `${q.member?.display_name ?? ""}議員「${q.title}」` : "一般質問・代表質問",
    description: q?.summary,
  };
}

export default function QuestionPage({ params }: PageProps<"/questions/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
      <QuestionDetail params={params} />
    </Suspense>
  );
}

const OUTCOME_TONE = {
  前向きな答弁: "primary",
  "検討・研究する": "accent",
  現状の説明のみ: "neutral",
  否定的な答弁: "neutral",
} as const;

async function QuestionDetail({ params }: { params: Promise<{ id: string }> }) {
  const q = await getQuestion(Number((await params).id));
  if (!q) notFound();

  return (
    <article className="space-y-6">
      <BackLink href="/questions" label="一般質問・代表質問の一覧" />
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <Badge tone={q.question_type === "代表質問" ? "primary" : "neutral"}>{q.question_type}</Badge>
          <span>{formatDate(q.meeting_date)}</span>
          {q.session && <span>{q.session.label}</span>}
        </div>
        <h1 className="mt-1 text-2xl font-bold">{q.title}</h1>
        {q.member && (
          <p className="mt-1">
            <Link href={`/members/${q.member.id}`} className="font-medium text-primary underline">
              {q.member.display_name} 議員
            </Link>
            {q.member.faction && <span className="text-sm text-muted">（{q.member.faction}）</span>}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {q.fields.map((f) => (
            <FieldTag key={f} field={f} />
          ))}
        </div>
      </header>

      <Card className="bg-primary-soft">
        <h2 className="text-sm font-bold text-primary">まとめ</h2>
        <p className="mt-1">{q.summary}</p>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-bold">質問と答え</h2>
        <ol className="space-y-4">
          {q.topics.map((t, i) => (
            <li key={`${i}-${t.title}`}>
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">
                    {i + 1}. {t.title}
                  </h3>
                  <FieldTag field={t.field} />
                  <span className="ml-auto">
                    <Badge tone={OUTCOME_TONE[t.outcome] ?? "neutral"}>{t.outcome}</Badge>
                  </span>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-bold text-muted">議員の質問</dt>
                    <dd className="mt-1">{t.question}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-muted">市の答え</dt>
                    <dd className="mt-1">{t.answer}</dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">質問の評価</h2>
        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <ScorePill score={q.score_total} />
            <span className="text-xs text-muted">5点満点（5つの基準の平均）</span>
          </div>
          {q.evaluation_comment && <p className="text-sm">{q.evaluation_comment}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {q.good_points.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-great">良かった点</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {q.good_points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {q.improvement_points.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-poor">改善できる点</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {q.improvement_points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <ScoreBreakdown scores={q.scores} />
        </Card>
      </section>

      {q.source_url && (
        <p className="text-sm">
          <a href={q.source_url} className="text-primary underline" target="_blank" rel="noreferrer">
            会議録（相模原市議会 会議録検索システム）で全文を読む
          </a>
        </p>
      )}
      <p className="text-xs text-muted">
        要約と評価は AI が会議録をもとに作成したもので、誤りを含むことがあります。
        <Link href="/about" className="underline">
          評価のしかた
        </Link>
      </p>
    </article>
  );
}
