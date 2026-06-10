# Troubleshooting (inkly CLI 経路)

inkly CLI / eval で起こる典型エラーと対処の SSOT。 実機テスト発見の罠を全件記載。

## CLI 系

### Symptom 1: `Bun is not defined`

```
ERROR Bun is not defined
  at loadDocument (packages/cli/dist/index.mjs:167:37)
```

原因 — node で `$INKLY` を実行している。
対処 — **`bun $INKLY ...`** で実行 (node では fail)。

### Symptom 2: `Could not connect to Inkly app on localhost:7600`

```
ERROR Could not connect to Inkly app on localhost:7600.
Is the app running? Start it with: bun run tauri dev
```

原因 — FILE 引数なしで実行 (CLI が app 接続を試みた)。
対処 — 必ず最後に `<file>` を渡す:

```bash
# WRONG
bun $INKLY eval --code "..."

# CORRECT
bun $INKLY eval --code "..." -w /path/to/design.fig
```

### Symptom 3: `Nothing to export`

```
ERROR Nothing to export
```

原因 — page に node がない、 または --node ID が無効。
対処 — tree で構造確認:

```bash
bun $INKLY tree $FILE
bun $INKLY find $FILE --type FRAME
# 確認した ID を --node に渡す
bun $INKLY export -f png --node 0:5 -o /tmp/x.png $FILE
```

### Symptom 4: `.pen` を編集しようとして fail

`.pen` は read-only。 `-w` でも書き込めない。

対処 — `.fig` に変換:

```bash
# .pen → .fig 変換
bun $INKLY convert input.pen -o input.fig
# 以降は input.fig を編集
```

または `-o` で別 file に書き出し:

```bash
bun $INKLY eval --code "..." -o /path/new.fig /path/original.pen
```

## eval の罠 (`figma-plugin-api-quirks.md` 参照、 ここはエラーパターンのみ)

### Symptom 5: 文字が縦に 1 文字ずつ折り返される

原因 — `textAutoResize = "WIDTH_AND_HEIGHT"` 設定が無視され、 text の width が 100 px のまま。
対処 — `t.resize(<width>, <height>)` を append 後に明示。 詳細 `figma-plugin-api-quirks.md` ★★★★★ Section。

### Symptom 6: frame が 100x100 になる

原因 — `primaryAxisSizingMode` / `counterAxisSizingMode` 未設定で flex に張り付き。
対処 — 必ず `FIXED` か `AUTO` を明示。

```javascript
f.layoutMode = "VERTICAL"
f.primaryAxisSizingMode = "FIXED"   // ← 必須
f.counterAxisSizingMode = "FIXED"   // ← 必須
parent.appendChild(f)
f.resize(1440, 720)
```

### Symptom 7: text の color が反映されない (不可視)

原因 — `t.textColor = "..."` で設定しようとしている (存在しない)。
対処 — `fills` で設定:

```javascript
t.fills = [{type: "SOLID", color: {r: 1, g: 1, b: 1}}]
```

色は **0-1 range**、 0-255 ではない (`{r: 1}` = #FFFFFF、 `{r: 255}` は溢れて black 扱い)。

### Symptom 8: lineHeight / letterSpacing 設定で TypeError

原因 — 数値を直接渡している。
対処 — `{value, unit}` object:

```javascript
t.lineHeight = {value: 32, unit: "PIXELS"}
t.letterSpacing = {value: 1.5, unit: "PIXELS"}
```

### Symptom 9: instance が作れない

原因 — `figma.createInstance(id)` が inkly では動かない場合あり。
対処 — 既存 instance を clone:

```javascript
const orig = figma.getNodeById(originalId)
const cloned = orig.clone()
parent.appendChild(cloned)
```

### Symptom 10: 子の resize() が反映されない

原因 — appendChild 前に resize() している、 または親の layoutMode が `NONE` で `layoutSizingHorizontal/Vertical` が無効。
対処:

```javascript
// CORRECT
parent.appendChild(child)
child.resize(800, 200)
```

### Symptom 11: opacity が効かない

原因 — color object の `a` プロパティに opacity を入れている。
対処 — fill object の `opacity` プロパティ:

```javascript
// WRONG
{type: "SOLID", color: {r: 1, g: 1, b: 1, a: 0.5}}

// CORRECT
{type: "SOLID", color: {r: 1, g: 1, b: 1}, opacity: 0.5}
```

shadow / effect の color は `a` 含むため例外:

```javascript
{type: "DROP_SHADOW", color: {r: 0, g: 0, b: 0, a: 0.1}, ...}
```

### Symptom 12: console.log が見えない

原因 — stderr に出ているか、 --quiet で抑制されている。
対処:

```bash
bun $INKLY eval --code "console.log('x')" $FILE 2>&1  # stderr も capture
# --quiet 外す
```

## 視覚検証 系

### Symptom 13: export 画像が真っ黒 / 真っ白

原因 — 全 frame が placeholder のまま、 または背景 fill が指定されていない。
対処 — page / frame に `fill` を設定:

```javascript
page.children[0].fills = [{type: "SOLID", color: {r: 1, g: 1, b: 1}}]
```

### Symptom 14: export 画像サイズが巨大 (token 圧迫)

原因 — `-s` (scale) 値が大きすぎ、 または全 page export。
対処:

```bash
# scale を 1 に
bun $INKLY export -f png -s 1 -o /tmp/x.png $FILE
# 特定 node だけ
bun $INKLY export -f png --node <id> -o /tmp/x.png $FILE
# thumbnail mode で 1920x1080 固定
bun $INKLY export -f png --thumbnail --width 1280 --height 720 -o /tmp/x.png $FILE
```

### Symptom 15: layout 崩れが検出できない

原因 — Read で見落とし、 細部が小さい。
対処:

```bash
# 2x scale で詳細確認
bun $INKLY export -f png -s 2 -o /tmp/x.png $FILE
# section ごとに export
bun $INKLY export -f png --node <heroId> -o /tmp/hero.png $FILE
bun $INKLY export -f png --node <featuresId> -o /tmp/features.png $FILE
```

## abort 基準

3 回試行しても解決しない場合:

| カテゴリ | アクション |
|---|---|
| CLI / runtime 系 | ユーザーに「bun --version 確認」「inkly CLI path 確認」と報告 |
| API 罠系 | `figma-plugin-api-quirks.md` を再読、 別の sizing 戦略を試す |
| 視覚検証で再現できない | 該当 node の `bun $INKLY node $FILE --id <id> --json` で内部 state 確認 |
| 復旧不能 | 部分完成で完了報告、 残りはユーザー判断 |

## デバッグ tips

### node の全 property を確認

```bash
bun $INKLY node $FILE --id <id> --json | python3 -m json.tool
```

### tree 構造 + サイズ確認

```bash
bun $INKLY eval --code "
function walk(n, d=0) {
  const i = '  '.repeat(d)
  if (n.type === 'TEXT') console.log(\`\${i}TEXT \"\${n.characters.substring(0,30)}\" w=\${n.width} h=\${n.height} autoResize=\${n.textAutoResize}\`)
  else if (n.children) {
    console.log(\`\${i}\${n.type} \${n.name} w=\${n.width} h=\${n.height} \${n.layoutMode || ''}\`)
    for (const c of n.children) walk(c, d+1)
  }
}
walk(figma.currentPage)
" $FILE
```

### 増分 export で問題箇所特定

```bash
# 各 section を export → どれが崩れているか目視
for id in 0:5 0:50 0:120 0:200; do
  bun $INKLY export -f png --node $id -o /tmp/sec-$id.png $FILE
done
```
