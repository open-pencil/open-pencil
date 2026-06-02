# pencil.dev `.pen` ファイル互換性仕様

## 背景

`.pen` は **pencil.dev** (商用デザインツール) のネイティブファイル形式で、JSON ベースの宣言的フォーマットです。
OpenPencil 公式は限定的に対応していますが、pencil.dev が生成するファイルでは多くの場合レイアウトが崩れます。
本 fork では pencil.dev のレンダリングエンジン仕様をリバースエンジニアリングし、互換性を高めています。

## .pen ファイル構造

```json
{
  "version": "2.9",
  "children": [
    {
      "type": "frame",
      "id": "OLfjy",
      "name": "Screen/Login",
      "width": 1440,
      "height": 900,
      "fill": "$--primary",
      "justifyContent": "center",
      "alignItems": "center",
      "children": [
        {
          "type": "frame",
          "id": "bQVna",
          "name": "loginCard",
          "width": 420,
          "fill": "$--bg-surface",
          "cornerRadius": "$--radius-lg",
          "padding": 40,
          "children": [...]
        }
      ]
    }
  ],
  "variables": {
    "--primary": { "type": "color", "value": "#1A1A1A" }
  }
}
```

## pencil.dev のレイアウト仕様 (リバースエンジニアリング結果)

### frame ノードのデフォルト

| 属性 | デフォルト値 |
|---|---|
| `layout` | **`HORIZONTAL`** (`Qn.Horizontal=1`) |
| `horizontalSizing` | `FitContent` |
| `verticalSizing` | `FitContent` |

→ OpenPencil 公式パーサーは frame の layout 未指定時を `NONE` 扱いするが、これは誤り。
`frame` 型は明示的に `"layout": "none"` でない限り **HORIZONTAL レイアウト**として扱う。

### `fill_container` の挙動

| 親の状態 | 動作 |
|---|---|
| flex 親 (HORIZONTAL/VERTICAL) | コンテナの空き領域を埋める |
| 非 flex 親 (NONE) | `fill_container(N)` の N をフォールバックピクセル値として使用 |

### justifyContent / alignItems

pencil.dev はアンダースコア区切りを使用。

| pencil.dev 値 | 本パーサーでの解釈 |
|---|---|
| `start` | MIN |
| `center` | CENTER |
| `end` | MAX |
| `space_between` (アンダースコア) | SPACE_BETWEEN |
| `space_around` | SPACE_BETWEEN (近似) |

### `layout: NONE` の挙動

子要素は **明示的な x/y 座標で absolute 配置**される。
ただし子要素自体が `layout: HORIZONTAL` / `VERTICAL` を持つ場合、その子の内部レイアウトは Yoga で計算する必要がある。

## 本 fork の修正内容

### packages/core/src/io/formats/pen/convert.ts

| 関数 | 修正内容 |
|---|---|
| `parseSize` | `fill_container(N)` / `fit_content(N)` の括弧付き値を正規表現でパース |
| `mapLayoutMode` | frame デフォルトを `HORIZONTAL` に変更 |
| `mapJustifyContent` | `space_between` (アンダースコア) に対応 |
| `applyPadding` | `[v, h]` の 2 要素配列を `[v, h, v, h]` に展開 |
| `convertFill` | `gradient` 型をスキップ (クラッシュ防止)、null fill を BLACK でフォールバック |
| `mapNodeType` | `line` ノードを LINE 型にマッピング |

### packages/core/src/io/formats/pen/read.ts

| 関数 | 修正内容 |
|---|---|
| `applyTextProps` | CJK 文字を含むテキストの fontFamily を `Noto Sans JP` に強制変更 |
| `estimateTextWidth` | CJK 文字を全角 (1.0) として幅推定 |

### packages/core/src/layout.ts

| 関数 | 修正内容 |
|---|---|
| `computeLayoutsBottomUp` | `layout: NONE` 親の中にある flex 子に対しても `computeLayout` を呼ぶ |

## 既知の制約

| 制約 | 影響 |
|---|---|
| `gradient` fill 非対応 | グラデーション塗りは透明扱い |
| `prompt` ノード非対応 | AI プロンプトノードは無視 (描画されない) |
| `.fig` への保存 | `.pen` で開いたファイルは保存時に `.fig` 形式に変換される (OpenPencil の制約) |

## テスト

```bash
bun test tests/engine/pen/
```

テストフィクスチャ:
- `tests/fixtures/pencil_simple.pen` (シンプルなテーブル)
- `tests/fixtures/pencil_button.pen` (コンポーネントとインスタンス)

## 参考

`pencil-dev-analysis/` ディレクトリに pencil.dev デスクトップアプリの Electron asar を解析した結果が格納されている:
- `01-pen-file-schema.md` — .pen JSON スキーマ仕様
- `02-mcp-tools-guide.md` — pencil.dev の MCP ツール定義
- `03-webapp-system-prompt.md` — AI デザイン生成プロンプト (Web)
- `04-mobile-system-prompt.md` — AI デザイン生成プロンプト (Mobile)
- `05-codegen-instructions.md` — .pen → コード変換手順
