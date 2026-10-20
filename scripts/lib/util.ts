import { createHash } from "node:crypto";

export const SITE_BASE = "https://www.sagamihara-shigikai.jp";

/** 全角英数字・全角スペースを半角にする */
export function toHankaku(s: string): string {
  return s
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/** 氏名比較用: 空白をすべて除く */
export function normalizeName(s: string): string {
  return toHankaku(s).replace(/\s+/g, "");
}

export function sha256(s: string | Uint8Array): string {
  return createHash("sha256").update(s).digest("hex");
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 公開サイトへの負荷を抑えるため、リクエストの間隔を空ける */
let lastFetch = 0;
export async function politeFetch(url: string, init?: RequestInit): Promise<Response> {
  const wait = lastFetch + 700 - Date.now();
  if (wait > 0) await sleep(wait);
  lastFetch = Date.now();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": "mirai-gikai-sagamihara/0.1 (civic tech)", ...init?.headers },
    });
    if (res.ok || attempt >= 2 || res.status < 500) return res;
    await sleep(2000 * (attempt + 1));
  }
}

export async function fetchText(url: string): Promise<string> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** 令和N年 → 西暦 */
export function reiwaToYear(n: number): number {
  return 2018 + n;
}

/**
 * 会議名を正規化する。
 * 「令和　８年　　６月定例会議」「令和７年定例会令和８年３月定例会議」→ "3月定例会議"
 * 「第１回臨時会議」→ "第1回臨時会議"、「定例会開会会議」→ "開会会議"
 */
export function normalizeSessionName(raw: string): string | null {
  const s = toHankaku(raw).replace(/\s+/g, "");
  let m = s.match(/(\d{1,2})月定例会議/);
  if (m) return `${Number(m[1])}月定例会議`;
  m = s.match(/第(\d+)回臨時会議/);
  if (m) return `第${Number(m[1])}回臨時会議`;
  if (s.includes("開会会議")) {
    // 令和5年は改選の前後で「第1回定例会」「第2回定例会」に分かれ、開会会議が2回ある
    m = s.match(/第(\d+)回定例会開会会議/);
    return m ? `第${Number(m[1])}回定例会開会会議` : "開会会議";
  }
  return null;
}

/** 会議名に含まれる最後の「令和N年」を西暦にする */
export function yearFromLabel(raw: string): number | null {
  const all = [...toHankaku(raw).replace(/\s+/g, "").matchAll(/令和(\d+)年/g)];
  if (all.length === 0) return null;
  return reiwaToYear(Number(all[all.length - 1][1]));
}

export function parseArgs(): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}
