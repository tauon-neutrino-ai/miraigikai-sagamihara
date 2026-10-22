import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Badge, Card, FieldTag, ResultBadge, billLabel } from "@/components/ui";
import { getSessionDetail } from "@/lib/data";
import type { BillDigestItem, QuestionDigestItem } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/sessions/[id]">): Promise<Metadata> {
  const d = await getSessionDetail(Number((await params).id));
  return { title: d ? `${d.session.label}のまとめ` : "会議のまとめ" };
}

export default function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
      <SessionDetail params={params} />
    </Suspense>
  );
}

async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const d = await getSessionDetail(Number((await params).id));
  if (!d) notFound();
  const { session, digests, bills, questions } = d;
  const billDigest = digests.find((x) => x.kind === "議案");
  const questionDigest = digests.find((x) => x.kind === "質問");

  return (
    <article className="space-y-10">
      <div>
        <BackLink href="/sessions" label="会議のまとめの一覧" />
        <h1 className="text-2xl font-bold">{session.label}のまとめ</h1>
        <p className="mt-1 text-sm text-muted">
          議案 {bills.length}件・一般質問／代表質問 {questions.length}件
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-bold">議案のまとめ</h2>
        {!billDigest ? (
          <p className="text-sm text-muted">{bills.length ? "まとめは準備中です。" : "この会議の議案はまだ取り込まれていません。"}</p>
        ) : (
          <div className="space-y-4">
            <Card className="bg-primary-soft">
              <p className="font-bold text-primary">{billDigest.headline}</p>
              <p className="mt-2">{billDigest.overview}</p>
            </Card>
            <ol className="space-y-3">
              {(billDigest.items as BillDigestItem[]).map((item, i) => {
                const linked = item.bill_ids.map((id) => bills.find((b) => b.id === id)).filter((b) => b != null);
                return (
                  <li key={`${i}-${item.title}`}>
                    <Card>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{item.title}</h3>
                        {item.contested && <Badge tone="primary">意見が分かれた</Badge>}
                      </div>
                      <p className="mt-2 text-sm">{item.description}</p>
                      {linked.length > 0 && (
                        <ul className="mt-3 space-y-1 text-sm">
                          {linked.map((b) => (
                            <li key={b.id} className="flex flex-wrap items-center gap-2">
                              <Link href={`/bills/${b.id}`} className="text-primary underline">
                                {billLabel(b)} {b.title}
                              </Link>
                              <ResultBadge result={b.result} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">代表質問・一般質問のまとめ</h2>
        {!questionDigest ? (
          <p className="text-sm text-muted">
            {questions.length ? "まとめは準備中です。" : "この会議の質問はまだ取り込まれていません（会議録の公開は会議の2〜3か月後です）。"}
          </p>
        ) : (
          <div className="space-y-4">
            <Card className="bg-primary-soft">
              <p className="font-bold text-primary">{questionDigest.headline}</p>
              <p className="mt-2">{questionDigest.overview}</p>
            </Card>
            <ol className="space-y-3">
              {(questionDigest.items as QuestionDigestItem[]).map((item, i) => {
                const linked = item.question_ids.map((id) => questions.find((q) => q.id === id)).filter((q) => q != null);
                return (
                  <li key={`${i}-${item.theme}`}>
                    <Card>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold">{item.theme}</h3>
                        <FieldTag field={item.field} />
                        <span className="ml-auto text-sm font-bold text-primary">{linked.length}人が質問</span>
                      </div>
                      <p className="mt-2 text-sm">{item.description}</p>
                      <p className="mt-2 text-sm">
                        <span className="font-bold text-muted">市の答え：</span>
                        {item.response}
                      </p>
                      {linked.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {linked.map((q) => (
                            <Link
                              key={q.id}
                              href={`/questions/${q.id}`}
                              className="rounded-full border border-border px-3 py-1 hover:border-primary"
                            >
                              {q.member?.display_name ?? "議員"}
                              {q.question_type === "代表質問" && <span className="ml-1 text-xs text-primary">代表</span>}
                            </Link>
                          ))}
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

      <p className="text-xs text-muted">
        このまとめは、取り込んだ議案・質問の要約をもとに AI が作成したものです。正確な内容は各ページの出典をご確認ください。
      </p>
    </article>
  );
}
