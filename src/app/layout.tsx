import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description:
    "相模原市議会で話し合われた議案や、議員の一般質問・代表質問をわかりやすい言葉でまとめています。議員ごとの質問の分野や評価も見られます。",
  // 漢字の多いページを中国語と取り違えたブラウザが自動翻訳し、言葉が崩れるのを防ぐ
  other: { google: "notranslate" },
};

const NAV = [
  { href: "/sessions", label: "会議のまとめ" },
  { href: "/bills", label: "議案" },
  { href: "/questions", label: "一般質問・代表質問" },
  { href: "/members", label: "議員" },
  { href: "/legislation", label: "議員立法" },
  { href: "/about", label: "このサイトについて" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" translate="no" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-primary">
              {SITE_NAME}
            </Link>
            <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-primary">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border bg-surface text-xs text-muted">
          <div className="mx-auto max-w-5xl space-y-1 px-4 py-6">
            <p>
              出典: <a className="underline" href="https://www.sagamihara-shigikai.jp/">相模原市議会ホームページ</a>・
              <a className="underline" href="https://ssp.kaigiroku.net/tenant/sagamihara/pg/index.html">
                相模原市議会 会議録検索システム
              </a>
            </p>
            <p>
              要約と評価は AI（Claude）が会議録・議案書をもとに作成したもので、誤りを含むことがあります。正確な内容は必ず出典をご確認ください。
            </p>
            <p>このサイトは市民有志による非公式のサイトで、相模原市・相模原市議会・特定の政党とは関係ありません。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
