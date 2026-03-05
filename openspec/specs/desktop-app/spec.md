# desktop-app Specification

## Purpose
Tauri v2 desktop shell. Cross-platform native menu bar with wired events, Developer Tools access, and `desktop/` directory structure for Tauri configuration and Rust source.
## Requirements
### Requirement: Tauri v2 desktop shell
The editor SHALL run as a native desktop app via Tauri v2 with the web frontend loaded in a webview. The app identifier SHALL be `net.dannote.open-pencil`. When running inside the Tauri webview, the service worker SHALL NOT be registered to avoid intercepting Tauri IPC and native file system requests.

#### Scenario: Desktop app launch
- **WHEN** user runs `bun run tauri dev`
- **THEN** a native desktop window opens with the editor UI and CanvasKit rendering

#### Scenario: No service worker in Tauri
- **WHEN** the app loads inside the Tauri webview
- **THEN** `navigator.serviceWorker.register` is never called and no SW is active

### Requirement: Native macOS menu bar
The desktop app SHALL display a native menu bar. On macOS, an app-level submenu (OpenPencil) with About, Services, Hide, Hide Others, Show All, and Quit items SHALL be shown. On Windows and Linux, this submenu SHALL be omitted. File, Edit, View, Object, Window, and Help menus SHALL be present on all platforms.

#### Scenario: Menu bar on macOS
- **WHEN** the desktop app launches on macOS
- **THEN** a native menu bar with the OpenPencil app submenu and all standard menus is visible

#### Scenario: Menu bar on Windows
- **WHEN** the desktop app launches on Windows
- **THEN** a native menu bar with File, Edit, View, Object, Window, and Help menus is visible and no macOS-specific app submenu is present

#### Scenario: Menu bar on Linux
- **WHEN** the desktop app launches on Linux
- **THEN** a native menu bar with File, Edit, View, Object, Window, and Help menus is visible and no macOS-specific app submenu is present

### Requirement: Menu events wired to frontend
Menu item clicks SHALL fire events that the Vue frontend handles (e.g., Undo, Redo, Zoom In/Out).

#### Scenario: Menu undo
- **WHEN** user clicks Edit → Undo in the menu bar
- **THEN** the frontend receives the undo event and performs undo

### Requirement: Developer tools menu item
The menu SHALL include a Developer Tools item (⌘⌥I) that opens the webview inspector.

#### Scenario: Open dev tools
- **WHEN** user selects View → Developer Tools or presses ⌘⌥I
- **THEN** the webview developer tools panel opens

### Requirement: Desktop directory structure
The Tauri configuration and Rust source SHALL live in `desktop/` (not `src-tauri/`). Tauri CLI SHALL find it by scanning.

#### Scenario: Build from desktop directory
- **WHEN** `bun run tauri build` is run
- **THEN** Tauri finds configuration in `desktop/` and produces a native binary

### Requirement: Cross-platform build
The desktop app SHALL compile and build on macOS, Windows, and Linux without platform-specific errors.

#### Scenario: Windows build
- **WHEN** `bun run tauri build` is run on Windows with MSVC toolchain installed
- **THEN** the build completes successfully and produces a Windows executable

#### Scenario: Linux build
- **WHEN** `bun run tauri build` is run on Linux with required system libraries installed
- **THEN** the build completes successfully and produces a Linux binary

### Requirement: Platform prerequisites documentation
The README SHALL document platform-specific prerequisites for building the desktop app on macOS, Windows, and Linux.

#### Scenario: Windows prerequisites documented
- **WHEN** a developer reads the README on Windows
- **THEN** they find instructions for installing Rust (stable-msvc), Visual Studio Build Tools, and WebView2

#### Scenario: macOS prerequisites documented
- **WHEN** a developer reads the README on macOS
- **THEN** they find instructions for installing Xcode Command Line Tools

#### Scenario: Linux prerequisites documented
- **WHEN** a developer reads the README on Linux
- **THEN** they find instructions for installing required system libraries (webkit2gtk, etc.)

### Requirement: Tauri native Save/Open dialogs
The desktop app SHALL use Tauri plugin-dialog and plugin-fs for native file dialogs and filesystem access. Open dialog filters for .fig files. Save dialog defaults to "Untitled.fig".

#### Scenario: Open file via native dialog
- **WHEN** user presses ⌘O in the desktop app
- **THEN** the native OS file picker opens and the selected .fig file is imported

#### Scenario: Save As via native dialog
- **WHEN** user selects File → Save As
- **THEN** a native OS save dialog opens and the file is written to the chosen path

### Requirement: Zstd compression via Rust command
The Tauri backend SHALL expose a Rust command for Zstd compression/decompression, used by .fig export for better performance than JavaScript alternatives.

#### Scenario: Zstd compress via IPC
- **WHEN** the frontend requests Zstd compression of a buffer
- **THEN** the Rust backend compresses it and returns the result via Tauri IPC

### Requirement: GitHub Actions CI/CD build workflow
The project SHALL include a GitHub Actions workflow (`.github/workflows/build.yml`) that builds Tauri desktop apps for Windows (x64, arm64) and macOS (x64, arm64). The workflow triggers on version tags (`v*`) and `workflow_dispatch`. Build artifacts are uploaded as draft GitHub releases via `tauri-apps/tauri-action`.

#### Scenario: Tag-triggered build
- **WHEN** a tag matching `v*` is pushed
- **THEN** GitHub Actions builds Windows and macOS binaries and creates a draft release

#### Scenario: Manual build trigger
- **WHEN** a maintainer triggers `workflow_dispatch`
- **THEN** the build runs for all platform/architecture combinations

#### Scenario: Build matrix
- **WHEN** the workflow runs
- **THEN** it builds for: windows-x64 (x86_64-pc-windows-msvc), windows-arm64 (aarch64-pc-windows-msvc), macos-arm64 (aarch64-apple-darwin), macos-x64 (x86_64-apple-darwin)

### Requirement: Monorepo with @open-pencil/core
The project SHALL use a Bun workspace monorepo. The engine (scene-graph, renderer, layout, codec, kiwi, types) SHALL be extracted to `packages/core/` (@open-pencil/core) with zero DOM dependencies. The app's `src/engine/` files become re-export shims. Core is importable by CLI, tests, and the app.

#### Scenario: Core has no DOM dependencies
- **WHEN** @open-pencil/core is imported in a Bun/Node environment without browser APIs
- **THEN** it loads successfully


### Requirement: System font commands via font-kit
The Tauri backend SHALL expose two Rust commands using the font-kit crate: `list_system_fonts` (returns all system font families with style names, cached via OnceLock) and `load_system_font` (loads font data by family + style name, with weight matching and fallback to first font in family). The TS font shim SHALL detect Tauri runtime and use invoke() instead of queryLocalFonts.

#### Scenario: List system fonts
- **WHEN** the frontend calls list_system_fonts via Tauri invoke
- **THEN** a sorted list of font families with styles is returned

#### Scenario: Load specific font style
- **WHEN** the frontend requests "Inter" "Bold" via load_system_font
- **THEN** the font data (ArrayBuffer) is returned and registered with the font provider

#### Scenario: Font list caching
- **WHEN** list_system_fonts is called multiple times
- **THEN** the result is cached (OnceLock) and returned instantly after the first call

### Requirement: CSS font face registration
System font faces SHALL be registered with document.fonts for CSS preview in the font picker. Each system font creates a FontFace pointing to local() source.

#### Scenario: Font preview in picker
- **WHEN** system fonts are loaded in Tauri
- **THEN** font faces are registered so CSS can render preview text in each font

### Requirement: App identity
The Cargo crate SHALL be named `open_pencil` and the binary `OpenPencil`. The macOS Dock SHALL display "OpenPencil". The app icon SHALL use the pencil loader icon.

#### Scenario: macOS Dock name
- **WHEN** the app is running on macOS
- **THEN** the Dock displays "OpenPencil" (not "open-pencil-app")
