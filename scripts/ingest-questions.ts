// 本会議の一般質問と代表質問を会議録から取り込み、Claude でわかりやすく要約・評価して保存する。
//   npm run ingest:questions -- --since=2023-05          （今の任期から）
//   npm run ingest:questions -- --latest                 （いちばん新しい定例会議だけ。手動で追記するとき）
//   npm run ingest:questions -- --council=1032           （特定の会議だけ）
//   npm run ingest:questions -- --since=2026-06 --dry-run （AI を呼ばずに区切り方だけ確認）
//   npm run ingest:questions -- --council=1032 --member=古内明 --type=代表質問 --preview （1人分だけ試す）
//   --force で要約済みのものも作り直す。--concurrency=2 で並列数を変える（既定は1）。
// 要約は Claude Code（サブスク）で行う。利用上限に達したら止まるので、時間をおいて同じコマンドを再実行すれば続きから進む。
import "dotenv/config";
import { z } from "zod";
import { FIELDS } from "../src/lib/constants";
import { generateStructured, lastUsage, MODEL, UsageLimitError } from "./lib/claude";
import { db, ensureMember, loadMemberIndex, must, mustMaybe, upsertSession } from "./lib/db";
import { type Minute, getMinutes, listCouncils, listSchedules, minuteUrl, scheduleDate } from "./lib/kaigiroku";
import { normalizeName, normalizeSessionName, parseArgs, sha256, toHankaku, yearFromLabel } from "./lib/util";

const QuestionSummary = z.object({
  title: z.string().describe("質問全体を表す見出し（30字以内）"),
  summary: z.string().describe("中学生にもわかる言葉で、何を問い、市がどう答えたかを200字程度で"),
  topics: z
    .array(
      z.object({
        title: z.string().describe("質問項目の見出し（20字以内）"),
        field: z.enum(FIELDS),
        question: z.string().describe("議員が求めたこと・問題提起（やさしい言葉で100字程度）"),
        answer: z.string().describe("市（市長・局長など）の答え（やさしい言葉で100字程度）"),
        outcome: z.enum(["前向きな答弁", "検討・研究する", "現状の説明のみ", "否定的な答弁"]),
      }),
    )
    .describe("通告の大項目ごと"),
  scores: z.object({
    specificity: z.number().int().describe("具体性・根拠 1〜5"),
    proposal: z.number().int().describe("建設的な意見 1〜5"),
    fiscal: z.number().int().describe("費用対効果の考え 1〜5"),
    outcome: z.number().int().describe("成果 1〜5"),
    relevance: z.number().int().describe("市民への関わり 1〜5"),
  }),
  evaluation_comment: z.string().describe("点数の理由を中立的に100〜150字で"),
  good_points: z.array(z.string()).describe("良かった点（1〜3個）"),
  improvement_points: z.array(z.string()).describe("改善できる点（0〜3個）"),
});

const SYSTEM = `あなたは相模原市議会の一般質問を、市民向けにわかりやすく解説する編集者です。
会議録の文字起こしを読み、次の方針でまとめてください。

- 専門用語や役所言葉は、中学生でもわかる言葉に言い換える。
- 事実は会議録に書かれていることだけを使う。推測で補わない。
- 特定の政党・会派・議員をひいきしたり、けなしたりしない。
- 評価は次の基準でそれぞれ1〜5点の整数をつける。
  - specificity（具体性・根拠）: 数字、現場の声、他都市の事例など根拠を示しているか
  - proposal（建設的な意見）: 批判や指摘だけで終わらず、代わりの案や次につながる具体的な提案を示しているか。
    現状や考えを聞くだけ、または批判・要望だけで終わる項目が多ければ1〜2点にする
  - fiscal（費用対効果の考え）: 費用対効果・財源・将来の財政負担を考えているか。相模原市は財政に余裕がないことを前提に厳しく見る。
    コストを抑えながら市民サービスを良くする方法や、企業誘致などで税収を増やす方法を示していれば高くする。
    質問全体を見て判断する。財源（どの事業を見直すか、どこからお金を出すか）を示さずに「無償化」「予算の増額」「補助の拡充」などを
    求める項目があれば点を下げ、その項目を improvement_points に必ず書く。ほかの項目で費用を十分に意識していれば、1つあるだけで大きくは下げない。
    費用や財源にほとんど触れずに、支出を伴う要望ばかりしている場合は1〜2点にする
  - outcome（成果）: 前向きな答弁や具体的な約束を引き出したか。「研究する」「検討する」止まりなら3点以下にする
  - relevance（市民への関わり）: 市民の暮らしや市の将来にとって大切なテーマか
- 点数の目安: 3点が「よくある平均的な一般質問」。5点はほかの議員の手本になるほど優れている場合だけにつける。
  すべての基準で4〜5点をつけるのは、ごく一部の特に優れた質問だけにする。
- どの政策の方向（施設を増やす・減らす、事業を進める・止めるなど）を主張しているかで点数を変えない。
  主張の中身ではなく、根拠・建設的な意見・費用対効果の考え・成果などで評価する。
- 再質問の多さでは評価しない（一般質問と代表質問では時間の使い方が違うため）。
- 点数の理由は、会議録のどの部分からそう判断したかがわかるように書く。
- 分野(field)は次の中から最も近いものを1つ選ぶ: ${FIELDS.join("、")}`;

export type QuestionType = "一般質問" | "代表質問";

type Segment = {
  memberName: string;
  type: QuestionType;
  firstMinuteId: number;
  text: string;
  memberChars: number;
};

/** 「１４番（三須城太郎議員）」→「三須城太郎」 */
function memberFromTitle(title: string): string | null {
  const m = toHankaku(title).match(/[（(](.+?)議員[）)]/);
  return m ? normalizeName(m[1]) : null;
}

/**
 * 会議録の中から一般質問・代表質問の部分を探し、質問した議員ごとに区切る。
 * - 一般質問: 「△日程N 一般質問」の日程の中
 * - 代表質問: 議案の質疑の中で、議長が「代表質問を行います」と言ってから
 *   「個人質疑を行います」「質疑を終結」と言うまで（3月・9月の定例会議）
 */
export function segmentQuestions(minutes: Minute[]): Segment[] {
  const segments: Segment[] = [];
  let mode: QuestionType | null = null;
  let cur: Segment | null = null;
  for (const m of minutes) {
    if (m.minute_type_code === 3) {
      mode = m.body.includes("一般質問") ? "一般質問" : null;
      cur = null;
      continue;
    }
    if (m.minute_type_code === 4) {
      if (m.body.includes("代表質問を行います")) {
        mode = "代表質問";
        cur = null;
      } else if (mode === "代表質問" && /個人質疑を行います|質疑を終結/.test(m.body)) {
        mode = null;
        cur = null;
      }
      continue;
    }
    if (!mode) continue;
    if (m.minute_type_code === 5) {
      const name = memberFromTitle(m.title);
      if (!name) continue;
      if (!cur || cur.memberName !== name) {
        cur = { memberName: name, type: mode, firstMinuteId: m.minute_id, text: "", memberChars: 0 };
        segments.push(cur);
      }
      cur.text += `【質問 ${name}議員】${m.body.replace(/^[◆○◎].*?　/, "")}\n\n`;
      cur.memberChars += m.body.length;
    } else if (m.minute_type_code === 6 && cur) {
      cur.text += `【答弁 ${normalizeName(m.title)}】${m.body.replace(/^[◆○◎].*?　/, "")}\n\n`;
    }
  }
  // 議事進行の発言など、ごく短いものは質問として扱わない
  return segments.filter((s) => s.memberChars >= 400);
}

let stopped = false;

/** AI がまれに「テスト」のような中身のない答えを返すので、そのときは頼み直す */
async function summarize(j: { seg: Segment; date: string }) {
  for (let attempt = 1; ; attempt++) {
    const r = await summarizeOnce(j);
    const looksEmpty = r.summary.length < 60 || /テスト/.test(r.title) || r.topics.length === 0;
    if (!looksEmpty) return r;
    if (attempt >= 3) throw new Error(`中身のない要約が続きました（題名「${r.title}」）`);
    console.warn(`  ! ${j.seg.memberName}: 中身のない要約が返ったので頼み直します`);
  }
}

function summarizeOnce(j: { seg: Segment; date: string }) {
  return generateStructured({
    system: SYSTEM,
    prompt: `次は相模原市議会 ${j.date} の本会議における ${j.seg.memberName} 議員の${j.seg.type}の会議録です。${j.seg.type === "代表質問" ? "代表質問は、会派を代表して市長の施政方針や議案について質問するものです。" : ""}\n\n${j.seg.text}`,
    schema: QuestionSummary,
  });
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length && !stopped) await fn(items[i++]);
    }),
  );
}

async function main() {
  const args = parseArgs();
  const since = String(args.since ?? "2023-05");
  // --preview: DB を使わず、最初の1件だけ要約して画面に表示する（お試し用）
  const preview = Boolean(args.preview);
  const dryRun = Boolean(args["dry-run"]) || preview;
  const force = Boolean(args.force);
  const concurrency = Number(args.concurrency ?? 1);

  let councils = (await listCouncils()).filter((c) => c.type_path === "本会議/定例会");
  if (args.latest) councils = councils.sort((a, b) => b.council_id - a.council_id).slice(0, 1);
  if (args.council) councils = councils.filter((c) => c.council_id === Number(args.council));

  const index = dryRun ? new Map<string, number>() : await loadMemberIndex();
  type Job = { seg: Segment; councilId: number; scheduleId: number; date: string; sessionId: number | null };
  const jobs: Job[] = [];

  for (const c of councils) {
    const year = yearFromLabel(c.name) ?? c.view_year;
    const name = normalizeSessionName(c.name);
    if (!name) continue;
    const schedules = await listSchedules(c.council_id);
    const firstDate = schedules[0] ? scheduleDate(year, schedules[0].name) : null;
    if (!firstDate || firstDate.slice(0, 7) < since) continue;
    const sessionId = dryRun
      ? null
      : await upsertSession({
          year,
          name,
          label: `令和${year - 2018}年 ${name}`,
          kaigiroku_council_id: c.council_id,
          start_date: firstDate,
        });
    for (const s of schedules) {
      const date = scheduleDate(year, s.name);
      if (!date) continue;
      const segs = segmentQuestions(await getMinutes(c.council_id, s.schedule_id));
      console.log(`${c.name.replace(/\s+/g, " ")} ${s.name}: ${segs.map((x) => (x.type === "代表質問" ? `${x.memberName}（代表）` : x.memberName)).join("、") || "なし"}`);
      for (const seg of segs) {
        // --member=古内明 / --type=代表質問 で対象を絞る（お試しや部分的な作り直し用）
        if (args.member && seg.memberName !== normalizeName(String(args.member))) continue;
        if (args.type && seg.type !== args.type) continue;
        jobs.push({ seg, councilId: c.council_id, scheduleId: s.schedule_id, date, sessionId });
      }
    }
  }
  const chars = jobs.map((j) => j.seg.text.length);
  console.log(
    `質問 ${jobs.length} 件（代表質問 ${jobs.filter((j) => j.seg.type === "代表質問").length} 件を含む。会議録 合計 ${chars.reduce((a, b) => a + b, 0).toLocaleString()} 文字・` +
      `1件平均 ${Math.round(chars.reduce((a, b) => a + b, 0) / Math.max(1, jobs.length)).toLocaleString()} 文字・` +
      `最大 ${Math.max(0, ...chars).toLocaleString()} 文字）`,
  );
  if (preview && jobs[0]) {
    console.log(JSON.stringify(await summarize(jobs[0]), null, 2));
    console.log(`この1件: 会議録 ${jobs[0].seg.text.length.toLocaleString()} 文字`, lastUsage);
  }
  if (dryRun) return;

  let done = 0;
  let failed = 0;
  await pool(jobs, concurrency, async (j) => {
    const hash = sha256(j.seg.text);
    const existing = mustMaybe(
      await db
        .from("general_questions")
        .select("id, source_text_hash")
        .eq("kaigiroku_council_id", j.councilId)
        .eq("kaigiroku_schedule_id", j.scheduleId)
        .eq("first_minute_id", j.seg.firstMinuteId)
        .maybeSingle(),
      "select question",
    );
    if (existing && existing.source_text_hash === hash && !force) return;

    try {
      const r = await summarize(j);
      const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));
      const scores = Object.fromEntries(Object.entries(r.scores).map(([k, v]) => [k, clamp(v)]));
      const vals = Object.values(scores);
      const row = {
        session_id: j.sessionId,
        member_id: await ensureMember(index, j.seg.memberName),
        meeting_date: j.date,
        kaigiroku_council_id: j.councilId,
        kaigiroku_schedule_id: j.scheduleId,
        first_minute_id: j.seg.firstMinuteId,
        question_type: j.seg.type,
        title: r.title,
        summary: r.summary,
        topics: r.topics,
        fields: [...new Set(r.topics.map((t) => t.field))],
        score_total: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10,
        scores,
        evaluation_comment: r.evaluation_comment,
        good_points: r.good_points,
        improvement_points: r.improvement_points,
        source_url: minuteUrl(j.councilId, j.scheduleId, j.seg.firstMinuteId),
        source_text_hash: hash,
        ai_model: MODEL,
        updated_at: new Date().toISOString(),
      };
      must(
        await db
          .from("general_questions")
          .upsert(row, { onConflict: "kaigiroku_council_id,kaigiroku_schedule_id,first_minute_id" }),
        "upsert question",
      );
      done++;
      console.log(`  ✓ ${j.date} ${j.seg.memberName}「${r.title}」 ${row.score_total}`);
    } catch (e) {
      if (e instanceof UsageLimitError) {
        if (!stopped) console.error(e.message);
        stopped = true;
        return;
      }
      failed++;
      console.error(`  ✗ ${j.date} ${j.seg.memberName}: ${(e as Error).message}`);
    }
  });
  console.log(`完了: 新規・更新 ${done} 件 / 失敗 ${failed} 件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
