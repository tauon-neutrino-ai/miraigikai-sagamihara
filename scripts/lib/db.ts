import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// --dry-run でも読み込めるよう、未設定なら使った時点でエラーにする
export const db =
  url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : (new Proxy({}, {
        get() {
          throw new Error(".env に SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください");
        },
      }) as ReturnType<typeof createClient>);

export function must<T>(res: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as NonNullable<T>;
}

/** maybeSingle() 用: 見つからなければ null */
export function mustMaybe<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export async function upsertSession(s: {
  year: number;
  name: string;
  label: string;
  kaigiroku_council_id?: number;
  start_date?: string | null;
}): Promise<number> {
  const existing = mustMaybe(
    await db.from("sessions").select("id, start_date").eq("year", s.year).eq("name", s.name).maybeSingle(),
    "select session",
  );
  if (existing) {
    const patch: Record<string, unknown> = { label: s.label };
    if (s.kaigiroku_council_id) patch.kaigiroku_council_id = s.kaigiroku_council_id;
    if (s.start_date && (!existing.start_date || s.start_date < existing.start_date)) patch.start_date = s.start_date;
    must(await db.from("sessions").update(patch).eq("id", existing.id), "update session");
    return existing.id;
  }
  const row = must(
    await db.from("sessions").insert({ ...s, start_date: s.start_date ?? null }).select("id").single(),
    "insert session",
  );
  return row.id;
}

/** 氏名（空白なし）→ member id の対応表 */
export async function loadMemberIndex(): Promise<Map<string, number>> {
  const rows = must(await db.from("members").select("id, name"), "select members");
  return new Map(rows.map((r) => [r.name, r.id]));
}

/** 名簿にいない議員（過去の議員など）を最小限の情報で登録する */
export async function ensureMember(index: Map<string, number>, name: string): Promise<number> {
  const hit = index.get(name);
  if (hit) return hit;
  // 対応表を読んだ後に名簿の取り込みで追加された議員もいるので、まず DB を確認する（上書きしない）
  const existing = mustMaybe(await db.from("members").select("id").eq("name", name).maybeSingle(), "select member");
  const id =
    existing?.id ??
    must(
      await db.from("members").insert({ name, display_name: name, is_current: false }).select("id").single(),
      "insert member",
    ).id;
  index.set(name, id);
  return id;
}
