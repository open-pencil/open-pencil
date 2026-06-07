#!/usr/bin/env bash
# scripts/dev-api.sh — API server のみを単独起動 (dev:full を使わないとき用)
#
# 使い方:
#   cp .env.development.example .env.development  (初回のみ)
#   bun run dev:api
#
# .env.development が存在しない場合は exit 1 で fail-fast する
# (bun --env-file は missing file を silent skip するため、 ここで明示ガード)。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.development"
LOCAL_OVERRIDE="$REPO_ROOT/.env.development.local"
EXAMPLE_FILE="$REPO_ROOT/.env.development.example"

if [ ! -f "$ENV_FILE" ]; then
  echo "[dev:api] .env.development が見つかりません。" >&2
  echo "[dev:api] cp $EXAMPLE_FILE $ENV_FILE してから再実行してください。" >&2
  exit 1
fi

if [ -f "$LOCAL_OVERRIDE" ]; then
  ENV_ARG="$ENV_FILE,$LOCAL_OVERRIDE"
  echo "[dev:api] starting API server on http://localhost:3001 (env: $ENV_FILE + $LOCAL_OVERRIDE)"
else
  ENV_ARG="$ENV_FILE"
  echo "[dev:api] starting API server on http://localhost:3001 (env: $ENV_FILE)"
fi

cd "$REPO_ROOT"
exec bun --env-file="$ENV_ARG" run packages/api/src/server.ts
