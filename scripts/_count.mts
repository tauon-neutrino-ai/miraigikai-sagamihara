import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data } = await sb.from("bills").select("bill_kind, number, title, result").order("number");
console.log(`bills: ${data?.length}`);
for (const b of data ?? []) console.log(b.bill_kind, b.number, b.title.slice(0, 30), b.result ?? "-");
