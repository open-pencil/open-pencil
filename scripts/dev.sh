#!/usr/bin/env bash
# scripts/dev.sh — API server (3001) + Vite (1420) を 1 コマンドで並行起動
#
# 使い方:
#   1) cp .env.development.example .env.development  (初回のみ)
#   2) bun run dev:full
#
# 終了は Ctrl+C で両 process を一括停止。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.development"
EXAMPLE_FILE="$REPO_ROOT/.env.development.example"

if [ ! -f "$ENV_FILE" ]; then
  echo "[dev] .env.development が見つかりません。" >&2
  echo "[dev] cp $EXAMPLE_FILE $ENV_FILE してから再実行してください。" >&2
  exit 1
fi

API_PID=""
VITE_PID=""

cleanup() {
  echo ""
  echo "[dev] shutting down..."
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [ -n "$VITE_PID" ] && kill -0 "$VITE_PID" 2>/dev/null; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

API_LOCAL_OVERRIDE="$REPO_ROOT/.env.development.local"
if [ -f "$API_LOCAL_OVERRIDE" ]; then
  API_ENV_ARG="$ENV_FILE,$API_LOCAL_OVERRIDE"
  echo "[dev] starting API server on http://localhost:3001 (env: $ENV_FILE + $API_LOCAL_OVERRIDE)"
else
  API_ENV_ARG="$ENV_FILE"
  echo "[dev] starting API server on http://localhost:3001 (env: $ENV_FILE)"
fi
# dev:api と同じ cwd (repo root) で起動して INKLY_API_DB_PATH の相対解決を統一する
# (cwd が異なると packages/api 起点 vs repo root 起点で DB ファイルが分裂する)
(
  cd "$REPO_ROOT"
  exec bun --env-file="$API_ENV_ARG" run packages/api/src/server.ts
) &
API_PID=$!

echo "[dev] starting Vite dev server on http://localhost:1420"
# Vite に env-file を preload しない。 Vite 自身に .env / .env.development /
# .env.development.local の優先順 (local が最強) を解決させ、 開発者が
# .env.development.local で安全に override できるようにする。
# (bun --env-file= で process.env に先に注入すると Vite は existing process.env を尊重し、
# .env.development.local の上書きが効かなくなる)
(
  cd "$REPO_ROOT"
  exec bun run vite
) &
VITE_PID=$!

echo ""
echo "[dev] PIDs — api=$API_PID vite=$VITE_PID"
echo "[dev] Open http://localhost:1420/ (Landing) or /editor"
echo "[dev] Ctrl+C to stop both."
echo ""

# どちらかの child が落ちるまで polling で待つ。
# Bash 4.3+ の `wait -n` は使わない (macOS デフォルト Bash 3.2 では不正オプション)。
EXIT_CODE=0
while true; do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "[dev] API server exited; stopping vite as well."
    EXIT_CODE=1
    break
  fi
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "[dev] Vite exited; stopping API server as well."
    EXIT_CODE=1
    break
  fi
  sleep 1
done

exit "$EXIT_CODE"
