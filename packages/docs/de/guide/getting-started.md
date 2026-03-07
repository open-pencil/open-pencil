# Erste Schritte

## Online testen

OpenPencil läuft im Browser — keine Installation nötig. Öffne [app.openpencil.dev](https://app.openpencil.dev) um loszulegen.

## Desktop-App herunterladen

Vorgefertigte Binärdateien für macOS, Windows und Linux sind auf der [Releases-Seite](https://github.com/open-pencil/open-pencil/releases/latest) verfügbar.

| Plattform | Download |
|-----------|----------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Aus Quellcode bauen

### Voraussetzungen

- [Bun](https://bun.sh/) (Paketmanager und Runtime)
- [Rust](https://rustup.rs/) (nur für Desktop-App)

## Installation

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

## Entwicklungsserver

```sh
bun run dev
```

Öffnet den Editor unter `http://localhost:1420`.

## Verfügbare Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `bun run dev` | Entwicklungsserver mit HMR |
| `bun run build` | Produktions-Build |
| `bun run check` | Lint (oxlint) + Typprüfung (tsgo) |
| `bun run test` | E2E visuelle Regression (Playwright) |
| `bun run test:update` | Screenshot-Baselines erneuern |
| `bun run test:unit` | Unit-Tests (bun:test) |
| `bun run docs:dev` | Dokumentations-Entwicklungsserver |
| `bun run docs:build` | Dokumentationsseite bauen |

## Desktop-App (Tauri)

Die Desktop-App benötigt Rust und plattformspezifische Voraussetzungen.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. [Rust](https://rustup.rs/) mit `stable-msvc`-Toolchain installieren:
   ```sh
   rustup default stable-msvc
   ```
2. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) mit der Workload „Desktopentwicklung mit C++" installieren
3. WebView2 ist auf Windows 10 (1803+) und Windows 11 vorinstalliert
4. Ausführen:
   ```sh
   bun run tauri dev
   ```

### Linux

Systemabhängigkeiten installieren (Debian/Ubuntu):

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Dann:

```sh
bun run tauri dev
```

### Für Distribution bauen

```sh
bun run tauri build                                    # Aktuelle Plattform
bun run tauri build --target universal-apple-darwin    # macOS Universal
```
