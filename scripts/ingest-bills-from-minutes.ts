// 議案書の PDF が画像だけで読めないときに、本会議の会議録にある「提案理由の説明」から議案を要約して取り込む。
// 局長などが「議案第N号…議案集のNページを御覧ください。本議案は…」と1件ずつ説明している部分を使う。
//   npm run ingest:bills-minutes -- --council=1019 --numbers=14-37            （令和8年3月定例会議の議案第14〜37号）
//   npm run ingest:bills-minutes -- --council=1019 --numbers=14-37 --dry-run  （AI を呼ばずに、使う説明文を確認）
//   --preview で DB に保存せず、最初のまとまりだけ要約して表示。--force で取り込み済みの議案も作り直す。
// 要約は Claude Code（サブスク）で行う。
import "dotenv/config";
import { BILL_SYSTEM, BillsSummary, saveBills } from "./lib/bills";
import { generateStructured, lastUsage, UsageLimitError } from "./lib/claude";
import { db, loadMemberIndex, must, upsertSession } from "./lib/db";
import { getMinutes, listCouncils, listSchedules, minuteUrl } from "./lib/kaigiroku";
import { normalizeSessionName, parseArgs, sha256, toHankaku, yearFromLabel } from "./lib/util";

const BILLS_PER_CALL = 12;

/** "14-37,52" → [14, 15, …, 37, 52] */
function parseNumbers(spec: string): number[] {
  const out: number[] = [];
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-").map(Number);
    for (let n = a; n <= (b || a); n++) out.push(n);
  }
  return out;
}

/** 文中に出てくる「議案第N号」の番号（市長提出のみ） */
function billNumbersIn(text: string): Set<number> {
  const t = toHankaku(text);
  return new Set([...t.matchAll(/(?<!議提)議案第(\d+)号/g)].map((m) => Number(m[1])));
}

type Speech = { scheduleId: number; minuteId: number; speaker: string; body: string; numbers: Set<number> };

async function main() {
  const args = parseArgs();
  if (!args.council || !args.numbers) throw new Error("--council=会議番号 と --numbers=14-37 を指定してください");
  const councilId = Number(args.council);
  const targets = parseNumbers(String(args.numbers));
  const dryRun = Boolean(args["dry-run"]);
  const preview = Boolean(args.preview);

  const council = (await listCouncils()).find((c) => c.council_id === councilId);
  if (!council) throw new Error(`会議番号 ${councilId} が見つかりません`);
  const year = yearFromLabel(council.name) ?? council.view_year;
  const sessionName = normalizeSessionName(council.name);
  if (!sessionName) throw new Error(`会議名を読み取れません: ${council.name}`);

  // 日程の一覧から件名を、提案理由の説明から説明文を集める
  const titles = new Map<number, string>();
  const speeches: Speech[] = [];
  for (const s of await listSchedules(councilId)) {
    const minutes = await getMinutes(councilId, s.schedule_id);
    let explaining = false;
    for (const m of minutes) {
      if (m.minute_type_code === 3) {
        const t = toHankaku(m.body).match(/(?<!議提)議案第(\d+)号\s*(.+)$/);
        if (t && !titles.has(Number(t[1]))) titles.set(Number(t[1]), t[2].trim());
      }
      if (m.minute_type_code === 4) {
        if (m.body.includes("提案理由の説明を求めます")) explaining = true;
        if (/提案理由の説明は終わりました|これより質疑に入ります/.test(m.body)) explaining = false;
      }
      if (explaining && m.minute_type_code === 6) {
        speeches.push({ scheduleId: s.schedule_id, minuteId: m.minute_id, speaker: m.title, body: m.body, numbers: billNumbersIn(m.body) });
      }
    }
  }

  // 取り込み済みの議案は飛ばす
  let todo = targets;
  if (!dryRun && !preview && !args.force) {
    const done = must(
      await db.from("bills").select("number").eq("year", year).eq("bill_kind", "市長提出").in("number", targets),
      "select bills",
    );
    const doneSet = new Set(done.map((b) => b.number));
    todo = targets.filter((n) => !doneSet.has(n));
  }
  const missing = todo.filter((n) => !speeches.some((sp) => sp.numbers.has(n)));
  console.log(`${council.name.replace(/\s+/g, " ")}: 対象 ${todo.length} 件、提案理由の説明 ${speeches.length} 件`);
  if (missing.length) console.warn(`  ! 説明が見つからない議案: ${missing.map((n) => `第${n}号`).join("、")}`);

  const sessionId = dryRun || preview ? 0 : await upsertSession({ year, name: sessionName, label: `令和${year - 2018}年 ${sessionName}` });
  const index = dryRun || preview ? new Map<string, number>() : await loadMemberIndex();

  for (let i = 0; i < todo.length; i += BILLS_PER_CALL) {
    const batch = todo.slice(i, i + BILLS_PER_CALL).filter((n) => !missing.includes(n));
    if (batch.length === 0) continue;
    const used = speeches.filter((sp) => batch.some((n) => sp.numbers.has(n)));
    const text = used.map((sp) => `===== ${sp.speaker}の説明 =====\n${sp.body}`).join("\n\n");
    const list = batch.map((n) => `議案第${n}号 ${titles.get(n) ?? ""}`).join("\n");
    console.log(`第${batch[0]}〜${batch[batch.length - 1]}号: 説明 ${used.length} 件・${text.length.toLocaleString()} 文字`);
    if (dryRun) continue;

    try {
      const r = await generateStructured({
        system: BILL_SYSTEM,
        prompt:
          `相模原市議会 ${year}年 ${sessionName} の本会議で、市の局長などが議案の提案理由を説明した会議録です。` +
          `議案書の代わりにこの説明をもとに、次の議案だけを1件ずつまとめてください（ほかの議案は含めない）。\n${list}\n\n${text}`,
        schema: BillsSummary,
      });
      const bills = r.bills.filter((b) => b.kind === "市長提出" && batch.includes(b.number));
      if (preview) {
        console.log(JSON.stringify(bills, null, 2), lastUsage);
        return;
      }
      await saveBills(bills, {
        sessionId,
        year,
        url: minuteUrl(councilId, used[0].scheduleId, used[0].minuteId),
        hash: sha256(text),
        index,
      });
      console.log(`  ✓ ${bills.length} 件を保存`);
    } catch (e) {
      if (e instanceof UsageLimitError) throw e;
      console.error(`  ✗ 第${batch[0]}〜${batch[batch.length - 1]}号: ${(e as Error).message}`);
    }
  }
  console.log("完了（審議結果は npm run ingest:bills -- --only=results で反映できます）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
