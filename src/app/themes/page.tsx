import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageTitle } from "@/components/ui";
import { getThemes } from "@/lib/data";

export const metadata: Metadata = { title: "テーマ深掘り" };

export default async function ThemesPage() {
  const themes = await getThemes();
  return (
    <div>
      <PageTitle
        title="テーマ深掘り"
        lead="気になるテーマについて、議案と議員の質問・市の答弁をもとに、これまでの経緯・現在の状況・関心のある議員をまとめています。"
      />
      {themes.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {themes.map((t) => (
            <li key={t.slug}>
              <Link href={`/themes/${t.slug}`} className="block h-full rounded-xl border border-border bg-surface p-5 hover:border-primary">
                <h2 className="text-lg font-bold">{t.title}</h2>
                {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
                <p className="mt-3 text-sm font-medium text-primary">{t.content.headline}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
