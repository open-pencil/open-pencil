# Deploy 実行ガイド — 今すぐ実行できるコマンド集

実環境の状況を踏まえた「コピペで実行する手順」。
詳細な背景は `DEPLOY.md` 参照、 本ファイルはコマンド実行だけにフォーカス。

## 現状 (確認済)

| 項目 | 状況 |
|---|---|
| Fly CLI | ✅ Install 済 (`/opt/homebrew/bin/fly`) |
| Fly login | ❌ **未ログイン** ← Step 1 で対応 |
| Turso CLI | ✅ Install 済 |
| Turso login | ✅ `jfet-cardene` でログイン済 |
| Turso DB `pencil-editor` | ✅ **既存** (1.2 MB データ in)、 新規作成不要 |
| Resend API key | ❌ 未取得 ← Step 2 で対応 |
| `.env.prod` | ❌ 未作成 ← Step 6 で対応 |
| Fly app `pencil-editor` | ❌ 未作成 ← `scripts/deploy.sh` が自動で促す |
| Fly secrets | ❌ 未設定 ← `scripts/deploy.sh` が一括投入 |

## Step 1: Fly login (ユーザー操作)

ターミナルで以下を実行:

```bash
fly auth login
```

ブラウザが開くので認証する。 完了後ターミナルに戻る。

確認:

```bash
fly auth whoami
```

メールアドレスが表示されれば OK。

## Step 2: Resend 登録 + API key 取得 (ユーザー操作)

ブラウザで https://resend.com にアクセス。

1. 「Sign up」 → GitHub or Google or email で登録
2. ダッシュボード左メニュー `API Keys`
3. `Create API Key` をクリック
4. Name: `pencil-editor-prod`、 Permission: `Full access` で作成
5. 表示された `re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` を **必ずコピー** (1 度しか表示されない)

メモる: `INKLY_API_RESEND_KEY = re_xxx...`

(Google OAuth は省略可、 必要なら DEPLOY.md Step 4 参照)

## Step 3: Turso token 再取得 (推奨、 古い token は破棄)

既存 DB はそのまま使う、 token だけ更新:

```bash
cd /Users/cardene/Desktop/projects/pencil-editor

# token 新規発行 (eyJ... で始まる JWT が表示される)
turso db tokens create pencil-editor
```

表示された値をメモ: `TURSO_AUTH_TOKEN = eyJ...`

URL は既知: `libsql://pencil-editor-jfet-cardene.aws-ap-northeast-1.turso.io`

## Step 4: Auth secret 生成

```bash
cd /Users/cardene/Desktop/projects/pencil-editor

# 2 個の secret を一気に生成して表示 (両方メモる)
echo "INKLY_API_AUTH_SECRET=$(openssl rand -hex 32)"
echo "INKLY_API_JWT_SECRET=$(openssl rand -hex 32)"
```

出力された 2 つの値をメモる。

## Step 5: Fly app 作成 (省略可、 deploy.sh が自動で促す)

`scripts/deploy.sh` を実行すると Fly app が未作成の場合に自動で `fly launch` の実行を促す。
事前に手動で作成しておきたい場合のみ以下を実行:

```bash
cd /Users/cardene/Desktop/projects/pencil-editor

fly launch --no-deploy --copy-config --name pencil-editor
```

質問:

| 質問 | 答え |
|---|---|
| Would you like to set up Postgres? | **No** |
| Would you like to set up Upstash Redis? | **No** |
| Would you like to deploy now? | **No** |

## Step 6: .env.prod 作成 + 一発デプロイ

メモした値を `.env.prod` に書いて `scripts/deploy.sh` を実行する。
secrets 投入とデプロイを 1 コマンドで一気通貫。

### 6-1. .env.prod 作成

```bash
cd /Users/cardene/Desktop/projects/pencil-editor

# テンプレを .env.prod にコピー
cp .env.prod.example .env.prod

# エディタで開いて値を埋める
$EDITOR .env.prod
```

`.env.prod` の中身 (Step 2-4 でメモした値を貼る):

```bash
# 必須
INKLY_API_AUTH_SECRET=<Step 4 で生成した 1 個目>
INKLY_API_JWT_SECRET=<Step 4 で生成した 2 個目>
TURSO_DATABASE_URL=libsql://pencil-editor-jfet-cardene.aws-ap-northeast-1.turso.io
TURSO_AUTH_TOKEN=<Step 3 でメモした eyJ...>

# 任意
INKLY_API_RESEND_KEY=<Step 2 でメモした re_...>
# INKLY_API_GOOGLE_CLIENT_ID=
# INKLY_API_GOOGLE_CLIENT_SECRET=
```

`.env.prod` は `.gitignore` 済 (commit されない)。

### 6-2. デプロイ実行

```bash
bash scripts/deploy.sh
```

スクリプトの流れ:
1. `.env.prod` を読込 + 必須変数チェック (空ならエラー)
2. 任意変数の状況を表示 (設定済 / 未設定)
3. Fly app 存在チェック (無ければ `fly launch` 提案)
4. `y` 入力で続行
5. `fly secrets import --stage < .env.prod` で一括投入
6. `fly deploy` 実行

待つ:
- Docker build: 5-10 分 (`bun install` + `vite build`)
- イメージアップロード: 1-2 分
- machine 起動 + health check: 30 秒

完了すると URL が出る:

```
✓ Deployment complete
Visit your newly deployed app at https://pencil-editor.fly.dev/
```

## Step 7: 動作確認

```bash
fly open  # ブラウザで開く
fly logs  # サーバーログを見る (Ctrl+C で抜ける)
fly status  # machine 稼働状況
```

確認すること:
1. https://pencil-editor.fly.dev/ にアクセス → ランディングが表示
2. アカウント作成 (メール / Google OAuth は Step 設定時のみ)
3. board 作成 → 開ける
4. 共有ボタン → 招待モーダル → メールアドレス入力 → 招待送信
5. 招待されたメールアドレスに Resend からメールが届くか確認

メール届かない場合:
- スパムフォルダ確認 (`onboarding@resend.dev` から来る、 スパム判定されやすい)
- Resend ダッシュボード `Emails` で送信履歴確認
- `fly logs | grep -i resend` でエラーが出てないか

## 完了

以降の運用:

```bash
fly deploy        # コード変更後、 再デプロイ
fly logs          # ログ確認
fly secrets set X=y   # secret 追加
fly status        # 稼働状況
fly open          # ブラウザで開く
```

## トラブル時

詳細は `DEPLOY.md` 「トラブルシュート」 参照。

よくある:
- `INKLY_API_AUTH_SECRET` は **32 文字以上**必須 (32 byte hex = 64 文字なので OK)
- Turso URL は `libsql://` で始まる
- Resend key は `re_` で始まる
- migration が失敗したらログ確認、 多くは Turso 接続情報の typo
