// data/chairs.json（手で管理する正副議長経験者の一覧）を Supabase に反映する。AI は使わない。
//   npm run sync:chairs
// 新しい議長・副議長が選ばれたら data/chairs.json に1行足して実行する。
import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { db, ensureMember, loadMemberIndex, must } from "./lib/db";
import { normalizeName } from "./lib/util";

const SOURCE = "手入力（歴代正副議長）";

const Chair = z.object({
  position: z.enum(["議長", "副議長"]),
  name: z.string(),
});

async function main() {
  const list = z.array(Chair).parse(JSON.parse(readFileSync("data/chairs.json", "utf8")));
  const index = await loadMemberIndex();
  const rows = new Map<string, { member_id: number; position: string; body: string; source: string }>();
  for (const c of list) {
    const name = normalizeName(c.name);
    if (!index.has(name)) console.warn(`  ! 名簿にない議員「${c.name}」を元議員として登録します`);
    const member_id = await ensureMember(index, name);
    rows.set(`${member_id}-${c.position}`, { member_id, position: c.position, body: "本会議", source: SOURCE });
  }
  // 以前に会議録から割り出していた記録（副議長に漏れがあった）も消して、この一覧だけにする
  must(await db.from("member_positions").delete().in("source", [SOURCE, "会議録（議事進行役）"]), "clear chairs");
  must(await db.from("member_positions").insert([...rows.values()]), "insert chairs");
  console.log(`正副議長の経験 ${rows.size} 件を反映しました`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
