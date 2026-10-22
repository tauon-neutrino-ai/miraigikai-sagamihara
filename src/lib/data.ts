// 画面用のデータ取得。Supabase の内容は取り込み時にしか変わらないので、1時間キャッシュする。
import { cacheLife } from "next/cache";
import type { Field } from "./constants";
import { getSupabase } from "./supabase";
import { sortSessionsDesc } from "./sessions";
import type {
  Bill,
  GeneralQuestion,
  Legislation,
  Member,
  MemberStats,
  MemberWithStats,
  Position,
  Session,
  SessionDigest,
  SessionSummary,
} from "./types";

const BILL_COLUMNS =
  "id, session_id, bill_kind, number, year, title, category, summary, background, key_points, impact, fields, result, decided_on, source_url, session:sessions(label, year, name)";

const QUESTION_LIST_COLUMNS =
  "id, member_id, question_type, meeting_date, title, summary, topics, fields, score_total, scores, evaluation_comment, good_points, improvement_points, source_url, member:members(id, display_name, faction), session:sessions(label)";

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

export async function getBills(): Promise<Bill[]> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("bills")
    .select(BILL_COLUMNS)
    .order("year", { ascending: false })
    .order("number", { ascending: false });
  if (error) fail("bills", error);
  return data as unknown as Bill[];
}

export async function getBill(id: number): Promise<Bill | null> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("bills")
    .select(`${BILL_COLUMNS}, sponsors:bill_sponsors(role, member:members(id, display_name))`)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("bill", error);
  return data as unknown as Bill | null;
}

export async function getQuestions(): Promise<GeneralQuestion[]> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("general_questions")
    .select(QUESTION_LIST_COLUMNS)
    .order("meeting_date", { ascending: false })
    .order("first_minute_id", { ascending: true });
  if (error) fail("questions", error);
  return data as unknown as GeneralQuestion[];
}

export async function getQuestion(id: number): Promise<GeneralQuestion | null> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("general_questions").select(QUESTION_LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error) fail("question", error);
  return data as unknown as GeneralQuestion | null;
}

export async function getMembers(): Promise<MemberWithStats[]> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return [];
  const [members, stats, fields] = await Promise.all([
    sb.from("members").select("*").order("kana", { ascending: true, nullsFirst: false }),
    sb.from("member_stats").select("*"),
    sb.from("member_field_counts").select("*"),
  ]);
  if (members.error) fail("members", members.error);
  if (stats.error) fail("member_stats", stats.error);
  if (fields.error) fail("member_field_counts", fields.error);
  const statsById = new Map((stats.data as MemberStats[]).map((s) => [s.member_id, s]));
  const fieldsById = new Map<number, { field: Field; count: number }[]>();
  for (const f of fields.data as { member_id: number; field: Field; count: number }[]) {
    const list = fieldsById.get(f.member_id) ?? [];
    list.push({ field: f.field, count: f.count });
    fieldsById.set(f.member_id, list);
  }
  return (members.data as Member[]).map((m) => ({
    ...m,
    stats: statsById.get(m.id) ?? null,
    topFields: (fieldsById.get(m.id) ?? []).sort((a, b) => b.count - a.count),
  }));
}

const LEGISLATION_COLUMNS =
  "id, slug, title, year, proposer_type, proposer_group, summary, background, co_proposers, source_url, leaders:legislation_leaders(role, member:members(id, display_name))";

/** 議員立法（議員提案条例）の一覧。新しい順 */
export async function getLegislations(): Promise<Legislation[]> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("legislations").select(LEGISLATION_COLUMNS).order("year", { ascending: false });
  if (error) fail("legislations", error);
  return data as unknown as Legislation[];
}

export async function getMemberDetail(id: number): Promise<{
  member: MemberWithStats;
  positions: Position[];
  questions: GeneralQuestion[];
  /** 中心的な役割を果たした議員立法だけ（連名の提出者・賛成者は含めない） */
  legislations: (Legislation & { role: string })[];
} | null> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return null;
  const member = (await getMembers()).find((m) => m.id === id);
  if (!member) return null;
  const [positions, questions, legislations] = await Promise.all([
    sb.from("member_positions").select("position, body, start_date, end_date").eq("member_id", id).order("start_date"),
    sb.from("general_questions").select(QUESTION_LIST_COLUMNS).eq("member_id", id).order("meeting_date", { ascending: false }),
    getLegislations(),
  ]);
  if (positions.error) fail("positions", positions.error);
  if (questions.error) fail("member questions", questions.error);
  return {
    member,
    positions: positions.data as Position[],
    questions: questions.data as unknown as GeneralQuestion[],
    legislations: legislations.flatMap((l) => {
      const leader = l.leaders.find((x) => x.member.id === id);
      return leader ? [{ ...l, role: leader.role }] : [];
    }),
  };
}

/** まとめページ用: 議案・質問が1件以上ある会議の一覧（新しい順） */
export async function getSessionSummaries(): Promise<SessionSummary[]> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return [];
  const [sessions, bills, questions, digests] = await Promise.all([
    sb.from("sessions").select("id, year, name, label, start_date"),
    sb.from("bills").select("session_id"),
    sb.from("general_questions").select("session_id"),
    sb.from("session_digests").select("session_id, kind, headline"),
  ]);
  if (sessions.error) fail("sessions", sessions.error);
  if (bills.error) fail("bills", bills.error);
  if (questions.error) fail("questions", questions.error);
  if (digests.error) fail("session_digests", digests.error);
  const count = (rows: { session_id: number | null }[], id: number) => rows.filter((r) => r.session_id === id).length;
  return sortSessionsDesc(sessions.data as Session[])
    .map((s) => ({
      ...s,
      billCount: count(bills.data, s.id),
      questionCount: count(questions.data, s.id),
      digests: (digests.data as { session_id: number; kind: "議案" | "質問"; headline: string }[])
        .filter((d) => d.session_id === s.id)
        .map(({ kind, headline }) => ({ kind, headline })),
    }))
    .filter((s) => s.billCount > 0 || s.questionCount > 0);
}

/** まとめページ用: 1つの会議のまとめと、リンク先の議案・質問 */
export async function getSessionDetail(id: number): Promise<{
  session: Session;
  digests: SessionDigest[];
  bills: Pick<Bill, "id" | "bill_kind" | "number" | "title" | "result">[];
  questions: Pick<GeneralQuestion, "id" | "question_type" | "title" | "member">[];
} | null> {
  "use cache";
  cacheLife("hours");
  const sb = getSupabase();
  if (!sb) return null;
  const [session, digests, bills, questions] = await Promise.all([
    sb.from("sessions").select("id, year, name, label, start_date").eq("id", id).maybeSingle(),
    sb.from("session_digests").select("kind, headline, overview, items, updated_at").eq("session_id", id),
    sb.from("bills").select("id, bill_kind, number, title, result").eq("session_id", id).order("number"),
    sb
      .from("general_questions")
      .select("id, question_type, title, member:members(id, display_name, faction)")
      .eq("session_id", id)
      .order("meeting_date"),
  ]);
  if (session.error) fail("session", session.error);
  if (digests.error) fail("session_digests", digests.error);
  if (bills.error) fail("session bills", bills.error);
  if (questions.error) fail("session questions", questions.error);
  if (!session.data) return null;
  return {
    session: session.data as Session,
    digests: digests.data as SessionDigest[],
    bills: bills.data as Pick<Bill, "id" | "bill_kind" | "number" | "title" | "result">[],
    questions: questions.data as unknown as Pick<GeneralQuestion, "id" | "question_type" | "title" | "member">[],
  };
}
