import type { Metadata } from "next";
import { BillList } from "@/components/bill-list";
import { EmptyState, PageTitle } from "@/components/ui";
import { getBills } from "@/lib/data";

export const metadata: Metadata = { title: "議案" };

export default async function BillsPage() {
  const bills = await getBills();
  return (
    <div>
      <PageTitle
        title="議案"
        lead="市長が提出した議案と、議員が提出した議案（議員提出議案）を、会議ごとにまとめています。"
      />
      {bills.length === 0 ? <EmptyState /> : <BillList bills={bills} />}
    </div>
  );
}
