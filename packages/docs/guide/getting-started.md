# Getting Started

## Try Online

Inkly runs in the browser — no installation required. Open [app.inkly.dev](https://app.inkly.dev) to start designing.

If you want to build on top of it instead of only using the default app, see the [Programmable](/programmable/) section and the [Vue SDK](/programmable/sdk/).

## Download Desktop App

Pre-built binaries for macOS, Windows, and Linux are available on the [releases page](https://github.com/cardene777/open-pencil/releases/latest).

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |


## macOS via Homebrew

```sh
brew install inkly/tap/inkly
```

This installs the latest signed release for macOS (Apple Silicon and Intel). The tap is auto-updated on each release.

## Building from Source

### Prerequisites

- [Bun](https://bun.sh/) (package manager and runtime)
- [Rust](https://rustup.rs/) (for desktop app only)

## Installation

```sh
git clone https://github.com/cardene777/open-pencil.git
cd inkly
bun install
```

## Development Server

```sh
bun run dev
```

Opens the editor at `http://localhost:1420`.

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server with HMR |
| `bun run build` | Production build |
| `bun run check` | Lint (oxlint) + typecheck (tsgo) |
| `bun run test` | E2E visual regression (Playwright) |
| `bun run test:update` | Regenerate screenshot baselines |
| `bun run test:unit` | Unit tests (bun:test) |
| `bun run docs:dev` | Documentation dev server |
| `bun run docs:build` | Build documentation site |

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
