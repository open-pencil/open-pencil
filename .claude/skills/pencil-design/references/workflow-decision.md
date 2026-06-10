# Workflow Decision Tree (inkly CLI 経路)

新規 task を受け取ったときの判断分岐 SSOT。
公式 Workflow §1-8 + DECISION POINT を inkly CLI に置換。

## Step 0: 環境セットアップ

```bash
INKLY=/Users/cardene/Desktop/projects/pencil-editor/packages/cli/dist/index.mjs
test -f $INKLY && echo "inkly CLI ready" || echo "inkly CLI not found"
bun --version  # bun 必須
```

## Step 1: 対象ファイル確認 / 作成

```bash
FILE=/path/to/design.fig  # 既存 file
ls -la $FILE
```

新規作成の場合 — inkly は完全空ファイルから作れないので既存 .pen / .fig を base に派生:

```bash
# パターン A: 既存 .pen を base に新 .fig 書き出し (内容は eval で全削除)
BASE=/Users/cardene/Desktop/.../some.pen
NEW=/path/new.fig
bun $INKLY eval --code "
  const page = figma.currentPage
  for (const c of [...page.children]) c.remove()
  page.name = 'New Design'
" -o $NEW $BASE

# パターン B: 既存 .fig template をコピー
cp /path/template.fig /path/new.fig
```

## Step 2: editor state 取得

```bash
bun $INKLY info $FILE        # page / node 数 / font / type 別分布
bun $INKLY pages $FILE       # page 一覧
bun $INKLY variables $FILE   # design token
```

## Step 3: 設計タイプ判定

ユーザー指示から **最も狭いタイプ** を選ぶ:

| キーワード | タイプ | references |
|---|---|---|
| LP / ランディング / マーケ / hero / pricing page | landing-page | `landing-page.md` |
| iOS / Android / mobile / アプリ画面 | mobile-app | `mobile-app.md` |
| ダッシュボード / 管理画面 / web アプリ / CRM / SaaS | web-app | `web-app.md` |
| スライド / 資料 / プレゼン / deck | slides | `slides.md` |
| コンポーネント / デザインシステム / token | design-system | `design-system.md` |
| .fig → React / Tailwind / コード生成 | code or tailwind | `code.md` / `tailwind.md` |

複合する場合 (例 「LP の dashboard preview」):
- 主タイプ — landing-page、 副タイプ — web-app (preview 部分のみ参照)

## Step 4: Decision Point — Creative vs Compositional

### A) Creative design task (大半)

- screen / page / dashboard / LP / web app / slide / mobile app の新規設計
- 特定 style / aesthetic / mood の指定
- blank canvas / scratch design
- variation explore

→ 該当タイプの `references/{topic}.md` を Read
→ `references/general-rules.md` + `references/figma-plugin-api-quirks.md` を Read

### B) Compositional task (簡単な追加)

- 「ボタンを追加」「カードを 1 つ insert」「要素を移動」
- 既存 component の arrange、 styling じゃない

→ `references/general-rules.md` + `references/figma-plugin-api-quirks.md` のみ Read

判断に迷ったら A を採用。

## Step 4.5: 自動分割 (v2 新規、 仕様書起動時のみ)

仕様書を渡された場合 (Step 3a 経路) は § 4 画面一覧の行数 N から `.fig` の分割を自動決定する。

```
N (画面数) を確定
        │
        ▼
   ┌────┴────┐
   │ N <= 15 │ ──→ 1 file (<product>.fig)
   ├─────────┤
   │ 16-30   │ ──→ 2 file (<product>-core.fig / <product>-others.fig)
   ├─────────┤
   │ N >= 31 │ ──→ 3 file (<product>-core.fig / <product>-marketing.fig / <product>-settings.fig)
   └─────────┘
        │
        ▼
   ユーザーに分割計画を「報告」のみ (file 数判断はユーザーに振らない)
        │
        ▼
   各 file ごとに Step 5 以降を独立に実行
   (各 file 内で 1 eval 完結、 file 間で page 上書きなし)
```

### scope 割当の標準

| file | 担当 prefix | 例 (画面数) |
|---|---|---|
| `<product>.fig` (1 file 完結) | 全画面 | 全 N |
| `<product>-core.fig` | C-* (Core) | C-01 .. C-N |
| `<product>-marketing.fig` | M-* + A-* + O-* | M-01..M-N + A-01..A-N + O-01..O-N |
| `<product>-others.fig` (2 file) | C-* 以外全て | M-* + A-* + O-* + S-* + ST-* |
| `<product>-settings.fig` | S-* + ST-* | S-01..S-N + ST-01..ST-N |

prefix が異なる場合は仕様書から画面の役割を解釈して同等のグルーピングを作る (例 `Dashboard-` `Account-` 等)。

### 報告フォーマット

```
仕様書 41 画面を 3 file に分割します。
- replay-core.fig: 15 画面 (C-01 .. C-15)
- replay-marketing.fig: 13 画面 (M-01..04 + A-01..04 + O-01..05)
- replay-settings.fig: 13 画面 (S-01..07 + ST-01..06)

各 file ごとに reviewer subagent で fix_proposals = 0 まで詰めてから .pen 変換します。
```

ユーザーに「何 file に分けますか」を訊かない (Step 4.5 で自動決定)。

## Step 5: 既存 layout / variable 把握

```bash
bun $INKLY tree $FILE --depth 3
bun $INKLY find $FILE --type COMPONENT   # 再利用 component 一覧
bun $INKLY variables $FILE --json        # token を JSON で取得
```

新規 screen は **既存 screen 上に重ねない**。 `tree` で既存座標を確認して空白領域に配置。

## Step 6: eval code 設計

JavaScript code を `/tmp/op-{section}.js` に書く。 section 単位で分割 (1 file = 1 section)。

各 file の構成:

```javascript
// /tmp/op-hero.js
const page = figma.currentPage
// ヘルパー定義
function hexToRgb(hex) { ... }
function setFill(node, hex, opacity) { ... }
function mkText(parent, content, opts) { ... }
function safeFrame(parent, opts) { ... }
// セクション作成
const hero = safeFrame(page.children[0], {
  name: "Hero",
  layout: "VERTICAL",
  primarySizing: "FIXED",
  counterSizing: "FIXED",
  width: 1440,
  height: 720,
  primaryAlign: "CENTER",
  counterAlign: "CENTER",
  itemSpacing: 28,
  padding: [120, 120, 120, 120],
  fill: "#0A0E18"
})
// 子要素
mkText(hero, "Headline", {size: 72, lineHeight: 82, style: "Bold", color: "#FFFFFF", align: "CENTER", width: 1200, height: 82})
// ...
console.log("Hero done")
```

## Step 7: eval 実行 (1 file = 1 eval 完結、 v2 厳格化)

```bash
# v2: 全 helpers + 全画面 + console.log を 1 つの JS file にまとめて 1 回の eval で完結
bun $INKLY eval --code "$(cat /tmp/<product>-<scope>-gen.js)" -o $FILE $BASE
# -o で base から新規生成、 -w 形式は 1 file あたり 1 回まで (複数回 -w は page 上書き)
```

v2 では複数 section 順次実行は **禁止** (`bun eval -w` を同 `.fig` に複数回呼ぶと page 上書き)。 helper は appendChild → resize → x/y の順で書き、 walk-fix は不要 (`figma-plugin-api-quirks.md` § appendChild 順序 参照)。

エラー出たら `references/figma-plugin-api-quirks.md` を読み返す。

## Step 8: 視覚検証 (overview + 個別)

```bash
# overview (全画面が並ぶ page 全体)
bun $INKLY export -f png -o /tmp/<product>-<scope>-overview.png $FILE

# 各画面個別 (node ID 取得後、 並列 export)
bun $INKLY tree $FILE --depth 1 | grep "Screen/"   # node ID 一覧
for nid in 0:4 0:117 0:237 ...; do
  cid=$(echo $nid | tr ':' '-')
  bun $INKLY export -f png --node "$nid" -o /tmp/<product>-<scope>-${cid}.png $FILE &
done
wait
```

その後 Read で画像として ingest (base64 直接処理しない)。

## Step 9: reviewer subagent + fix_proposals = 0 ループ (v2 厳格化)

Step 8 後に **必ず** Agent tool で reviewer subagent を起動 (`references/reviewer-checklist.md` § Reviewer agent 参照)。 JSON で返る `fix_proposals` が空になるまでループ。

| 制約 | 値 |
|---|---|
| 1 file あたり最大 round | 5 |
| ループ終了条件 | `fix_proposals` が全画面で空 (overall PASS だけでは終わらせない) |
| skip マーキング trigger | 同じ fix proposal が 2 round 連続で出現 |
| skip マーキング先 | `<repo>/.context/pencil-design/<product>-<scope>-fix-state.md` |
| 5 round 到達時 | AskUserQuestion で「続行 / 残件 skip / 中断」 |

## Step 10: 完了処理 (file 単位 → 全 file 統合)

```bash
# 各 .fig が fix_proposals = 0 になり次第 .pen 変換
bun $INKLY convert $FILE -o ${FILE%.fig}.pen

# 全 file 揃ったら lint で一貫性チェック (任意)
bun $INKLY lint $FILE
```

完了報告は `references/reviewer-checklist.md` § 完了報告テンプレート (v2) に従う。

## 分岐サマリ (v2)

```
[Step 0: 環境 (bun + inkly path)]
       ↓
[Step 1: ファイル確認 / 新規派生]
       ↓
[Step 2: info / variables 取得]
       ↓
[Step 3: タイプ判定] → references/{topic}.md
       ↓
[Step 4: Creative (A) or Compositional (B)]
       ↓
[Step 4.5: 自動分割 (仕様書起動時のみ、 N 画面 → 1/2/3 file)]
       ↓
[Step 5: tree / find で既存把握]
       ↓
─── ↓ 以下、 各 .fig file ごとに繰り返す ────────────────
       ↓
[Step 6: eval code 設計 (全 helpers + 全画面 1 file 完結、 appendChild → resize → x/y)]
       ↓
[Step 7: bun eval -o で 1 回生成] ← quirks.md 再読、 複数 eval -w 禁止
       ↓
[Step 8: overview + 個別 PNG export → Read]
       ↓
[Step 9: reviewer subagent → fix_proposals = 0 ループ (最大 5 round、 skip マーキング)]
       ↓
[Step 10: .pen 変換 (file 単位)]
       ↓
─── ↑ 次の file に進む ───────────────────────────
       ↓
[全 file 完了 → 完了報告 (v2 テンプレート)]
```
