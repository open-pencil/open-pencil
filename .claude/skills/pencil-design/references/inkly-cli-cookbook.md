# inkly CLI Cookbook

`packages/cli/dist/index.mjs` を Bash 経由で叩く実用例集。
全コマンドは **bun** で実行 (node では `Bun is not defined` で fail)。

## 環境変数定義

`bash` ブロックの先頭で以下を必ず定義:

```bash
INKLY=/Users/cardene/Desktop/projects/pencil-editor/packages/cli/dist/index.mjs
```

## 基本コマンド

### info — ドキュメント概要

```bash
bun $INKLY info <file>
# 出力例:
#   1 pages, 9934 nodes
#   Screen/Login  ████████ 9934nodes
#   3188 FRAME, 5280 TEXT, 1217 INSTANCE, ...
#   Fonts: DM Sans, Inter, JetBrains Mono
```

### tree — node 木構造

```bash
bun $INKLY tree <file>               # default depth
bun $INKLY tree <file> --depth 3     # 3 階層まで
bun $INKLY tree <file> --id <nodeId> # 特定 node 配下
```

### find — name / type で検索

```bash
bun $INKLY find <file> --name "Hero"
bun $INKLY find <file> --type FRAME
bun $INKLY find <file> --name "Button" --type INSTANCE
```

### query — XPath 検索

```bash
bun $INKLY query <file> --xpath "//FRAME[@name='Hero']"
bun $INKLY query <file> --xpath "//TEXT[contains(@characters, 'Get Started')]"
```

### node — 単体 node 詳細

```bash
bun $INKLY node <file> --id 0:1
bun $INKLY node <file> --id 0:1 --json  # JSON 出力
```

### variables — design token 列挙

```bash
bun $INKLY variables <file>
bun $INKLY variables <file> --json
```

### pages — page 一覧

```bash
bun $INKLY pages <file>
```

### selection — 起動中 app の選択取得

```bash
bun $INKLY selection  # 注: app 起動時のみ動作、 通常 skill 経路では不要
```

## eval — JavaScript 編集 (核心)

Figma plugin API で任意の操作を実行。

### 読込のみ (write しない)

```bash
bun $INKLY eval --code 'console.log(figma.currentPage.children.length)' <file>
```

### 編集して書込

```bash
bun $INKLY eval --code "$(cat /tmp/code.js)" -w <file>
```

### 別 file に書込 (input は変更しない)

```bash
bun $INKLY eval --code "$(cat /tmp/code.js)" -o <new>.fig <file>
```

### stdin から code 流す

```bash
cat /tmp/code.js | bun $INKLY eval --stdin -w <file>
```

### JSON 出力 (parse 可能な形)

```bash
bun $INKLY eval --code "..." --json <file>
```

### --quiet で console.log 抑制

```bash
bun $INKLY eval --code "..." -w --quiet <file>
```

## 典型 eval パターン

### 既存 page 全削除して新規 layout 作成

```javascript
const page = figma.currentPage
for (const child of [...page.children]) child.remove()
page.name = "New Page"
// 以降で frame 作成
```

### Frame 作成 (sizing 罠回避)

```javascript
const f = figma.createFrame()
f.resize(1440, 720)  // append 前に initial size
f.layoutMode = "VERTICAL"
f.primaryAxisSizingMode = "FIXED"   // ← 必須
f.counterAxisSizingMode = "FIXED"   // ← 必須
f.primaryAxisAlignItems = "CENTER"
f.counterAxisAlignItems = "CENTER"
f.itemSpacing = 24
f.paddingTop = 120
f.paddingBottom = 120
f.paddingLeft = 120
f.paddingRight = 120
f.fills = [{type: "SOLID", color: {r: 0.04, g: 0.05, b: 0.09}}]
page.appendChild(f)  // ← append 後で final 確定
```

### Text 作成 (width 明示)

```javascript
const t = figma.createText()
t.fontName = {family: "Inter", style: "Bold"}
t.characters = "Hello"
t.fontSize = 32
t.fills = [{type: "SOLID", color: {r: 1, g: 1, b: 1}}]
parent.appendChild(t)
// ★ append 後に明示 resize、 textAutoResize は WIDTH_AND_HEIGHT 効かないので width 指定で改行制御
t.resize(800, 40)
```

### Solid fill helper

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
function setFill(node, hex, opacity) {
  const f = {type: "SOLID", color: hexToRgb(hex)}
  if (opacity !== undefined) f.opacity = opacity
  node.fills = [f]
}
setFill(hero, "#0A0E18")
setFill(badge, "#B3D056", 0.15)
```

### 文字 + style 一括 helper

```javascript
function mkText(parent, content, opts) {
  const t = figma.createText()
  t.fontName = {family: opts.family || "Inter", style: opts.style || "Regular"}
  t.characters = content
  t.fontSize = opts.size || 14
  if (opts.lineHeight) t.lineHeight = {value: opts.lineHeight, unit: "PIXELS"}
  if (opts.letterSpacing) t.letterSpacing = {value: opts.letterSpacing, unit: "PIXELS"}
  if (opts.align) t.textAlignHorizontal = opts.align
  if (opts.color) {
    const f = {type: "SOLID", color: hexToRgb(opts.color)}
    if (opts.colorOpacity !== undefined) f.opacity = opts.colorOpacity
    t.fills = [f]
  }
  parent.appendChild(t)
  t.resize(opts.width, opts.height || t.height)
  return t
}
mkText(hero, "Design on canvas. Land in code.", {
  size: 72, lineHeight: 82, style: "Bold", color: "#FFFFFF",
  align: "CENTER", width: 1200, height: 82
})
```

### Component instance 作成

```javascript
const inst = figma.createInstance("componentNodeId")
parent.appendChild(inst)
// override
inst.children[0].characters = "Custom label"
```

### Variable 取得 / binding

```javascript
const vars = figma.variables.getLocalVariables()
const primaryVar = vars.find(v => v.name === "--primary")
// binding
node.setBoundVariable("fills", primaryVar.id)
```

### tree walk + 一括 update

```javascript
function walk(node, fn) {
  fn(node)
  if (node.children) for (const c of node.children) walk(c, fn)
}
walk(figma.currentPage, n => {
  if (n.type === "TEXT" && n.fontSize === 14) {
    n.fontSize = 16
  }
})
```

## export — 視覚出力

### PNG export

```bash
bun $INKLY export -f png -o /tmp/preview.png <file>
bun $INKLY export -f png -o /tmp/preview.png --node 0:5 <file>  # 特定 node
bun $INKLY export -f png -o /tmp/preview.png --page "Landing Page" <file>
bun $INKLY export -f png -s 2 -o /tmp/2x.png <file>  # 2x scale
```

### 他フォーマット

```bash
bun $INKLY export -f svg -o /tmp/x.svg <file>
bun $INKLY export -f pdf -o /tmp/x.pdf <file>
bun $INKLY export -f jpg -q 85 -o /tmp/x.jpg <file>  # quality 85
bun $INKLY export -f jsx --style tailwind -o /tmp/x.jsx <file>  # JSX + Tailwind
```

### Thumbnail (page サマリ)

```bash
bun $INKLY export -f png --thumbnail --width 1920 --height 1080 -o /tmp/thumb.png <file>
```

## lint — 一貫性チェック

```bash
bun $INKLY lint <file>
bun $INKLY lint <file> --rule spacing
bun $INKLY lint <file> --json
```

## analyze — token / spacing / typography 分析

```bash
bun $INKLY analyze <file>
bun $INKLY analyze <file> --colors
bun $INKLY analyze <file> --spacing
bun $INKLY analyze <file> --typography
bun $INKLY analyze <file> --clusters
```

## convert — フォーマット変換

```bash
bun $INKLY convert input.pen -o output.fig  # .pen → .fig (編集可に)
```

## エラーパターンと対処

### `Bun is not defined`

```bash
# WRONG
node $INKLY ...
# CORRECT
bun $INKLY ...
```

### `Could not connect to Inkly app on localhost:7600`

```
# 原因: FILE 引数なしで実行
# 対処: 必ず file path を渡す
bun $INKLY eval --code "..." -w <file>  # <- file 必須
```

### `Nothing to export`

```
# 原因: page に node がない、 または node ID が間違い
# 対処: tree で構造確認してから export
bun $INKLY tree <file>
bun $INKLY export -f png -o /tmp/x.png <file>
```

### eval の console.log が見えない

```
# stdout に出る、 stderr 別 stream
bun $INKLY eval --code "console.log('x')" <file> 2>&1
```

## 新規 file 作成パターン

inkly は完全空ファイルから新規作成できない (`-w` は既存 file を要求)。
パターン:

```bash
# 1. 既存 .pen / .fig を base にして新規書き出し
bun $INKLY eval --code "
  const page = figma.currentPage
  for (const c of [...page.children]) c.remove()
  page.name = 'New Design'
" -o /path/new.fig /path/existing.fig

# 2. 既に作った .fig をコピーして新規扱い
cp /path/template.fig /path/new.fig
bun $INKLY eval --code "..." -w /path/new.fig
```

## `.fig` → `.pen` 変換 (CLI 補完経路)

inkly CLI は `convert -f pen` を直接サポートしないが、 eval で SceneGraph を JSON 化して `.pen` schema として書き出すことが可能。 実機検証で **`.pen` ファイルとして inkly が読み込んで export まで通る** ことを確認済。

### 変換器 (再利用可能)

```bash
INKLY=/Users/cardene/Desktop/projects/pencil-editor/packages/cli/dist/index.mjs
SRC=/path/source.fig
OUT=/path/output.pen

cat > /tmp/fig-to-pen.js <<'JSEOF'
const usedIds = new Set()
function genId() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let id
  do {
    id = ""
    for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)]
  } while (usedIds.has(id))
  usedIds.add(id)
  return id
}
function rgbToHex(c) {
  const r = Math.round(c.r * 255).toString(16).padStart(2, "0")
  const g = Math.round(c.g * 255).toString(16).padStart(2, "0")
  const b = Math.round(c.b * 255).toString(16).padStart(2, "0")
  return "#" + r + g + b
}
function fillToPen(fills) {
  if (!fills || !fills.length) return undefined
  const f = fills[0]
  if (f && f.type === "SOLID") {
    let hex = rgbToHex(f.color)
    if (f.opacity !== undefined && f.opacity < 1) {
      hex += Math.round(f.opacity * 255).toString(16).padStart(2, "0")
    }
    return hex
  }
}
function mapAlign(a) {
  return {MIN: "start", CENTER: "center", MAX: "end", SPACE_BETWEEN: "space_between"}[a]
}
function nodeToPen(n) {
  const t = n.type.toLowerCase()
  const out = { type: t, id: genId() }
  if (n.name) out.name = n.name
  let isFlexChild = n.parent && n.parent.layoutMode && n.parent.layoutMode !== "NONE"
  if (!isFlexChild) {
    if (n.x) out.x = n.x
    if (n.y) out.y = n.y
  }
  if (n.layoutSizingHorizontal === "FILL") out.width = "fill_container"
  else if (n.layoutSizingHorizontal === "HUG") out.width = "fit_content"
  else if (n.width !== undefined) out.width = n.width
  if (n.layoutSizingVertical === "FILL") out.height = "fill_container"
  else if (n.layoutSizingVertical === "HUG") out.height = "fit_content"
  else if (n.height !== undefined) out.height = n.height
  const f = fillToPen(n.fills)
  if (f) out.fill = f
  if (n.cornerRadius) out.cornerRadius = n.cornerRadius
  if (t === "text") {
    out.content = n.characters
    if (n.fontSize) out.fontSize = n.fontSize
    if (n.fontName) {
      out.fontFamily = n.fontName.family
      const styleMap = {"Bold": "700", "Medium": "500", "SemiBold": "600", "Light": "300"}
      const w = styleMap[n.fontName.style]
      if (w) out.fontWeight = w
    }
    if (n.lineHeight && n.lineHeight.value) out.lineHeight = n.lineHeight.value
    if (n.letterSpacing && n.letterSpacing.value) out.letterSpacing = n.letterSpacing.value
    if (n.textAlignHorizontal && n.textAlignHorizontal !== "LEFT") out.textAlign = n.textAlignHorizontal.toLowerCase()
    out.textGrowth = "fixed-width"
  }
  if (n.layoutMode && n.layoutMode !== "NONE") {
    out.layout = n.layoutMode === "VERTICAL" ? "vertical" : "horizontal"
    if (n.itemSpacing) out.gap = n.itemSpacing
    const a = mapAlign(n.primaryAxisAlignItems)
    if (a && a !== "start") out.justifyContent = a
    const ca = mapAlign(n.counterAxisAlignItems)
    if (ca && ca !== "start") out.alignItems = ca
    if (n.paddingTop || n.paddingBottom || n.paddingLeft || n.paddingRight) {
      const top = n.paddingTop || 0
      const right = n.paddingRight || 0
      const bottom = n.paddingBottom || 0
      const left = n.paddingLeft || 0
      if (top === right && right === bottom && bottom === left) out.padding = top
      else if (top === bottom && left === right) out.padding = [top, left]
      else out.padding = [top, right, bottom, left]
    }
  }
  if (n.children && n.children.length) out.children = n.children.map(nodeToPen)
  return out
}
const root = { version: "2.9", children: figma.currentPage.children.map(nodeToPen) }
console.log(JSON.stringify(root, null, 2))
JSEOF

# 変換実行
bun $INKLY eval --code "$(cat /tmp/fig-to-pen.js)" --quiet $SRC > $OUT

# 検証 (inkly が読めるか)
bun $INKLY info $OUT
bun $INKLY export -f png -o /tmp/from-pen.png $OUT
```

### 制限事項

| 機能 | 対応 |
|---|---|
| Frame / Text / 基本 layout | ✅ |
| Solid fill + opacity | ✅ |
| corner radius | ✅ |
| flexbox layout | ✅ |
| stroke | ⚠️ 部分対応 (color のみ) |
| effects (shadow / blur) | ❌ |
| gradient / image fill | ❌ |
| variables 参照 | ❌ (`$--xxx` の binding ではなく hex 値で出力) |
| component instance | ❌ (clone した frame は普通の frame として出力) |

完全な対応が必要なら個別拡張する。

### スマートな運用

通常運用は `.fig` で行い、 外部共有 / Pencil 公式互換性が必要な時のみ `.pen` に変換するのが推奨。
変換は片方向 (`.fig` → `.pen`) のみで、 `.pen` → `.fig` への逆変換は `bun $INKLY convert -f fig <file>.pen` で可能。

## 重要: 複数 eval 呼出禁止 (page 上書き)

### 致命的問題

`bun $INKLY eval --code "..." -w <file>` を **複数回呼ぶと**、 各 call で **page が新規に作り直され**、 過去 eval の成果が消える (実機 Stride 27 画面で 検証済)。

```bash
# WRONG - 過去成果が消える
bun $INKLY eval --code "$(cat /tmp/part1.js)" -o stride.fig base.fig    # Part 1: 10 画面
bun $INKLY eval --code "$(cat /tmp/part2.js)" -w stride.fig             # ← Part 1 が消える可能性
bun $INKLY eval --code "$(cat /tmp/part3.js)" -w stride.fig             # ← Part 1+2 が消える
# 最終結果: Screen frames: 0
```

### 解 — 1 file 完結

全 helpers + 全画面実装 + walk-fix を **1 つの JS file** にまとめて 1 回の eval call で完結:

```bash
cat > /tmp/all-screens.js <<'EOF'
// 全 helpers
function hexToRgb(hex) { ... }
function setFill(node, hex, opacity) { ... }
function rect(parent, x, y, w, h, opts) { ... }
function btn(parent, label, x, y, w, h, kind) { ... }
function txt(parent, content, x, y, opts) { ... }
// ...

// 全 frame 作成
const F = {}
for (const [id, name, x, y, w, h, fill] of SCREENS) { ... }

// 各画面実装 (IIFE)
;(function(f) { /* M-01 */ })(F["M-01"])
;(function(f) { /* M-02 */ })(F["M-02"])
// ...

// walk-fix (座標 bug 対策、 詳細は figma-plugin-api-quirks.md)
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
EOF

# 1 回の eval call で完結
bun $INKLY eval --code "$(cat /tmp/all-screens.js)" -o design/<product>.fig <base>.fig
```

### 27 画面のサイズ感

- Marketing 3 + Auth 4 + Onboarding 3 + Core 9 + Settings 4 + States 4 = 27 画面
- 1 file で 1300-1500 行になる
- これ以外に inkly の上書き問題を回避する path はない

### 漸進的に追加したい場合

`open` で別 .fig を base にして派生する:

```bash
# 1st run: 10 画面
bun $INKLY eval --code "$(cat /tmp/v1.js)" -o stride-v1.fig base.fig

# 2nd run: stride-v1.fig を base にして残り 17 画面追加 (-o で新 file)
bun $INKLY eval --code "$(cat /tmp/v2.js)" -o stride-v2.fig stride-v1.fig
```

ただしこれも v2.js 側で v1.js の helpers + 全画面実装を **再度** 書く必要がある (helpers の state は引き継がれない)。 結局 1 file が現実解。
