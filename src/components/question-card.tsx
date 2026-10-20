import Link from "next/link";
import type { GeneralQuestion } from "@/lib/types";
import { Badge, FieldTag, ScorePill, formatDate } from "./ui";

export function QuestionCard({ q, showMember = true }: { q: GeneralQuestion; showMember?: boolean }) {
  return (
    <Link
      href={`/questions/${q.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition hover:border-primary"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {q.question_type === "代表質問" && <Badge tone="primary">代表質問</Badge>}
        <span>{formatDate(q.meeting_date)}</span>
        {showMember && q.member && (
          <span className="font-medium text-foreground">
            {q.member.display_name} 議員{q.member.faction && <span className="font-normal text-muted">（{q.member.faction}）</span>}
          </span>
        )}
        <span className="ml-auto">
          <ScorePill score={q.score_total} />
        </span>
      </div>
      <h3 className="mt-1 font-bold">{q.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{q.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {q.fields.map((f) => (
          <FieldTag key={f} field={f} />
        ))}
      </div>
    </Link>
  );
}
