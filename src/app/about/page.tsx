import type { Metadata } from "next";
import { Card, PageTitle } from "@/components/ui";
import { SCORE_CRITERIA, SITE_NAME, scoreLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "このサイトについて" };

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <PageTitle title="このサイトについて" />

      <section className="space-y-2">
        <p>
          {SITE_NAME}は、相模原市議会で話し合われていることを、だれでも気軽に知ることができるようにするためのサイトです。
          市議会の公開情報（議案書・審議結果・会議録）をもとに、AI（Claude）がわかりやすい言葉で要約しています。
        </p>
        <p>
          「みらい議会＠沼津市」を参考にしています。
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">一般質問・代表質問の評価のしかた</h2>
        <p className="mb-4 text-sm">
          一般質問と代表質問は、1人の議員の1回の質問ごとに、会議録の全文を AI が読み、次の5つの基準でそれぞれ1〜5点をつけています。3点が「よくある平均的な一般質問」の目安です。
          総合点は5つの平均です。どの政策の方向（施設を増やす・減らすなど）を主張しているかでは点数を変えず、根拠・建設的な意見・費用対効果の考え・成果などで評価しています。財源を示さずに無償化や予算の増額を求める項目があれば「費用対効果の考え」を下げ、「改善できる点」に書いています（質問全体で費用を意識していれば、大きくは下げません）。一般質問と代表質問では時間の使い方が違うため、再質問の多さでは評価していません。評価の理由は、各質問のページに書いてあります。
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCORE_CRITERIA.map((c) => (
            <Card key={c.key}>
              <h3 className="font-bold">{c.label}</h3>
              <p className="mt-1 text-sm text-muted">{c.description}</p>
            </Card>
          ))}
        </div>
        <h3 className="mt-6 mb-2 font-bold">総合点の目安</h3>
        <ul className="space-y-1 text-sm">
          {[4.5, 3.5, 2.8, 1.8].map((s) => (
            <li key={s}>
              {s >= 4 ? "4.0以上" : s >= 3.2 ? "3.2〜3.9" : s >= 2.4 ? "2.4〜3.1" : "2.3以下"}：{scoreLabel(s).label}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">議長経験・議員立法について</h2>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          <li>議長・副議長の経験は、相模原市議会の歴代の正副議長の記録（2011年以降）をもとに、経験の有無を記載しています。</li>
          <li>
            議員立法は、議員が提案して成立した条例（議員提案条例）です。相模原市議会では会派や委員会による共同提案がほとんどのため、
            連名で提出に加わっただけでは数えず、条例づくりで中心的な役割を果たした議員だけを実績として記載しています。
          </li>
          <li>
            国への意見書や委員会の設置など、議員が連名で提出する議案（議員提出議案）は、議案のページで提出者を確認できます。議員ごとの実績には数えていません。
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">ご注意</h2>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          <li>AI による要約と評価には誤りが含まれることがあります。正確な内容は、各ページのリンクから元の資料をご確認ください。</li>
          <li>評価は質問の「中身」についての目安で、議員の活動のすべてを表すものではありません。委員会での活動や地域での活動は含まれていません。</li>
          <li>このサイトは市民有志による非公式のサイトです。相模原市・相模原市議会・特定の政党とは関係ありません。</li>
        </ul>
      </section>
    </div>
  );
}
