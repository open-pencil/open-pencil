# 共通ルール (全タイプ適用)

Pencil 公式の "General instructions when editing .pen files" / "General design information" / "Flexbox Layout" / "Components and Instances" セクションを忠実移植。
タイプ別 reference を Read する前に必ず本 file を Read する。

## placeholder フラグ

新規・コピー frame は必ず `placeholder: true` を設定し、 完成時に false に戻す。

| ケース | 動作 |
|---|---|
| 新規 frame insert | 必ず `placeholder: true` で作成、 内容完成後 false |
| copy で複製 | コピー直後に `placeholder: true` 上書き、 編集後 false |
| 既存 screen 修正 | 編集開始時 `placeholder: true` 設定、 完了で false |
| 複数 screen を作る | 先に全 screen の placeholder frame を作成、 個別に作業 |

placeholder が残ったまま完了報告するのは禁止。 必ず外す。

## 25 op cap

1 batch_update 呼出は **最大 25 operation** を上限とする。 超える場合は section 単位で分割。

理由 — 公式 Pencil で性能・エラー耐性が担保される閾値、 inkly でも同じ。

- 1 画面の hero / nav / footer / content を別々の batch_update に分ける
- 25 op で意味のある進捗単位を作る (中途半端な分割を避ける)
- 同じ batch 内で複数 frame を作るより、 1 frame ずつ完成させる方が drift しにくい

## gap / padding 数値厳守

各コンポーネントの spec 数値は public な調査済みの値、 hallucinate しない。

例 — mobile-app tab bar (`references/mobile-app.md` で詳述):

| プロパティ | 値 |
|---|---|
| Tab Bar Container padding | top: 12, right/bottom/left: 21 |
| Pill 高さ | 62 px |
| Pill corner radius | 36 px |
| Pill border | 1 px solid (theme border) |
| Tab Item corner radius | 26 px |
| Icon サイズ | 18 px |
| Label fontSize | 10 px, weight 500-600, uppercase, letter-spacing 0.5 px |

各 references の数値表を**そのまま**使う、 「だいたい」「適当に」で済ませない。

## 未定義プロパティは 0

`cornerRadius` 等が spec / variable に無い場合は **0** を使う、 適当な値で hallucinate しない。

| プロパティ | 未指定時 default |
|---|---|
| cornerRadius | 0 |
| padding | 0 |
| gap | 0 |
| stroke | none |
| opacity | 1 |
| rotation | 0 |

## text fill 必須

text node は default で fill が空 = 不可視。 必ず fill を指定する。

```
I("parent", {type:"text", content:"Hello", fontSize:24, fill:"$--font-primary"})
```

- variable があるなら `$--font-primary` 等
- 直接色なら `fill:"#FFFFFF"`
- 絵文字含む text も fill 必須 (絵文字は色を持つが、 text node の fill が空だと glyph 全体が透明扱い)

## textGrowth ルール

text の width / height を直接指定するのではなく、 textGrowth を使う。

| textGrowth | 条件 |
|---|---|
| `auto` (default) | width / height は自動計算、 単一行のみ、 改行しない |
| `fixed-width` | width 必須、 height 自動、 改行する |
| `fixed-width-height` | width / height 両方必須、 改行する、 縦オーバーフロー可 |

推奨 — flex layout 内では `fixed-width` + `width: "fill_container"` を使う。
高さは text 内容から自動計算させ、 hallucinate しない。

## flexbox 内の x/y 禁止

parent の layout が "vertical" / "horizontal" のとき、 child の x/y は完全無視される。
`layout: "none"` 以外で x/y を子に設定しない。

## fit_content vs fill_container 優先

pixel 値で親と同じ数値を子に重複指定しない。

```
// WRONG: 親 400px の子に 400px と書く
container=I(parent, {type:"frame", layout:"vertical", width:400})
title=I(container, {type:"text", width:400})

// CORRECT: 子は fill_container
title=I(container, {type:"text", width:"fill_container", textGrowth:"fixed-width"})
```

例外 — 親に layout が無い (absolute) ときのみ pixel 値が必要。

## 画像は frame に G operation

`image` type node は **存在しない**。 frame を作って fill に画像を設定する。

```
hero=I(container, {type:"frame", layout:"vertical", width:600, height:400})
G(hero, "ai", "team collaboration modern office")
```

G の第 2 引数:
- `"ai"` (推奨): AI 生成画像、 具体的に prompt を書く
- `"stock"` (fallback): Unsplash 写真

inkly での equivalent — `mcp__inkly__set_image_fill` または `mcp__inkly__stock_photo`。

## 座標系

- 全 node の x/y は **親の左上原点** に対する相対座標
- x は右に増加、 y は下に増加
- 子 node の座標は常に親基準
- 0 width / 0 height は禁止 (見えない object になる)

## flexbox の制約

- single-axis only — 横並び OR 縦並びのみ、 grid 風には複数 row frame を作る
- item wrapping なし — 自動折返しは無い
- padding は全子に均等
- 個別 child の offset は frame でラップして padding を持たせる
- 親が `fit_content` で全子が `fill_container` は **循環依存**、 禁止

## Components と Instances

`reusable: true` の object はコンポーネント。 ref で参照して instance を作る。

| 操作 | 構文 (公式 batch_design) | inkly 経由 |
|---|---|---|
| instance 配置 | `I("parent", {type:"ref", ref:"componentId"})` | `create_instance` |
| instance の root プロパティ override | ref object に直接 | `update_node({ref:..., width:..., })` |
| instance 内 descendant プロパティ override | `descendants` プロパティ | (inkly では path 指定 `update_node("instance/childId", {...})`) |
| descendant 完全置換 | `descendants` で `type` 含む完全 object | `node_replace_with` |

## Tables

階層 — Table (frame) → Table Row (frame) → Table Cell (frame) → Cell Content (text / button / instance)

各 cell は **frame**、 row 直下に text を置かない (antipattern)。

## 検証と完了

- 生成後 `export_image` で視覚確認
- gap / padding が公式 spec 通りか
- placeholder flag 全外し済か
- text fill 漏れなしか
- 0 width / 0 height なしか
- レイアウト崩れなしか

検証 NG なら別アプローチで修正、 hallucinate で進めない。

## 抜けがちな gotchas (公式から)

- text 単独で width/height 指定すると visual bug、 必ず textGrowth 経由
- `icon_font` には width / height 必須
- variable 参照は `$` 前置 (`fill: "$primary-color"`、 `gap: "$spacing-small"`)
- `textColor` / `fillColor` という property 名は **無効**、 必ず `fill` を使う
- 既存コンテンツのコピー > 新規生成 を優先 (drift しにくい)
- 新規 screen を作るときは既存 screen の上に重ねない (必ず空白領域に配置)

## Tables (詳細仕様)

公式 `get_guidelines("table")` を移植。 design system に Table component / Table frame があるならそれを使い、 無いときのみ以下の rule を適用。

### 構造

- header row (column 名) + data row (1 件以上)
- ユーザー指定がないなら dummy placeholder 値で埋める
- mobile responsive — 横長 multi-column table は **card に置換** を検討 (table のまま縮めない)

### Cell

- 各 cell は **frame node** で表現する
- scratch 時の cell 内容:
  - `textGrowth: fixed-width` の **text node**、 または
  - 別 component / node (label / button 等、 ユーザー明示時のみ)

### Layout 数値 (絶対遵守)

| 要素 | 値 |
|---|---|
| Cell frame | width: fixed / height: fill_container |
| Row frame | width: fill_container / height: fixed / children = 複数 cell frame |
| Table frame | row 群を vertical layout で内包 |

### Antipattern (再掲)

```
// WRONG — row 直下に text、 cell frame 不在
tableRow=I("kdl58",{type:"frame",layout:"horizontal"})
I(tableRow,{type:"text",content:"John Doe"})

// CORRECT — Table → Row → Cell (frame) → Cell Content
tableRow=I("kdl58",{type:"frame",layout:"horizontal"})
tableCell1=I(tableRow,{type:"frame",width:"fill_container"})
tableCellContent1=I(tableCell1,{type:"text",content:"John Doe"})
```
