import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Badge, Card, FieldTag, ResultBadge, formatDate } from "@/components/ui";
import { getBill } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/bills/[id]">): Promise<Metadata> {
  const bill = await getBill(Number((await params).id));
  return { title: bill?.title ?? "議案", description: bill?.summary ?? undefined };
}

export default function BillPage({ params }: PageProps<"/bills/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">読み込み中…</p>}>
      <BillDetail params={params} />
    </Suspense>
  );
}

async function BillDetail({ params }: { params: Promise<{ id: string }> }) {
  const bill = await getBill(Number((await params).id));
  if (!bill) notFound();
  const proposers = bill.sponsors?.filter((s) => s.role === "提出者") ?? [];
  const supporters = bill.sponsors?.filter((s) => s.role === "賛成者") ?? [];

  return (
    <article className="space-y-6">
      <BackLink href="/bills" label="議案の一覧" />
      <header>
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <Badge tone={bill.bill_kind === "市長提出" ? "neutral" : "primary"}>
            {bill.bill_kind === "市長提出" ? `議案第${bill.number}号` : `議提議案第${bill.number}号`}（{bill.bill_kind}）
          </Badge>
          {bill.category && <Badge>{bill.category}</Badge>}
          {bill.session && <span className="text-muted">{bill.session.label}</span>}
        </div>
        <h1 className="mt-2 text-2xl font-bold">{bill.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <ResultBadge result={bill.result} />
          {bill.decided_on && <span className="text-muted">{formatDate(bill.decided_on)} 議決</span>}
          {bill.fields.map((f) => (
            <FieldTag key={f} field={f} />
          ))}
        </div>
      </header>

      <Card className="bg-primary-soft">
        <h2 className="text-sm font-bold text-primary">ひとことで言うと</h2>
        <p className="mt-1 text-lg">{bill.summary}</p>
      </Card>

      {bill.background && (
        <section>
          <h2 className="mb-2 text-lg font-bold">なぜ必要なの？</h2>
          <p>{bill.background}</p>
        </section>
      )}

      {bill.key_points.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">ポイント</h2>
          <ul className="list-disc space-y-1 pl-6">
            {bill.key_points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      {bill.impact && (
        <section>
          <h2 className="mb-2 text-lg font-bold">くらしへの影響</h2>
          <p>{bill.impact}</p>
        </section>
      )}

      {(proposers.length > 0 || supporters.length > 0) && (
        <section>
          <h2 className="mb-2 text-lg font-bold">提出した議員</h2>
          {[
            ["提出者", proposers],
            ["賛成者", supporters],
          ].map(([label, list]) =>
            (list as typeof proposers).length ? (
              <p key={label as string} className="text-sm">
                <span className="mr-2 text-muted">{label as string}</span>
                {(list as typeof proposers).map((s, i) => (
                  <span key={s.member.id}>
                    {i > 0 && "、"}
                    <Link href={`/members/${s.member.id}`} className="text-primary underline">
                      {s.member.display_name}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null,
          )}
        </section>
      )}

      {bill.source_url && (
        <p className="text-sm">
          <a href={bill.source_url} className="text-primary underline" target="_blank" rel="noreferrer">
            議案書（PDF・相模原市議会）を見る
          </a>
        </p>
      )}
      <p className="text-xs text-muted">この要約は AI が議案書をもとに作成しました。正確な内容は議案書をご確認ください。</p>
    </article>
  );
}
