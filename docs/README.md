# Inkly カスタム構成 (pencil-editor)

private 利用向けに **Inkly** を調整し、pencil.dev で作成した `.pen` ファイルを正しく表示・編集できるようにしたプロジェクトです。

## プロジェクト構成

```
pencil-editor/
├── docs/                     ← 本リポジトリ独自の仕様・設計ドキュメント
├── packages/
│   ├── core/                 ← Skia + Yoga ベースのレンダリングエンジン
│   ├── vue/                  ← Vue 3 UI コンポーネント (i18n を含む)
│   ├── cli/                  ← CLI ツール
│   └── mcp/                  ← MCP サーバー (AI 連携)
├── src/                      ← アプリケーション本体 (Vite + Vue 3)
├── public/                   ← 同梱フォント・WASM
└── pencil-dev-analysis/      ← pencil.dev (デスクトップアプリ) のリバースエンジニアリング結果
```

## ドキュメント一覧

| ドキュメント | 内容 |
|---|---|
| [architecture.md](./architecture.md) | システム全体の設計・レンダリングパイプライン |
| [pen-format-compat.md](./pen-format-compat.md) | pencil.dev `.pen` ファイル互換性の仕様 |
| [font-management.md](./font-management.md) | フォント管理 (バンドル戦略・日本語対応) |
| [i18n.md](./i18n.md) | 国際化対応 (UI ローカライズ) |

## 起動方法

```bash
bun install
bun --filter @inkly/core build
bun --filter @inkly/vue build
bun run dev
```

ブラウザで `http://localhost:1420/` を開きます。

## 主な機能

- **pencil.dev `.pen` ファイルの読み込み**: pencil.dev のフォーマットを正しくパース・レンダリング
- **ドラッグ&ドロップ対応**: `.pen` / `.fig` ファイルをキャンバスにドロップで開く
- **日本語フォント標準対応**: Noto Sans JP を同梱、外部ダウンロード不要
- **アイコンフォント**: lucide アイコンをローカル同梱
- **多言語 UI**: 日本語・英語・中国語等のローカライズ対応

## 標準 Inkly との差分

| 項目 | 標準 Inkly | このリポジトリ |
|---|---|---|
| `.pen` パーサー | 一部互換 | pencil.dev 仕様準拠 |
| 日本語フォント | 動的ダウンロード | 同梱 |
| lucide アイコン | 未対応 | 同梱 |
| .pen ドラッグ&ドロップ | 未対応 | 対応 |
| 日本語 UI | なし | あり |
