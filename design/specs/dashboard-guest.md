# Inkly Dashboard for Guest (External Invitee) デザイン仕様書

## 1. プロダクト概要

- ビジョン ... 招待を受け取った外部ユーザーが「自分が招かれた board だけ」 を迷いなく開ける、 余計なものが何もない来訪者向けの場所をつくる。
- ミッション ... jfet の内部メンバー向けの全機能 dashboard と切り離して、 ゲスト用に boards 一覧 / team 機能 / 新規作成 / 管理機能を一切見せず、 「あなたが招待された board」 だけが視覚的に主役になる画面を提供する。
- 解決する課題 ... 既存の dashboard はメンバー向けの機能 (新規 board 作成 / team 管理 / 通知 全件 / admin) が並んでおり、 招待された人が開くと「自分には関係ない選択肢」 が大量に見えて迷う。 また「自分のための場所」 ではないという疎外感を与える。
- 既存代替手段と限界
  - Figma 共有リンク ... 編集権限は持てるが共有相手は Figma アカウントを持っていない場合のオンボーディングが重い。
  - Google Drive 共有 ... 「リンクを知っている全員」 になりがちでセキュリティ上の懸念。
  - Notion ゲスト ... ゲスト経験はあるが design tool ではないので board 内容を直接編集できない。
- 製品の差別化価値 ... Inkly Guest Dashboard は「招待 redeem 直後のゲストでも、 自分が招かれた board をひと目で見つけて、 そのまま編集に入れる」 ことを最短のクリック数で実現する、 余計な機能を削ぎ落とした招待者専用ビューを提供する。

## 2. ユーザーリサーチ

### ペルソナ

- 名前 ... 高井 颯太 (Sota Takai)
- 役職 / 立場 ... jfet と取引のある外部デザインエージェンシーのアートディレクター、 30 代後半
- 1 日の流れ ... 朝、 jfet 担当 PM からメールで招待 URL を受け取る、 自社の Figma を閉じて Inkly を初めて開く、 数枚のラフを共同編集してフィードバック、 翌日もまた招待 URL からアクセスする。
- 主要痛み ... 自分の主戦場ではないツールに毎回入るたびに「自分は何にアクセスできるのか」 を確認するコストが高い、 余計な機能が並んでいるとどれを触ってよいか分からない、 jfet の社内事情 (チーム / 管理) が見えても困る。
- 既存代替手段への満足度 ... Figma を取引先別に切り替えるのは Figma アカウントが必須で煩雑、 jfet 専用の閲覧場所が欲しい。

- 名前 ... 林 美咲 (Misaki Hayashi)
- 役職 / 立場 ... jfet の業務委託ライター、 20 代後半
- 1 日の流れ ... 週に 2-3 回 jfet から共有される board に文言レビューコメントを書く、 普段は Notion と Slack。
- 主要痛み ... ツールを毎回覚え直したくない、 「ログインしたら自分の board がぱっと出る」 だけでよい、 他の機能は触らない。

### User Story

- As an external invitee, I want to see only the board I was invited to, so that I don't get distracted by features that don't apply to me.
- As an external invitee, I want to open the invited board in one click, so that I can resume the design discussion without navigation.
- As an external invitee, I want to know who invited me and what role I have, so that I understand my context within the host organization.
- As an external invitee, I want to switch language without losing my work, so that I can comfortably use the tool in my preferred locale.
- As an external invitee, I want to sign out cleanly, so that my shared device does not leak my context.

### Jobs to be Done

- When I open `/dashboard` after redeeming an invitation, I want to see only the board I was invited to, so I can pick up immediately.
- When I get multiple invitations from the same host, I want them listed together, so I can switch between them without navigation.
- When I accidentally try to navigate to internal areas, I want a clear permission-denied message, so I understand why I can't access certain pages.
- When I want to leave or come back later, I want a visible sign-out control, so I can manage my session intentionally.

## 3. 情報設計 (IA)

### サイトマップ

- `/dashboard` (本仕様の対象画面、 guest 向けバージョン)
  - Top app bar (Inkly logo / notifications bell / locale switcher / customize button / avatar with email tooltip / sign out)
  - Welcome strip (短い 1 行 ヘッドライン、 例「{name} さん、 ようこそ」)
  - Invited boards section (招待された board のカード一覧、 1 件のときも grid フォーマット維持)
  - Empty fallback (board に対しての招待が解除されている場合の説明)
- guest が誤って到達した場合の他画面 (本仕様の範囲、 「権限なし」 として表示)
  - `/boards` `/teams` `/team/:id` `/notifications` `/account` `/admin` → 全て「アクセス権限がありません」 共通画面 (PermissionDeniedView)
- guest がアクセス OK の画面 (本仕様の範囲外、 リンク先として言及)
  - `/board/:id` ... 招待された board のエディタ (role に従い編集可能)

### 主要ユーザーフロー

- 招待 redeem 後の初回フロー ... `/invite/:token` → sign-up → `/board/:id` に遷移して即編集 → 一度閉じて翌日また `/dashboard` を開く → invited boards section にカードが出ている → クリックで再びエディタへ。
- 通知トリアージ (招待された board 上の変更通知のみ) ... bell アイコンクリック → 招待 board に絞った通知一覧 (jfet 全体の通知ではない) → 関連 board へ jump。
- 言語切替 ... locale switcher で ja / en / 7 ロケールを変更 → SPA 内で即時反映。
- sign out ... avatar menu → sign out → LP に戻る。
- 誤遷移 ... URL 直打ちで `/boards` 等にアクセス → PermissionDeniedView が出る → 「招待された board を開く」 ボタンで `/dashboard` に戻る。

## 4. 画面一覧

| 画面 ID | 画面名 | 役割 | 主要機能 | 主要要素 | 状態網羅 | 関連画面 |
|---|---|---|---|---|---|---|
| G-1 | Guest Dashboard | 招待された board だけを見せる起点 | 招待 board 一覧 / 通知 / 言語切替 / customize / sign out | top bar + welcome strip + invited boards grid + empty fallback | empty (招待が revoked など 0 件) / loading / error / success / locale switching / sign-out confirm | /board/:id (招待された board のエディタ) |
| G-2 | Permission Denied | guest が誤って制限ページに来たときの説明 | アクセス権限の説明 + dashboard に戻るリンク + sign out | 中央コンテナ + ヘッドライン + 説明 + cta 2 つ | static (固定表示) | /dashboard |

## 5. デザイン原則

- トーン ... welcoming / quiet / restrained。 jfet 内向け dashboard が「professional / quiet / focus」 だったのに対し、 guest 向けは「welcoming」 を 1 段強くする (外部の人を迎える場所のため)。
- 想定する印象 ... 「自分のホームではないが、 親切に整えてくれた場所」 「余計な選択肢がない安心感」。
- 避けたい印象
  - jfet 内部資料感 (社内ツール感) を直接見せる印象。
  - 招待された人を「お客様あつかい」 し過ぎる丁寧すぎる装飾。
  - jfet 内部 dashboard より「機能が劣っている」 と感じさせる劣等感。
  - 「ここで何を触ってよいか分からない」 という曖昧さ。
- 視覚原則
  - centered single-purpose ... 招待 board のカードを画面中央に大きく配置、 周囲は余白。
  - subtle warmth ... 内部 dashboard の cool palette より 1 段だけ温度を上げる (avatar や welcome ヘッドラインに微温色)。
  - minimal nav ... sidebar 不在、 top bar も必要最小限。
  - clear absence ... 機能が無いことを「グレーアウト」 ではなく「最初から無い」 で示す。 ボタンを置いて disabled にしない。
- a11y 配慮
  - WCAG AA 4.5:1 を全 text に確保。
  - sign out / locale / notifications にすべてキーボードで到達可能。
  - PermissionDeniedView は screen reader で「あなたはこのページにアクセスする権限がありません」 を最初に読み上げる。

## 6. ブランド

### カラー

- メイン (canvas / surface) ... jfet 内部 dashboard と同じ neutral grey、 ただし背景中央に放射状の薄い暖色グラデーション (5% 程度) を追加して「迎える」 印象を出す。
- アクセント (action) ... 既存 Inkly accent (青寄り purple) を踏襲。
- avatar ランダムカラー パレット (Notion / Slack 型 8-10 色) ... email hash で固定割当、 同じ user は常に同じ色。
  - rose / coral / amber / yellow / lime / teal / sky / indigo / violet / pink の 10 色。
  - 各色は彩度を 1 段落とした muted トーン (派手にしない)、 dark bg 上でも視認可能。
- success / warning / error ... 既存 token をそのまま。
- 内部 dashboard との差別化 ... 背景の温暖グラデーションが「guest 専用」 のサイン、 内部 user はクールな radial only、 guest はわずかな warm を加える。

### タイポグラフィ

- heading ... 内部 dashboard と同一 (Inter semibold)、 ただし welcome strip だけ少し大きいサイズで「あなたへ向けた言葉」 を強調。
- body ... 同上。
- mono ... 不要 (guest はメトリック数値を見ない)。
- 多言語 ... 内部と同じ全 8 ロケール + en、 default は invitee の Accept-Language または ja。

## 7. コンポーネント要件 (design system)

- Top App Bar (Guest variant)
  - 左 ... Inkly wordmark (jfet ロゴは出さない、 invitee に「これはどの会社のツールか」 を強要しない)。
  - 右 ... notification bell (招待 board 関連のみ) / locale switcher / customize button / avatar (random color + initial + email tooltip on hover) / sign out menu。
  - 中央 ... なし (検索バーは guest には出さない、 boards 一覧が無いため検索する対象がない)。
- Welcome Strip ... 1 行のヘッドライン「{name} さん、 ようこそ」 + 副文「{inviter} さんから {count} 件のボードに招待されています」。 background は subtle gradient strip。
- Invited Board Card ... thumbnail (16:10) + board name + inviter 名 (avatar + 名前) + role badge (editor / viewer / commenter) + last activity timestamp。 hover で 1px 浮き、 クリックで `/board/:id` に遷移。 1 件のみのときも grid を使い、 中央に 1 枚浮かせる。
- Avatar (Guest variant) ... 32-40 px、 random color background (上記パレットから email hash で固定選択) + 大文字 initial 1 文字 (英字または日本語 1 文字)。 hover で email を tooltip 表示。
- Permission Denied Card ... 中央配置の card + 鍵アイコン + ヘッドライン「アクセス権限がありません」 + 説明「招待された board だけが閲覧可能です」 + cta 2 つ (「招待されたボード一覧へ」 / 「サインアウト」)。
- Locale Switcher ... 既存 component を流用、 guest でも変更可能。
- Notification Bell ... 既存 component、 ただし内容は「招待された board 上の変更」 にフィルター。
- Customize Button ... section の表示順保存 (1 セクションしか無くても customize 自体は出して機能差を最小化、 ユーザー期待を裏切らない)。
- Empty Illustration ... 線画のシンプルなイラスト (例 鍵を持つ人) + 「招待されているボードがありません」 + 「招待された方は招待 URL から再アクセスしてください」 文言。

## 8. 状態の網羅

- Empty (招待された board が 0 件、 例 招待が revoked された) ... empty illustration + 「招待されているボードがありません」 + 「招待 URL から再度アクセスしてください」 + 「サインアウト」 ボタン。
- Loading ... welcome strip と board grid を skeleton で表示、 calm pulse、 3 秒以上で「サーバーから取得中」 文言追加。
- Error ... 「招待ボードを読み込めませんでした」 ヘッドライン + 「もう一度試す」 ボタン + 「サインアウト」 ボタン。 we 主語で書く。
- Success (通常 view) ... 招待 board grid を表示、 1 件のときは 1 枚を中央に大きく、 2 件以上は 2-3 列 grid。
- Permission denied (guest が `/boards` 等に到達) ... PermissionDeniedView を全画面で表示、 board content を絶対に描画しない。
- Locale switching ... switcher 切替時に skeleton を 200ms だけ表示して i18n re-render を視認可能に。
- Sign-out confirm ... avatar menu の「サインアウト」 クリックで小さな confirm dialog (「ボードのドラフトは自動保存されています、 サインアウトしますか?」) → 確定で LP へ。

## 9. 制約・要件

- a11y ... WCAG AA、 motion-reduced で animation を停止。
- responsive
  - desktop (1280+) ... welcome strip 上に 3 列 grid。
  - tablet (768-1279) ... 2 列 grid。
  - mobile (640 以下) ... 1 列 stack、 board card は full-width。
- ロケール ... ja / de / es / fr / it / pl / ru / zh-CN + en、 invitee の Accept-Language で初期決定、 locale switcher で変更可能。
- platform ... web のみ。
- 既存 design system 参照 ... `src/app.css` token + `packages/vue` primitives を流用、 guest 専用の追加 token は背景 warm gradient と avatar palette の 2 種のみ。
- guest 判定 ... email ドメインが `@jfet.co.jp` 以外、 かつ collaborators テーブルに userId 紐付けで board に参加している、 が条件。 jfet user は別仕様 `design/specs/dashboard-jfet.md` で扱う。
- 機能制限の実装方針
  - frontend ... router beforeEach で guest user が `/boards` `/teams` `/team/:id` `/notifications` `/account` `/admin` に到達したら `/dashboard` で PermissionDeniedView を表示するよう redirect、 nav links 自体を guest UI から削除。
  - backend ... 既存 ACL (board collaborator 判定) を維持、 加えて team / admin endpoint で guest user を 403 で reject。

## 10. 次の作業

- `/pencil-design design/specs/dashboard-guest.md` で本仕様書を読んで `.pen` ファイルを生成
- ペア仕様書 `design/specs/dashboard-jfet.md` も同時に `.pen` 生成して 2 種を比較
- 修正は本仕様書を編集して再生成、 仕様書を SSOT として扱う
