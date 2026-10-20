// 評価基準を変えたときに、取り込み済みの質問の総合点を AI を使わずに計算し直す。
// src/lib/constants.ts の SCORE_CRITERIA にない基準の点数は消し、残りの平均を総合点にする。
//   npm run recompute:scores
import "dotenv/config";
import { SCORE_CRITERIA } from "../src/lib/constants";
import { db, must } from "./lib/db";

async function main() {
  const keys = SCORE_CRITERIA.map((c) => c.key as string);
  const rows = must(await db.from("general_questions").select("id, scores, score_total"), "select questions");
  let changed = 0;
  for (const r of rows) {
    const scores = Object.fromEntries(Object.entries((r.scores ?? {}) as Record<string, number>).filter(([k]) => keys.includes(k)));
    const vals = Object.values(scores);
    const total = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    if (total === r.score_total && Object.keys(scores).length === Object.keys(r.scores ?? {}).length) continue;
    must(await db.from("general_questions").update({ scores, score_total: total }).eq("id", r.id), `update ${r.id}`);
    changed++;
  }
  console.log(`${rows.length} 件中 ${changed} 件の総合点を計算し直しました（基準: ${SCORE_CRITERIA.map((c) => c.label).join("・")}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
