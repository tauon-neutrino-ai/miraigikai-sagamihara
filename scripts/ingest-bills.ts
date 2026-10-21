// 議案（市長提出・議員提出）を市議会ホームページの PDF から取り込み、Claude で要約する。
// 審議結果の PDF から「可決」「認定」などの結果も反映する。
//   npm run ingest:bills -- --since=2023        （令和5年以降）
//   npm run ingest:bills -- --since=2026 --only=results  （審議結果だけ更新）
//   npm run ingest:bills -- --latest            （最新の会議だけ。手動で追記するとき）
//   --force で要約済みの PDF も作り直す。--dry-run で PDF の一覧だけ表示。
//   --preview で DB に保存せず、最初の PDF の最初のまとまりだけ要約して表示（お試し用）。
// 要約は Claude Code（サブスク）で行う。利用上限で止まったら、時間をおいて再実行すれば続きから進む。
import "dotenv/config";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { generateStructured, lastUsage, UsageLimitError } from "./lib/claude";
import { BILL_SYSTEM, BillsSummary, saveBills } from "./lib/bills";
import { db, loadMemberIndex, must, upsertSession } from "./lib/db";
import {
  SITE_BASE,
  fetchText,
  normalizeSessionName,
  parseArgs,
  politeFetch,
  sha256,
  stripTags,
  toHankaku,
  yearFromLabel,
} from "./lib/util";

const BILLS_CURRENT = `${SITE_BASE}/doc/2013120900011/`; // 提出議案・発言通告（最新の会議）
const BILLS_PAST_INDEX = `${SITE_BASE}/doc/2016012500047/`; // 過去の提出議案等（年別）
const RESULTS_CURRENT = `${SITE_BASE}/doc/2013120900035/`; // 審議結果等（今年）
const RESULTS_PAST_INDEX = `${SITE_BASE}/doc/2017033100025/`; // 過去の審議結果等（年別）

// サブスクの利用量を抑えるため、AI に渡す文字数を絞る。
/** 1件の議案の抜粋の上限（件名・本文の冒頭・理由・関係資料の概要） */
const PER_BILL_HEAD = 2_000;
const PER_BILL_REASON = 600;
const PER_BILL_MATERIAL = 2_500;
/** 議案ごとに切り分けられなかった PDF（予算書・決算書など）は先頭からこの文字数だけ渡す */
const FALLBACK_CHARS = 15_000;
/** 1回の AI 呼び出しでまとめる議案の数 */
const BILLS_PER_CALL = 12;

type PdfLink = { url: string; text: string };
type Section = { heading: string; links: PdfLink[] };

function absolute(href: string, pageUrl: string): string {
  return new URL(href, pageUrl).toString();
}

/** 記事本文を <h2> ごとに区切り、PDF リンクを集める */
function parseSections(html: string, pageUrl: string): Section[] {
  const start = html.indexOf('<div class="body">');
  const end = html.indexOf("関連情報", start);
  const body = html.slice(start, end > 0 ? end : undefined);
  const parts = body.split(/<h2[^>]*>/).slice(1);
  return parts.map((p) => {
    const heading = stripTags(p.slice(0, p.indexOf("</h2>"))).trim();
    const links = [...p.matchAll(/<a [^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
      url: absolute(m[1], pageUrl),
      text: stripTags(m[2]).replace(/\[PDF[^\]]*\]/, "").trim(),
    }));
    return { heading, links };
  });
}

/** 年別ページの一覧から、指定した年以降のページ URL を返す */
async function yearPages(indexUrl: string, since: number): Promise<string[]> {
  const html = await fetchText(indexUrl);
  const body = html.slice(html.indexOf('<div class="body">'));
  const out = new Set<string>();
  for (const m of body.matchAll(/<a [^>]*href="([^"]*\/doc\/\d+\/)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const url = absolute(m[1], indexUrl);
    // 画像だけのリンクもあるので、文字がなければページの見出しで年を判定する
    let label = stripTags(m[2]).trim();
    if (!label) label = (await fetchText(url)).match(/<h1>([^<]+)<\/h1>/)?.[1] ?? "";
    const y = yearFromLabel(label);
    // 年をまたぐ会議（1〜3月）があるため、1年前のページも見る
    if (y && y >= since - 1) out.add(url);
  }
  return [...out];
}

/** ファイル名「2026_gian_2.pdf」の年。会議の暦年として使う */
function fileYear(url: string): number | null {
  const m = url.match(/\/(\d{4})_[^/]*\.pdf$/);
  return m ? Number(m[1]) : null;
}

function mostCommon(nums: (number | null)[]): number | null {
  const counts = new Map<number, number>();
  for (const n of nums) if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

async function pdfText(url: string): Promise<{ text: string; hash: string }> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const hash = sha256(buf);
  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });
  // 全角数字を半角に、抽出時に入る余分な空白を除く（日本語の文書なので空白は不要）
  return { text: toHankaku(text).replace(/[ \t]+/g, ""), hash };
}

type BillChunk = { label: string; excerpt: string };

/**
 * 複数の議案が入った PDF を、議案ごとの抜粋に分ける。
 * 議案書は「議案第N号 → 件名 → 本文 → 理由 → 議案第N号関係資料（概要）」の順に並んでいる。
 */
export function splitBills(text: string): BillChunk[] {
  const starts = [...text.matchAll(/(議提)?議案第(\d+)号\n/g)].map((m) => ({
    index: m.index,
    label: m[0].trim(),
  }));
  // 同じ番号の2回目（関係資料など）はその議案の一部として扱う
  const firsts = starts.filter((s, i) => starts.findIndex((t) => t.label === s.label) === i);
  return firsts.map((s, i) => {
    const chunk = text.slice(s.index, firsts[i + 1]?.index ?? text.length);
    if (chunk.length <= PER_BILL_HEAD + PER_BILL_REASON + PER_BILL_MATERIAL) return { label: s.label, excerpt: chunk };
    const parts = [chunk.slice(0, PER_BILL_HEAD)];
    const material = chunk.indexOf(`${s.label}関係資料`);
    const body = material > 0 ? chunk.slice(0, material) : chunk;
    const reason = body.lastIndexOf("理由");
    if (reason > PER_BILL_HEAD) parts.push(body.slice(reason, reason + PER_BILL_REASON));
    if (material > 0) parts.push(chunk.slice(material, material + PER_BILL_MATERIAL));
    return { label: s.label, excerpt: parts.join("\n（中略）\n") };
  });
}

/** PDF の文字を、AI に渡すまとまり（議案いくつか分ずつ）に分ける */
function promptBatches(text: string): string[] {
  const chunks = splitBills(text);
  if (chunks.length === 0) return [text.slice(0, FALLBACK_CHARS)];
  const batches: string[] = [];
  for (let i = 0; i < chunks.length; i += BILLS_PER_CALL) {
    batches.push(
      chunks
        .slice(i, i + BILLS_PER_CALL)
        .map((c) => `===== ${c.label} =====\n${c.excerpt}`)
        .join("\n\n"),
    );
  }
  return batches;
}

const ResultsSchema = z.object({
  results: z.array(
    z.object({
      kind: z.enum(["市長提出", "議員提出", "委員会提出"]),
      number: z.number().int(),
      result: z.string().describe("本会議の議決結果。例: 可決（賛成多数）、原案可決（賛成総員）、認定（賛成多数）、同意、否決、継続審査"),
      decided_on: z.string().describe("議決日 YYYY-MM-DD。不明なら空文字"),
    }),
  ),
});

type Opts = { force: boolean; dryRun: boolean; preview: boolean; latest: boolean };

async function ingestBills(since: number, opts: Opts) {
  const pages = [BILLS_CURRENT, ...(opts.latest ? [] : await yearPages(BILLS_PAST_INDEX, since))];
  const noDb = opts.dryRun || opts.preview;
  const index = noDb ? new Map<string, number>() : await loadMemberIndex();
  const seenPdf = new Set<string>();

  for (const page of pages) {
    for (const sec of parseSections(await fetchText(page), page)) {
      // 最新ページは見出しが「提出議案等」なので、会議名はリンク文字から拾う
      const name =
        normalizeSessionName(sec.heading) ??
        sec.links.map((l) => normalizeSessionName(l.text)).find(Boolean) ??
        null;
      const billLinks = sec.links.filter((l) => /^(議案第|議提議案第|委員会提出議案第)/.test(toHankaku(l.text)) && !seenPdf.has(l.url));
      const year = mostCommon(billLinks.map((l) => fileYear(l.url))) ?? yearFromLabel(sec.heading);
      if (!name || !year || year < since || billLinks.length === 0) continue;
      billLinks.forEach((l) => seenPdf.add(l.url));
      console.log(`${year} ${name}: ${billLinks.map((l) => l.text).join(" / ")}`);
      if (opts.dryRun) continue;

      const sessionId = noDb ? 0 : await upsertSession({ year, name, label: `令和${year - 2018}年 ${name}` });
      for (const link of billLinks) {
        try {
          // 取り込み済みの PDF はダウンロードもしない（市のサーバーへの負荷を減らす）
          if (!noDb && !opts.force) {
            const done = must(await db.from("bills").select("id").eq("source_url", link.url).limit(1), "select bills");
            if (done.length) continue;
          }
          const { text, hash } = await pdfText(link.url);
          // 紙をスキャンした画像だけの PDF は文字が取れないので、AI を呼ばずに知らせる
          if (text.replace(/\s/g, "").length < 300) {
            console.warn(`  ! ${link.text}: 画像だけの PDF で文字を読み取れないため、取り込めません（${link.url}）`);
            continue;
          }
          const batches = promptBatches(text);
          let count = 0;
          for (const batch of batches) {
            const r = await generateStructured({
              system: BILL_SYSTEM,
              prompt: `相模原市議会 ${year}年 ${name} に提出された「${link.text}」の議案書から抜き出した文字です。\n\n${batch}`,
              schema: BillsSummary,
            });
            if (opts.preview) {
              console.log(JSON.stringify(r, null, 2));
              console.log(`AI に渡した文字数: ${batch.length.toLocaleString()} / PDF 全体: ${text.length.toLocaleString()}`, lastUsage);
              return;
            }
            await saveBills(r.bills, { sessionId, year, url: link.url, hash, index });
            count += r.bills.length;
          }
          console.log(`  ✓ ${link.text}: ${count} 件（AI 呼び出し ${batches.length} 回）`);
        } catch (e) {
          if (e instanceof UsageLimitError) throw e;
          console.error(`  ✗ ${link.text}: ${(e as Error).message}`);
        }
      }
      if (opts.latest) return;
    }
  }
}

async function ingestResults(since: number, opts: Opts) {
  const pages = [RESULTS_CURRENT, ...(opts.latest ? [] : await yearPages(RESULTS_PAST_INDEX, since))];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const sec of parseSections(await fetchText(page), page)) {
      for (const link of sec.links) {
        if (!link.text.includes("審議結果") || seen.has(link.url)) continue;
        seen.add(link.url);
        const year = fileYear(link.url) ?? yearFromLabel(sec.heading);
        if (!year || year < since) continue;
        console.log(`${year} ${link.text}`);
        if (opts.dryRun || opts.preview) continue;
        try {
          // 結果が入っていない議案がなければ、AI を呼ばずにスキップする
          const { text } = await pdfText(link.url);
          const numbers = [...text.matchAll(/(議提)?議案第(\d+)号/g)].map((m) => Number(m[2]));
          if (!opts.force && numbers.length) {
            const pending = must(
              await db.from("bills").select("id").eq("year", year).in("number", numbers).is("result", null).limit(1),
              "select pending",
            );
            if (!pending.length) {
              console.log("  - 反映済み");
              continue;
            }
          }
          const r = await generateStructured({
            system: "相模原市議会の審議結果一覧から、議案ごとの本会議の議決結果を正確に抜き出してください。陳情・請願は除きます。",
            prompt: `${year}年の審議結果一覧です。\n\n${text}`,
            schema: ResultsSchema,
          });
          let updated = 0;
          for (const x of r.results) {
            const res = must(
              await db
                .from("bills")
                .update({ result: x.result.replace(/\s+/g, ""), decided_on: x.decided_on || null })
                .eq("year", year)
                .eq("bill_kind", x.kind)
                .eq("number", x.number)
                .select("id"),
              "update result",
            );
            updated += res.length;
          }
          console.log(`  ✓ ${r.results.length} 件中 ${updated} 件を更新`);
        } catch (e) {
          if (e instanceof UsageLimitError) throw e;
          console.error(`  ✗ ${link.text}: ${(e as Error).message}`);
        }
        if (opts.latest) return;
      }
    }
  }
}

async function main() {
  const args = parseArgs();
  const since = Number(args.since ?? 2023);
  const opts: Opts = {
    force: Boolean(args.force),
    dryRun: Boolean(args["dry-run"]),
    preview: Boolean(args.preview),
    latest: Boolean(args.latest),
  };
  if (args.only !== "results") await ingestBills(since, opts);
  if (args.only !== "bills" && !opts.preview) await ingestResults(since, opts);
  console.log("完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
