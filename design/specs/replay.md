# Replay デザイン仕様書

> 非同期動画メッセージング SaaS。
> リモートチーム (50-500 名) の文脈共有を「録って、見られて、話せる」状態に持っていく。

## 1. プロダクト概要

- **ビジョン** — 動画を「撮ったあと」まで責任を持つ非同期動画ツールを、リモートチームの標準にする。
- **ミッション** — 5 分動画で交換される文脈が、確かに見られ、確かに動く状態をチームに届ける。
- **解決する課題**
  - Loom 系ツールで撮った動画の多くが「投げっぱなし」になり、必要な相手に届かないまま埋もれる。
  - 既読が見えないため送り手は不安になり、受け手は優先度を判断できず、結果として「重要な動画」を選別する仕組みが個人の善意に依存する。
  - 50-500 名規模になるとライブラリは肥大化し、検索しても古い動画と新しい動画の境目が曖昧になる。
- **既存代替手段と限界**
  - Loom — 録画体験は最良だが、視聴は「リンクを開いた人」止まり。誰が見ていないかをチームで運用する仕組みがない。
  - Vidyard — 営業向けトラッキングは強いが、社内コラボのコメント・チーム横断の検索が薄い。
  - Vimeo (Enterprise) — プレイヤー品質は高いが、非同期コラボのワークフロー (Slack/Linear 連携・未視聴フォロー) が弱い。
  - 会議 + Notion 議事録 — 場所と時間を奪う、議事録は読まれない、動画は残らない。
- **製品の差別化価値** — チームの視聴オペレーションを第一級のオブジェクトとして可視化する。「誰が見た / どこで離脱した / 誰にリマインドすべきか」を dashboard と自動フォローで運用できる、撮ったあとに責任を持てる非同期動画ツール。

## 2. ユーザーリサーチ

### ペルソナ

- **Mika (typical user) — プロダクトマネージャー**
  - 役職 / 立場 — 80 名規模の SaaS スタートアップ、4 プロダクトチームを横断する PM、フルリモート (東京 + シンガポール + ベルリン)。
  - 1 日の流れ — 朝に Linear のチケット整理、午前は仕様レビュー、午後はステークホルダーへの状況共有、夜は時差のあるエンジニアからの質問を非同期で返す。
  - 主要痛み — 仕様を Loom で撮っても「見ました」リアクションが 3 人しか付かず、リリース当日に「聞いてない」が発生する。週次 sync を非同期化したいが、誰が追いつけているか把握できない。
  - 既存代替への満足度 — Loom は録るのは好きだが、視聴の運用を完全に自分の声掛けに頼っている状態に消耗している。
- **Ren (power user) — カスタマーサクセスマネージャー**
  - 役職 / 立場 — 中規模 SaaS の CS リード、社内外に向けて週 10-15 本の動画を録る。社外向けデモ・社内向けナレッジ共有が半々。
  - 1 日の流れ — 朝に顧客への返信動画 3 本、午後に新機能のオンボーディング動画を撮り、夕方にチームのナレッジライブラリを整理。
  - 主要痛み — 顧客に送った動画がどこまで見られたかを把握したい (営業視点)、社内ライブラリは増える一方でタグ運用が破綻している、新人 CS が過去動画を見つけられない。
  - 既存代替への満足度 — Vidyard は社外向けには使えるが社内コラボが弱く、Loom と二重管理になっていてどちらも中途半端。
- **Sora (edge case) — シニアデザイナー / エンジニア (個人貢献者)**
  - 役職 / 立場 — フロントエンドエンジニア兼デザイナー、Figma レビューと PR walkthrough を動画で残すのが習慣。
  - 1 日の流れ — 午前にコード書き、午後にレビュー (PR + Figma)、夕方に翌日の作業整理を 3 分動画で残す。
  - 主要痛み — 動画にコメントが付いた時に通知が埋もれる、Figma / GitHub / Slack を行き来する間に動画の参照が切れる、レビュー動画にタイムスタンプ付きで返信したい。
  - 既存代替への満足度 — Loom のコメントは線形すぎて議論にならず、結局 Slack スレッドに戻ってしまい動画と議論が分離する。

### User Story

- As a PM, I want to see who has and hasn't watched my spec video, so that I can nudge only the people who actually need to catch up.
- As a CS lead, I want to know where customers drop off in my demo video, so that I can shorten the right section in the next take.
- As a designer-engineer, I want to leave timestamped comments on a colleague's PR walkthrough, so that the discussion stays anchored to the moment in the video.
- As a team admin, I want recordings tagged "All-hands" to be auto-shared with #announcements, so that critical updates reach the whole company without manual posting.
- As a new hire, I want to search past videos by transcript, so that I can find onboarding context without asking my buddy for the third time.

### Jobs to be Done

- When I'm about to schedule a meeting that's mostly one-way context sharing, I want to record a 5-minute video instead, so I can give my team time back and still know they got the message.
- When I send a video to my team, I want to confirm critical viewers have actually watched it, so I can stop manually pinging people in Slack.
- When I receive a long video from a colleague, I want a TL;DR with chapters and action items, so I can decide whether to watch in full now or skim and circle back.
- When I find an old video that's still relevant, I want to bring it back into the team's attention, so good context doesn't decay just because it's a week old.
- When a customer watches my demo, I want to see exactly which sections caught their interest, so my follow-up can speak to what they actually saw.

## 3. 情報設計 (IA)

### サイトマップ

```text
Marketing
├── Landing
├── Pricing
├── Use cases (Engineering / Product / CS / Leadership)
└── Sign up CTA

Auth
├── Sign up
├── Sign in (SSO + email)
├── Forgot password
└── Email verify

Onboarding
├── Welcome
├── Workspace setup (logo / domain / SSO)
├── Install recorder (Chrome ext / Desktop app)
├── Invite team
└── First recording walkthrough

Core
├── Home (For you / Following / Team feed)
├── Library (Personal / Team / All workspace)
├── Recorder (capture mode select / live recording / post-record edit)
├── Player (video + transcript + chapters + comments + analytics drawer)
├── Comments inbox (mentions / replies / unwatched-by-me)
├── Analytics dashboard (workspace-wide viewing ops)
├── Workflows (auto-routing rules)
├── External shares (audience list + lead capture)
└── Search (transcript / tag / people / time)

Settings
├── Profile
├── Workspace (identity / branding / domain / SSO)
├── Members (roles / groups)
├── Billing (plan / seats / usage)
├── Integrations (Slack / Notion / Linear / GitHub / Figma)
├── Audit log
└── Recording defaults (resolution / retention / watermark)

States
├── Empty (no recordings / no team activity / no comments)
├── Loading (recorder warming / upload / transcribing)
├── Error (recording failed / upload stalled / playback failed)
├── Permission denied (private workspace / removed share)
├── Maintenance
└── 404
```

### 主要ユーザーフロー

- **新規ユーザー登録 → 初回録画** — Sign up (SSO) → Email verify → Workspace setup → Install recorder → Invite team → First recording walkthrough → Recorder → Library (Home)
- **継続ユーザーの daily flow** — Sign in → Home (For you) → 未視聴の重要動画 1-2 本を視聴 → Comments inbox で返信 → Recorder で 1 本録る → Library で過去動画整理
- **PM の仕様共有フロー** — Recorder → 録画 (5 min) → 自動 transcript + chapters 生成 → タグ付け (Spec, Team:Frontend) → Workflow で Slack #frontend に自動投稿 → Analytics で視聴率モニタ → 未視聴者リマインド
- **CS の顧客デモフロー** — Recorder → 録画 → External shares で magic link 発行 + lead capture form 設定 → 顧客視聴 → Analytics で離脱箇所確認 → 次の follow-up
- **デザイナー/エンジニアの PR walkthrough フロー** — Figma / GitHub から拡張機能で Recorder → 録画 → コメント欄でタイムスタンプ議論 → 録画返信で双方向化
- **チーム招待フロー** — Onboarding/Invite → メール送信 → 招待先 Sign up → Workspace join → Home (Team feed) で welcome 動画自動表示

## 4. 画面一覧

| ID | 画面名 | 役割 | 主要機能 | 状態 |
|---|---|---|---|---|
| M-01 | Landing | 製品紹介と trial 誘導 | Hero / 視聴 ops の差別化説明 / Use case 切替 / Final CTA | -- |
| M-02 | Pricing | 3 tier 提示 | Tier card (Starter / Business / Enterprise) / 機能比較表 / FAQ | -- |
| M-03 | Use cases | 役割別の利用例 | Engineering / Product / CS / Leadership の 4 タブ + 動画埋め込み | -- |
| M-04 | Sign up CTA | 単独 trial 登録 | email form / SSO ボタン / 製品 mockup | -- |
| A-01 | Sign up | アカウント作成 | SSO (Google / Microsoft / Okta) / email + password / workspace 名 | error |
| A-02 | Sign in | ログイン | SSO / email / Forgot link | error |
| A-03 | Forgot password | リセット送信 | email form | success / error |
| A-04 | Email verify | メール確認待ち | countdown / resend / wrong email 修正 | -- |
| O-01 | Welcome | 新規歓迎 | 3 action card (Watch demo / Record now / Invite team) | -- |
| O-02 | Workspace setup | workspace 基本情報 | logo / domain / SSO 設定 / 業種選択 | error |
| O-03 | Install recorder | 録画ツール導入 | Chrome 拡張 / Desktop app の DL link + 設定確認 | -- |
| O-04 | Invite team | 初期招待 | email 一括 / 招待 link コピー / Slack import | -- |
| O-05 | First recording walkthrough | 初回録画ガイド | 3 step coach mark + 録画開始 CTA | -- |
| C-01 | Home | チームの非同期 feed | For you / Following / Team の 3 tab / unwatched バッジ / quick play | empty / loading |
| C-02 | Library | 動画一覧 | Personal / Team / All workspace の 3 階層 / grid + list 切替 / sort / filter / bulk action | empty / loading / error |
| C-03 | Recorder (mode select) | 録画モード選択 | Screen / Screen+Cam / Cam only / Audio only + countdown 設定 | -- |
| C-04 | Recorder (live) | 録画中 UI | カメラプレビュー / mute / pause / draw / countdown / quick cut | error |
| C-05 | Recorder (post-record) | 録画直後編集 | trim 両端 / cover 選択 / タイトル / タグ / 公開先 / 即時 share | loading |
| C-06 | Player | 動画再生 | 再生 / chapter ナビ / transcript / コメント / 分析 drawer / 速度 / CC | loading / error |
| C-07 | Player (comment compose) | コメント入力 | timestamp 自動付与 / mention / 録画返信 / emoji reaction | -- |
| C-08 | Comments inbox | コメント受信箱 | Mentions / Replies / Unwatched-by-me の 3 tab / mark as resolved | empty |
| C-09 | Analytics dashboard | 視聴オペレーション可視化 | 視聴率 / 未視聴者リスト / drop-off ヒートマップ / チーム別比較 / 期間切替 | empty / loading |
| C-10 | Analytics (video detail) | 動画単体の分析 | viewer リスト / watch progress bar / 離脱 timeline / コメント density | -- |
| C-11 | Workflows | 自動ルーティング | rule list (条件 → アクション) / 新規作成 wizard / 実行履歴 | empty |
| C-12 | Workflow editor | rule 編集 | trigger (tag / 視聴閾値 / mention) → action (Slack / リマインド / アーカイブ) | error |
| C-13 | External shares | 社外共有管理 | audience list / magic link / lead capture form / view tracking | empty |
| C-14 | External share detail | 共有先の詳細 | viewer ログ / lead 情報 / 共有設定変更 | -- |
| C-15 | Search | 横断検索 | transcript / タイトル / タグ / 人 / 期間の絞り込み + ヒット箇所プレビュー | empty / loading |
| S-01 | Profile | 個人情報 | avatar / display name / 通知 / 録画 default | -- |
| S-02 | Workspace | workspace 管理 | identity / branding / domain / SSO / 保存ポリシー | -- |
| S-03 | Members | メンバー / グループ | table / 招待 / role (Admin / Manager / Member / Viewer) / group 編集 | empty / loading |
| S-04 | Billing | 支払い | plan / seat 数 / usage グラフ / invoices / 解約 | error |
| S-05 | Integrations | 連携 | Slack / Notion / Linear / GitHub / Figma の接続状況と設定 | error |
| S-06 | Audit log | 監査 | event table / フィルタ / CSV export | empty |
| S-07 | Recording defaults | 録画初期値 | 解像度 / retention / watermark / consent 文言 | -- |
| ST-01 | Empty (Library) | 動画なし | 励まし copy + 「最初の 1 本を録る」CTA | -- |
| ST-02 | Loading (Recorder) | 録画準備中 | カメラ / マイクの permission 確認進行表示 | -- |
| ST-03 | Error (Upload failed) | アップロード失敗 | retry / ローカル保存案内 / サポート連絡 | -- |
| ST-04 | Permission denied | 共有 link 失効 | 状況説明 + 元発信者への request アクセス | -- |
| ST-05 | Maintenance | 計画停止 | 復旧予定時刻 / 進捗 link | -- |
| ST-06 | 404 | 存在しない page | back nav + 検索 / 最近の動画 | -- |

## 5. デザイン原則

- **トーン** — calm / focused / reassuring / human / quietly operational
- **想定する印象** — 「動画は撮ったら終わり」ではなく「ここに置けば届く」と思える、頼れる社内ツールの落ち着き。
- **避けたい印象** — Loom 的なカジュアル・ポップさで「軽い動画ツール」と見られてしまうこと、あるいは enterprise 臭の冷たい監視ツールに見えてしまうこと。本製品は「運用を支える静かな自信」を出す。
- **視覚原則**
  - density — Home / Library は medium、Analytics と Player の transcript は dense、Recorder / Onboarding は airy で迷わせない。
  - 視覚的重み — 1 画面につき dominant region は 1 つ (Library なら動画 grid、Player なら video player)。analytics の数値は dominant にしすぎず player と並列のコラボ素材として置く。
  - hierarchy — 視覚的重み = 重要度。未視聴・未読・未処理は明確に視覚的優位に、既読・既処理は静かに沈める。
  - 動画の主役性 — どの画面でも video thumbnail は文字より先に目に入る大きさを確保 (Home の card は 16:9 を 280px 以上で扱う)。
- **a11y 配慮** — WCAG AA 準拠、contrast 4.5:1 以上、focus visible を全 interactive に、transcript / 字幕は first-class でキーボードナビ可、reduced motion 設定時は player の自動アニメと録画 countdown のモーションを stilled に切替。

## 6. ブランド

### カラー

- **メイン** — 落ち着いた青緑系。集中と信頼を示しつつ、enterprise 臭の冷たい純青を避ける。Loom のオレンジ系カジュアルとも明確に距離を取る。
- **アクセント** — 暖かみのある温かいコーラル系を最小限。Record ボタン / primary CTA / 未視聴バッジに限定して使い、「動き出すべき場所」を視線が拾えるようにする。
- **success** — 落ち着いた緑。視聴完了 / 公開成功 / workflow 動作確認。celebration はしすぎず「届いた」を静かに告げるトーン。
- **warning** — マスタード寄りの黄。視聴率低下 / 録画長すぎ / retention 警告に使う。stop sign 的な強い警告ではなく「気付いてほしい」レベル。
- **error** — 明確に問題と分かる赤。ただし threatening でない柔らかい彩度に抑え、we 主語の文面と組み合わせる。
- **info** — 中立的なグレー寄りブルー。tips / システム告知 / undo の banner などで使用。
- **背景** — light / dark の両モード必須 (動画再生は dark が default、編集とライブラリは light が default)。
- **録画中 chrome** — recorder の live UI は黒ベースで動画品質を視覚的に裏切らない暗背景に。

### タイポグラフィ

- **heading** — geometric sans (Inter Display 系)。modern + readability、「動画タイトル」が dominant になる場面でも肥大化しない。
- **body** — Inter Regular。長文 transcript の可読性最優先、行間広めで video の隣に並んでも疲れない。
- **mono (数値表示)** — JetBrains Mono。Analytics の視聴率 / drop-off 時刻 / duration / timestamp コメントで使用、tabular numbers を有効化。

## 7. コンポーネント要件 (design system)

| component | variant | 使用意図 |
|---|---|---|
| Button | Primary / Secondary / Outline / Ghost / Destructive / Record (専用) — 各 sm/md/lg、default/hover/active/disabled/loading | action の hierarchy。Record ボタンは Primary とは別系統で「主役性」を明示 |
| IconButton | sm / md、circular / square、tooltip 必須 | player chrome / recorder chrome / toolbar |
| Input | text / email / password / search / textarea / select / tag input / OTP / @mention | form 入力と検索、tag input は library / workflow trigger で多用 |
| Card | video card (16:9 + meta + 視聴状態) / interactive / highlighted / featured / workflow card | content grouping、video card は dominant な視覚要素 |
| Badge | default / success / warning / error / info / new / unwatched / archived / external | status と category、unwatched は accent 色で 1 画面 1-2 個までに視覚抑制 |
| Avatar | 24 / 32 / 40 / 56 / 96、with status dot、stacked (+N) | user identity、Analytics の viewer リストと コメントで多用 |
| Modal | default / fullscreen / sheet / confirm | flow interruption、Recorder mode select は sheet で軽く |
| Toast | success / error / info / progress | feedback、upload progress / transcribe 完了通知に使用 |
| Dropdown | menu / select / nested menu | filter / sort / role 切替 |
| Tabs | underline / pill | Home の 3 tab / Comments inbox の 3 tab |
| Table | default / sortable / selectable / dense (Analytics) | Members / Audit log / Analytics viewer list |
| Player chrome | scrub bar / chapter bar / waveform / speed / CC / fullscreen / pip | 動画再生 UI、chapter は scrub bar の上層に並置 |
| Recorder chrome | countdown / mute / pause / draw / cam shape / quick cut | 録画中の最小限 UI、視覚負荷を下げる |
| Transcript pane | line / speaker / timestamp / highlight on play | player と双方向 sync、click でその時刻にジャンプ |
| Comment thread | top-level / reply / timestamped / video reply embed / emoji reaction | 議論を時間軸に anchor |
| Heatmap | drop-off / engagement | Analytics の動画タイムライン上に overlay |
| Empty / Loading / Error template | -- | first-class state UI、Recorder と Upload は専用 variant |
| Workflow node | trigger / condition / action / connector | workflow editor 専用 visual primitive |

## 8. 状態の網羅

- **Empty (Library)** — 「最初の 1 本がここに溜まり始める」と希望を示すコピー、Record now を Primary、Watch demo を Secondary で並置。「動画が無いのは出遅れている証拠」と思わせない。
- **Empty (Home / For you)** — チーム動画が無い時期は「Follow するメンバー」候補を提示し、孤独感を埋める。
- **Empty (Analytics)** — 「データはまだない」を悪い知らせにしない。「最初の動画を公開すると、ここに視聴の動きが現れる」と未来形で語る。
- **Loading (Recorder warm-up)** — カメラ / マイクの permission 状態を視覚化、「数秒で準備できます」と短期間を約束、ユーザーの session が「壊れていない」と分かる feedback。
- **Loading (Upload + Transcribe)** — 動画は手元から離れた瞬間が一番不安なので、進行率 / 残り時間 / 失敗時の自動 retry を明示。バックグラウンド継続可。
- **Error (録画失敗 / Upload 失敗)** — we 主語、「録画は端末に保存されています」と最重要情報を最初に。retry / save locally / contact support の 3 択を均等提示し、データロスの恐怖を下げる。
- **Error (Playback failed)** — 「ネットワーク / ブラウザ / 元動画」のどれが原因かを推測表示、必ず代替 (transcript / DL link) を残す。
- **Success (録画公開)** — 「視聴がここから始まります」と次のステージへ案内、celebration は短いマイクロアニメーションで控えめに。Workflow 自動投稿が走ったら、何処に投稿されたかを Toast で確実に示す。
- **Success (コメント送信 / Workflow 動作)** — undo を 5 秒間提示、間違って送信した心理コストを下げる。
- **Permission denied (共有 link 失効 / 退職者の動画)** — 「あなたに権限が無い」ではなく「この動画は現在アクセス制限されています」、required action (発信者にリクエスト送信) を 1 click で。
- **Pending verification (新規 SSO ドメイン / Workspace audit)** — 「処理中、通常 N 時間以内」と所要時間を明示、進行中に出来ることを 1-2 件提示。
- **Maintenance** — 計画停止時刻と復旧予定、ステータスページ link、影響範囲 (録画のみ / 再生のみ / 全体) を分かるように。

## 9. 制約・要件

- **a11y** — WCAG AA target、player は AAA を目指す (字幕 / transcript / キーボード操作完備 / focus visible / screen reader 対応 / reduced motion 切替 / 色覚多様性で red/green 単独依存禁止)。
- **responsive** — desktop (1440+) を first-class、laptop (1280+) / tablet (768+、Library と Player は使用可、Recorder は限定) / mobile (375+、視聴とコメントのみ、Recorder は別 native アプリ前提)。
- **platform** — web app (本仕様書のスコープ)、Chrome 拡張 (Recorder の入口)、Desktop app (Mac / Windows、高品質録画用)、native viewer app (iOS / Android、視聴 + コメントのみ Phase 2)。
- **regulation** — GDPR / CCPA (cookie consent + データ削除フロー)、SOC 2 Type II 準拠目標 (audit log / DLP / SSO / 暗号化必須)、video データの retention 設定はワークスペース管理者が制御。
- **security / compliance** — SSO (SAML / OIDC) 標準対応、IP allowlist (Business+)、video watermark (動的に viewer email を埋め込み、Enterprise)、DLP (機密タグ動画の外部共有禁止)。
- **language** — default 英語、日本語完全対応 (UI 全体 + transcript 多言語生成)、追加言語 (ES / FR / DE / ZH-CN) は Phase 2、字幕は自動生成 + 翻訳。
- **performance** — Player は first frame 1.5s 以内、Library 100 件 grid は LCP 2.5s 以内、Recorder warm-up は 2s 以内、Analytics dashboard は 30 日範囲で 3s 以内に target。
- **既存 design system 参照 (任意)** — 本仕様書の生成時点では参照無し。pencil-design 実行時に既存トークンがあれば指定可能。

## 10. 次の作業

本仕様書を元にデザインを生成するには:

```bash
/pencil-design design/specs/replay.md
```

仕様書が SSOT。
修正は本 file を編集して再生成する。
