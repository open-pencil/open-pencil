# Deploy Guide — Pencil Editor

Fly.io にデプロイする手順。 ユーザーが順に実行する想定で書いた。
各 Step は **コピペで実行できる** ようにコマンド単位で並べてある。

## 0. 前提

- macOS / Linux (Windows は WSL 推奨)
- `bun` / `git` 導入済
- 招待メール送信機能を有効化したい場合は Step 3 (Resend) を実行、 不要なら Skip 可

## 1. Fly CLI のセットアップ

```bash
# Fly CLI インストール (まだなら)
brew install flyctl

# ログイン (ブラウザが開きます)
fly auth login
```

## 2. Turso (本番 DB) を作成

Turso は libSQL の managed service。 無料枠で十分。

```bash
# Turso CLI インストール
brew install tursodatabase/tap/turso

# サインアップ + ログイン
turso auth signup    # 初回のみ
turso auth login

# DB 作成 (region は東京 (nrt) 推奨)
turso db create pencil-editor --location nrt

# 接続情報を取得 (URL + auth token、 メモする)
turso db show pencil-editor
turso db tokens create pencil-editor
```

メモする値:
- **TURSO_DATABASE_URL** (`libsql://pencil-editor-<your-org>.turso.io` 形式)
- **TURSO_AUTH_TOKEN** (`eyJ...` で始まる JWT)

## 3. Resend (招待メール送信) を設定 (任意)

招待メール送信を有効化したい場合のみ。 未設定でも招待 URL は API レスポンスで取れるが、 受信者に自動でメールが届かない。

### 3-1. Resend アカウント作成

1. https://resend.com にアクセス
2. 「Sign up」 (GitHub / Google OAuth or メール)
3. ダッシュボードへ

### 3-2. API key 取得

1. 左メニュー `API Keys` をクリック
2. `Create API Key` クリック
3. 名前: `pencil-editor-prod` (任意)、 Permission: `Full access`
4. 表示された **`re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`** をメモ (1 度しか表示されない、 慎重に)

メモする値:
- **INKLY_API_RESEND_KEY** (`re_` で始まる)

### 3-3. 送信元アドレス

無料枠は **`onboarding@resend.dev`** がデフォルトで使える (テスト用)。
独自ドメインを使いたい場合は別途 DNS 設定が必要 (本ガイドでは省略、 production 移行時に検討)。

## 4. Google OAuth 設定 (任意)

Google ログインを使いたい場合のみ。 未設定でも email/password ログインは動く。

1. https://console.cloud.google.com/apis/credentials
2. 「認証情報を作成」 → 「OAuth クライアント ID」
3. アプリケーションの種類: `ウェブアプリケーション`
4. 承認済みのリダイレクト URI: `https://pencil-editor.fly.dev/api/auth/callback/google`
5. 作成されたクライアント ID / シークレットをメモ

メモする値:
- **INKLY_API_GOOGLE_CLIENT_ID** (`123...apps.googleusercontent.com`)
- **INKLY_API_GOOGLE_CLIENT_SECRET** (`GOCSPX-...`)

## 5. Auth Secret を生成

```bash
# better-auth 用の secret (32 byte hex)
echo "INKLY_API_AUTH_SECRET=$(openssl rand -hex 32)"
echo "INKLY_API_JWT_SECRET=$(openssl rand -hex 32)"
```

メモする値:
- **INKLY_API_AUTH_SECRET**
- **INKLY_API_JWT_SECRET**

## 6. Fly app 作成

```bash
cd /Users/cardene/Desktop/projects/pencil-editor

# app 作成 (デプロイはまだしない)
# fly.toml の app = "pencil-editor" は既に設定済み
fly launch --no-deploy --copy-config --name pencil-editor
```

質問に答える:
- Would you like to set up Postgres? → **No** (Turso を使う)
- Would you like to set up Upstash Redis? → **No**
- Would you like to deploy now? → **No** (secrets 設定後に手動 deploy する)

## 7. Fly secrets を設定

メモした値をすべて secrets として設定 (1 コマンドで一気に):

```bash
fly secrets set \
  INKLY_API_AUTH_SECRET="<Step 5 の値>" \
  INKLY_API_JWT_SECRET="<Step 5 の値>" \
  TURSO_DATABASE_URL="<Step 2 の URL>" \
  TURSO_AUTH_TOKEN="<Step 2 の token>" \
  INKLY_API_RESEND_KEY="<Step 3 の key、 Resend 未設定なら省略可>" \
  INKLY_API_GOOGLE_CLIENT_ID="<Step 4 の ID、 Google 未設定なら省略可>" \
  INKLY_API_GOOGLE_CLIENT_SECRET="<Step 4 の secret、 同上>"
```

設定された secrets 一覧確認:

```bash
fly secrets list
```

## 8. デプロイ実行

```bash
fly deploy
```

進行を見守る (build 5-10 分、 deploy 1-2 分)。 完了すると URL が出る。

```
✓ Deployment complete
Visit your newly deployed app at https://pencil-editor.fly.dev/
```

## 9. 動作確認

```bash
# ブラウザで開く
fly open

# サーバーログ確認 (リアルタイム)
fly logs

# サーバー稼働状況
fly status
```

ログイン / board 作成 / 招待メール送信を実際に試す。
Resend 設定済なら招待先メールアドレスに `Inkly` から招待メールが届く。

## 10. 以降の運用

### コード変更後の再デプロイ

```bash
fly deploy
```

### secrets の追加・変更

```bash
fly secrets set NEW_KEY="value"
fly secrets unset OLD_KEY
```

### スケール調整

```bash
# CPU / memory 増やす
fly scale memory 512  # 512 MB に
fly scale vm shared-cpu-2x

# region 追加
fly regions add hkg sin
```

### コスト管理

無料枠は以下:
- 共有 CPU 1x / 256 MB RAM × 3 machine まで
- 3 GB persistent storage
- 160 GB outbound transfer

`auto_stop_machines = "stop"` 設定済 (fly.toml) なので、 アクセス無いと machine 停止 → cold start (5-10 秒) が発生するが、 料金は発生しない。

## トラブルシュート

### deploy が落ちる

```bash
# build error を確認
fly logs

# 直近 release を確認
fly releases

# 直前 release に戻す
fly releases rollback <version>
```

### migration が失敗する

Dockerfile の `CMD` で `bun run packages/api/src/db/migrate.ts` を毎回実行している。
失敗すると server 起動しない。 ログで原因確認:

```bash
fly logs | grep -i migrate
```

DB 接続情報が間違っているケースが多い (`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`)。

### 招待メールが届かない

1. Resend ダッシュボード → `Emails` で送信履歴確認 (Bounce / Spam 判定の有無)
2. 受信者の迷惑メールフォルダ確認 (`onboarding@resend.dev` はスパム判定されることがある)
3. サーバーログで `[inkly-api]` 行確認 (Dry-run mode になってないか)

production 移行時は独自ドメイン認証推奨 (DNS で SPF / DKIM 設定)。

### ローカル動作確認したい

```bash
# Docker でローカル build / run
docker build -t pencil-editor .
docker run -p 3001:3001 \
  -e INKLY_API_AUTH_SECRET=test-secret-min-32-chars-xxxxxxxxxx \
  -e INKLY_API_JWT_SECRET=test-jwt-min-32-chars-xxxxxxxxxxxx \
  pencil-editor

# http://localhost:3001 を開く
```

## まとめ

ステップ順:

1. ✅ Fly CLI install + login
2. ✅ Turso DB 作成 → URL + token メモ
3. (任意) Resend 登録 → key メモ
4. (任意) Google OAuth 設定 → ID + secret メモ
5. ✅ Auth secret 生成 → 2 個メモ
6. ✅ `fly launch --no-deploy`
7. ✅ `fly secrets set ...` でメモした値を全部設定
8. ✅ `fly deploy`
9. ✅ `fly open` で動作確認

招待メール無しで動かしたいなら Step 3 を skip。 Google ログイン無しなら Step 4 を skip。
最小構成は Step 1, 2, 5, 6, 7 (Turso + Auth secret のみ) + Step 8。
