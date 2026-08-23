# Erste Schritte

## Webversion

OpenPencil läuft direkt im Browser und muss nicht installiert werden. Öffnen Sie [app.openpencil.dev](https://app.openpencil.dev), um mit der Gestaltung zu beginnen.

Wenn Sie ein eigenes Produkt auf OpenPencil aufbauen möchten, lesen Sie den Bereich [Automatisierung](/programmable/) und die Dokumentation zum [Vue SDK](/programmable/sdk/).

## Desktop-Anwendung

Fertige Versionen für macOS, Windows und Linux finden Sie auf der [Release-Seite](https://github.com/open-pencil/open-pencil/releases/latest).

| Plattform | Datei |
|-----------|-------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Installation unter macOS mit Homebrew

```sh
brew install open-pencil/tap/open-pencil
```

Der Befehl installiert die aktuelle signierte Version für Macs mit Apple Silicon oder Intel-Prozessor. Der Homebrew Tap wird bei jedem Release aktualisiert.

## Aus dem Quellcode erstellen

### Voraussetzungen

- [Bun](https://bun.sh/) als Runtime und Package Manager;
- [Rust](https://rustup.rs/) nur für die Tauri-Anwendung.

### Installation

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

### Entwicklungsserver

```sh
bun run dev
```

Der Editor ist anschließend unter `http://localhost:1420` erreichbar.

### Befehle

| Befehl | Zweck |
|--------|-------|
| `bun run dev` | Entwicklungsserver mit HMR starten |
| `bun run build` | Produktionsversion erstellen |
| `bun run check` | oxlint und Typprüfung mit tsgo ausführen |
| `bun run test` | E2E- und visuelle Regressionstests mit Playwright ausführen |
| `bun run test:update` | Referenz-Screenshots aktualisieren |
| `bun run test:unit` | Unit-Tests mit bun:test ausführen |
| `bun run docs:dev` | Entwicklungsserver der Dokumentation starten |
| `bun run docs:build` | Dokumentation schnell zur lokalen Prüfung erstellen |
| `bun run docs:build:production` | Vollständige veröffentlichungsfähige Dokumentation einschließlich LLM-Dateien erstellen |

## Tauri-Anwendung

Zum Erstellen der Tauri-Anwendung werden Rust und plattformspezifische Systemkomponenten benötigt.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Installieren Sie [Rust](https://rustup.rs/) mit der Toolchain `stable-msvc`:
   ```sh
   rustup default stable-msvc
   ```
2. Installieren Sie die [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) mit der Workload **Desktop development with C++**.
3. WebView2 ist in Windows 10 ab Version 1803 und in Windows 11 bereits enthalten.
4. Führen Sie Folgendes aus:
   ```sh
   bun run tauri dev
   ```

### Linux

Installieren Sie unter Debian oder Ubuntu die Systemabhängigkeiten:

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Führen Sie anschließend aus:

```sh
bun run tauri dev
```

### Installationspaket erstellen

```sh
bun run tauri build                                    # Aktuelle Plattform
bun run tauri build --target universal-apple-darwin    # Universal Binary für macOS
```
