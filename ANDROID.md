# Building OpenPencil for Android

These are the changes needed to run OpenPencil as an Android app, on phones and tablets
alike. The desktop build is unchanged: the platform-specific work sits behind
`isAndroid()`, `#[cfg(desktop)]`, or in files only Android compiles. See
[What changed](#what-changed) for the summary of each area.

## Requirements

| Tool        | Version used                               | Notes                                                |
| ----------- | ------------------------------------------ | ---------------------------------------------------- |
| Rust        | stable with `aarch64-linux-android` target | `rustup target add aarch64-linux-android`            |
| NDK         | r27 (`27.0.12077973`)                      | `export ANDROID_NDK_HOME=/path/to/ndk/27.0.12077973` |
| Java        | 17+                                        | Gradle 9 needs it                                    |
| Bun         | 1.x                                        | frontend deps and bundle                             |
| Android SDK | platform 37, build-tools 36+               | `compileSdk = 37`                                    |

```sh
bun install
bun run build          # produces dist/ — the Tauri asset bundle point this at
```

### A fresh clone does not build yet

`desktop/gen/android/` is checked in, but four files the Gradle build applies are generated
by the Tauri CLI and ignored by git (`gen/android/.gitignore`, `gen/android/app/.gitignore`):

| File                                     | What it carries                                            |
| ---------------------------------------- | ---------------------------------------------------------- |
| `gen/android/tauri.settings.gradle`      | the module list and the Rust plugin projects Tauri injects |
| `gen/android/app/tauri.build.gradle.kts` | the `rust` task, the `jniLibs` link, `abiFilters`          |
| `gen/android/app/tauri.properties`       | the Tauri version the app module builds against            |
| `gen/android/app/proguard-tauri.pro`     | the keep rules for the JNI entry points                    |

`settings.gradle` applies the first one unconditionally, so the clone fails before Gradle
even reads the project — and `./gradlew :app:rust` cannot repair itself, because the same
missing file is what stops Gradle from starting:

> Could not read script '.../gen/android/tauri.settings.gradle' as it does not exist.

Only the Tauri CLI writes these. `tauri android init` regenerates the scaffolding but not
this file, so run a build once — it may fail later on, in Rust or Gradle, and the four
files are already in place by then:

```sh
cd desktop
bun tauri android build --apk --target aarch64
```

Everything here is generated from `tauri.conf.json` and the plugin list, so regenerating it
is safe: re-running the CLI leaves the tracked Kotlin, `app/build.gradle.kts` and
`settings.gradle` untouched, and rewrites these four byte for byte. Re-run it after
changing `tauri.conf.json` or adding a Rust plugin, since the plugin list lives in
`tauri.settings.gradle`.

## Build the Rust library

The Gradle `rust` task shells out to `tauri android android-studio-script`, which needs a
healthy `@tauri-apps/cli`. When that call misbehaves, build the library directly — the
Gradle task only copies the result into `jniLibs` anyway:

```sh
NDK=$ANDROID_NDK_HOME
# The prebuilt toolchain dir is host-specific: linux-x86_64, darwin-x86_64 or
# windows-x86_64 depending on where the NDK was installed.
HOST_OS=$(uname -s | tr '[:upper:]' '[:lower:]')   # linux / darwin
[ "$HOST_OS" = darwin ] && HOST_OS=darwin || HOST_OS=linux
TC=$NDK/toolchains/llvm/prebuilt/${HOST_OS}-x86_64/bin

export CC_aarch64_linux_android=$TC/aarch64-linux-android26-clang
export AR_aarch64_linux_android=$TC/llvm-ar
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=$TC/aarch64-linux-android26-clang

# generate_context!() reads desktop/icons/32x32.png at compile time; the icons are
# not committed, so generate them first (normally done by beforeBuildCommand).
cd desktop
bun run generate:icons --target desktop

cargo build --release --target aarch64-linux-android --lib \
  --features tauri/custom-protocol
```

`--features tauri/custom-protocol` is **not optional**. Without it Tauri compiles in dev
mode and the WebView asks `devUrl` for the page instead of reading the assets embedded in
the `.so`, which looks exactly like "the app cannot reach the network" at launch, or like a
white screen on a device with no dev server behind it.

The string `localhost:1420` is _not_ a usable test for this: it comes from `devUrl` in
`tauri.conf.json`, which every build compiles in. The difference is the asset table, so
check for the bundled scripts instead:

```sh
strings target/aarch64-linux-android/release/libopen_pencil_lib.so \
  | grep -cE '/assets/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.js'
# hundreds → production build, assets embedded
# 0        → dev build, will fail without a dev server
```

For reference, the two builds side by side on `aarch64-linux-android`:

| Build                              | `/assets/*.js` | `localhost:1420` |
| ---------------------------------- | -------------- | ---------------- |
| debug, no feature                  | 0              | 1                |
| `--features tauri/custom-protocol` | 709            | 1                |

The library's size moves the same way — a dev-mode one stays near its unstripped Rust
size, while a production one carries the whole of `dist/` inside the `.so`.

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
`OPENPENCIL_KEY_ALIAS`, `OPENPENCIL_KEY_PASSWORD`. When either is present, Gradle signs
the APK during `assembleArm64Release` and no extra step is needed. Without either, the
release build is unsigned (`app-arm64-release-unsigned.apk`) and must be aligned and
signed before it will install:

```sh
OUT=app/build/outputs/apk/release
BT=$ANDROID_HOME/build-tools/36.0.0
$BT/zipalign -p -f 4 "$OUT/app-arm64-release-unsigned.apk" "$OUT/app-arm64-release.apk"
$BT/apksigner sign --ks my-release.keystore \
  --ks-pass 'pass:<store-password>' --ks-key-alias openpencil \
  --key-pass 'pass:<key-password>' "$OUT/app-arm64-release.apk"
```

To create a keystore:

```sh
keytool -genkeypair -v -keystore my-release.keystore -alias openpencil \
  -keyalg RSA -keysize 2048 -validity 10000
```

## Install

```sh
adb install -r app/build/outputs/apk/release/app-arm64-release.apk
```

If the APK above does not exist, you are looking at `app-arm64-release-unsigned.apk` —
sign it first (see [Signing](#signing)).

The package id is `net.dannote.open_pencil`, minimum SDK 24, arm64-v8a only.

## What changed

| Area                                                            | Change                                                                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `desktop/src/lib.rs`                                            | `fix-path-env`, the native menu, deep links, the updater and the close-to-quit handshake are `#[cfg(desktop)]`                                                                       |
| `desktop/src/credentials.rs`                                    | file-backed credential store for Android (`keyring` has no Android backend)                                                                                                          |
| `desktop/src/files/recent.rs`                                   | no-op on mobile; the menu it feeds is desktop-only                                                                                                                                   |
| `desktop/capabilities/`                                         | `default.json` and `updater.json` scoped to desktop, new `mobile.json` for Android                                                                                                   |
| `desktop/gen/android/`                                          | Gradle project tracked: window insets in `MainActivity`, launcher icons, SDK levels, signing wiring                                                                                  |
| `desktop/gen/android/.../MainActivity.kt`                       | applies the top window inset to the WebView so the status bar stops covering the toolbar                                                                                             |
| `src/app/tauri/env.ts`                                          | `isAndroid()`                                                                                                                                                                        |
| `src/app/settings/mcp/`                                         | `MCP_SETTINGS_ENABLED`, hides the MCP tab on Android                                                                                                                                 |
| `src/components/shell/AppMenu.vue`                              | Save button in the panel header on Android — the native menu is desktop-only and the floating HUD is not rendered in the wide layout, so there was no way to save without a keyboard |
| `desktop/src/android_save.rs` + `gen/android/.../SavePlugin.kt` | writes to the `content://` document the system picker returns; `std::fs` cannot open one, so the copy goes through the ContentResolver                                               |
| `src/app/document/io/write.ts`                                  | stages the file in the cache directory and hands the path to the platform, instead of sending megabytes over IPC                                                                     |

## Saving on Android

`Save` opens the system "save as" sheet and writes through
`ACTION_CREATE_DOCUMENT`'s `content://` URI. The app stages the document in its cache
directory first and the Kotlin side copies it through the ContentResolver — the
`fs` plugin resolves paths with `std::fs`, which cannot open a document URI.

The chosen URI is remembered for the session, so a second `Save` writes to the same
document without asking again. Android's grant for that URI does not survive a process
restart: after reopening the app, saving asks for a location once more.

## Known limitations

- **arm64 only.** `abiFilters` is not set, but only an arm64 library is built; add
  `armeabi-v7a`/`x86_64` to `CARGO` targets and rebuild if you need other devices.
- **No back-button handling.** The Android back gesture leaves the app rather than
  popping the current dialog or tool.
- **No mobile file picker integration.** Opening a `.fig` from another app's share sheet
  goes through the deep-link path, which is desktop-only; use File → Open inside the app.
