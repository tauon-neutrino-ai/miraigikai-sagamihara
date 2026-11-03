import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Badge, Card, ResultBadge, billLabel, formatDate } from "@/components/ui";
import { getTheme } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/themes/[slug]">): Promise<Metadata> {
  const d = await getTheme((await params).slug);
  return { title: d?.theme.title ?? "テーマ深掘り", description: d?.theme.content.headline };
}

export default function ThemePage({ params }: PageProps<"/themes/[slug]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
      <ThemeDetail params={params} />
    </Suspense>
  );
}

type Data = NonNullable<Awaited<ReturnType<typeof getTheme>>>;

/** 根拠（Q123 / B45）を、質問・議案ページへのリンクにする */
function Refs({ refs, data }: { refs: string[]; data: Data }) {
  const links = refs.flatMap((r) => {
    const id = Number(r.slice(1));
    if (r.startsWith("Q")) {
      const q = data.questions.find((x) => x.id === id);
      return q
        ? [
            <Link key={r} href={`/questions/${q.id}`} className="rounded-full border border-border px-2 py-0.5 hover:border-primary">
              {q.member?.display_name.replace(/\s+/g, "") ?? "議員"}
              {q.question_type === "代表質問" ? "（代表）" : ""} {q.meeting_date.slice(0, 7).replace("-", "/")}
            </Link>,
          ]
        : [];
    }
    const b = data.bills.find((x) => x.id === id);
    return b
      ? [
          <Link key={r} href={`/bills/${b.id}`} className="rounded-full border border-border px-2 py-0.5 hover:border-primary">
            {b.year}年 {billLabel(b)}
          </Link>,
        ]
      : [];
  });
  if (links.length === 0) return null;
  return <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">{links}</div>;
}

async function ThemeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getTheme((await params).slug);
  if (!data) notFound();
  const { theme, bills } = data;
  const c = theme.content;
  const stances = [...new Set(c.members.map((m) => m.stance))];

  return (
    <article className="space-y-10">
      <div>
        <BackLink href="/themes" label="テーマ深掘りの一覧" />
        <p className="text-sm text-muted">テーマ深掘り</p>
        <h1 className="text-2xl font-bold">{theme.title}</h1>
        {theme.description && <p className="mt-1 text-sm text-muted">{theme.description}</p>}
      </div>

      <Card className="bg-primary-soft">
        <p className="text-lg font-bold text-primary">{c.headline}</p>
        <p className="mt-2">{c.overview}</p>
      </Card>

      <section>
        <h2 className="mb-2 text-xl font-bold">いまどうなっている？</h2>
        <Card>
          <p>{c.current_status}</p>
          <Refs refs={c.current_status_refs} data={data} />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">気になる疑問</h2>
        <div className="space-y-3">
          {c.faq.map((f) => (
            <Card key={f.question}>
              <h3 className="font-bold">Q. {f.question}</h3>
              <p className="mt-2 text-sm">{f.answer}</p>
              <Refs refs={f.refs} data={data} />
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">これまでの経緯</h2>
        <ol className="relative space-y-4 border-l-2 border-border pl-5">
          {c.timeline.map((t, i) => (
            <li key={`${i}-${t.date}`}>
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary" aria-hidden />
              <p className="text-sm font-bold text-primary">{t.date}</p>
              <p className="text-sm">{t.event}</p>
              <Refs refs={t.refs} data={data} />
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">このテーマに関心のある議員</h2>
        <p className="mb-3 text-xs text-muted">
          本会議の一般質問・代表質問での発言内容から分けています（委員会での発言は含みません）。
        </p>
        <div className="space-y-6">
          {stances.map((s) => (
            <div key={s}>
              <h3 className="mb-2 font-bold">
                <Badge tone="accent">{s}</Badge>
                <span className="ml-2 text-sm font-normal text-muted">{c.members.filter((m) => m.stance === s).length}人</span>
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.members
                  .filter((m) => m.stance === s)
                  .map((m) => (
                    <li key={m.name}>
                      <Card className="h-full">
                        {m.member_id ? (
                          <Link href={`/members/${m.member_id}`} className="font-bold text-primary underline">
                            {m.name}
                          </Link>
                        ) : (
                          <span className="font-bold">{m.name}</span>
                        )}
                        <p className="mt-1 text-sm">{m.summary}</p>
                        <Refs refs={m.refs} data={data} />
                      </Card>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {c.open_issues.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-bold">これからの注目点</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            {c.open_issues.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      {bills.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-bold">関係する議案</h2>
          <ul className="space-y-2 text-sm">
            {bills.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/bills/${b.id}`} className="text-primary underline">
                  {b.year}年 {billLabel(b)} {b.title}
                </Link>
                <ResultBadge result={b.result} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        このページは、本会議の一般質問・代表質問の会議録（{data.questions.length}件）と議案の要約をもとに AI が作成したもので、誤りを含むことがあります。
        最終更新: {formatDate(theme.updated_at.slice(0, 10))}
      </p>
    </article>
  );
}
