#!/usr/bin/env bash
# Builds a signed Lawha APK for arm64 Android phones.
# Needs ANDROID_HOME and NDK_HOME, and a keystore: LAWHA_KEYSTORE, LAWHA_KEYSTORE_PASS.
set -euo pipefail
cd "$(dirname "$0")"
[ -e tauri ] || ln -s ../node_modules/@tauri-apps/cli/tauri.js tauri
[ -d gen/android ] || node tauri android init --ci
cp -r icons/android/* gen/android/app/src/main/res/
node tauri android build --apk --target aarch64 --ci
BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"
UNSIGNED=gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk
OUT=${1:-../Lawha-android-arm64.apk}
"$BT/zipalign" -f -p 4 "$UNSIGNED" "$OUT.aligned"
"$BT/apksigner" sign --ks "$LAWHA_KEYSTORE" --ks-pass "pass:$LAWHA_KEYSTORE_PASS" --out "$OUT" "$OUT.aligned"
rm -f "$OUT.aligned" "$OUT.idsig"
"$BT/apksigner" verify "$OUT"
echo "Built $OUT"
