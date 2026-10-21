// 議案の要約（AI への指示とスキーマ）と保存処理。PDF からの取り込みと会議録からの取り込みで共通に使う。
import { z } from "zod";
import { FIELDS } from "../../src/lib/constants";
import { MODEL } from "./claude";
import { db, ensureMember, must } from "./db";
import { normalizeName } from "./util";

export const BillsSummary = z.object({
  bills: z.array(
    z.object({
      kind: z.enum(["市長提出", "議員提出", "委員会提出"]).describe("「議案第N号」は市長提出、「議提議案第N号」は議員提出、「委員会提出議案第N号」は委員会提出"),
      number: z.number().int(),
      title: z.string().describe("議案の正式な件名"),
      category: z.enum(["条例", "予算", "決算", "人事", "契約・財産", "意見書・決議", "その他"]),
      summary: z.string().describe("何を決める議案か、中学生にもわかる言葉で80字程度"),
      background: z.string().describe("なぜこの議案が必要なのか（100字程度）。資料にない場合は空文字"),
      key_points: z.array(z.string()).describe("主な変更点・ポイント（1〜4個、各40字程度）"),
      impact: z.string().describe("市民の暮らしにどう関係するか（80字程度）"),
      fields: z.array(z.enum(FIELDS)).describe("関係する分野（1〜2個）"),
      sponsors: z
        .array(z.object({ name: z.string(), role: z.enum(["提出者", "賛成者"]) }))
        .describe("議員提出議案の提出者・賛成者の氏名（市長提出なら空配列）"),
    }),
  ),
});

export const BILL_SYSTEM = `あなたは相模原市議会の議案を、市民向けにわかりやすく解説する編集者です。
議案書の PDF から抜き出した文字を読み、含まれている議案を1件ずつまとめてください。
- 専門用語や役所言葉は、中学生でもわかる言葉に言い換える。
- 事実は資料に書かれていることだけを使う。推測で補わない。
- 賛成・反対の立場をとらず、中立に書く。
- 金額や日付など大切な数字は残す。
- 分野(fields)は次の中から選ぶ: ${FIELDS.join("、")}
- PDF の文字は抽出の都合で余分な空白が入っていることがある。`;

export async function saveBills(
  bills: z.infer<typeof BillsSummary>["bills"],
  ctx: { sessionId: number; year: number; url: string; hash: string; index: Map<string, number> },
) {
  for (const b of bills) {
    const row = {
      session_id: ctx.sessionId,
      bill_kind: b.kind,
      number: b.number,
      year: ctx.year,
      title: b.title.replace(/\s+/g, ""),
      category: b.category,
      summary: b.summary,
      background: b.background || null,
      key_points: b.key_points,
      impact: b.impact,
      fields: b.fields,
      source_url: ctx.url,
      source_text_hash: ctx.hash,
      ai_model: MODEL,
      updated_at: new Date().toISOString(),
    };
    const saved = must(
      await db.from("bills").upsert(row, { onConflict: "year,bill_kind,number" }).select("id").single(),
      "upsert bill",
    );
    if (b.sponsors.length) {
      must(await db.from("bill_sponsors").delete().eq("bill_id", saved.id), "clear sponsors");
      const sponsors = new Map<string, { bill_id: number; member_id: number; role: string }>();
      for (const s of b.sponsors) {
        const member_id = await ensureMember(ctx.index, normalizeName(s.name));
        sponsors.set(`${member_id}-${s.role}`, { bill_id: saved.id, member_id, role: s.role });
      }
      must(await db.from("bill_sponsors").upsert([...sponsors.values()]), "insert sponsors");
    }
  }
}
