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

      <section id="scoring" className="scroll-mt-4">
        <h2 className="mb-3 text-xl font-bold">一般質問・代表質問の評価のしかた</h2>
        <div className="mb-4 rounded-lg border border-border bg-background px-4 py-3 text-sm">
          <p className="font-bold">評価基準の決め方について</p>
          <p className="mt-1">
            下の5つの基準は、学術的に確立された評価方法ではなく、このサイトの運営者が「市民にとって役立つ質問とは何か」を考えて設定したものです。
            点数は AI がこの基準にそって会議録を読んでつけた目安で、同じ質問でも採点のたびに多少ぶれることがあります。
            評価は人によって変わります。ぜひ質疑の内容をよく読んで、ご自身の価値基準で判断してください。
          </p>
        </div>
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

      <section id="references" className="scroll-mt-4">
        <h2 className="mb-2 text-xl font-bold">評価基準と関係する考え方・文献</h2>
        <p className="mb-4 text-sm text-muted">
          上の評価基準は、これらの文献をもとに作ったものではありません。基準を設定したあとで、同じような考え方が示されている条例や研究を照らし合わせ、参考として紹介しています。
        </p>
        <div className="space-y-3">
          {REFERENCES.map((r) => (
            <Card key={r.title}>
              <p className="text-sm font-bold">
                {r.url ? (
                  <a href={r.url} className="text-primary underline" target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                ) : (
                  r.title
                )}
              </p>
              <p className="mt-1 text-xs text-muted">{r.source}</p>
              <p className="mt-2 text-sm">{r.relation}</p>
            </Card>
          ))}
        </div>
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

/** 評価基準と関係する条例・研究（基準を作ったあとで照らし合わせたもの。内容は原文で確認済み） */
const REFERENCES = [
  {
    title: "相模原市議会基本条例",
    source: "相模原市議会（平成26年7月1日施行）",
    url: "https://www.sagamihara-shigikai.jp/doc/2014051200010/",
    relation:
      "第5条で、議員の活動原則として「市長等の事務の執行について監視及び評価をし、的確な政策提言を行う」「日々の調査研究の成果を議会活動に反映させる」「常に市民意見の把握に努める」こと、また「市民全体の利益を念頭に置く」ことを定めています（評価基準の「建設的な意見」「具体性・根拠」「市民への関わり」に対応）。第20条では、質問と答弁を「分かりやすく行う」としています。",
  },
  {
    title: "本田正美「地方議員の活動評価と情報公開基盤の必要性」",
    source: "東京大学大学院情報学環紀要『情報学研究』No.88",
    url: "https://www.iii.u-tokyo.ac.jp/manage/wp-content/uploads/2018/04/88_2.pdf",
    relation:
      "議員の一般質問を評価する試みで、大村市議会基本条例第9条の7つの論点（政策の発生源、提案に至るまでの経緯、他の自治体の類似する政策との比較検討、市民参加、総合計画との整合性、財源措置及び将来にわたるコスト計算、政策の効果）を評価の軸としています（「具体性・根拠」「費用対効果の考え」に対応）。答弁をどれだけ引き出せたかの評価を今後の課題とし（「成果」に対応）、議員の活動を評価すべきなのは地域の住民であるとしています。",
  },
  {
    title: "上瀬裕美「地方議会における一般質問の研究」",
    source: "京都大学（公共政策大学院のサイトで公開）",
    url: "https://www.sg.kyoto-u.ac.jp/sg/wp-content/uploads/2021/07/6536b9d98e0684721a7b108cdf7f5080-1.pdf",
    relation:
      "一般質問は、監査機能と政策提案機能を果たし、執行機関の公式見解を引き出す重要な場であるという指摘（土山 2016）を紹介しています（「建設的な意見」「成果」に対応）。",
  },
  {
    title: "Bull, P. & Mayer, K. “How not to answer questions in political interviews”",
    source: "Political Psychology, 14(4), 651–666 (1993)",
    url: "https://pure.york.ac.uk/portal/en/publications/how-not-to-answer-questions-in-political-interviews",
    relation:
      "政治家が質問に正面から答えずにかわす方法を分類した研究です。質問に対して実質的な答えが得られたかどうかを見る、という「成果」の考え方に近いものです。",
  },
  {
    title: "Bates, S. R., Kerr, P., Byrne, C. & Stanley, L. “Questions to the Prime Minister: A Comparative Study of PMQs from Thatcher to Cameron”",
    source: "Parliamentary Affairs, 67(2), 253–280 (2014)",
    url: "https://eprints.leedsbeckett.ac.uk/id/eprint/6608/",
    relation:
      "英国議会の首相への質問（PMQs）について、議会による監視が浅い点数稼ぎの場になっていないかを、質問の性質（答えを引き出しやすい質問か、答えようのない質問か など）を分類して比べた研究です。質問の中身そのものを見て評価するという考え方の参考として紹介しています。",
  },
];
