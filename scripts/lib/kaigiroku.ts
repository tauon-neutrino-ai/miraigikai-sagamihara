// 相模原市議会 会議録検索システム（ssp.kaigiroku.net）の API クライアント
import { politeFetch, stripTags } from "./util";

const API = "https://ssp.kaigiroku.net/dnp/search";
const TENANT_ID = 400;

async function post<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const body = new URLSearchParams({ tenant_id: String(TENANT_ID) });
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  const res = await politeFetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`kaigiroku ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export type Council = {
  council_id: number;
  name: string;
  view_year: number;
  type_path: string; // 例: 本会議/定例会
};

export async function listCouncils(): Promise<Council[]> {
  type Raw = {
    councils: {
      view_years: {
        view_year: string;
        council_type: {
          council_type_name2: string | null;
          council_type_name3: string | null;
          councils: { council_id: number; name: string }[];
        }[];
      }[];
    }[];
  };
  const raw = await post<Raw>("councils/index", {});
  const out: Council[] = [];
  for (const c of raw.councils)
    for (const y of c.view_years)
      for (const t of y.council_type)
        for (const k of t.councils)
          out.push({
            council_id: k.council_id,
            name: k.name,
            view_year: Number(y.view_year),
            type_path: [t.council_type_name2, t.council_type_name3].filter(Boolean).join("/"),
          });
  return out;
}

export type Schedule = { schedule_id: number; name: string; member_list: string };

export async function listSchedules(councilId: number): Promise<Schedule[]> {
  const raw = await post<{ council_schedules: Schedule[] }>("minutes/get_schedule", { council_id: councilId });
  return raw.council_schedules ?? [];
}

export type Minute = {
  minute_id: number;
  title: string;
  body: string;
  /** 2=名簿 3=日程 4=議長 5=議員 6=理事者（答弁） */
  minute_type_code: number;
};

export async function getMinutes(councilId: number, scheduleId: number): Promise<Minute[]> {
  const raw = await post<{ tenant_minutes: Minute[] }>("minutes/get_minute", {
    council_id: councilId,
    schedule_id: scheduleId,
  });
  return (raw.tenant_minutes ?? []).map((m) => ({ ...m, body: stripTags(m.body ?? "").trim() }));
}

export function minuteUrl(councilId: number, scheduleId: number, minuteId?: number): string {
  const q = new URLSearchParams({ tenant_id: String(TENANT_ID), council_id: String(councilId), schedule_id: String(scheduleId) });
  if (minuteId) q.set("minute_id", String(minuteId));
  return `https://ssp.kaigiroku.net/tenant/sagamihara/MinuteView.html?${q}`;
}

/** schedule.name「06月29日－05号」と会議の年から日付を作る */
export function scheduleDate(year: number, scheduleName: string): string | null {
  const m = scheduleName.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}
