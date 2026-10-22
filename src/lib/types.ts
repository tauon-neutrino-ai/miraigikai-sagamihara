import type { Field, ScoreKey } from "./constants";

export type Session = {
  id: number;
  year: number;
  name: string;
  label: string;
  start_date: string | null;
};

export type Bill = {
  id: number;
  session_id: number | null;
  bill_kind: "市長提出" | "議員提出" | "委員会提出";
  number: number;
  year: number;
  title: string;
  category: string | null;
  summary: string | null;
  background: string | null;
  key_points: string[];
  impact: string | null;
  fields: Field[];
  result: string | null;
  decided_on: string | null;
  source_url: string | null;
  session?: Pick<Session, "label" | "year" | "name"> | null;
  sponsors?: { role: string; member: Pick<Member, "id" | "display_name"> }[];
};

export type Member = {
  id: number;
  name: string;
  display_name: string;
  kana: string | null;
  ward: string | null;
  faction: string | null;
  seat_number: number | null;
  committees: string[];
  profile_url: string | null;
  is_current: boolean;
};

export type MemberStats = {
  member_id: number;
  question_count: number;
  avg_score: number | null;
  was_chair: boolean;
  was_vice_chair: boolean;
  legislation_count: number;
};

export type MemberWithStats = Member & { stats: MemberStats | null; topFields: { field: Field; count: number }[] };

export type Position = {
  position: string;
  body: string;
  start_date: string | null;
  end_date: string | null;
};

export type Topic = {
  title: string;
  field: Field;
  question: string;
  answer: string;
  outcome: "前向きな答弁" | "検討・研究する" | "現状の説明のみ" | "否定的な答弁";
};

export type GeneralQuestion = {
  id: number;
  member_id: number;
  question_type: "一般質問" | "代表質問";
  meeting_date: string;
  title: string;
  summary: string;
  topics: Topic[];
  fields: Field[];
  score_total: number | null;
  scores: Partial<Record<ScoreKey, number>>;
  evaluation_comment: string | null;
  good_points: string[];
  improvement_points: string[];
  source_url: string | null;
  member?: Pick<Member, "id" | "display_name" | "faction"> | null;
  session?: Pick<Session, "label"> | null;
};

/** 議員立法（議員提案条例）。leaders は中心的な役割を果たした議員だけ */
export type Legislation = {
  id: number;
  slug: string;
  title: string;
  year: number;
  proposer_type: "会派" | "委員会" | "超党派・共同";
  proposer_group: string | null;
  summary: string | null;
  background: string | null;
  co_proposers: string | null;
  source_url: string | null;
  leaders: { role: string; member: Pick<Member, "id" | "display_name"> }[];
};

export type BillDigestItem = { title: string; description: string; bill_ids: number[]; contested: boolean };
export type QuestionDigestItem = {
  theme: string;
  field: Field;
  description: string;
  response: string;
  question_ids: number[];
};

/** 会議ごとのまとめ（AI が議案・質問の要約から作る） */
export type SessionDigest = {
  kind: "議案" | "質問";
  headline: string;
  overview: string;
  items: (BillDigestItem | QuestionDigestItem)[];
  updated_at: string;
};

export type SessionSummary = Session & {
  billCount: number;
  questionCount: number;
  digests: Pick<SessionDigest, "kind" | "headline">[];
};
