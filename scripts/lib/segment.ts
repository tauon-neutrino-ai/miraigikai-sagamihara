// 会議録の中から一般質問・代表質問の部分を探し、質問した議員ごとに区切る（取り込みとテーマ深掘りで共通）
import type { Minute } from "./kaigiroku";
import { normalizeName, toHankaku } from "./util";

export type QuestionType = "一般質問" | "代表質問";

export type Segment = {
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
