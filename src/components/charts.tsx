import { FIELD_COLORS, type Field, SCORE_CRITERIA, type ScoreKey } from "@/lib/constants";

/** 分野ごとの質問数（横棒） */
export function FieldBars({ data }: { data: { field: Field; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.field} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="truncate">{d.field}</span>
          <span className="h-3 rounded-full bg-background">
            <span
              className="block h-3 rounded-full"
              style={{ width: `${(d.count / max) * 100}%`, background: FIELD_COLORS[d.field] ?? "#999" }}
            />
          </span>
          <span className="text-right tabular-nums text-muted">{d.count}件</span>
        </li>
      ))}
    </ul>
  );
}

/** 評価基準ごとの点数（5点満点の横棒） */
export function ScoreBreakdown({ scores }: { scores: Partial<Record<ScoreKey, number>> }) {
  return (
    <ul className="space-y-3">
      {SCORE_CRITERIA.map((c) => {
        const v = scores[c.key];
        return (
          <li key={c.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{c.label}</span>
              <span className="tabular-nums text-muted">{v != null ? `${Number(v).toFixed(1)} / 5` : "-"}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-background">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">{c.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
