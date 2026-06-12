# Inkly Dashboard for jfet デザイン仕様書

## 1. プロダクト概要

- ビジョン ... jfet の PM / エンジニアが「前回の続き」 から最短で作業に戻れる、 静かで集中できるデザイン基地局を提供する。
- ミッション ... 個人 board / team board / 通知 / アカウント / 管理機能をひとつの画面に並べつつ、 視線を「最近編集した board」 へ誘導することで「作りはじめる前の迷い時間」 を 1 秒以下に縮める。
- 解決する課題 ... PM とエンジニアは複数 board と複数チームを横断するため、 「直近どこを触っていたか」 「誰が何をしたか」 を即座に把握できないと毎回 10-30 秒ロスする。 既存の Figma / Linear ダッシュボードはチーム別 / プロジェクト別の階層を強要するため、 横断的に「自分の文脈」 を集めるビューが弱い。
- 既存代替手段と限界
  - Figma ... ファイルツリーは強力だが「個人の最新文脈」 が前面に来ない、 通知も別 panel。
  - Linear ... task は強いが design board の embed が苦手、 PM 視点で design 進捗を見るのに不向き。
  - Notion ... 柔軟だが design tool ではないため board content をそのまま扱えない。
- 製品の差別化価値 ... Inkly Dashboard for jfet は「最近編集した board」 を画面中央に据え、 metrics / quick actions / activity を周辺に配置することで「迷わず作業に戻れる起点」 を 1 画面に成立させる。

## 2. ユーザーリサーチ

### ペルソナ

- 名前 ... 佐々木 蓮 (Ren Sasaki)
- 役職 / 立場 ... jfet PM (3-4 プロダクト同時並行)、 30 代前半
- 1 日の流れ ... 朝 30 分の design review、 午前は board に直接コメント、 午後は team 横断 sync、 夕方に翌日のドラフトを 1 枚作る。
- 主要痛み ... 「どの board が今日触るべきか」 を朝に決めるのに時間がかかる、 通知が分散していて取りこぼす。
- 既存代替手段への満足度 ... Figma + Linear + Slack を切り替える運用で「context switch コスト」 が高い、 1 画面で完結したい。

- 名前 ... 大久保 桃花 (Momoka Okubo)
- 役職 / 立場 ... jfet エンジニア (frontend + design system)、 20 代後半
- 1 日の流れ ... 朝 IDE と Inkly を行き来して spec を確認、 午後は実装、 夕方に design system token を更新。
- 主要痛み ... design token の最新版がどの board にあるか追えない、 PM の編集が反映されたかが分かりにくい。
- 既存代替手段への満足度 ... GitHub PR と Inkly を二重に見る、 activity feed が必要。

### User Story

- As a PM, I want to see my recently edited boards first, so that I can resume yesterday's design review in one click.
- As an engineer, I want to scan team activity in the same view as my boards, so that I can catch design changes that affect my implementation.
- As a team lead, I want to see how many unread notifications are pending, so that I can decide whether to triage now or after deep work.
- As an admin, I want quick access to administration and team settings without leaving the dashboard, so that I can keep operating tasks adjacent to creative tasks.

### Jobs to be Done

- When I open Inkly in the morning, I want to find the board I touched yesterday, so I can resume design review immediately.
- When a teammate edits a board I pinned, I want to be alerted in the same view, so I do not miss design changes.
- When I need to create a new board for a meeting, I want a single click action, so I do not break my thinking flow.
- When I am switching between projects, I want to see all pinned and recent boards together, so I can keep context without sidebar navigation.

## 3. 情報設計 (IA)

### サイトマップ

- `/dashboard` (本仕様の対象画面)
  - Top app bar (Inkly logo / search / notifications / locale / account chip with `@jfet.co.jp` ドメイン)
  - Metrics row (personal boards / team boards / teams / unread)
  - Quick actions row (new board / boards / teams / notifications)
  - Pinned boards section
  - Recent boards section
  - Activity feed section
  - Customize panel (折りたたみ、 section の表示順 / on off を保存)
- `/dashboard` から到達する他画面 (本仕様の範囲外、 リンク先のみ言及)
  - `/boards` `/board/:id` `/teams` `/team/:id` `/notifications` `/account` `/admin`

### 主要ユーザーフロー

- 朝の作業再開フロー ... `/dashboard` を開く → 1st fold の Recent boards 先頭の thumbnail を確認 → クリックで `/board/:id` に遷移 → 作業継続。
- 通知トリアージ ... 上部 metrics 「未読 N 件」 を確認 → activity feed で直近変更を確認 → 必要なら `/notifications` で詳細。
- 新規 board 作成 ... Quick actions の 「+ 新規ボード」 をクリック → 即時 `/board/:id` に遷移してエディタ起動。
- ピン管理 ... Recent boards の各 card の「pin」 アイコンクリックで Pinned section に移動、 もう一度クリックで解除。
- 管理画面導線 ... account chip → menu → admin link → `/admin` (一般 user では非表示)。

## 4. 画面一覧

| 画面 ID | 画面名 | 役割 | 主要機能 | 主要要素 | 状態網羅 | 関連画面 |
|---|---|---|---|---|---|---|
| D-1 | Dashboard | jfet メンバーが作業を再開する起点 | recent / pinned / metrics / activity / quick actions / customize / locale / 通知 / account 切替 | top bar + 5 sections (metrics / quick actions / pinned / recent / activity) + customize drawer | empty (board ゼロ) / loading (skeleton) / error (再試行) / success (通常 view) / permission denied (jfet ドメイン外で誤って到達した時の guard) | /boards /board/:id /teams /notifications /account /admin |

(本仕様は dashboard 単体のため 1 row のみ)

## 5. デザイン原則

- トーン ... professional / quiet / focus.
- 想定する印象 ... 「読みやすくて落ち着く、 でも情報量はある」 (Linear + Notion enterprise + Stripe Dashboard の中間)。
- 避けたい印象 ... 派手なグラデーション、 アイコン詰め込み、 motion 過多、 design tool らしい「クリエイティブ自慢」 の演出。
- 視覚原則
  - data-dense yet quiet ... 情報は減らさず余白とタイポグラフィで静けさを出す。
  - card stack with soft edges ... card は border より shadow を使い、 重なりで階層を示す。
  - typography first ... heading とラベルのコントラストで階層を示し、 装飾線を減らす。
  - text default semibold for headings ... 体感の重さを足す。
  - motion is functional only ... カード hover で 1 段だけ浮く、 page transition は fade のみ。
- a11y 配慮
  - WCAG AA contrast ratio をすべての text に確保 (4.5:1 以上)。
  - すべての interactive 要素に focus ring を明示。
  - section heading は `aria-label` で screen reader に意味を伝える。
  - keyboard navigation のみで recent boards 先頭にアクセス可能 (skip link).

## 6. ブランド

### カラー

- メイン (canvas / surface) ... 暗めの neutral grey、 純黒は避けて「夜の図書館」 のような落ち着きを出す。 純白の上に乗せても眩しくない設計。
- アクセント (action) ... 既存 Inkly accent (青寄りの purple) を踏襲、 jfet 内部で違和感のないトーンに微調整。
- secondary accent (data positive) ... 控えめな緑、 metrics が「up」 のときだけ薄く表示。
- success / warning / error ... 既存 design token をそのまま、 ただし warning は彩度を落として通知が「焦る色」 にならないように。
- jfet 要素の差し色 ... account chip の outline に jfet コーポレートカラーを 1 px だけ走らせて「jfet ワークスペース」 と分かるサインにする。

### タイポグラフィ

- heading ... sans-serif (Inter) semibold、 段落間で大きすぎず小さすぎないリズム、 大見出しは tight letter spacing で「整った」 印象。
- body ... 同じ sans-serif、 regular、 行間は 1.6 で読み疲れを減らす。
- mono (metric 数値 / board id 等) ... JetBrains Mono or 似た等幅、 metric の数字に使うとデータダッシュボード感が出る。
- 多言語 ... ja / en の bilingual 想定、 日本語に対応するため和文ウェイトのバランスを確認。

## 7. コンポーネント要件 (design system)

- Top App Bar ... brand wordmark + search + notification bell (unread badge) + locale switcher + account chip (avatar + name + jfet ドメイン chip)。
- Metric Card ... ラベル + 大きい数字 + delta (任意)。 variant: neutral (default) / positive (up) / negative (down)。
- Quick Action Card ... アイコン + タイトル + 1 行説明 + cta (→ 矢印)。 hover で 1px 浮く。
- Board Card (large / small variant) ... thumbnail + board name + last edited timestamp + collaborators 数 + pin toggle。
- Section Heading ... 見出し + 副題 + 「すべて表示 →」 リンク。
- Activity Item ... avatar + 「{name} edited {board}」 + 相対時刻、 アンダーラインは hover のみ。
- Customize Drawer ... section ごとの表示 on/off toggle + 並び替え handle (drag)。
- Account Chip ... avatar (32px) + display name + ドメイン chip (`@jfet.co.jp`) を 1 行に。
- Empty State Illustration ... 線画のミニマルなイラスト + 励まし文 + cta。
- Skeleton Loader ... card 形状に合わせた pulsing block。 ジッタなしの calm な pulse。

## 8. 状態の網羅

- Empty (board が 0 件) ... 「最初のボードを作りましょう」 ヘッドライン + 「+ 新規ボード」 ボタン、 周辺に薄いイラストレーション、 metrics 0 件は控えめに表示。
- Loading ... skeleton で 3 sections (metrics / pinned / recent) 同時に出す、 アニメーションは calm pulse、 3 秒以上続くなら「サーバーから取得中」 文言を追加。
- Error ... 「ボードを読み込めませんでした」 ヘッドライン + 「もう一度試す」 ボタン + 詳細は折りたたみ、 we 主語で書く (you ではなく)。
- Success (通常 view) ... pinned が 0 件のときは空セクションごと隠す (枠だけ残さない)、 recent は最大 12 件まで。
- Permission denied (jfet ドメイン外がアクセスした時) ... 「このダッシュボードは jfet メンバー向けです」 ヘッドライン + 「招待されたボードを開く」 ボタン (招待があれば) + 「サインアウト」 ボタン、 本画面の中身は描画しない。
- Maintenance ... 上部に薄い banner で「メンテナンス中、 一部機能が制限されています」 を出し、 dashboard は表示続行 (機能のみ disable)。

## 9. 制約・要件

- a11y ... WCAG AA を目標、 motion-reduced 環境では animation を全停止。
- responsive
  - desktop (1280+) ... metrics 4 列 + quick actions 4 列 + pinned grid + recent grid + activity sidebar。
  - tablet (768-1279) ... metrics 2x2 + quick actions 2x2 + section ごと縦並び。
  - mobile (640 以下) ... metrics 横スクロールカード + quick actions 縦スタック + activity は drawer に格納。
- ロケール ... ja / de / es / fr / it / pl / ru / zh-CN + en、 既存 inkly i18n に乗る。
- platform ... web のみ (Tauri build は別仕様)。
- 既存 design system 参照 ... `src/app.css` の token (`--color-canvas` `--color-accent` 等) と `packages/vue` の primitives をそのまま使う。
- jfet 判定 ... email ドメインが `@jfet.co.jp` で終わるかで分岐 (本仕様の対象は jfet ドメイン user のみ、 外部 user は別仕様 `design/specs/dashboard-guest.md` で扱う)。

## 10. 次の作業

- `/pencil-design design/specs/dashboard-jfet.md` で本仕様書を読んで `.pen` ファイルを生成
- 修正は本仕様書を編集して再生成、 仕様書を SSOT として扱う
- ペア仕様書として `design/specs/dashboard-guest.md` (外部招待 user 向け) を別途生成予定
