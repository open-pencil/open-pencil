# Building OpenPencil for Android

This branch (`build/android-arm64`) carries the changes needed to run OpenPencil as an
Android tablet app. Nothing here is upstream; see [What changed](#what-changed) for the
short list and `git log` for the reasoning.

## Requirements

| Tool | Version used | Notes |
| --- | --- | --- |
| Rust | stable with `aarch64-linux-android` target | `rustup target add aarch64-linux-android` |
| NDK | r27 (`27.0.12077973`) | `export ANDROID_NDK_HOME=/path/to/ndk/27.0.12077973` |
| Java | 17+ | Gradle 9 needs it |
| Bun | 1.x | frontend deps and bundle |
| Android SDK | platform 37, build-tools 36+ | `compileSdk = 37` |

```sh
bun install
bun run build          # produces dist/ — the Tauri asset bundle point this at
```

## Build the Rust library

The Gradle `rust` task shells out to `tauri android android-studio-script`, which needs a
healthy `@tauri-apps/cli`. When that call misbehaves, build the library directly — the
Gradle task only copies the result into `jniLibs` anyway:

```sh
NDK=$ANDROID_NDK_HOME
TC=$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin

export CC_aarch64_linux_android=$TC/aarch64-linux-android26-clang
export AR_aarch64_linux_android=$TC/llvm-ar
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=$TC/aarch64-linux-android26-clang

cd desktop
cargo build --release --target aarch64-linux-android --lib \
  --features tauri/custom-protocol
```

`--features tauri/custom-protocol` is **not optional**. Without it Tauri compiles in dev
mode and the WebView requests `devUrl` (`http://localhost:1420`) instead of the embedded
assets, which looks exactly like "the app cannot reach the network" at launch. You can
check which one you got:

```sh
strings target/aarch64-linux-android/release/libopen_pencil_lib.so | grep -c localhost:1420
# 0 → production build, assets embedded
# 1 → dev build, will fail without a dev server
```

## Assemble the APK

```sh
cd desktop/gen/android
./gradlew assembleArm64Release
# app/build/outputs/apk/release/app-arm64-release.apk
```

`assembleArm64Debug` works too. Note that `app/src/main/jniLibs/arm64-v8a/libopen_pencil_lib.so`
is a symlink into `desktop/target/aarch64-linux-android/release/`, so a debug APK still
ships whatever the release library contains — rebuild the library, not just Gradle, before
concluding a fix did not apply.

## Signing

Release signing material is not in the repository. Either copy
`gen/android/keystore.properties.example` to `gen/android/keystore.properties` and fill it
in, or export `OPENPENCIL_KEYSTORE`, `OPENPENCIL_KEYSTORE_PASSWORD`,
`OPENPENCIL_KEY_ALIAS`, `OPENPENCIL_KEY_PASSWORD`. Without either, the release build is
unsigned and only installs after `apksigner` signs it with a debug key.

```sh
keytool -genkeypair -v -keystore my-release.keystore -alias openpencil \
  -keyalg RSA -keysize 2048 -validity 10000
```

## Install

```sh
adb install -r app/build/outputs/apk/release/app-arm64-release.apk
```

The package id is `net.dannote.open_pencil`, minimum SDK 24, arm64-v8a only.

## What changed

| Area | Change |
| --- | --- |
| `desktop/src/lib.rs` | `fix-path-env`, the native menu, deep links, the updater and the close-to-quit handshake are `#[cfg(desktop)]` |
| `desktop/src/credentials.rs` | file-backed credential store for Android (`keyring` has no Android backend) |
| `desktop/src/files/recent.rs` | no-op on mobile; the menu it feeds is desktop-only |
| `desktop/capabilities/` | `default.json` and `updater.json` scoped to desktop, new `mobile.json` for Android |
| `desktop/gen/android/` | Gradle project tracked: icons, `MainActivity`, SDK levels, signing wiring |
| `src/app/tauri/env.ts` | `isAndroid()` |
| `src/app/settings/mcp/` | `MCP_SETTINGS_ENABLED`, hides the MCP tab on Android |

## Known limitations

- **arm64 only.** `abiFilters` is not set, but only an arm64 library is built; add
  `armeabi-v7a`/`x86_64` to `CARGO` targets and rebuild if you need other devices.
- **No back-button handling.** The Android back gesture leaves the app rather than
  popping the current dialog or tool.
- **Crash dialog.** `MainActivity` installs an uncaught-exception handler that shows the
  stack trace in an `AlertDialog`. Useful on a device with no logcat, noisy for users.
  Remove the handler block in `onCreate` once the build is stable.
- **No mobile file picker integration.** Opening a `.fig` from another app's share sheet
  goes through the deep-link path, which is desktop-only; use File → Open inside the app.
- **Not upstreamed.** These are fork changes; upstream has no Android target.
