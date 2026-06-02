# アーキテクチャ仕様

## システム概要

本プロジェクトはブラウザベースの Figma ライクデザインエディタです。
**CanvasKit (Skia WebAssembly)** を用いた自前のレンダリングエンジンを内蔵しており、ブラウザの DOM 描画とは独立しています。

## 全体構成

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Chrome / Safari / Edge)                              │
│                                                                 │
│  ┌─────────────────┐  ┌────────────────────────────────────┐  │
│  │ Vue 3 UI        │  │ <canvas> (CanvasKit / WebGL)        │  │
│  │ (sidebar, menu) │  │                                     │  │
│  │                 │  │  Skia エンジンが GPU 経由で描画      │  │
│  └────────┬────────┘  └──────────────┬─────────────────────┘  │
│           │                          │                         │
│           └──────────────┬───────────┘                         │
│                          ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ @open-pencil/core (TypeScript)                              │ │
│  │ ─ SceneGraph (ノードツリー)                                 │ │
│  │ ─ Yoga レイアウト計算 (CSS Flexbox 同等)                    │ │
│  │ ─ Skia 描画 (canvas/text.ts, canvas/renderer.ts)            │ │
│  │ ─ FontManager (TypefaceFontProvider 管理)                   │ │
│  │ ─ I/O (.pen / .fig パーサー)                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          ↑                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ public/                                                      │ │
│  │ ─ canvaskit.wasm (Skia エンジン本体)                         │ │
│  │ ─ NotoSansJP-Regular.ttf (日本語フォント、同梱)              │ │
│  │ ─ Inter-Regular.ttf / Inter-Bold.ttf (欧文フォント、同梱)    │ │
│  │ ─ Lucide.ttf (アイコンフォント、同梱)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 主要パッケージ

### @open-pencil/core

レンダリングエンジンと I/O の中心。

| モジュール | 役割 |
|---|---|
| `scene-graph.ts` | ノードツリー (FRAME, TEXT, VECTOR, INSTANCE 等) の管理 |
| `layout.ts` | Yoga WASM による Flexbox レイアウト計算 |
| `canvas/text.ts` | Skia ParagraphBuilder でのテキスト描画 |
| `canvas/renderer.ts` | キャンバスへの描画パイプライン |
| `text/fonts.ts` | TypefaceFontProvider・フォントロード管理 |
| `io/formats/pen/` | `.pen` ファイルのパーサー |
| `io/formats/fig/` | `.fig` (Figma) ファイルのパーサー |

### @open-pencil/vue

Vue 3 ベースの UI コンポーネント・i18n。

| モジュール | 役割 |
|---|---|
| `canvas/` | <canvas> 要素・ドラッグ&ドロップ |
| `i18n/` | 多言語対応 (nanostores/i18n) |
| `locales/*.json` | 言語ごとの翻訳 |

### src/ (アプリケーション本体)

| モジュール | 役割 |
|---|---|
| `app/tabs/` | タブ管理・ファイルオープン |
| `app/editor/` | エディタの状態管理 |
| `app/shell/menu/` | メニューバー |
| `components/EditorCanvas.vue` | キャンバスコンポーネント |

## レンダリングパイプライン

```
.pen ファイル (JSON)
    │
    ▼
[1] parsePenFile (read.ts)
    │ - JSON を SceneGraph に変換
    │ - frame デフォルト layoutMode = HORIZONTAL (pencil.dev 仕様)
    │ - CJK テキストは fontFamily を Noto Sans JP に強制変更
    │ - icon_font ノードを fontFamily = "lucide" として TEXT に変換
    ▼
SceneGraph
    │
    ▼
[2] computeAllLayouts (layout.ts)
    │ - Yoga で Flexbox 計算
    │ - layout: NONE 親内の flex 子は再帰的に計算
    ▼
レイアウト済み SceneGraph
    │
    ▼
[3] fontManager.loadFont(...) で必要なフォントを並行ロード
    │ - BUNDLED_FONTS から /public/*.ttf を fetch
    │ - CanvasKit TypefaceFontProvider に登録
    ▼
[4] Skia 描画 (canvas/renderer.ts)
    │ - ノードごとに ParagraphBuilder.MakeFromFontProvider
    │ - fontFamilies = [primary, ...CJK, default, ...arabic]
    ▼
<canvas> へ描画 (WebGL)
```

## 依存技術

| 技術 | バージョン | 用途 |
|---|---|---|
| Vue 3 | 3.5+ | UI フレームワーク |
| Vite | 8.0+ | 開発サーバー / バンドラ |
| CanvasKit | 0.40 | Skia WASM (描画) |
| Yoga | 3.3 | Flexbox レイアウト |
| Iconify | - | アイコンライブラリ (動的取得) |
| nanostores | - | 状態管理 + i18n |
| Bun | 1.3+ | パッケージマネージャ / ランタイム |

## ビルド/開発フロー

```bash
# 依存パッケージインストール
bun install

# core パッケージビルド (TypeScript → tsdown)
bun --filter @open-pencil/core build

# vue パッケージビルド
bun --filter @open-pencil/vue build

# 開発サーバー起動
bun run dev
```

`packages/core` または `packages/vue` を編集した時は、必ず該当パッケージを再ビルドする必要があります (Vite HMR では反映されません)。

## テスト

```bash
# 単体テスト (bun test)
bun test tests/engine/pen/
bun test tests/engine/layout/

# 全テスト
bun run test:unit
```
