// 画面用のデータ取得。Supabase の内容は取り込み時にしか変わらないので、1時間キャッシュする。
import { cacheLife } from "next/cache";
import type { Field } from "./constants";
import { getSupabase } from "./supabase";
import type { Bill, GeneralQuestion, Legislation, Member, MemberStats, MemberWithStats, Position } from "./types";

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
