import Link from "next/link";
import type { ReactNode } from "react";
import { FIELD_COLORS, type Field, scoreLabel } from "@/lib/constants";

export function PageTitle({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {lead && <p className="mt-2 text-sm text-muted">{lead}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface p-5 ${className}`}>{children}</div>;
}

export function FieldTag({ field }: { field: Field }) {
  const color = FIELD_COLORS[field] ?? "#999";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap"
      style={{ borderColor: `${color}66` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {field}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "primary" | "accent" }) {
  const cls =
    tone === "primary"
      ? "bg-primary text-white"
      : tone === "accent"
        ? "bg-primary-soft text-primary"
        : "bg-background text-muted border border-border";
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{children}</span>;
}

const TONE_CLASS = {
  great: "bg-great text-white",
  good: "bg-good text-white",
  fair: "bg-fair text-white",
  poor: "bg-poor text-white",
  none: "bg-border text-muted",
} as const;

export function ScorePill({ score, showLabel = true }: { score: number | null | undefined; showLabel?: boolean }) {
  const { label, tone } = scoreLabel(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${TONE_CLASS[tone]}`}>
      {score != null && <span>{Number(score).toFixed(1)}</span>}
      {showLabel && <span className="font-medium">{label}</span>}
    </span>
  );
}

export function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <Badge>審議中・結果未登録</Badge>;
  const negative = /否決|不同意|不認定|不承認/.test(result);
  const pending = /継続|撤回/.test(result);
  return <Badge tone={negative || pending ? "neutral" : "accent"}>{result}</Badge>;
}

export function EmptyState({ children }: { children?: ReactNode }) {
  return (
    <Card className="text-center text-sm text-muted">
      {children ?? "データを準備しています。取り込みが終わるとここに表示されます。"}
    </Card>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-4 inline-block text-sm text-muted hover:text-primary">
      ← {label}
    </Link>
  );
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return `${y}年${m}月${day}日`;
}


/** 議案番号の表示（議案第N号 / 議提議案第N号 / 委員会提出議案第N号） */
export function billLabel(b: { bill_kind: string; number: number }): string {
  if (b.bill_kind === "議員提出") return `議提議案第${b.number}号`;
  if (b.bill_kind === "委員会提出") return `委員会提出議案第${b.number}号`;
  return `議案第${b.number}号`;
}

/** 点数を表示するところに置く注意書き（評価の観点は「このサイトについて」に書いてある） */
export function ScoreNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted ${className}`}>
      今回の点数付けの観点は
      <Link href="/about#scoring" className="mx-0.5 text-primary underline">
        「このサイトについて」
      </Link>
      に書かれています。評価は人によって変わります。ぜひ質疑の内容をよく読んで、ご自身の価値基準で判断してください。
    </p>
  );
}
