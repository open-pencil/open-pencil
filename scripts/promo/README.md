# Pencil Editor 紹介動画ジェネレータ (Remotion 版)

production の SPA を Playwright で **screenshot 取得** → **Remotion (React) で programmatic に animation** → mp4 出力する仕組み。

Linear / Vercel / Cal.com の LP に貼ってある「滑らかなプロダクト紹介動画」と同じアーキテクチャ。

## 出力スペック

| 項目 | 値 |
|---|---|
| 解像度 | 1920 × 1080 (Full HD) |
| FPS | 60 |
| 形式 | H.264 / yuv420p / mp4 |
| 長さ | 約 38 秒 (6 scene、 cross-fade 0.4s overlap) |
| ファイル | `scripts/promo/output/pencil-editor-promo.mp4` |

## 前提条件

### `.env.promo` を用意

`scripts/promo/build.sh` は実行前に `scripts/promo/.env.promo` の存在を必須チェックし、 無いと `❌ .env.promo が無い` で abort する。 これは内蔵 API サーバの secret と DB モードを切り替えるためで、 production のメール / OAuth 設定とは独立した promo 専用の最小セット。

雛形が repo に含まれているので、 そのままコピーすればすぐ動く。

```bash
cp scripts/promo/.env.promo.example scripts/promo/.env.promo
```

雛形に含まれる変数。

| 変数名 | 用途 | 例 |
|---|---|---|
| `INKLY_API_AUTH_SECRET` | better-auth セッション暗号化 secret (32 文字) | promo 専用の公開固定値で OK |
| `INKLY_API_JWT_SECRET` | JWT signing secret (32 文字) | promo 専用の公開固定値で OK |
| `INKLY_API_GOOGLE_CLIENT_ID` | Google OAuth client id | 空で OK (test login 経路で代替) |
| `INKLY_API_GOOGLE_CLIENT_SECRET` | Google OAuth client secret | 空で OK |
| `INKLY_API_RESEND_KEY` | Resend メール API | 空で OK (招待メール送信しない) |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Turso (libSQL) リモート DB | 空で OK (in-memory 起動のため) |
| `INKLY_API_AUTH_ENABLE_TEST_UTILS` | `/api/test/login` の有効化 flag、 promo 専用 | `1` 必須 |
| `INKLY_API_DB_MODE` | DB ストレージモード | `memory` 推奨 (毎回クリーン) |

雛形は `.env.promo.example` として repo に commit 済、 `.env.promo` 本体は `.env*` パターンで gitignore される。

### Playwright Chromium

build.sh が初回起動時に `bunx playwright install chromium` を自動実行する。 手動で先に走らせても良い。

## 使い方

### 1 コマンド版 (推奨)

```bash
bash scripts/promo/build.sh
```

production を素材取得 → Remotion render。 約 3 分で完成 (初回は依存 install で +1 分)。

オプション:

```bash
bash scripts/promo/build.sh --local           # local dev (http://localhost:1420) を素材化
bash scripts/promo/build.sh --skip-capture    # 既存 screenshot を流用、 render だけ再実行
```

### Remotion Studio (リアルタイムプレビュー)

```bash
cd scripts/promo/remotion && bun run studio
```

ブラウザで http://localhost:3000 が開き、 timeline + frame 単位プレビュー + プロパティ調整がリアルタイムにできる (Vercel が動画作成で使う公式ツール)。

### 認証必須ページの素材化

未ログイン状態だと `/dashboard` `/boards` 等は LP に redirect される。 ログイン済 screenshot が必要な場合:

```bash
bun scripts/promo/login.ts    # headed Chromium で開く → 手動 Google ログイン → ENTER で state 保存
```

`scripts/promo/.playwright-state.json` が生成され、 以降の `capture.ts` が自動で使う。

## シーン台本 (38 秒、 6 scene)

| # | 秒 | 素材 | 演出 |
|---|---|---|---|
| 1 | 0-6 | LP hero | zoom-out + caption |
| 2 | 6-13 | LP features | zoom-in + ファイル形式バッジ flow-in + caption |
| 3 | 13-19 | dashboard | zoom-in + caption |
| 4 | 19-26 | boards | zoom-in + ハイライトリング pan + caption |
| 5 | 26-33 | share modal | overlay + URL ピル pop + 「コピー → コピー済」flash + caption |
| 6 | 33-38 | LP outro | spring の CTA + グラデ URL pill |

カスタマイズは `scripts/promo/remotion/src/scenes/*.tsx` を直接編集。

## 素材ファイル (動画作成で使う固定の デザインファイル)

| ファイル | 用途 |
|---|---|
| `scripts/promo/assets/replay-marketing.fig` | 動画用の固定素材 (公開ディスクから消えないよう scripts/promo 配下に保存) |
| `public/promo-design.fig` | Vite が serve する body、 `scripts/promo/assets/replay-marketing.fig` のコピー |

build.sh が自動でコピーし直す挙動ではないので、 design/replay-marketing.fig を更新したい場合は手動で:

```bash
cp design/replay-marketing.fig scripts/promo/assets/replay-marketing.fig
cp design/replay-marketing.fig public/promo-design.fig
```

## アーキテクチャ

```
scripts/promo/
├── capture.ts                 — Playwright で screenshot 取得
├── login.ts                   — 認証 state 保存 (1 回のみ実行)
├── build.sh                   — 全工程の1コマンドエントリ
├── remotion/                  — Remotion プロジェクト (独立 node_modules)
│   ├── package.json
│   ├── remotion.config.ts
│   ├── tsconfig.json
│   ├── public/shots/          — capture.ts が出力する素材
│   ├── out/                   — render 結果 mp4
│   └── src/
│       ├── index.ts            — registerRoot
│       ├── Root.tsx            — Composition 登録
│       ├── PencilEditorPromo.tsx  — メイン (シーンを Sequence で並べる)
│       ├── components/
│       │   ├── KenBurns.tsx    — 画像 zoom + pan
│       │   ├── Caption.tsx     — テキスト fade/slide-in
│       │   └── SceneFade.tsx   — シーン境界 cross-fade
│       └── scenes/             — 6 個のシーン本体
│
└── output/                    — build.sh が最終 mp4 を copy する場所
```

## BGM (任意)

Remotion は `Audio` Component で mp3/wav を載せられる。 `scripts/promo/remotion/public/bgm.mp3` を置いて、 `PencilEditorPromo.tsx` の最後に以下を追加:

```tsx
import { Audio } from 'remotion'
import { staticFile } from 'remotion'

// AbsoluteFill の中に:
<Audio src={staticFile('bgm.mp3')} volume={0.18} />
```

無料素材:
- [YouTube Audio Library](https://www.youtube.com/audiolibrary)
- [Pixabay Music](https://pixabay.com/music/)

## 依存

| ツール | 用途 | install |
|---|---|---|
| `bun` 1.3+ | runtime | (既存) |
| Playwright 1.58+ | screenshot | `bunx playwright install chromium` |
| Remotion 4.0+ | 動画 render | `cd scripts/promo/remotion && bun install` (build.sh が自動) |
| ffmpeg 7+ | 内部 H.264 encode (Remotion が同梱、 別途 install 不要) | (自動) |

## 完成 mp4 を git に含めたい場合

`scripts/promo/output/` は `.gitignore` 済。 LP に貼るなど明示的に commit したい場合は別 path に move して LFS 推奨。
