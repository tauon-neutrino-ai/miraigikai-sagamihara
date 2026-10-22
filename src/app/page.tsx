import Link from "next/link";
import { QuestionCard } from "@/components/question-card";
import { Badge, Card, EmptyState, ResultBadge, billLabel } from "@/components/ui";
import { SITE_NAME } from "@/lib/constants";
import { getBills, getMembers, getQuestions, getSessionSummaries } from "@/lib/data";

export default async function Home() {
  const [bills, questions, members, sessions] = await Promise.all([getBills(), getQuestions(), getMembers(), getSessionSummaries()]);
  const digested = sessions.filter((s) => s.digests.length > 0).slice(0, 2);
  const latestSession = bills[0]?.session?.label;
  const latestBills = bills.filter((b) => b.session?.label === latestSession).slice(0, 6);
  const latestQuestions = questions.slice(0, 5);

  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-primary-soft px-6 py-10">
        <h1 className="text-3xl font-bold text-primary">{SITE_NAME}</h1>
        <p className="mt-3 max-w-2xl">
          相模原市議会で話し合われた<strong>議案</strong>と、議員の<strong>一般質問・代表質問</strong>
          を、わかりやすい言葉でまとめています。議員ごとに、どんな分野の質問が多いか、質問の中身がどうだったかも見られます。
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Link href="/bills" className="rounded-xl bg-surface p-4 hover:ring-2 hover:ring-primary">
            <div className="text-2xl font-bold">{bills.length}</div>
            <div className="text-sm text-muted">件の議案</div>
          </Link>
          <Link href="/questions" className="rounded-xl bg-surface p-4 hover:ring-2 hover:ring-primary">
            <div className="text-2xl font-bold">{questions.length}</div>
            <div className="text-sm text-muted">件の一般質問・代表質問</div>
          </Link>
          <Link href="/members" className="rounded-xl bg-surface p-4 hover:ring-2 hover:ring-primary">
            <div className="text-2xl font-bold">{members.filter((m) => m.is_current).length}</div>
            <div className="text-sm text-muted">人の議員</div>
          </Link>
        </div>
      </section>

      {digested.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-bold">最近の会議のまとめ</h2>
            <Link href="/sessions" className="text-sm text-primary">
              すべて見る →
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {digested.map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 hover:border-primary">
                  <h3 className="font-bold">{s.label}のまとめ</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {s.digests.map((d) => (
                      <li key={d.kind}>
                        {d.kind === "議案" ? "議案" : "質問"}：{d.headline}
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">最新の議案{latestSession && <span className="ml-2 text-sm font-normal text-muted">{latestSession}</span>}</h2>
          <Link href="/bills" className="text-sm text-primary">
            すべて見る →
          </Link>
        </div>
        {latestBills.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {latestBills.map((b) => (
              <li key={b.id}>
                <Link href={`/bills/${b.id}`} className="block h-full rounded-xl border border-border bg-surface p-4 hover:border-primary">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Badge tone={b.bill_kind === "市長提出" ? "neutral" : "primary"}>
                      {billLabel(b)}
                    </Badge>
                    <span className="ml-auto">
                      <ResultBadge result={b.result} />
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold">{b.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{b.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">最近の一般質問・代表質問</h2>
          <Link href="/questions" className="text-sm text-primary">
            すべて見る →
          </Link>
        </div>
        {latestQuestions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {latestQuestions.map((q) => (
              <li key={q.id}>
                <QuestionCard q={q} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <h2 className="font-bold">一般質問・代表質問ってなに？</h2>
        <p className="mt-2 text-sm">
          一般質問は、議員が市の仕事全般について、市長や市の幹部に直接たずねる場です。議員が市民の声をもとに問題を指摘したり、新しい取り組みを提案したりします。
          代表質問は、会派（議員のグループ）を代表して、市長の施政方針や議案について質問するものです。
          どんなテーマを取り上げ、どんな答えを引き出したかを見ると、議員の活動がよくわかります。
        </p>
        <Link href="/about" className="mt-2 inline-block text-sm text-primary">
          評価のしかたについて →
        </Link>
      </Card>
    </div>
  );
}
