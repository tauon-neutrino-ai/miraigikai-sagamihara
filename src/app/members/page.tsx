import type { Metadata } from "next";
import { MemberList } from "@/components/member-list";
import { EmptyState, PageTitle } from "@/components/ui";
import { getMembers } from "@/lib/data";

export const metadata: Metadata = { title: "議員" };

export default async function MembersPage() {
  const members = await getMembers();
  return (
    <div>
      <PageTitle
        title="議員"
        lead="議員ごとに、一般質問・代表質問の回数・評価・よく取り上げる分野、議長経験、議員立法（中心的な役割を果たした議員提案条例）の有無をまとめています。"
      />
      {members.length === 0 ? <EmptyState /> : <MemberList members={members} />}
    </div>
  );
}
