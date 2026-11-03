// テーマ深掘りページを作る。data/themes.json の設定（探す言葉・答えたい疑問・立場の分け方）をもとに、
// 会議録の一般質問・代表質問から関係する発言を集め、議案と合わせて AI がまとめる。
//   npm run theme -- --slug=skate             （作る・作り直す）
//   npm run theme -- --slug=skate --dry-run   （AI を呼ばずに、集まった材料の量だけ表示）
//   npm run theme -- --all                    （すべてのテーマ。材料が変わっていなければ AI を呼ばない）
//   --force で作り直す。--preview で保存せずに表示。
// 要約は Claude Code（サブスク）で行う。
import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { generateStructured, MODEL, UsageLimitError } from "./lib/claude";
import { db, must, mustMaybe } from "./lib/db";
import { getMinutes } from "./lib/kaigiroku";
import { segmentQuestions } from "./lib/segment";
import { normalizeName, parseArgs, sha256 } from "./lib/util";

const ThemeConfig = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).min(1),
  questions: z.array(z.string()),
  stances: z.array(z.string()).min(2),
  // AI への注意書き（例: 同じ言葉で別の話題を拾いやすいときに、除くものを書く）
  note: z.string().optional(),
});
type ThemeConfig = z.infer<typeof ThemeConfig>;

/** 1件の質問から、キーワードを含む段落だけを話し手つきで抜き出す */
function excerpt(text: string, kw: RegExp): string {
  const speeches = text.split(/\n\n(?=【)/);
  const out: string[] = [];
  for (const sp of speeches) {
    const label = sp.match(/^【[^】]+】/)?.[0] ?? "";
    const paras = sp.replace(/^【[^】]+】/, "").split("\n").filter((p) => kw.test(p));
    if (paras.length) out.push(`${label}${paras.join("\n")}`);
  }
  return out.join("\n");
}

function themeSchema(cfg: ThemeConfig) {
  const Ref = z.array(z.string()).describe("根拠にした材料の番号（例: Q12, B34）");
  return z.object({
    headline: z.string().describe("このテーマの今を一言で表す見出し（40字以内）。報道や見込みなど不確かなことは言い切らない"),
    overview: z.string().describe("テーマの全体像。何が問題で、これまでどんな議論があったか（300〜500字）"),
    current_status: z.string().describe("いまどうなっているか。最新の市の方針・予定（150〜300字）"),
    current_status_refs: Ref,
    faq: z
      .array(z.object({ question: z.string(), answer: z.string().describe("100〜250字"), refs: Ref }))
      .describe("設定された疑問すべてに、資料からわかる範囲で答える。資料でわからないことは「議会の資料からはわかりません」と書く"),
    timeline: z
      .array(z.object({ date: z.string().describe("例: 2024年9月"), event: z.string().describe("60字程度"), refs: Ref }))
      .describe("議会で示された方針・答弁・議決などを古い順に5〜12項目"),
    members: z
      .array(
        z.object({
          name: z.string().describe("議員の氏名（材料の表記どおり）"),
          stance: z.enum(cfg.stances as [string, ...string[]]),
          summary: z.string().describe("このテーマで何を主張・質問したか（60〜120字）"),
          refs: Ref,
        }),
      )
      .describe("このテーマを取り上げた議員全員を1人1項目で。発言内容から立場を判断し、はっきりしなければ最後の選択肢にする。時期によって立場が変わった議員は最新の立場を選び、summary に変化を書く"),
    open_issues: z.array(z.string()).describe("まだ決まっていないこと・今後の注目点（2〜5個）"),
  });
}

const SYSTEM = `あなたは相模原市議会の議論を市民向けに解説する編集者です。
1つのテーマについて、会議録の一般質問・代表質問の関係部分と議案の要約を読み、テーマを深く理解できるページを作ります。
- 中学生にもわかる言葉で書く。
- 事実は資料に書かれていることだけを使う。推測で補わない。日付や数字は資料どおりに書く。
- 書いた内容の根拠となる材料の番号（Q○○ や B○○）を refs に必ず入れる。
- 議員の立場は、その議員自身の発言から判断する。特定の議員・会派をひいきしたり、けなしたりしない。
- 市の答弁と議員の主張を区別して書く。新しい資料ほど現在の状況を表すので、古い答弁と新しい答弁が違えば新しい方を「現在」とする。`;

async function build(cfg: ThemeConfig, opts: { dryRun: boolean; preview: boolean; force: boolean }) {
  const kw = new RegExp(cfg.keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
  console.log(`${cfg.title}（探す言葉: ${cfg.keywords.join("・")}）`);

  // 取り込み済みの質問を会議録から読み直し、キーワードを含む部分を集める
  const qs = must(
    await db
      .from("general_questions")
      .select("id, question_type, meeting_date, kaigiroku_council_id, kaigiroku_schedule_id, first_minute_id, member:members(name, display_name)")
      .order("meeting_date"),
    "select questions",
  );
  const byDay = new Map<string, typeof qs>();
  for (const q of qs) {
    const key = `${q.kaigiroku_council_id}:${q.kaigiroku_schedule_id}`;
    byDay.set(key, [...(byDay.get(key) ?? []), q]);
  }
  const materials: { ref: string; id: number; header: string; body: string }[] = [];
  for (const [key, list] of byDay) {
    const [councilId, scheduleId] = key.split(":").map(Number);
    const segs = segmentQuestions(await getMinutes(councilId, scheduleId));
    for (const q of list) {
      const seg = segs.find((s) => s.firstMinuteId === q.first_minute_id);
      if (!seg || !kw.test(seg.text)) continue;
      const m = q.member as unknown as { display_name: string } | null;
      materials.push({
        ref: `Q${q.id}`,
        id: q.id,
        header: `${q.meeting_date} ${q.question_type} ${m?.display_name.replace(/\s+/g, "") ?? ""}議員`,
        body: excerpt(seg.text, kw),
      });
    }
  }

  const bills = must(
    await db.from("bills").select("id, bill_kind, number, year, title, summary, background, key_points, result, decided_on"),
    "select bills",
  ).filter((b) => kw.test(`${b.title}${b.summary ?? ""}${b.background ?? ""}${JSON.stringify(b.key_points)}`));

  const text = [
    ...materials.map((m) => `===== [${m.ref}] ${m.header} =====\n${m.body}`),
    ...bills.map(
      (b) =>
        `===== [B${b.id}] ${b.year}年 ${b.bill_kind === "市長提出" ? "議案" : "議提議案"}第${b.number}号 ${b.title}（${b.result ?? "結果未登録"}${b.decided_on ? ` ${b.decided_on}` : ""}） =====\n${b.summary ?? ""} ${b.background ?? ""} ${(b.key_points as string[]).join(" ")}`,
    ),
  ].join("\n\n");
  console.log(`  材料: 質問 ${materials.length} 件・議案 ${bills.length} 件・${text.length.toLocaleString()} 文字`);
  if (opts.dryRun) return;

  const hash = sha256(JSON.stringify(cfg) + text);
  if (!opts.preview && !opts.force) {
    const existing = mustMaybe(await db.from("themes").select("source_hash").eq("slug", cfg.slug).maybeSingle(), "select theme");
    if (existing?.source_hash === hash) return console.log("  - 最新です");
  }

  const r = await generateStructured({
    system: SYSTEM,
    prompt:
      `テーマ「${cfg.title}」（${cfg.description ?? ""}）について、次の疑問に答えるページを作ってください。\n` +
      (cfg.note ? `注意: ${cfg.note}\n` : "") +
      cfg.questions.map((q) => `- ${q}`).join("\n") +
      `\n\n議員の立場は次から選んでください: ${cfg.stances.join(" / ")}\n\n` +
      `以下が材料です（Q は一般質問・代表質問の会議録の関係部分、B は議案の要約）。\n\n${text}`,
    schema: themeSchema(cfg),
  });
  if (opts.preview) return console.log(JSON.stringify(r, null, 2));

  const content = { ...r, timeline: sortTimeline(r.timeline), members: await linkMembers(r.members) };
  must(
    await db.from("themes").upsert(
      {
        slug: cfg.slug,
        title: cfg.title,
        description: cfg.description ?? null,
        content,
        question_ids: materials.map((m) => m.id),
        bill_ids: bills.map((b) => b.id),
        source_hash: hash,
        ai_model: MODEL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    ),
    "upsert theme",
  );
  console.log(`  ✓ 「${r.headline}」（議員 ${r.members.length} 人・経緯 ${r.timeline.length} 項目）`);
}

/**
 * AI が書いた議員名をサイトの議員に結びつける。名前が一致しなければ（書き間違いなど）、
 * 根拠に挙げた質問（Q○○）の議員を使う。表示名は名簿の表記にそろえる。
 */
async function linkMembers<T extends { name: string; refs: string[] }>(list: T[]) {
  const members = must(await db.from("members").select("id, name, display_name"), "select members");
  const qids = list.flatMap((m) => m.refs.filter((r) => r.startsWith("Q")).map((r) => Number(r.slice(1))));
  const qs = must(await db.from("general_questions").select("id, member_id").in("id", qids.length ? qids : [0]), "select refs");
  const linked = list.map((m) => {
    let member = members.find((x) => x.name === normalizeName(m.name));
    if (!member) {
      const fromRefs = m.refs.map((r) => qs.find((q) => `Q${q.id}` === r)?.member_id).find(Boolean);
      member = members.find((x) => x.id === fromRefs);
    }
    return { ...m, name: member ? member.display_name.replace(/\s+/g, "") : m.name, member_id: member?.id ?? null };
  });
  // 同じ議員が2回出てきたら1つにまとめる（立場は最初の項目、根拠はすべて残す）
  const merged: typeof linked = [];
  for (const m of linked) {
    const same = merged.find((x) => (x.member_id ?? x.name) === (m.member_id ?? m.name));
    if (same) same.refs = [...new Set([...same.refs, ...m.refs])];
    else merged.push({ ...m });
  }
  return merged;
}

async function main() {
  const args = parseArgs();
  const all = z.array(ThemeConfig).parse(JSON.parse(readFileSync("data/themes.json", "utf8")));
  const targets = args.all ? all : all.filter((t) => t.slug === args.slug);
  if (targets.length === 0) throw new Error("--slug=テーマのslug（data/themes.json）か --all を指定してください");
  const opts = { dryRun: Boolean(args["dry-run"]), preview: Boolean(args.preview), force: Boolean(args.force) };
  // --relink: AI を呼ばずに、保存済みのテーマの議員の結びつけと経緯の並び順だけやり直す
  if (args.relink) {
    for (const t of targets) {
      const row = must(await db.from("themes").select("content").eq("slug", t.slug).single(), "select theme");
      const c = row.content as { members: { name: string; refs: string[] }[] };
      const fixed = { ...c, timeline: sortTimeline((c as { timeline?: { date: string }[] }).timeline ?? []), members: await linkMembers(c.members) };
      must(await db.from("themes").update({ content: fixed }).eq("slug", t.slug), "relink");
      console.log(`  ✓ ${t.title}: 議員の結びつけをやり直しました`);
    }
    return;
  }
  for (const t of targets) {
    try {
      await build(t, opts);
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

/** 経緯を日付順に並べる（「2023年1月〜8月」なら2023年1月として扱う。年がないものは元の順のまま最後に） */
function sortTimeline<T extends { date: string }>(list: T[]): T[] {
  const key = (d: string) => {
    const m = d.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).match(/(\d{4})年(?:度)?(?:\s*(\d{1,2})月)?/);
    return m ? Number(m[1]) * 100 + (m[2] ? Number(m[2]) : 0) : Number.MAX_SAFE_INTEGER;
  };
  return list.map((t, i) => ({ t, i })).sort((a, b) => key(a.t.date) - key(b.t.date) || a.i - b.i).map((x) => x.t);
}
