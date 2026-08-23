# Pierwsze kroki

## Wersja internetowa

OpenPencil działa bezpośrednio w przeglądarce i nie wymaga instalacji. Otwórz [app.openpencil.dev](https://app.openpencil.dev), aby rozpocząć pracę.

Jeśli chcesz zbudować własny produkt na bazie OpenPencil, a nie tylko korzystać z gotowej aplikacji, przejdź do sekcji [Automatyzacja](/programmable/) lub dokumentacji [Vue SDK](/programmable/sdk/).

## Aplikacja na komputer

Gotowe wersje dla macOS, Windows i Linux są dostępne na [stronie wydań](https://github.com/open-pencil/open-pencil/releases/latest).

| Platforma | Plik |
|-----------|------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Instalacja w macOS przez Homebrew

```sh
brew install open-pencil/tap/open-pencil
```

Polecenie instaluje najnowszą podpisaną wersję dla komputerów Mac z Apple Silicon lub procesorem Intel. Homebrew tap jest aktualizowany przy każdym wydaniu.

## Budowanie ze źródeł

### Wymagania

- [Bun](https://bun.sh/) — runtime i package manager;
- [Rust](https://rustup.rs/) — tylko do aplikacji Tauri.

### Instalacja

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

### Serwer deweloperski

```sh
bun run dev
```

Edytor będzie dostępny pod adresem `http://localhost:1420`.

### Polecenia

| Polecenie | Zastosowanie |
|-----------|--------------|
| `bun run dev` | Uruchamia serwer deweloperski z HMR |
| `bun run build` | Buduje wersję produkcyjną |
| `bun run check` | Uruchamia oxlint i sprawdzanie typów za pomocą tsgo |
| `bun run test` | Uruchamia testy E2E i testy wyglądu w Playwright |
| `bun run test:update` | Aktualizuje wzorcowe zrzuty ekranu |
| `bun run test:unit` | Uruchamia testy jednostkowe za pomocą bun:test |
| `bun run docs:dev` | Uruchamia serwer deweloperski dokumentacji |
| `bun run docs:build` | Szybko buduje dokumentację do lokalnej weryfikacji |
| `bun run docs:build:production` | Buduje pełną wersję dokumentacji do publikacji, w tym pliki dla LLM |

## Aplikacja Tauri

Do zbudowania aplikacji Tauri potrzebne są Rust i składniki systemowe właściwe dla danej platformy.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Zainstaluj [Rust](https://rustup.rs/) z toolchain `stable-msvc`:
   ```sh
   rustup default stable-msvc
   ```
2. Zainstaluj [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) i wybierz workload **Desktop development with C++**.
3. WebView2 jest już częścią Windows 10 w wersji 1803 lub nowszej oraz Windows 11.
4. Uruchom:
   ```sh
   bun run tauri dev
   ```

### Linux

W Debianie lub Ubuntu zainstaluj zależności systemowe:

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Następnie uruchom:

```sh
bun run tauri dev
```

### Budowanie pakietu instalacyjnego

```sh
bun run tauri build                                    # Bieżąca platforma
bun run tauri build --target universal-apple-darwin    # Universal binary dla macOS
```
