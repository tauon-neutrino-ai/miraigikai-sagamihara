// data/legislations.json（手で編集する議員立法の一覧）を Supabase に反映する。AI は使わない。
//   npm run sync:legislations
import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { db, ensureMember, loadMemberIndex, must } from "./lib/db";
import { normalizeName } from "./lib/util";

const Legislation = z.object({
  slug: z.string(),
  title: z.string(),
  year: z.number().int(),
  proposer_type: z.enum(["会派", "委員会", "超党派・共同"]),
  proposer_group: z.string().optional(),
  summary: z.string().optional(),
  background: z.string().optional(),
  co_proposers: z.string().optional(),
  source_url: z.string().optional(),
  // 中心的な役割を果たした議員。ここに書いた議員だけが「議員立法」として数えられる
  leaders: z.array(z.object({ name: z.string(), role: z.string() })),
});

async function main() {
  const list = z.array(Legislation).parse(JSON.parse(readFileSync("data/legislations.json", "utf8")));
  const index = await loadMemberIndex();

  for (const { leaders, ...l } of list) {
    const saved = must(
      await db
        .from("legislations")
        .upsert({ ...l, updated_at: new Date().toISOString() }, { onConflict: "slug" })
        .select("id")
        .single(),
      `upsert ${l.slug}`,
    );
    must(await db.from("legislation_leaders").delete().eq("legislation_id", saved.id), "clear leaders");
    const rows = [];
    for (const x of leaders) {
      const name = normalizeName(x.name);
      if (!index.has(name)) console.warn(`  ! 名簿にない議員「${x.name}」を元議員として登録します`);
      rows.push({ legislation_id: saved.id, member_id: await ensureMember(index, name), role: x.role });
    }
    if (rows.length) must(await db.from("legislation_leaders").insert(rows), "insert leaders");
    console.log(`✓ ${l.year} ${l.title}（中心: ${leaders.map((x) => x.name).join("、") || "なし"}）`);
  }

  // JSON から消したものは DB からも消す
  const slugs = list.map((l) => l.slug);
  must(
    await db.from("legislations").delete().not("slug", "in", `(${slugs.map((s) => `"${s}"`).join(",")})`),
    "delete removed",
  );
  console.log("完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
