#!/usr/bin/env bash
# Probe: does an S3-compatible provider honour conditional writes
# (If-Match / If-None-Match)?
#
# sync-versioned-remote-layout phase 3 enables conditional head updates only
# where a live probe returns 412s as documented. Bunny documents conditional
# headers as explicitly unsupported; B2 and R2 are measured here.
#
# Results (2026-08-04):
#   B2  — no 412 on a stale If-Match; stays at conflictProtection 'detect'
#   R2  — 412 PreconditionFailed on both stale If-Match and If-None-Match '*';
#         the evidence for R2_STORAGE_PROVIDER.conflictProtection = 'prevent'
#
# Provider-agnostic despite where it started: pre-set VITE_OPENPENCIL_CLOUD_S3_*
# in the environment to point it anywhere. Reads .env.local otherwise. Writes and
# removes a single key OUTSIDE the app namespace: probe/conditional-writes.
set -euo pipefail
cd "$(dirname "$0")/.."
# Pre-set VITE_OPENPENCIL_CLOUD_S3_* in the environment to probe another
# provider (R2, MinIO, …) without touching the B2 creds in .env.local.
if [ -z "${VITE_OPENPENCIL_CLOUD_S3_ENDPOINT:-}" ]; then
  set -a; . ./.env.local; set +a
fi
export AWS_ACCESS_KEY_ID="$VITE_OPENPENCIL_CLOUD_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$VITE_OPENPENCIL_CLOUD_S3_SECRET_ACCESS_KEY"
# R2 signs as `auto` and rejects a B2 region name, and the resulting signature
# error surfaces as "no 412" — i.e. it reads as "conditional writes unsupported"
# rather than as a misconfiguration. Infer from the host so a repointed run
# cannot silently produce a false negative.
case "$VITE_OPENPENCIL_CLOUD_S3_ENDPOINT" in
  *r2.cloudflarestorage.com*) DEFAULT_REGION=auto ;;
  *) DEFAULT_REGION=eu-central-003 ;;
esac
export AWS_DEFAULT_REGION="${VITE_OPENPENCIL_CLOUD_S3_REGION:-$DEFAULT_REGION}"
EP="$VITE_OPENPENCIL_CLOUD_S3_ENDPOINT"
BUCKET="$VITE_OPENPENCIL_CLOUD_S3_BUCKET"
KEY="probe/conditional-writes"

printf 'one' > /tmp/b2cas-a
printf 'two' > /tmp/b2cas-b

aws --endpoint-url "$EP" s3api put-object --bucket "$BUCKET" --key "$KEY" --body /tmp/b2cas-a >/dev/null
ETAG=$(aws --endpoint-url "$EP" s3api head-object --bucket "$BUCKET" --key "$KEY" --query ETag --output text)

echo "-- If-Match with the CURRENT etag (expect success):"
if aws --endpoint-url "$EP" s3api put-object --bucket "$BUCKET" --key "$KEY" --body /tmp/b2cas-b --if-match "$ETAG" >/dev/null 2>/tmp/b2cas-err0; then
  echo OK
else
  echo "UNEXPECTED FAILURE:"; cat /tmp/b2cas-err0
fi

echo "-- If-Match with the STALE etag (expect 412 PreconditionFailed):"
if aws --endpoint-url "$EP" s3api put-object --bucket "$BUCKET" --key "$KEY" --body /tmp/b2cas-b --if-match "$ETAG" >/dev/null 2>/tmp/b2cas-err; then
  echo "NO 412 — conditional update not enforced"
else
  grep -o 'PreconditionFailed\|412' /tmp/b2cas-err | head -2 || echo "failed without 412:"; grep -o '"__type": "[^"]*"' /tmp/b2cas-err | head -1 || true
fi

echo "-- If-None-Match '*' against an existing key (expect 412):"
if aws --endpoint-url "$EP" s3api put-object --bucket "$BUCKET" --key "$KEY" --body /tmp/b2cas-b --if-none-match '*' >/dev/null 2>/tmp/b2cas-err2; then
  echo "NO 412 — conditional create not enforced"
else
  grep -o 'PreconditionFailed\|412' /tmp/b2cas-err2 | head -2 || echo "failed without 412"; grep -o '"__type": "[^"]*"' /tmp/b2cas-err2 | head -1 || true
fi

# Clean up every version, not just the current one: B2 retains versions by default.
# R2 has no object versioning, so list-object-versions fails there — and under
# `pipefail` that aborted the script before this cleanup ran, leaving the probe
# key in the bucket. Tolerate the failure, then delete the current object
# unconditionally so a non-versioned provider is still left clean.
aws --endpoint-url "$EP" s3api list-object-versions --bucket "$BUCKET" --prefix "$KEY" \
  --query 'Versions[].{K:Key,V:VersionId}' --output text 2>/dev/null |
  while read -r k v; do
    [ -n "${k:-}" ] && aws --endpoint-url "$EP" s3api delete-object --bucket "$BUCKET" --key "$k" --version-id "$v" >/dev/null
  done || true
aws --endpoint-url "$EP" s3api delete-object --bucket "$BUCKET" --key "$KEY" >/dev/null 2>&1 || true
rm -f /tmp/b2cas-a /tmp/b2cas-b /tmp/b2cas-err /tmp/b2cas-err2 /tmp/b2cas-err0
echo "cleaned up $KEY"
