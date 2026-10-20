// 現職議員の名簿を市議会ホームページから取り込む
//   npm run ingest:members
import "dotenv/config";
import { db, must } from "./lib/db";
import { SITE_BASE, fetchText, normalizeName, stripTags, toHankaku } from "./lib/util";

const LIST_URL = `${SITE_BASE}/doc/2013122400014/`; // 50音順名簿

/** 表の「見出しセル → 値セル」から値を読む（見出しセルの中にタグが入っているページもある） */
function cell(html: string, label: string): string | null {
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tds = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (tds.length >= 2 && stripTags(tds[0]).trim() === label) return stripTags(tds[1]).trim();
  }
  return null;
}

async function main() {
  const list = await fetchText(LIST_URL);
  const body = list.slice(list.indexOf("<h1>50音順名簿"));
  // 名前が <span> で囲まれているリンクもあるので、タグを除いて読む
  const links = [...body.matchAll(/href="(\/doc\/\d+\/)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ path: m[1], name: stripTags(m[2]).trim() }))
    .filter((l) => l.name && !l.name.includes("名簿"));
  const unique = [...new Map(links.map((l) => [l.path, l])).values()];
  console.log(`名簿から ${unique.length} 名を検出`);

  const currentNames: string[] = [];
  for (const l of unique) {
    const url = `${SITE_BASE}${l.path}`;
    const html = await fetchText(url);
    const displayName = cell(html, "氏名") ?? l.name;
    const name = normalizeName(displayName);
    const roles = (cell(html, "役職・所属委員会") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const seat = cell(html, "議席番号");
    const row = {
      name,
      display_name: displayName.replace(/\s+/g, "　"),
      kana: cell(html, "よみがな"),
      ward: cell(html, "選出区"),
      faction: cell(html, "所属会派"),
      seat_number: seat ? Number(toHankaku(seat)) || null : null,
      committees: roles,
      profile_url: url,
      is_current: true,
      updated_at: new Date().toISOString(),
    };
    must(await db.from("members").upsert(row, { onConflict: "name" }), `upsert ${name}`);
    currentNames.push(name);
    console.log(`  ${displayName}（${row.faction ?? "-"}）`);
  }

  // 名簿から外れた議員は「元議員」にする
  if (currentNames.length > 30) {
    must(
      await db
        .from("members")
        .update({ is_current: false })
        .not("name", "in", `(${currentNames.map((n) => `"${n}"`).join(",")})`),
      "mark former members",
    );
  }
  console.log("完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
