// 分野タグ。AI の分類と画面表示の両方でこの一覧だけを使う。
export const FIELDS = [
  "子育て・教育",
  "医療・福祉",
  "防災・安全",
  "まちづくり・交通",
  "環境",
  "経済・産業",
  "農林・中山間地域",
  "文化・スポーツ",
  "人権・市民活動",
  "行財政・市役所改革",
  "議会運営",
  "その他",
] as const;

export type Field = (typeof FIELDS)[number];

export const FIELD_COLORS: Record<Field, string> = {
  "子育て・教育": "#e8833a",
  "医療・福祉": "#d6457a",
  "防災・安全": "#c0392b",
  "まちづくり・交通": "#2f7fc1",
  環境: "#2e9d5b",
  "経済・産業": "#b8860b",
  "農林・中山間地域": "#6b8e23",
  "文化・スポーツ": "#8e5ccf",
  "人権・市民活動": "#16a3a3",
  "行財政・市役所改革": "#5a6b7d",
  議会運営: "#7d5a50",
  その他: "#999999",
};

// 一般質問の評価基準（各 1〜5 点）。画面にもそのまま表示して透明性を保つ。
export const SCORE_CRITERIA = [
  {
    key: "specificity",
    label: "具体性・根拠",
    description: "数字や現場の声、他都市の事例など、根拠を示して質問しているか",
  },
  {
    key: "proposal",
    label: "建設的な意見",
    description: "批判や指摘だけで終わらず、代わりの案や次につながる具体的な提案を示しているか",
  },
  {
    key: "fiscal",
    label: "費用対効果の考え",
    description:
      "費用や財源を考えているか。コストを抑えたサービス向上や税収を増やす方法を示していれば高く、財源を示さずに無償化や予算の増額だけを求める場合は低く評価します",
  },
  {
    key: "outcome",
    label: "成果",
    description: "「検討する」「実施する」など前向きな答弁や具体的な約束を引き出したか",
  },
  {
    key: "relevance",
    label: "市民への関わり",
    description: "市民の暮らしや市の将来に直結する大切なテーマを扱っているか",
  },
] as const;

export type ScoreKey = (typeof SCORE_CRITERIA)[number]["key"];

export function scoreLabel(score: number | null | undefined): {
  label: string;
  tone: "great" | "good" | "fair" | "poor" | "none";
} {
  if (score == null) return { label: "未評価", tone: "none" };
  if (score >= 4) return { label: "とても良い質問", tone: "great" };
  if (score >= 3.2) return { label: "良い質問", tone: "good" };
  if (score >= 2.4) return { label: "ふつう", tone: "fair" };
  return { label: "改善の余地が大きい", tone: "poor" };
}

export const SITE_NAME = "みらい議会＠相模原市";
