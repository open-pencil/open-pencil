# Getting Started

## Try Online

OpenPencil runs in the browser — no installation required. Open [app.openpencil.dev](https://app.openpencil.dev) to start designing.

If you want to build on top of it instead of only using the default app, see the [Programmable](/programmable/) section and the [Vue SDK](/programmable/sdk/).

## Download Desktop App

Pre-built binaries for macOS, Windows, and Linux are available on the [releases page](https://github.com/open-pencil/open-pencil/releases/latest).

| Platform | Download |
| --------------------- | -------------------- |
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## System Requirements

OpenPencil renders with CanvasKit on WebGL and relies on current web platform features, so it needs a recent browser engine. The web app supports Chrome 111, Edge 111, Firefox 128, and Safari 16.4 or later; Chromium-based browsers such as Brave and Opera follow their Chrome version. The desktop app renders in the system WebView, so its floor is the operating system's engine:

| Platform | Requirement |
| -------- | ----------- |
| macOS | macOS 13 Ventura or later with the current Safari updates installed (Safari 16.4 shipped with macOS 13.3). |
| Windows | Windows 10 or later with the Microsoft Edge WebView2 Evergreen runtime, which updates itself. |
| Linux | WebKitGTK 2.40 or later (`webkit2gtk-4.1`). |

When the engine is too old, OpenPencil shows what to update instead of a blank window. If you see that notice on a system that meets the requirements, use its "Report a problem" link, which prefills the browser and engine details.

## macOS via Homebrew

```sh
brew install --cask openpencil
```

This installs the signed macOS app (Apple Silicon and Intel) from the [official Homebrew cask](https://formulae.brew.sh/cask/openpencil). Homebrew updates are reviewed upstream and may lag behind GitHub releases. For a release not yet available through Homebrew, use the [direct download](https://github.com/open-pencil/open-pencil/releases/latest).

The desktop cask does not install the CLI; install it separately with `npm install -g @open-pencil/cli`.

If you used the archived custom tap, migrate with:

```sh
brew uninstall open-pencil/tap/open-pencil
brew install --cask openpencil
```

## Building from Source

### Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Rust](https://rustup.rs/) (for desktop app only)

## Installation

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

## Development Server

```sh
bun run dev
```

Opens the editor at `http://localhost:1420`.

## Available Scripts

| Command | Description |
| ------------------------------- | --------------------------------------------------- |
| `bun run dev` | Dev server with HMR |
| `bun run build` | Production build |
| `bun run check` | Lint (oxlint) + typecheck (tsgo) |
| `bun run test` | E2E visual regression (Playwright) |
| `bun run test:update` | Regenerate screenshot baselines |
| `bun run test:unit` | Unit tests (bun:test) |
| `bun run docs:dev` | Documentation dev server |
| `bun run docs:build` | Build documentation locally (fast validation build) |
| `bun run docs:build:production` | Build deployable documentation, including LLM files |

## Desktop App (Tauri)

The desktop app requires Rust and platform-specific prerequisites.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Install [Rust](https://rustup.rs/) with `stable-msvc` toolchain:
   ```sh
   rustup default stable-msvc
   ```
2. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++" workload
3. WebView2 is pre-installed on Windows 10 (1803+) and Windows 11
4. Run:
   ```sh
   bun run tauri dev
   ```

### Linux

Install system dependencies (Debian/Ubuntu):

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Then:

```sh
bun run tauri dev
```

### Build for Distribution

```sh
bun run tauri build                                    # Current platform
bun run tauri build --target universal-apple-darwin    # macOS universal
```
