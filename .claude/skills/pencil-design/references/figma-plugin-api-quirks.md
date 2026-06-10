# Figma plugin API の罠 (inkly CLI eval)

`bun $INKLY eval` で Figma plugin API を使うときの仕様差・罠の集約。
**eval code を書く前に必ず Read**。 実機テストで発見した issue を全件記載。

## 重要度 ★★★★★ — text サイズの罠

### `textAutoResize = "WIDTH_AND_HEIGHT"` は効かない

公式 Figma plugin API では text に `textAutoResize` を `WIDTH_AND_HEIGHT` (横にも縦にも伸びる) を設定できるが、 **inkly では `HEIGHT` に強制変換** される。

```javascript
const t = figma.createText()
t.characters = "Long text"
t.textAutoResize = "WIDTH_AND_HEIGHT"
console.log(t.textAutoResize)  // → "HEIGHT" (期待 "WIDTH_AND_HEIGHT")
```

**結果**: text が flex layout 内で **width = 100 px のまま** になり、 横にはみ出す全文字が縦に 1 文字ずつ折り返される ("c\na\nn\nv\na\ns" のような表示)。

### 解 — width を明示 resize() で設定

```javascript
const t = figma.createText()
t.characters = "Design on canvas. Land in code."
t.fontSize = 72
parent.appendChild(t)
t.resize(1200, 82)  // ← 明示的に width / height
```

ポイント:
- `parent.appendChild(t)` の **後** に `resize()` を呼ぶ
- width は text が改行せず収まる十分なサイズを指定
- height は lineHeight に合わせる (lineHeight 設定済なら lineHeight 値)

## 重要度 ★★★★★ — frame の sizing 罠

### `sizingMode` 未設定で 100x100 default 化

frame を作って `resize(1440, 720)` を呼んでも、 `primaryAxisSizingMode` / `counterAxisSizingMode` を設定しないと flex layout の影響で **100 x 100 にリセット** される。

```javascript
const f = figma.createFrame()
f.layoutMode = "VERTICAL"
f.resize(1440, 720)  // ← この時点では 1440x720
parent.appendChild(f)
console.log(f.width, f.height)  // → 100 100 (期待 1440 720)
```

### 解 — sizingMode を明示

```javascript
const f = figma.createFrame()
f.resize(1440, 720)
f.layoutMode = "VERTICAL"
f.primaryAxisSizingMode = "FIXED"   // ← 必須 (主軸 = 縦の場合 height)
f.counterAxisSizingMode = "FIXED"   // ← 必須 (副軸 = 横の場合 width)
parent.appendChild(f)
```

| sizingMode | 意味 |
|---|---|
| `FIXED` | resize() で指定した値を保持 |
| `AUTO` | 子の合計サイズに自動調整 (= 公式の `fit_content`) |

主軸 / 副軸の対応:
- `layoutMode: "VERTICAL"` → primary = height、 counter = width
- `layoutMode: "HORIZONTAL"` → primary = width、 counter = height

### `layoutSizingHorizontal / Vertical` も併用可能

新しい API:

```javascript
f.layoutSizingHorizontal = "FILL"    // 親の幅いっぱいに広がる (= fill_container)
f.layoutSizingVertical = "HUG"        // 子の合計サイズ (= fit_content)
f.layoutSizingHorizontal = "FIXED"    // resize 値固定
```

**注意**: `layoutSizingHorizontal = "FILL"` は **親 frame の layoutMode が有効** な時のみ有効。 親が `layoutMode = "NONE"` だと意味なし。

## 重要度 ★★★★ — append タイミング

### `resize()` は appendChild の後

```javascript
// WRONG — append 前は親の layout が未確定
const f = figma.createFrame()
f.resize(800, 200)
f.layoutMode = "VERTICAL"
parent.appendChild(f)
// → 親の sizingMode 計算で f.width が変わる可能性

// CORRECT
const f = figma.createFrame()
f.layoutMode = "VERTICAL"
f.primaryAxisSizingMode = "FIXED"
f.counterAxisSizingMode = "FIXED"
parent.appendChild(f)
f.resize(800, 200)  // ← append 後で final
```

## 重要度 ★★★★ — text の color

### `textColor` プロパティは存在しない

```javascript
// WRONG
t.textColor = "#FFFFFF"        // ← 無視される
t.color = "#FFFFFF"            // ← 存在しない

// CORRECT — fills で設定 (frame と同じ)
t.fills = [{type: "SOLID", color: {r: 1, g: 1, b: 1}}]
```

### 色は `{r, g, b}` で 0-1 範囲

```javascript
// WRONG
{r: 255, g: 255, b: 255}       // ← 真っ白にならない

// CORRECT
{r: 1, g: 1, b: 1}             // ← #FFFFFF
{r: 0.04, g: 0.05, b: 0.09}    // ← #0A0E18
```

helper:

```javascript
function hexToRgb(hex) {
  hex = hex.replace("#", "")
  if (hex.length === 3) hex = hex.split("").map(c => c+c).join("")
  return {
    r: parseInt(hex.substr(0,2), 16) / 255,
    g: parseInt(hex.substr(2,2), 16) / 255,
    b: parseInt(hex.substr(4,2), 16) / 255
  }
}
```

## 重要度 ★★★ — opacity の指定方法

color object 内ではなく、 fill object の `opacity` プロパティ:

```javascript
// WRONG
{type: "SOLID", color: {r: 1, g: 1, b: 1, a: 0.5}}  // ← `a` は無視

// CORRECT
{type: "SOLID", color: {r: 1, g: 1, b: 1}, opacity: 0.5}
```

## 重要度 ★★★ — `image` type node は存在しない

公式と同じく、 画像は **frame の fill に image を設定** する:

```javascript
// WRONG
const img = figma.createImage("url")  // ← 存在しない

// CORRECT
const frame = figma.createFrame()
frame.resize(600, 400)
frame.fills = [{
  type: "IMAGE",
  imageHash: "...",
  scaleMode: "FILL"
}]
parent.appendChild(frame)
```

inkly では `figma.createImage(url)` の代わりに `setImageFill` 系の helper が API として提供されている可能性がある (要確認、 公式 plugin API には `figma.createImage` がある)。 不明なら `figma.createImage` で試行。

## 重要度 ★★★ — alignItems の値

```javascript
// 公式 Figma plugin API
frame.primaryAxisAlignItems = "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN"
frame.counterAxisAlignItems = "MIN" | "CENTER" | "MAX" | "BASELINE"
```

inkly も同じ。 公式の `justify-start` / `align-center` 等は使わない。

## 重要度 ★★ — lineHeight / letterSpacing の単位

`{value, unit}` object で渡す:

```javascript
t.lineHeight = {value: 32, unit: "PIXELS"}
t.lineHeight = {value: 150, unit: "PERCENT"}  // 150% = 1.5x
t.lineHeight = {unit: "AUTO"}                 // フォント default

t.letterSpacing = {value: 1.5, unit: "PIXELS"}
t.letterSpacing = {value: 10, unit: "PERCENT"}
```

数値直渡しは fail する:

```javascript
// WRONG
t.lineHeight = 32  // ← TypeError

// CORRECT
t.lineHeight = {value: 32, unit: "PIXELS"}
```

## 重要度 ★★ — fontName の正しい指定

```javascript
// WRONG
t.fontName = "Inter Bold"
t.fontFamily = "Inter"
t.fontWeight = "Bold"

// CORRECT
t.fontName = {family: "Inter", style: "Bold"}
t.fontName = {family: "Inter", style: "Regular"}
t.fontName = {family: "JetBrains Mono", style: "Medium"}
```

利用可能な style は font 依存、 `list_fonts` で確認可能 (公式 inkly では `list_fonts` MCP tool、 CLI なら `bun $INKLY eval --code 'console.log(figma.listAvailableFontsAsync())' <file>`)。

## 重要度 ★★ — stroke の設定

```javascript
node.strokes = [{type: "SOLID", color: {r: 1, g: 1, b: 1}, opacity: 0.2}]
node.strokeWeight = 1                    // 全辺
node.strokeWeight = {top: 1, bottom: 0}  // 個別辺 (frame のみ)
node.strokeAlign = "INSIDE" | "CENTER" | "OUTSIDE"
node.dashPattern = [4, 4]                 // 4 px dash + 4 px gap
```

## 重要度 ★★ — effects (shadow / blur)

```javascript
node.effects = [
  {
    type: "DROP_SHADOW",
    color: {r: 0, g: 0, b: 0, a: 0.1},
    offset: {x: 0, y: 8},
    radius: 24,
    spread: 0,
    visible: true,
    blendMode: "NORMAL"
  },
  {
    type: "LAYER_BLUR",
    radius: 8,
    visible: true
  }
]
```

shadow の color は **`a` 含む 4 要素**、 `opacity` プロパティとは別扱い。

## 重要度 ★ — node の削除

```javascript
node.remove()
// 子要素全削除
for (const c of [...frame.children]) c.remove()
```

`for (const c of frame.children)` (spread なし) は iter 中に collection を mutate するため不安定、 必ず `[...frame.children]` で copy する。

## 重要度 ★ — instance の作成と override

```javascript
// component を取得 (既に作成済 component)
const componentId = "1:2"
const inst = figma.createInstance(componentId)
parent.appendChild(inst)

// 子の override
inst.children[0].characters = "Custom label"  // text override

// resetOverrides で全 override 解除
inst.resetOverrides()
```

ただし `figma.createInstance` は inkly で動かない可能性、 fallback として既存 instance を clone:

```javascript
const orig = figma.getNodeById(originalInstanceId)
const cloned = orig.clone()
parent.appendChild(cloned)
```

## 重要度 ★ — page 切替 / 操作

```javascript
const root = figma.root
const pages = root.children
const page = pages[0]
figma.currentPage = page  // 切替

// 新規 page 作成 (公式 plugin API)
const newPage = figma.createPage()
newPage.name = "Page 2"
root.appendChild(newPage)
```

## 集約 — 安全に動く frame 作成 template

実機テスト済の安定版:

```javascript
function safeFrame(parent, opts) {
  const f = figma.createFrame()
  f.name = opts.name || "Frame"

  // layout 先設定
  if (opts.layout) {
    f.layoutMode = opts.layout  // "VERTICAL" | "HORIZONTAL" | "NONE"
    f.primaryAxisSizingMode = opts.primarySizing || "FIXED"
    f.counterAxisSizingMode = opts.counterSizing || "FIXED"
    if (opts.itemSpacing !== undefined) f.itemSpacing = opts.itemSpacing
    if (opts.primaryAlign) f.primaryAxisAlignItems = opts.primaryAlign
    if (opts.counterAlign) f.counterAxisAlignItems = opts.counterAlign
    if (opts.padding) {
      f.paddingTop = opts.padding[0] || 0
      f.paddingRight = opts.padding[1] || 0
      f.paddingBottom = opts.padding[2] || opts.padding[0] || 0
      f.paddingLeft = opts.padding[3] || opts.padding[1] || 0
    }
  }

  // fill
  if (opts.fill) {
    const f0 = {type: "SOLID", color: hexToRgb(opts.fill)}
    if (opts.fillOpacity !== undefined) f0.opacity = opts.fillOpacity
    f.fills = [f0]
  } else if (opts.transparent) {
    f.fills = []
  }

  // stroke
  if (opts.stroke) {
    f.strokes = [{type: "SOLID", color: hexToRgb(opts.stroke), opacity: opts.strokeOpacity}]
    f.strokeWeight = opts.strokeWeight || 1
  }

  // radius
  if (opts.radius !== undefined) f.cornerRadius = opts.radius

  // append
  parent.appendChild(f)

  // resize は append 後
  if (opts.width && opts.height) f.resize(opts.width, opts.height)

  return f
}
```

このパターンを skill 内 eval code の base とする。

## 重要度 ★★★★★ — appendChild 順序で座標 bug を回避 (v2 必須)

### 根本対処 (replay 41 画面で実機検証済)

helper 内の操作順序を `appendChild → resize → x/y` の順に固定すれば、 座標 bug は根本的に発生しない。 walk-fix は **不要**。

### 致命的問題 (順序を逆にした場合)

`rect(parent, x, y, w, h, ...)` で順序を `x/y → appendChild → resize` (= 旧 stride helper) にすると、 child の x/y は **絶対座標として保存** され frame ローカル座標として扱われない。
parent frame が page 内で `x=1640, y=3800` にあると child の `x=540, y=200` は絶対座標 (540, 200) に飛び、 clipsContent で描画されない。

### 正しい helper (v2)

```javascript
function rect(parent, x, y, w, h, opts) {
  opts = opts || {}
  const f = figma.createFrame()
  if (opts.name) f.name = opts.name

  // CRITICAL — 順序固定: appendChild → resize → x/y
  parent.appendChild(f)      // 1. 先に親確定
  f.resize(w, h)             // 2. resize は append 後
  f.x = x                    // 3. x/y は最後 (frame ローカル座標として保存される)
  f.y = y

  if (opts.fill) f.fills = [solidFill(opts.fill, opts.fillOpacity)]
  // ... 残りのプロパティ
  return f
}

function txt(parent, x, y, content, opts) {
  opts = opts || {}
  const t = figma.createText()
  t.fontName = { family: opts.family || "Inter", style: opts.style || "Regular" }
  t.characters = content

  // CRITICAL — 順序固定: appendChild → resize → x/y
  parent.appendChild(t)      // 1. 先に親確定
  if (opts.size) t.fontSize = opts.size
  if (opts.width) {
    t.textAutoResize = "HEIGHT"
    t.resize(opts.width, opts.height || (opts.size || 14) * 1.4)  // 2. resize は append 後
  }
  t.x = x                    // 3. x/y は最後
  t.y = y

  t.fills = [solidFill(opts.color || "#0F172A")]
  return t
}
```

### 検証コード

```javascript
const screen = figma.createFrame()
screen.name = "Screen/Auth/SignIn"
page.appendChild(screen)
screen.resize(1440, 900)
screen.x = 0
screen.y = 0
screen.clipsContent = true

// 中央 card を rect helper で作る (frame ローカル座標 500, 200 を期待)
const card = rect(screen, 500, 200, 440, 500, { fill: "#FFFFFF" })
console.log(card.x, card.y)
// 期待: 500, 200 (frame ローカル)
// 実際: 500, 200 ✓ (順序が正しい helper だと frame ローカル座標として保存)
```

### 補足

- helpers (rect / btn / txt 等) は **frame ローカル座標前提で書く** + 順序固定で walk-fix 不要
- v1 stride.md (walk-fix 経由) は孫レベル child の補正で過剰補正 / 未補正の混在が発生したため廃止
- v2 replay.md (順序固定) は 41 画面で walk-fix 0 件、 全画面正しい位置に配置

### v1 walk-fix からの移行ガイド

旧 helper を持つ既存 generation script は以下の置換で v2 化:

```javascript
// 旧 (v1) — x/y → appendChild → resize の順
const f = figma.createFrame()
f.x = x
f.y = y
parent.appendChild(f)
f.resize(w, h)

// 新 (v2) — appendChild → resize → x/y の順
const f = figma.createFrame()
parent.appendChild(f)
f.resize(w, h)
f.x = x
f.y = y
```

末尾の walk-fix 呼出も削除する (v2 では不要)。

## 重要度 ★★★★★ — emoji 罠 (Inter フォントで `|` に化ける)

### 致命的問題

Inter フォント (skill default) は emoji glyph を含まないため、 `🔔 🔍 ⏸ 🎙 ▶ 🤫` 等 emoji を `t.characters = "🔔"` で設定すると **`|` 縦棒に fallback** して描画される。

実機検証 (replay v1 第 1 ラウンド):
- sidebar の bell / search icon が縦棒 1 本に化け
- player chrome の ⏸ 1× 🔊 CC ⤢ が全て縦棒に化け
- recorder live の操作 icon 5 個全滅で機能不全
- reviewer から「全画面 icon 縦棒 glyph 化け」で 15/15 NG 判定

### 解 — letter monogram + rect 三角形 (v2)

emoji を 3 種類の代替パターンで置換:

```javascript
// パターン A: letter monogram (24-44 px、 nav / button / badge の汎用 icon)
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

// 使用例: nav item の icon
iconBox(sidebar, 12, 9, 20, "#0EA5E9", "H")  // Home icon (旧 🏠)
iconBox(sidebar, 12, 9, 20, "#7C3AED", "L")  // Library icon (旧 📚)
iconBox(sidebar, 12, 9, 20, "#0D9488", "A")  // Analytics icon (旧 📊)

// パターン B: 三角形 (play icon / 矢印先端)
function playTriangle(parent, cx, cy, color) {
  rect(parent, cx, cy, 22, 28, { fill: color, radius: 2 })
  rect(parent, cx + 22, cy + 4, 12, 20, { fill: color, radius: 2 })
}

// パターン C: chevron (dropdown / disclosure icon)
function chevron(parent, cx, cy, color) {
  rect(parent, cx, cy + 6, 8, 2, { fill: color || "#94A3B8" })
  rect(parent, cx + 4, cy + 4, 2, 6, { fill: color || "#94A3B8" })
}
```

### 補足

- letter は画面 prefix から取る (Home → "H"、 Library → "L"、 Analytics → "A") と一貫性が出る
- play button は ▶ ではなく rect 2 個で擬似三角形にする (上記 playTriangle)
- 数値表示 (時刻 / progress) は letter monogram 不要、 そのまま `txt` で描画
- どうしても icon set を使いたい場合は `Noto Color Emoji` フォントに切替 (ただし inkly での描画は未検証)

## 重要度 ★★★★★ — 複数 eval 呼出禁止 (inkly -w の page 上書き)

### 致命的問題

`bun $INKLY eval --code "..." -w <file>` を **複数回呼ぶと**、 各 call で **page が新規に作り直され**、 過去 eval の成果が消去される。

### 再現

```bash
# Part 1: 10 画面作成
bun $INKLY eval --code "..." -o stride.fig base.fig

# Part 2: Core 9 画面追加 (-w で書き戻し)
bun $INKLY eval --code "..." -w stride.fig
# → この時点で Part 1 の 10 画面が消える可能性

# Part 3: Settings + States 追加
bun $INKLY eval --code "..." -w stride.fig
# → Part 1 + Part 2 がさらに消える可能性
```

実機 (Stride 27 画面) で **Screen frames: 0** という結果が出た。

### 解 — 1 file 完結

- 全 helpers + 全画面実装を **1 つの JS file** にまとめる
- **1 回の eval call** で全画面生成 + walk-fix を実行
- 27 画面なら 1300-1500 行になるが、 これ以外に inkly の上書き問題を回避する path はない

### コード template

```bash
INKLY=/Users/cardene/Desktop/projects/pencil-editor/packages/cli/dist/index.mjs
SRC=...  # base .fig
DEST=design/<product>.fig

cat > /tmp/all-screens.js <<'EOF'
// === 全 helpers + 全画面実装 + walk-fix ===
const page = figma.currentPage
for (const c of [...page.children]) c.remove()
page.name = "<Product>"

// helpers (hexToRgb / setFill / rect / btn / txt / badge / avatar / sidebar / topbar)
function hexToRgb(hex) { ... }
function setFill(node, hex, opacity) { ... }
function txt(parent, content, x, y, opts) { ... }
function rect(parent, x, y, w, h, opts) { ... }
// ...

// 全 27 画面 placeholder + ID tag
const SCREENS = [...]
const F = {}
for (const [id, name, x, y, w, h, fill] of SCREENS) {
  // frame 作成 + ID tag
}

// 各画面実装 (IIFE で frame ローカル座標)
;(function(f) { /* M-01 */ })(F["M-01"])
;(function(f) { /* M-02 */ })(F["M-02"])
// ...

// 最後に walk-fix
for (const screen of figma.currentPage.children) {
  if (screen.type !== "FRAME" || !screen.name.startsWith("Screen/")) continue
  const stack = [...screen.children]
  while (stack.length > 0) {
    const node = stack.pop()
    if (node.x < -100 || node.y < -100) {
      node.x += screen.x
      node.y += screen.y
    }
    if (node.children) for (const c of node.children) stack.push(c)
  }
}
console.log("all done")
EOF

bun $INKLY eval --code "$(cat /tmp/all-screens.js)" -o $DEST $SRC
```

## 重要度 ★★★★ — 日本語+英語混在 text の描画失敗

### 問題

Inter フォントで `"Google で続行"` のような日本語+英語混在 string を btn 内 text に設定すると、 描画失敗することがある (button 内が空に見える)。

### 解

- button label は **英語のみ** にする (例: `"Continue with Google"`)
- 日本語が必要な場合は font を `"Noto Sans JP"` 等に切替
- もしくは Inter で日本語 string の前後に英字を入れない
