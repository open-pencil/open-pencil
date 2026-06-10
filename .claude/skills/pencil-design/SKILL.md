---
name: pencil-design
description: pencil-editor (inkly) CLI を使って .fig / .pen ファイルにデザインを生成・編集・検証する。headless で完結し、 editor app / MCP server 不要、 Pencil 公式 (pencil.dev) の system prompt と workflow を踏襲。引数に仕様書 path (例 design/specs/<product>.md) を渡すと仕様書を Read してデザインを生成する 2 段階フローに対応 (pencil-spec で仕様書生成 → pencil-design で実装)。仕様書なし起動も対応 (従来通り)。トリガー — .fig / .pen への画面追加 / 既存デザイン修正 / コンポーネント新規作成 / デザインからコード生成 / `design/specs/*.md` から実装。
---

# pencil-design

inkly CLI (`packages/cli/dist/index.mjs`) を Bash 経由で呼び、 完全 headless でデザインを操作する skill。
editor app / MCP server / WebSocket 接続は **不要**、 bun + CLI 1 本で完結する。
Pencil 公式 (pencil.dev) の closed-source MCP server に埋め込まれた system prompt を逆解析し、 同等品質を inkly 上で再現する。

## 1. 大前提 (絶対遵守)

| 規約 | 内容 |
|---|---|
| 経路 | inkly CLI を Bash で都度起動、 editor app / MCP は不要 |
| runtime | **bun 必須** (node では `Bun is not defined` で fail) |
| ネイティブ document | **`.fig`** (read/write 可) ※ `.pen` は read-only |
| 課金 | terminal claude (interactive subscription) のみ消費、 6/15 以降の Agent SDK credit pool を消費しない |
| ファイル直読み禁止 | `.fig` / `.pen` は暗号化、 Read / Grep / cat ではなく inkly CLI 経由で操作 |
| **1 file = 1 eval = 1 .fig (CRITICAL)** | 同一 `.fig` に対する `bun eval -w` の複数回呼び出しは **禁止** (page 上書きされ過去成果が消える、 stride 27 画面で実機検証済)、 1 つの `.fig` = 全 helpers + 全画面 + 1 eval call で完結 |
| **大規模時は複数 .fig 分割 (CRITICAL)** | 15 画面以下 = 1 file、 16-30 = 2 file、 31+ = 3 file に **自動分割** (詳細は § 3 Step 4 と `references/workflow-decision.md` § 4)、 各 file 内で 1 eval 完結 |
| **helper 順序 (CRITICAL)** | rect / txt は `appendChild → resize → x/y` の順で作る (walk-fix 不要、 順序を逆にすると child の座標が壊れる、 詳細は `references/figma-plugin-api-quirks.md` § appendChild 順序) |
| **emoji 禁止 (CRITICAL)** | 🔔 🔍 ⏸ ▶ 等 emoji は Inter フォントで `\|` 縦棒に化ける (replay 41 画面で実機検証済)、 letter monogram の `iconBox` か rect 2 個の三角形で代替 (詳細は § 7 icon 代替パターン) |
| **transparent fill 禁止** | card / button / input の fill は **必ず明示 hex 指定** (default 透明だと reviewer 不合格)、 stroke も `#CBD5E1` (slate-300) 以上で明示 |
| **ID tag 2 箇所必須** | 各 frame の外左上 + 内左上 dark badge の 2 箇所に `<画面ID>` text を配置、 reviewer 識別 (overview) と個別 export (frame 内) 両対応 |
| **fix_proposals = 0 ループ (CRITICAL)** | reviewer の JSON `fix_proposals` が空でない限り次ラウンド、 overall PASS でも回す、 1 file あたり最大 5 round、 5 で 0 に到達しなければユーザーへエスカレーション (詳細は § 3 Step 11 と `references/reviewer-checklist.md`) |

## 2. inkly CLI 基本構造

```bash
# 環境変数で path を固定
INKLY=/Users/cardene/Desktop/projects/pencil-editor/packages/cli/dist/index.mjs

# 主要 command (全て bun で実行)
bun $INKLY info <file>                  # ドキュメント情報 (page / node 数 / font)
bun $INKLY tree <file>                  # node 木構造
bun $INKLY find <file> --name "..."     # name で検索
bun $INKLY query <file> --xpath "..."   # XPath 検索
bun $INKLY node <file> --id <id>        # node 詳細
bun $INKLY variables <file>             # design token 列挙
bun $INKLY pages <file>                 # page 一覧
bun $INKLY selection                    # 起動中 app の選択 (app 起動時のみ)
bun $INKLY eval --code "<JS>" -w <file> # JS で編集 (Figma plugin API)
bun $INKLY eval --code "<JS>" <file>    # JS で読込 (write しない)
bun $INKLY export -f png -o <out> <file># PNG export (jpg / webp / svg / pdf / jsx も可)
bun $INKLY lint <file>                  # 一貫性チェック
bun $INKLY analyze <file>               # token / spacing / typography 分析
bun $INKLY convert <file> -o <out>      # フォーマット変換
```

詳細は `references/inkly-cli-cookbook.md` を Read。

## 3. 起動時の作業フロー

### 3a. 仕様書 path 指定起動 (Recommended、 pencil-spec 連携)

引数に `design/specs/<product>.md` のような markdown 仕様書 path が指定された場合:

```
Step 1. 仕様書 Read           Read design/specs/<product>.md
Step 2. 仕様書解析            プロダクト概要 / ペルソナ / IA / 画面一覧 / デザイン原則 /
                              ブランド / コンポーネント / 状態 / 制約 の 9 部構成を解釈、
                              **画面数 N を確定** (§ 4 画面一覧 table の行数)
Step 3. 設計タイプ判定        仕様書の業種・カテゴリから自動判定
                              (full-app / single-lp / single-dashboard / mobile / slides 等)
Step 4. file 分割計画 (v2 新規) 画面数 N から自動分割 (詳細は § 3 Step 4 詳細 と
                              references/workflow-decision.md § 4 自動分割)
                              N <= 15 → 1 file (replay-<product>.fig)
                              16 <= N <= 30 → 2 file (-core / -others)
                              N >= 31 → 3 file (-core / -marketing / -settings)
                              各 file の画面割当を確定、 ユーザーには分割計画のみ報告
                              (file 数の判断はユーザーに振らない)
Step 5. references Read       該当タイプの reference を Read
                              (web-app.md / mobile-app.md / landing-page.md / design-system.md 等)
Step 6. 各 .fig を順次生成    file 1 → file 2 → file 3 の順で以下を file ごとに繰り返す:
                              a) base file copy (cp stride.fig design/<product>-<scope>.fig)
                              b) generation script を /tmp/<product>-<scope>-gen.js に作成
                                 (全 helpers + 該当 scope 全画面 + console.log で完結)
                              c) bun $INKLY eval --code "$(cat /tmp/<product>-<scope>-gen.js)" -o <fig> <base>
                                 で 1 eval 完結
                              d) bun $INKLY export -f png -o /tmp/<product>-<scope>-overview.png <fig>
                                 で overview PNG を Read で確認
                              e) 各画面の個別 PNG を export
                                 (bun $INKLY tree --depth 1 で node ID 一覧取得 → 並列 export)
                              f) Step 10-11 (reviewer + fix loop) を file 単位で実行、
                                 fix_proposals = 0 まで詰めてから次 file へ進む
                              **重要**: helper は appendChild → resize → x/y の順で作る
                              (walk-fix 不要、 順序を逆にすると child の座標が壊れる)
                              **重要**: emoji は使わず iconBox / rect 三角形で代替
                              (詳細は § 7 icon 代替パターン)
                              **重要**: ID tag は frame 外と内 dark badge の 2 箇所に配置
                              (overview 識別 + 個別 export 識別の両対応)
Step 7. .pen 変換             各 .fig が file 単位で fix_proposals = 0 になり次第、
                              bun $INKLY convert <fig> -o <pen> で .pen 出力
Step 8. 全 file 完了確認      全 .fig + .pen が揃ったか、 reviewer 結果 JSON が
                              fix_proposals = 0 で揃ったかを最終確認
Step 9. 完了報告              file 数 / 画面数 / 全 PASS 件数 / skip マーキングした項目を正直に列挙
                              (skip マーキング詳細は § Step 11 と
                              references/reviewer-checklist.md § skip 規約)
Step 10. レビュー (CRITICAL)  Step 6.f の subroutine、 Agent tool で reviewer subagent 起動
                              (references/reviewer-checklist.md 参照)
                              各画面 7 項目で PASS/NG 判定 + fix_proposals 抽出、 JSON で返す
Step 11. 修正ループ (v2 厳格化) Step 6.f の subroutine、 fix_proposals = 0 まで詰める:
                              - overall PASS でも fix_proposals が空でない限り次ラウンド
                              - 1 file あたり最大 5 round
                              - 同じ proposal が 2 round 連続で出たら fix_state.md に skip 理由
                                (out-of-scope / 構造不可能 / 仕様書外) を記録、
                                次ラウンドの reviewer prompt に「前ラウンドで skip した項目: ...」を渡し
                                再提案を抑止
                              - 5 round で 0 件に到達しなければユーザーへエスカレーション
                                (AskUserQuestion で「未解決 N 件、 続けますか / skip しますか / 中断」)
```

### Step 4 詳細: 自動分割 (v2 新規)

画面数 N から `.fig` の分割を自動決定する。 ユーザーに「何 file に分けますか」を訊かない。

| N (画面数) | file 数 | file 名 例 | scope 分割例 |
|---|---|---|---|
| 1-15 | 1 file | `<product>.fig` | 全画面 |
| 16-30 | 2 file | `<product>-core.fig` / `<product>-others.fig` | core 機能 / 残り (Marketing+Auth+Onboarding+Settings+States) |
| 31+ | 3 file | `<product>-core.fig` / `<product>-marketing.fig` / `<product>-settings.fig` | Core / Marketing+Auth+Onboarding / Settings+States |

scope 割当の標準:
- **core file** — 仕様書 §4 画面一覧で `C-` prefix の画面 (アプリ本体の中核機能)
- **marketing file** — `M-` (Marketing LP / Pricing / Use cases) + `A-` (Auth) + `O-` (Onboarding)
- **settings file** — `S-` (Settings) + `ST-` (States、 Empty / Loading / Error / Permission denied / Maintenance / 404)

prefix が異なる場合は仕様書から画面の役割を解釈して同等のグルーピングを作る (例 `Dashboard-` `Account-` 等)。

ユーザーへの報告は分割計画の **通知のみ** (file 数の判断はユーザーに振らない):

> 仕様書 41 画面を 3 file に分割します — core (15) / marketing (13) / settings (13)。

### Step 10 詳細: 生成後レビュー (v2)

各 file の生成 (Step 6.c-e) 後に **必ず** Agent tool で reviewer subagent を起動する。 PNG export を AI が直接見るバイアスを避け、 独立 subagent に references/reviewer-checklist.md 通りに採点させる。

```
Agent({
  description: "<product>/<scope> N 画面の品質レビュー (round K)",
  subagent_type: "general-purpose",
  prompt: `
仕様書: design/specs/<product>.md
overview PNG: /tmp/<product>-<scope>-overview.png
各画面 PNG: /tmp/<product>-<scope>-<screen-id>.png

前 round で skip マーキングした項目 (再提案禁止):
- <screen-id>: <skip した fix proposal の要旨> (理由 — out-of-scope / 構造不可能 / 仕様書外)
(初回 round は「なし」と書く)

references/reviewer-checklist.md の 7 項目で各画面を採点して JSON で返す:
{
  "results": [
    {"id": "M-01", "overall": "PASS|NG", "checks": {...}, "fix_proposals": ["..."]},
    ...
  ],
  "summary": {"pass_count": N, "ng_count": M, "critical_issues": [...]}
}

採点基準は「シニアデザイナーがギリギリ顧客に出せる」レベル。
fix_proposals は overall PASS でも残してよい (minor 改善案も列挙)、
skip マーキング済みの項目は再提案しない。
`
})
```

### Step 11 詳細: 修正ループ (v2 厳格化)

reviewer の JSON から `fix_proposals` を読み、 **0 件になるまで** 次ラウンドを回す。 overall PASS でも fix_proposals が空でない限り完了にしない。

| 制約 | 値 |
|---|---|
| 1 file あたり最大 round | 5 |
| skip マーキング trigger | 同じ fix proposal が 2 round 連続で出現 |
| skip マーキング先 | `<repo>/.context/pencil-design/<product>-<scope>-fix-state.md` |
| 5 round 到達時 | AskUserQuestion でユーザーにエスカレーション (続行 / 残件 skip / 中断) |
| エスカレーション禁止経路 | 「ここで完了します」「動作実証として成立」「skeleton で完成扱い」等の妥協報告 |

fix_state.md schema (Markdown table 形式):

```markdown
# <product>/<scope> fix-state

| screen | round | skip 内容 | 理由 |
|---|---|---|---|
| O-01 | 3 | sub-label を絵文字 ▶ にする | inkly emoji glyph 不在で代替不可、 letter monogram で既に対応済み |
| M-02 | 4 | FAQ 6 件に拡張 | 仕様書 §4 画面一覧に 4 件と明記、 仕様書外 |
```

skip した項目は次ラウンドの reviewer prompt 内に「前 round で skip マーキング済み (再提案禁止)」として渡す。

修正ループの体感目安:
- 1 round 目 — overall NG が複数 → fix_proposals を全部反映
- 2-3 round 目 — overall は PASS だが minor fix_proposals が残る → 1 件ずつ潰す
- 4-5 round 目 — 残る fix_proposals は仕様書外 or 構造不可能 → skip マーキング

### 完了報告の正直さ義務

完了報告は以下のフォーマット必須:

```
✅ N 画面 PASS / M 画面 NG (理由付き) / 合計 27 画面

PASS 画面:
- M-01 Marketing/Landing
- C-01 Core/Home
- ...

NG 画面 (修正試行 3 回失敗):
- C-04 Core/Evaluations: テーブルの行が描画されない (修正試行で改善せず)
- ...

総合判定: <全画面 PASS なら 「完成」 / 1 件でも NG なら 「部分完成、 NG 画面はユーザーが pencil-editor で手修正が必要」>
```

**禁止表現**:
- 「動作実証としては成立」
- 「skeleton で完成扱い」
- 「placeholder のままで OK」
- NG を「PASS」と report する
- NG 件数を隠す

出力先 (デフォルト):
- `design/<product>.fig` (inkly ネイティブ)
- `design/<product>.pen` (Pencil 公式 interchange)
- `<product>` は仕様書 file 名から推測 (例 `design/specs/cashlight.md` → `cashlight`)

### 3b. 仕様書なし起動 (従来通り、 直接生成)

引数に仕様書 path が無い、 ユーザーが直接デザイン指示を出した場合:

```
1. ファイル存在確認            ls -la <file>
2. info で構造把握             bun $INKLY info <file>
3. 設計タイプ判定              web-app / mobile-app / landing-page / slides / dashboard / design-system
4. 設計ガイド読込              references/{topic}.md を Read
5. variables 取得              bun $INKLY variables <file>
6. tree で既存 layout 把握     bun $INKLY tree <file>
7. eval で生成 / 修正          bun $INKLY eval --code "$(cat /tmp/code.js)" -w <file>
8. export で視覚検証           bun $INKLY export -f png -o /tmp/preview.png <file>
9. Read で画像確認             Read /tmp/preview.png
10. 必要なら 7-9 を反復
```

判断分岐の詳細は `references/workflow-decision.md` を Read。

## 4. Figma plugin API の罠 (実機検証済、 重要)

inkly の eval は Figma plugin API 互換で動くが、 仕様差で **layout が崩れる罠** が複数ある。
詳細は `references/figma-plugin-api-quirks.md` を必ず Read してから eval code を書く。

最低限以下を守る:

| ルール | 理由 |
|---|---|
| **helper 順序 `appendChild → resize → x/y`** (v2 必須) | 順序を逆 (例 `x/y → appendChild → resize`) にすると child の座標が壊れて walk-fix が必要になる、 正しい順なら walk-fix 不要 |
| `textAutoResize = "WIDTH_AND_HEIGHT"` は効かない | 強制的に `HEIGHT` 固定に変換、 **width を明示 resize() で設定** |
| `primaryAxisSizingMode / counterAxisSizingMode` を明示 | 未設定だと子の width が 100 px default に張り付き layout 崩壊 |
| flex 内の子は `resize(w, h)` を明示するか親で `layoutSizingHorizontal / Vertical` 設定 | 子 frame が 100x100 default になる罠 |
| `node.resize(w, h)` は append 後に呼ぶ | append 前だと layout 計算がリセット |
| text の color は `node.fills = [{type:"SOLID",color:{r,g,b}}]` | `textColor` プロパティはない |
| 画像 は `image` type なし、 frame に setFill | 公式と同じ |
| **emoji は使わない** (v2 必須) | 🔔 🔍 ⏸ ▶ 等 emoji は Inter フォントで `\|` に化ける、 letter monogram の `iconBox` か rect 2 個の三角形で代替 |

## 5. 公式 → inkly CLI マッピング (workflow tool)

| 公式 (pencil.dev MCP) | inkly CLI 等価 |
|---|---|
| `get_editor_state` | `bun $INKLY info <file>` + `bun $INKLY variables <file>` |
| `batch_design` (op 配列) | `bun $INKLY eval --code "..." -w <file>` (Figma plugin API で操作) |
| `batch_get` | `bun $INKLY node <file> --id <id>` / `tree` |
| `snapshot_layout` | `bun $INKLY tree <file>` |
| `get_screenshot` | `bun $INKLY export -f png --node <id> -o /tmp/x.png <file>` |
| `get_variables` | `bun $INKLY variables <file>` |
| `set_variables` | `bun $INKLY eval --code "figma.variables.create..." -w <file>` |
| `get_guidelines(topic)` | `references/{topic}.md` を Read (本 skill 内蔵) |
| `find_empty_space_on_canvas` | `bun $INKLY tree <file>` で既存座標確認 + JS 計算 |
| `search_all_unique_properties` | `bun $INKLY query <file> --xpath "..."` |
| `replace_all_matching_properties` | `bun $INKLY eval` で walk + update |
| `export_nodes` | `bun $INKLY export -f {png|jpg|svg|pdf|jsx}` |

## 6. 設計タイプ別ガイド

| タイプ | references | 起動条件 |
|---|---|---|
| web-app | `references/web-app.md` | 「ダッシュボード」「管理画面」「web アプリ」「CRM」 |
| mobile-app | `references/mobile-app.md` | 「アプリ画面」「iOS」「Android」「mobile」 |
| landing-page | `references/landing-page.md` | 「LP」「ランディング」「マーケ」「販売」 |
| slides | `references/slides.md` | 「スライド」「資料」「プレゼン」 |
| design-system | `references/design-system.md` | 「コンポーネント」「デザインシステム」 |
| code (.fig → React/Vue/Svelte) | `references/code.md` | コード生成全般 |
| tailwind (.fig → React+Tailwind v4) | `references/tailwind.md` | Tailwind 採用 project |

## 7. 共通ルール

`references/general-rules.md` に分離。 要点 (省略不可):

- 25 op cap は eval 1 call の操作量目安
- gap / padding / fontSize は references の数値を厳守
- 未定義 = 0 (hallucinate しない)
- text fill 必須
- 画像は frame + setFill (`image` type なし)
- placeholder concept (新規 frame は `name = "..." + "/draft"` で管理、 完成時 rename)

### icon 代替パターン (v2 必須)

Inter フォントは emoji glyph を持たないため `🔔 🔍 ⏸ 🎙 ▶` 等は `|` に化ける。 代替パターン 3 種:

```javascript
// パターン A: letter monogram (24-44 px size の汎用 icon 代替、 nav / button / badge)
function iconBox(parent, x, y, size, hex, letter, opts) {
  const f = rect(parent, x, y, size, size, {
    fill: hex,
    radius: opts.radius !== undefined ? opts.radius : Math.round(size * 0.25)
  })
  txt(f, 0, Math.round((size - size * 0.55) / 2), letter, {
    size: Math.round(size * 0.55), style: "Bold",
    color: opts.fg || "#FFFFFF", width: size, align: "CENTER"
  })
  return f
}

// パターン B: 三角形 (play / triangle icon)
// 矩形 2 個を組み合わせて approximate triangle を描く
rect(parent, cx, cy, 22, 28, { fill: "#0D9488", radius: 2 })           // 本体
rect(parent, cx + 22, cy + 4, 12, 20, { fill: "#0D9488", radius: 2 })  // 先端

// パターン C: chevron (dropdown / disclosure icon)
// 横棒 + 縦棒で V 字を作る
rect(parent, cx, cy + 6, 8, 2, { fill: "#94A3B8" })  // 横棒
rect(parent, cx + 4, cy + 4, 2, 6, { fill: "#94A3B8" })  // 縦棒
```

nav item の icon は `letter` を画面 prefix から取る (例 Home → "H"、 Library → "L"、 Analytics → "A")、 一貫性を保つ。

### ID tag 配置パターン (v2 必須)

各 frame に **frame 外** + **frame 内 dark badge** の 2 箇所配置:

```javascript
function idTag(page, screen, id, name) {
  // 外側 — overview PNG で識別 (reviewer agent が overview を見る時)
  const t = figma.createText()
  t.fontName = { family: "Inter", style: "Bold" }
  t.characters = id + " · " + name
  page.appendChild(t)
  t.fontSize = 14
  t.resize(800, 20)
  t.x = screen.x
  t.y = screen.y - 32
  t.fills = [solidFill("#0F172A")]

  // 内側 — 個別 export PNG で識別 (reviewer agent が個別 PNG を見る時)
  const inner = figma.createFrame()
  inner.name = "id-tag-inner"
  screen.appendChild(inner)
  inner.resize(96, 22)
  inner.x = 8
  inner.y = 8
  inner.fills = [solidFill("#0F172A")]
  inner.cornerRadius = 4
  const it = figma.createText()
  it.fontName = { family: "Inter", style: "Bold" }
  it.characters = id
  inner.appendChild(it)
  it.fontSize = 11
  it.resize(96, 14)
  it.x = 0
  it.y = 4
  it.textAlignHorizontal = "CENTER"
  it.fills = [solidFill("#FFFFFF")]
}
```

## 8. 視覚検証 (必須)

```bash
bun $INKLY export -f png -o /tmp/check.png <file>
# その後
Read /tmp/check.png
```

base64 を直接 Read せず、 file 保存してから Read で画像 ingest。

## 9. 完了基準

| 項目 | 条件 |
|---|---|
| 視覚確認 | export PNG を Read で確認 (layout 崩れ / 文字不可視 / 重複なし) |
| 25 op 単位 | 1 eval 呼出が論理的に意味ある単位 (section 1 つ等) |
| spec 準拠 | references の数値 (62px / 36px radius / fontSize 28 等) を守る |
| text fill | 全 text node に fill 指定 |
| sizing 罠回避 | frame / text に明示 resize() + sizingMode 設定 |

## 10. 関連 references

| file | 内容 |
|---|---|
| `references/reviewer-checklist.md` | 生成後レビュー 8 項目 + reviewer agent 起動例 |
| `references/inkly-cli-cookbook.md` | inkly CLI 全 command の用例 + JSON output / pipe |
| `references/figma-plugin-api-quirks.md` | eval 時の Figma plugin API 罠 (textAutoResize / sizingMode / resize) |
| `references/workflow-decision.md` | タスク受領時の分岐判定 |
| `references/web-app.md` | web app 16 原則 (公式 SYSTEM PROMPT 移植) |
| `references/mobile-app.md` | mobile app 数値 spec (Status Bar 62 / Pill 36) |
| `references/landing-page.md` | landing page 10 section / hero rule / anti-slop |
| `references/slides.md` | slides typography / layout contracts |
| `references/design-system.md` | design system composition |
| `references/code.md` | .fig → 任意 framework コード生成 |
| `references/tailwind.md` | Tailwind v4 詳細 |
| `references/general-rules.md` | 全タイプ共通ルール |
| `references/troubleshooting.md` | エラー対処 + Symptom 6-9 (実機発見) |
| `references/pencil-official-prompts-raw.md` | 公式 system prompt 原文 (1 次資料) |

## Gotchas (踏みやすい落とし穴、 全件回避)

- **【CRITICAL】1 file = 1 eval = 1 .fig**: 同一 `.fig` への `bun eval -w` 複数回呼出は禁止 (page 上書きで過去成果が消える、 stride 27 画面で実機検証済)、 1 つの `.fig` は 1 つの eval call で完結 (`-o` 形式で base から新規生成 or `-w` 形式で 1 回のみ書き戻し)
- **【CRITICAL】大規模時は複数 .fig 分割**: 16+ 画面は § 3 Step 4 の自動分割ロジック (15/30 閾値) で 2-3 file に分け、 各 file 内で 1 eval 完結、 ユーザーには分割計画の通知のみ (file 数判断はユーザーに振らない)
- **【CRITICAL】helper 順序 appendChild → resize → x/y**: 順序を逆 (例 `x/y → appendChild → resize`) にすると child の座標が壊れ walk-fix が必要になる、 正しい順なら walk-fix 不要 (replay 41 画面で実機検証済)
- **【CRITICAL】emoji 禁止**: 🔔 🔍 ⏸ ▶ 等 emoji は Inter フォントで `|` に化ける、 letter monogram の `iconBox` か rect 2 個の三角形 / chevron で代替 (詳細は § 7 icon 代替パターン)
- **【CRITICAL】transparent fill 禁止**: card / button / input の fill は **必ず明示 hex 指定** (default 透明だと reviewer 不合格)、 stroke も `#CBD5E1` (slate-300) 以上で明示、 透明 fill + 薄 stroke の組合せは描画失敗しやすい
- **【CRITICAL】ID tag 2 箇所**: 各 frame の外左上 + 内左上 dark badge の 2 箇所に画面 ID を text node で配置、 overview と個別 PNG export の両方で reviewer が識別できるようにする (詳細は § 7 ID tag 配置パターン)
- **【CRITICAL】fix_proposals = 0 まで loop**: reviewer の `fix_proposals` が空でない限り次ラウンド (overall PASS でも回す)、 1 file あたり最大 5 round、 5 で 0 件に到達しなければユーザーへエスカレーション (詳細は § 3 Step 11 と `references/reviewer-checklist.md`)
- **【CRITICAL】skip マーキング**: 同じ fix proposal が 2 round 連続で出たら `<repo>/.context/pencil-design/<product>-<scope>-fix-state.md` に skip 理由 (out-of-scope / 構造不可能 / 仕様書外) を記録、 次ラウンドの reviewer prompt に「再提案禁止」として渡す
- **日本語+英語混在 text の描画失敗**: Inter フォントで `"Google で続行"` のような混在 string は描画失敗、 button label は英語のみ or font を `Noto Sans JP` に切替
- **`bun` 必須**: `node $INKLY` は `Bun is not defined` で fail、 必ず `bun $INKLY`
- **`.pen` は read-only**: 編集には `.fig` を使う、 新規 .pen 作成不可
- **既存 file から派生する**: `bun $INKLY eval -w` は input file を要求、 完全空ファイルからは作れない。 既存 .pen を base にして `-o <new>.fig` で書き出す or 既存 .fig をコピー
- **`textAutoResize = "WIDTH_AND_HEIGHT"` は効かない**: HEIGHT 固定に強制変換される、 width を明示 resize で設定する
- **frame の sizingMode 未設定で 100x100 default**: `primaryAxisSizingMode` / `counterAxisSizingMode` を必ず設定 (`FIXED` か `AUTO`)
- **child の resize() は append 後**: append 前だと親 layout が無視
- **`.fig` は inkly ネイティブ、 `.pen` は Pencil 公式の interchange**: read だけなら .pen も可、 write には .fig 推奨
- **CLI 1 call = 1 file**: 複数 file を同時に編集する場合はループで個別実行
- **eval の output**: stdout に console.log した内容が返る、 stderr は別 stream
- **export の `--node <id>` 指定**: page 全体 export より早い (sub-frame だけ確認時)
- **default は `.pen` 拡張子推測**: file 引数が拡張子なしだと .pen として開こうとする、 .fig 明示
- **MCP / app 起動は不要**: CLI が独立して .fig を読み書き、 「app 起動して」のエラーが出たら FILE 引数を省略した時のみ (必ず指定する)
- **PR 起票時の `Closes #N`**: hook (088) が `--body` shell quote 経由だと `#N` を heading 解釈して検出失敗する、 `gh pr create --body-file <path>` で渡すこと
