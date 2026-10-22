# みらい議会＠相模原市

相模原市議会で話し合われた**議案**と、議員の**一般質問**を、わかりやすい言葉でまとめて公開するサイトです。
議員ごとに「どの分野の質問が多いか」「質問の評価」「議長経験の有無」「議員提出議案（議員立法）の有無」がわかります。

[みらい議会＠沼津市](https://mirai-numazu.com/)（[ソース](https://github.com/seiichi3141/numazugikai)）を参考にしています。
沼津版の「AI に質問する」機能は入れていません。

## しくみ

```
相模原市議会HP（議案PDF・審議結果PDF・議員名簿）──┐
会議録検索システム（ssp.kaigiroku.net の API）────┤
                                                   ▼
          scripts/ingest-*.ts（取り込み + Claude Code で要約・評価）
                                                   ▼
                                   Supabase（Postgres）
                                                   ▼
                          Next.js（src/app）── Vercel で公開
```

| データ | 取り込み元 | スクリプト |
| --- | --- | --- |
| 議員 | 50音順名簿・各議員のページ | `npm run ingest:members` |
| 議長・副議長の経歴 | `data/chairs.json` を手で編集（AI は使わない） | `npm run sync:chairs` |
| 議案・議員提出議案・審議結果 | 提出議案 PDF・審議結果 PDF | `npm run ingest:bills` |
| 一般質問・代表質問の要約・評価 | 本会議の会議録（議員ごとに区切る。代表質問は3月・6月・9月の議案質疑の中） | `npm run ingest:questions` |
| 議員立法（中心的な役割を果たした議員） | `data/legislations.json` を手で編集（AI は使わない） | `npm run sync:legislations` |

一般質問の評価は「具体性・根拠」「建設的な意見」「費用対効果の考え」「成果」「市民への関わり」の5つの基準で 1〜5 点をつけ、
平均を総合点にしています（基準は `src/lib/constants.ts`。サイトの「このサイトについて」にも表示）。

## 費用について

追加の費用がかからない構成にしています。

| 使うもの | プラン |
| --- | --- |
| 要約・評価（AI） | **Claude のサブスクリプション**（Claude Code の `claude -p` を呼び出す）。API キー・API の従量課金は使いません |
| データベース | Supabase の Free プラン |
| 公開 | Vercel の Hobby（無料）プラン |

- 取り込みスクリプトは、環境に `ANTHROPIC_API_KEY` があっても外してから Claude Code を呼ぶので、API 課金にはなりません。
- サブスクの利用上限に達するとスクリプトは止まります。時間をおいて同じコマンドを実行すれば、続きから進みます（済んだものはスキップ）。
- claude.ai の設定で「追加使用量（Extra usage）」を**オフ**にしておくと、上限を超えて課金されることはありません。
- 一般質問1件の要約に1分ほどかかります。1回の定例会議（20件ほど）で20〜30分が目安です。

## セットアップ

### 1. Supabase

1. https://supabase.com でプロジェクトを作る（Free プラン・リージョンは Tokyo がおすすめ）
2. SQL Editor に `supabase/migrations/20261018000000_init.sql` の中身を貼り付けて実行する
3. Project Settings > API から URL・anon key・service_role key を控える

### 2. 環境変数と Claude Code

```bash
cp .env.example .env
# .env に Supabase の URL・anon key・service_role key を書く
```

要約には Claude Code を使います。ターミナルで `claude` を起動し、`/login` で claude.ai アカウントにログインしておいてください。

### 3. データの取り込み（初回）

```bash
npm install
npm run ingest:members                        # 現職議員（1分ほど）
npm run sync:chairs                           # 歴代の正副議長（data/chairs.json）
npm run ingest:questions -- --latest          # まず最新の定例会議の一般質問だけ
npm run ingest:bills -- --since=2026          # 今年の議案と審議結果
```

慣れてきたら、過去の分を少しずつ追加します（サブスクの上限で止まったら、時間をおいて同じコマンドを再実行）。

```bash
npm run ingest:questions -- --since=2023-05   # 今の任期（2023年5月〜）の一般質問すべて
npm run ingest:bills -- --since=2023          # 2023年以降の議案すべて
```

便利なオプション:

- `--dry-run` … AI を呼ばずに、取り込み対象の一覧だけ表示
- `--preview` … （一般質問）DB に保存せず、最初の1件だけ要約して表示（お試し用）
- `--council=1032` … （一般質問）特定の会議だけ。番号は `--dry-run` の表示や会議録検索システムの URL で確認
- `--force` … 要約済みのものも作り直す
- モデルは `.env` の `CLAUDE_MODEL` で変更できます（既定は `claude-sonnet-5`）

### 4. 画面の確認

```bash
npm run dev   # http://localhost:3000
```

### 5. Vercel で公開

1. このフォルダを GitHub に push する
2. Vercel（Hobby プラン）で Import し、Environment Variables に `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定する
   （`SUPABASE_SERVICE_ROLE_KEY` は **Vercel には設定しない**）
3. Deploy。ページは1時間ごとに Supabase から読み直すので、取り込み後1時間以内にサイトに反映されます

## 新しい会議の追加（手動）

定例会議が終わり、会議録が公開されたら（会議の1〜2か月後）、次を実行します。

```bash
npm run ingest:members                  # 議員の会派・役職の変更を反映
npm run ingest:bills -- --since=2026    # 新しい議案と審議結果（取り込み済みの PDF はスキップ）
npm run ingest:questions -- --latest    # 最新の定例会議の一般質問
```

## 注意

- 要約・評価は AI によるもので、誤りを含むことがあります。各ページに元資料へのリンクを付けています。
- 市のサーバーに負荷をかけないよう、取り込みはリクエストの間隔を空けて行います。
- Supabase の Free プランは、しばらくアクセスがないとプロジェクトが一時停止されることがあります。その場合は Supabase の画面から再開してください。

## 議員立法の追加・修正（手動）

議員立法（議員提案条例）は `data/legislations.json` に手で書き足し、`npm run sync:legislations` で反映します。

- `leaders` に書いた議員だけが、その議員の「議員立法」の実績として数えられます（中心的な役割を果たした議員だけを書く）。
- 連名の提出者など、実績に数えない人は `co_proposers` に文章で書きます。
- 委員会提出など、特定の議員がいない場合は `leaders` を空 `[]` にします。
- 初めて使うときは、Supabase の SQL Editor で `supabase/migrations/20261019000000_legislations.sql` を実行しておいてください。

## 正副議長の追加（手動）

新しい議長・副議長が選ばれたら `data/chairs.json` に1行（役職と名前）足して `npm run sync:chairs` を実行します。

## 議案書が画像だけの PDF のとき

紙をスキャンした PDF は文字を読み取れないため、`ingest:bills` は「画像だけの PDF」と表示して飛ばします。
その場合は、本会議の会議録にある「提案理由の説明」から要約できます。

```bash
npm run ingest:bills-minutes -- --council=1019 --numbers=14-37 --dry-run   # 使う説明文を確認
npm run ingest:bills-minutes -- --council=1019 --numbers=14-37             # 取り込み
npm run ingest:bills -- --since=2026 --only=results                       # 審議結果を反映
```

`--council` は会議録検索システムの会議番号（`ingest:questions -- --dry-run` の表示などで確認）、`--numbers` は議案番号です。

## 会議のまとめ（手動）

議案・質問を取り込んだあと、会議ごとの「まとめ」（重要な議案と、複数の議員が取り上げた論点）を作ります。

```bash
npm run digest -- --all                          # まとめが古い・ない会議をすべて
npm run digest -- --year=2026 --name=6月定例会議   # 1つの会議だけ
npm run digest -- --latest --preview             # 保存せずに試す
```

元の要約が変わっていなければ AI を呼ばずに飛ばします。初めて使うときは、Supabase の SQL Editor で
`supabase/migrations/20261022000000_session_digests.sql` を実行しておいてください。
