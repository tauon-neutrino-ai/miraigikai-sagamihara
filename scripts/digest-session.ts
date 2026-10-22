// 会議ごとのまとめを作る。取り込み済みの議案・質問の要約を AI に読ませ、
// 「重要な議案」と「複数の議員が取り上げた論点」をまとめて session_digests に保存する。
//   npm run digest -- --latest                       （議案・質問が入っている最新の会議）
//   npm run digest -- --year=2026 --name=6月定例会議   （会議を指定）
//   npm run digest -- --all                          （まとめのない会議をすべて）
//   --only=議案 / --only=質問 で片方だけ。--force で作り直す。--preview で保存せずに表示。
// 要約は Claude Code（サブスク）で行う。元の要約が変わっていなければ AI を呼ばない。
import "dotenv/config";
import { z } from "zod";
import { FIELDS } from "../src/lib/constants";
import { sortSessionsDesc } from "../src/lib/sessions";
import { generateStructured, MODEL, UsageLimitError } from "./lib/claude";
import { db, must, mustMaybe } from "./lib/db";
import { parseArgs, sha256 } from "./lib/util";

const NEUTRAL = `- 中学生にもわかる言葉で書く。
- 事実は与えられた要約に書かれていることだけを使う。推測で補わない。
- 特定の政党・会派・議員をひいきしたり、けなしたりしない。賛否の立場をとらない。`;

const BillDigest = z.object({
  headline: z.string().describe("この会議の議案を一言で表す見出し（30字以内）"),
  overview: z.string().describe("この会議でどんな議案が話し合われ、どうなったかの全体像（150〜250字）"),
  items: z
    .array(
      z.object({
        title: z.string().describe("重要な議案（またはひとまとまりの議案群）の見出し（25字以内）"),
        description: z.string().describe("何が決まり、市民の暮らしにどう関係するか、なぜ重要か（100〜150字）"),
        bill_ids: z.array(z.number().int()).describe("関係する議案の id（入力の [id=N] の N）"),
        contested: z.boolean().describe("賛成多数・否決など、議会の意見が分かれた議案を含むか"),
      }),
    )
    .describe("市民にとって特に重要な議案を3〜6項目。意見が分かれた議案は必ず含める"),
});

const QuestionDigest = z.object({
  headline: z.string().describe("この会議の質問で目立った論点を一言で表す見出し（30字以内）"),
  overview: z.string().describe("どんなテーマに質問が集まり、どんな議論が盛り上がったかの全体像（150〜250字）"),
  items: z
    .array(
      z.object({
        theme: z.string().describe("論点の見出し（20字以内）"),
        field: z.enum(FIELDS),
        description: z.string().describe("議員たちが何を問題にし、どんな提案をしたか（100〜150字）"),
        response: z.string().describe("市の答えの傾向（60〜100字）"),
        question_ids: z.array(z.number().int()).describe("この論点を取り上げた質問の id（入力の [id=N] の N）"),
      }),
    )
    .describe("複数の議員が取り上げた論点を、取り上げた議員が多い順に4〜8項目。1人だけの論点は特に重要な場合のみ"),
});

type Session = { id: number; year: number; name: string; label: string };

async function digestBills(s: Session, opts: { force: boolean; preview: boolean }) {
  const bills = must(
    await db
      .from("bills")
      .select("id, bill_kind, number, title, category, summary, impact, result, fields")
      .eq("session_id", s.id)
      .order("number"),
    "select bills",
  );
  if (bills.length === 0) return console.log(`  - 議案なし`);
  const text = bills
    .map(
      (b) =>
        `[id=${b.id}] ${b.bill_kind === "市長提出" ? "議案" : b.bill_kind === "議員提出" ? "議提議案" : "委員会提出議案"}第${b.number}号 ${b.title}` +
        `（${b.category ?? ""}・${b.result ?? "結果未登録"}）\n  ${b.summary ?? ""} ${b.impact ?? ""}`,
    )
    .join("\n");
  await save(s, "議案", text, opts, () =>
    generateStructured({
      system: `あなたは相模原市議会の議案を市民向けに解説する編集者です。1回の会議に出された議案の要約一覧を読み、会議全体のまとめを作ってください。\n${NEUTRAL}\n- 予算・決算・市民負担（使用料・税・料金）・大きな契約・新しい制度など、市民への影響が大きい議案を優先する。人事や形式的な議案は、特に重要でなければ省く。`,
      prompt: `相模原市議会 ${s.label} の議案（${bills.length}件）です。\n\n${text}`,
      schema: BillDigest,
    }),
    (items) => items.flatMap((x) => x.bill_ids).every((id) => bills.some((b) => b.id === id)),
  );
}

async function digestQuestions(s: Session, opts: { force: boolean; preview: boolean }) {
  const qs = must(
    await db
      .from("general_questions")
      .select("id, question_type, title, summary, topics, member:members(display_name, faction)")
      .eq("session_id", s.id)
      .order("meeting_date"),
    "select questions",
  );
  if (qs.length === 0) return console.log(`  - 質問なし`);
  const text = qs
    .map((q) => {
      const m = q.member as unknown as { display_name: string; faction: string | null } | null;
      const topics = (q.topics as { title: string; question: string; answer: string }[])
        .map((t) => `    ・${t.title}: ${t.question} → 市: ${t.answer}`)
        .join("\n");
      return `[id=${q.id}] ${q.question_type} ${m?.display_name ?? ""}（${m?.faction ?? ""}）「${q.title}」\n${topics}`;
    })
    .join("\n");
  await save(s, "質問", text, opts, () =>
    generateStructured({
      system: `あなたは相模原市議会の質問を市民向けに解説する編集者です。1回の会議で行われた代表質問・一般質問の要約一覧を読み、複数の議員が取り上げた論点ごとにまとめてください。\n${NEUTRAL}\n- 同じテーマ（例: ごみ減量、熊対策、施設使用料の見直し）を別々の議員が取り上げていれば1つの論点にまとめる。`,
      prompt: `相模原市議会 ${s.label} の代表質問・一般質問（${qs.length}件）です。\n\n${text}`,
      schema: QuestionDigest,
    }),
    (items) => items.flatMap((x) => x.question_ids).every((id) => qs.some((q) => q.id === id)),
  );
}

async function save<T extends { headline: string; overview: string; items: unknown[] }>(
  s: Session,
  kind: "議案" | "質問",
  sourceText: string,
  opts: { force: boolean; preview: boolean },
  run: () => Promise<T>,
  idsValid: (items: T["items"]) => boolean,
) {
  const hash = sha256(sourceText);
  if (!opts.preview) {
    const existing = mustMaybe(
      await db.from("session_digests").select("source_hash").eq("session_id", s.id).eq("kind", kind).maybeSingle(),
      "select digest",
    );
    if (existing?.source_hash === hash && !opts.force) return console.log(`  - ${kind}のまとめは最新です`);
  }

  const r = await run();
  if (!idsValid(r.items)) console.warn(`  ! ${kind}のまとめに存在しない id が含まれていました（リンクは表示されません）`);
  if (opts.preview) return console.log(JSON.stringify(r, null, 2));
  must(
    await db.from("session_digests").upsert(
      {
        session_id: s.id,
        kind,
        headline: r.headline,
        overview: r.overview,
        items: r.items,
        source_hash: hash,
        ai_model: MODEL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,kind" },
    ),
    "upsert digest",
  );
  console.log(`  ✓ ${kind}のまとめ「${r.headline}」（${r.items.length}項目）`);
}

async function main() {
  const args = parseArgs();
  const opts = { force: Boolean(args.force), preview: Boolean(args.preview) };
  const all = sortSessionsDesc(must(await db.from("sessions").select("id, year, name, label, start_date"), "sessions"));

  let targets: Session[];
  if (args.year && args.name) targets = all.filter((s) => s.year === Number(args.year) && s.name === args.name);
  else if (args.latest) targets = all.slice(0, 1);
  else if (args.all) targets = all;
  else throw new Error("--latest、--all、または --year=2026 --name=6月定例会議 を指定してください");
  if (targets.length === 0) throw new Error("該当する会議がありません");

  for (const s of targets) {
    console.log(s.label);
    try {
      if (args.only !== "質問") await digestBills(s, opts);
      if (args.only !== "議案") await digestQuestions(s, opts);
    } catch (e) {
      if (e instanceof UsageLimitError) throw e;
      console.error(`  ✗ ${(e as Error).message}`);
    }
  }
  console.log("完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
