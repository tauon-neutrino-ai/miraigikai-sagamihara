import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { getLegislations } from "@/lib/data";

export const metadata: Metadata = { title: "議員立法" };

export default async function LegislationPage() {
  const list = await getLegislations();
  return (
    <div>
      <PageTitle
        title="議員立法（議員提案条例）"
        lead="市長ではなく議員が提案して成立した条例です。相模原市議会の議員立法は、会派や委員会による共同提案がほとんどです。このサイトでは、条例づくりで中心的な役割を果たした議員だけを「議員立法」の実績として数えています。"
      />
      {list.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-4">
          {list.map((l) => (
            <li key={l.id} id={l.slug} className="scroll-mt-4">
              <Card>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">{l.year}年</span>
                  <Badge>{l.proposer_type}提案</Badge>
                  {l.proposer_group && <span className="text-muted">{l.proposer_group}</span>}
                </div>
                <h2 className="mt-1 text-lg font-bold">{l.title}</h2>
                {l.summary && <p className="mt-2">{l.summary}</p>}
                {l.background && <p className="mt-2 text-sm text-muted">{l.background}</p>}

                <div className="mt-3 text-sm">
                  <span className="font-bold">中心的な役割を果たした議員：</span>
                  {l.leaders.length === 0 ? (
                    <span className="text-muted">特定の議員ではなく{l.proposer_group ?? "委員会"}として提案</span>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {l.leaders.map((x) => (
                        <li key={x.member.id}>
                          <Link href={`/members/${x.member.id}`} className="font-medium text-primary underline">
                            {x.member.display_name}
                          </Link>
                          <span className="text-muted"> ― {x.role}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {l.co_proposers && <p className="mt-2 text-xs text-muted">その他の提案者（実績には数えていません）：{l.co_proposers}</p>}
                {l.source_url && (
                  <a href={l.source_url} className="mt-2 inline-block text-sm text-primary underline" target="_blank" rel="noreferrer">
                    出典を見る
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
