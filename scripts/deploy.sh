#!/usr/bin/env bash
# scripts/deploy.sh — Fly.io への一発デプロイ
#
# 使い方:
#   1. .env.prod.example を .env.prod にコピーして実値を埋める
#      cp .env.prod.example .env.prod
#      $EDITOR .env.prod
#   2. このスクリプトを実行
#      bash scripts/deploy.sh
#
# 処理内容:
#   - .env.prod の必須変数を確認 (空なら fail)
#   - fly secrets import で一括投入
#   - fly deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.prod"

# === Step 0: 前提チェック ===
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.prod が見つからない"
  echo ""
  echo "次を実行して作成してください:"
  echo "  cp .env.prod.example .env.prod"
  echo "  \$EDITOR .env.prod   # 実値を入れる"
  exit 1
fi

if ! command -v fly >/dev/null 2>&1; then
  echo "❌ fly CLI が見つからない (brew install flyctl)"
  exit 1
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "❌ Fly に未ログイン"
  echo "次を実行してログインしてください:"
  echo "  fly auth login"
  exit 1
fi

# === Step 1: .env.prod 読込 + 必須変数チェック ===
echo "📋 .env.prod を読込中..."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

REQUIRED_VARS=(
  "INKLY_API_AUTH_SECRET"
  "INKLY_API_JWT_SECRET"
  "TURSO_DATABASE_URL"
  "TURSO_AUTH_TOKEN"
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING+=("$var")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "❌ 必須変数が空 (.env.prod を編集してください):"
  printf '   - %s\n' "${MISSING[@]}"
  exit 1
fi

echo "✅ 必須変数すべて設定済"
echo ""
echo "任意変数の状況:"
for var in INKLY_API_RESEND_KEY INKLY_API_GOOGLE_CLIENT_ID INKLY_API_GOOGLE_CLIENT_SECRET; do
  if [ -n "${!var:-}" ]; then
    echo "  ✅ $var (設定済)"
  else
    echo "  ⚠️  $var (未設定 — 該当機能は無効化)"
  fi
done

# === Step 2: Fly app 存在チェック ===
APP_NAME=$(grep -E '^app[[:space:]]*=' "$REPO_ROOT/fly.toml" | head -1 | sed -E 's/^app[[:space:]]*=[[:space:]]*["'\'']([^"'\'']+)["'\''].*/\1/')
if [ -z "$APP_NAME" ]; then
  echo "❌ fly.toml から app 名が読み取れない"
  exit 1
fi

echo ""
echo "🎯 対象 app: $APP_NAME"

if ! fly status --app "$APP_NAME" >/dev/null 2>&1; then
  echo ""
  echo "⚠️  Fly app '$APP_NAME' が未作成"
  echo "先に以下を実行してください:"
  echo "  fly launch --no-deploy --copy-config --name $APP_NAME"
  echo ""
  read -p "今 fly launch を実行しますか? [y/N]: " yn
  if [ "$yn" = "y" ] || [ "$yn" = "Y" ]; then
    fly launch --no-deploy --copy-config --name "$APP_NAME"
  else
    exit 1
  fi
fi

# === Step 3: 確認 prompt ===
echo ""
echo "🚀 以下の操作を実行します:"
echo "   1. fly secrets import < .env.prod"
echo "   2. fly deploy"
echo ""
read -p "実行しますか? [y/N]: " yn
if [ "$yn" != "y" ] && [ "$yn" != "Y" ]; then
  echo "中断しました"
  exit 0
fi

# === Step 4: fly secrets import ===
echo ""
echo "🔐 fly secrets import で一括投入中..."

SECRETS_TMP=$(mktemp)
trap 'rm -f "$SECRETS_TMP"' EXIT

while IFS= read -r line; do
  case "$line" in
    \#*|"") continue ;;
  esac
  if [[ "$line" != *=* ]]; then continue; fi
  key="${line%%=*}"
  val="${line#*=}"
  [ -z "$val" ] && continue
  echo "$key=$val" >> "$SECRETS_TMP"
done < "$ENV_FILE"

if [ ! -s "$SECRETS_TMP" ]; then
  echo "❌ 投入可能な secret が無い"
  exit 1
fi

fly secrets import --app "$APP_NAME" --stage < "$SECRETS_TMP"

echo "✅ secrets 投入完了 (--stage、 次の deploy で反映)"

# === Step 5: fly deploy ===
echo ""
echo "🚀 fly deploy 実行中..."
fly deploy --app "$APP_NAME"

echo ""
echo "✅ デプロイ完了"
echo ""
echo "動作確認:"
echo "  fly open --app $APP_NAME    # ブラウザで開く"
echo "  fly logs --app $APP_NAME    # サーバーログ"
echo "  fly status --app $APP_NAME  # 稼働状況"
