# フォント管理仕様

## 概要

本アプリは **CanvasKit (Skia WASM)** で描画するため、ブラウザのシステムフォントは使えません。
すべてのフォントを `TypefaceFontProvider` に登録する必要があります。

## 設計方針

| 方針 | 理由 |
|---|---|
| **主要フォントを `public/` に同梱** | 起動の高速化・オフライン動作・予測可能性 |
| **動的ダウンロード (Google Fonts) はフォールバック扱い** | ネットワーク不安定時の劣化を防ぐ |
| **ローカルフォント (`queryLocalFonts`) は最終フォールバック** | `SecurityError: User activation is required` で失敗するため |
| **CJK テキストは fontFamily を Noto Sans JP に変換** | Skia の段落フォントフォールバックがグリフ単位で効かないため |

## 同梱フォント一覧

`packages/core/assets/` と `public/` の両方に配置 (前者は SSR 用、後者は Web 用)。

| ファイル | サイズ | 用途 |
|---|---|---|
| `Inter-Regular.ttf` | 343 KB | UI / 欧文 Regular |
| `Inter-Medium.ttf` | 326 KB | 欧文 Medium |
| `Inter-SemiBold.ttf` | 326 KB | 欧文 SemiBold |
| `Inter-Bold.ttf` | 344 KB | 欧文 Bold |
| `Inter-ExtraBold.ttf` | 327 KB | 欧文 ExtraBold |
| `NotoSansJP-Regular.ttf` | **5.3 MB** | **日本語 Regular** |
| `NotoSansJP-Bold.ttf` | **5.3 MB** | **日本語 Bold** |
| `Lucide.ttf` | **824 KB** | **lucide アイコンフォント** |
| `NotoNaskhArabic-Regular.ttf` | 159 KB | アラビア語 |

## `BUNDLED_FONTS` 設定

`packages/core/src/text/fonts.ts`:

```typescript
const BUNDLED_FONTS: Record<string, string> = {
  'Inter|Regular': '/Inter-Regular.ttf',
  'Inter|Medium': '/Inter-Medium.ttf',
  'Inter|SemiBold': '/Inter-SemiBold.ttf',
  'Inter|Bold': '/Inter-Bold.ttf',
  'Inter|ExtraBold': '/Inter-ExtraBold.ttf',
  'Noto Naskh Arabic|Regular': '/NotoNaskhArabic-Regular.ttf',
  'Noto Sans JP|Regular': '/NotoSansJP-Regular.ttf',
  'Noto Sans JP|Bold': '/NotoSansJP-Bold.ttf',
  'lucide|Regular': '/Lucide.ttf',
  'Lucide|Regular': '/Lucide.ttf'
}
```

## フォント読み込みフロー

`fontManager.loadFont(family, style)` の優先順位:

```
1. キャッシュ (loadedFamilies)
       ↓ なければ
2. ダウンロードキャッシュ (IndexedDB)
       ↓ なければ
3. BUNDLED_FONTS から /public/*.ttf を fetch (このリポジトリでは最優先)
       ↓ なければ
4. ローカルフォント (queryLocalFonts) ← SecurityError で失敗しがち
       ↓ なければ
5. Google Fonts CSS API → woff2 fetch
       ↓ なければ
null (フォント取得失敗)
```

## CJK 描画の仕組み

### 問題

CanvasKit の `TypefaceFontProvider` は段落単位でフォントを解決し、**グリフ単位のフォールバック動作が不安定** です。
`fontFamily: "Inter"` のテキストで日本語文字を描画すると、Inter にグリフがなくても次のフォントに自動切替されず、`□` (豆腐) になります。

### 解決策

`.pen` パース時、テキストノードが **CJK 文字を含む場合は `fontFamily` を `Noto Sans JP` に直接変更** します。

`packages/core/src/io/formats/pen/read.ts`:

```typescript
const CJK_RE = /[぀-ヿ㐀-鿿豈-﫿가-힯]/u

function applyTextProps(node: SceneNode, pen: PenNode, ctx: VarContext): void {
  node.text = pen.type === 'icon_font' ? (pen.iconFontName ?? '') : (pen.content ?? '')
  const resolved =
    pen.type === 'icon_font'
      ? (pen.iconFontFamily ?? 'Material Symbols Sharp')
      : resolveFontFamily(pen.fontFamily, ctx)
  // CJK 文字が含まれていれば Noto Sans JP に置換 (icon_font は除く)
  node.fontFamily =
    pen.type !== 'icon_font' && CJK_RE.test(node.text) ? 'Noto Sans JP' : resolved
}
```

| CJK 範囲 | カバー |
|---|---|
| `U+3040-U+30FF` | ひらがな・カタカナ |
| `U+3400-U+9FFF` | CJK 統合漢字 |
| `U+F900-U+FAFF` | CJK 互換漢字 |
| `U+AC00-U+D7AF` | ハングル |

## アイコンフォント (lucide)

pencil.dev は `icon_font` ノード型で `iconFontFamily: "lucide"` を使用します。
このリポジトリでは:

1. `Lucide.ttf` を `/public/` に同梱
2. `BUNDLED_FONTS['lucide|Regular'] = '/Lucide.ttf'` で登録
3. `.pen` ファイル読み込み時に `fontManager.loadFont('lucide', 'Regular')` を呼び出してプリロード

lucide フォントはアイコン名 (例: `"home"`, `"bell"`) をテキストとして渡すと、対応するアイコングリフが描画されます。

## CJK フォールバックチェーン

`packages/core/src/text/fonts.ts:ensureCJKFallback`:

```
[Noto Sans JP (bundled)]  ← このリポジトリでは最優先
  ↓
[Noto Sans SC] (Google Fonts)
  ↓
[Noto Sans KR] (Google Fonts)
```

ローカルフォント (`Hiragino Sans` 等) はリストから除外。

## ロード順序

`.pen` ファイル読み込み時の並行ロード処理 (`src/app/tabs/index.ts:openFileInNewTab`):

```typescript
const fontPromise = Promise.all([
  cjkPromise,                                  // CJK フォールバック
  store.loadFontsForNodes(allNodeIds),         // 文書内で使われるフォント
  ...extraFonts.map(([f, s]) =>                // ノードのウェイトごと
    fontManager.loadFont(f, s)
  ),
  fontManager.loadFont('lucide', 'Regular'),   // アイコンフォント
])

fontPromise.then(() => {
  // 全フォント読み込み完了後にレイアウト再計算 + 再描画
  computeAllLayouts(store.graph, pageId)
  store.requestRender()
})
```

## トラブルシューティング

### 日本語が `□` (豆腐) になる

- `public/NotoSansJP-Regular.ttf` が存在するか確認 (`ls public/*.ttf`)
- `BUNDLED_FONTS` に `'Noto Sans JP|Regular'` のエントリがあるか確認
- ブラウザの DevTools Network タブで `/NotoSansJP-Regular.ttf` が 200 で返るか確認

### アイコンが英単語 (例: `home`) で表示される

- `public/Lucide.ttf` が存在するか確認
- `BUNDLED_FONTS` に `'lucide|Regular'` のエントリがあるか確認
- `openFileInNewTab` で `fontManager.loadFont('lucide', 'Regular')` が呼ばれているか確認

### フォントが読み込まれない

- `fontManager.attachProvider` が呼ばれているか確認 (renderer 初期化時)
- `TypefaceFontProvider.Make()` が成功しているか CanvasKit のログ確認
