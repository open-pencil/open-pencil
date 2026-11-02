# Pierwsze kroki

## Wersja internetowa

Lawha działa bezpośrednio w przeglądarce i nie wymaga instalacji. Otwórz [app.lawha.invalid](https://app.lawha.invalid), aby rozpocząć pracę.

Jeśli chcesz zbudować własny produkt na bazie Lawha, a nie tylko korzystać z gotowej aplikacji, przejdź do sekcji [Automatyzacja](/programmable/) lub dokumentacji [Vue SDK](/programmable/sdk/).

## Aplikacja na komputer

Gotowe wersje dla macOS, Windows i Linux są dostępne na [stronie pobierania](/pl/download).

| Platforma | Plik |
| --------------------- | -------------------- |
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Wymagania systemowe {#system-requirements}

Lawha renderuje przez CanvasKit na WebGL i korzysta z nowoczesnych funkcji platformy webowej, dlatego wymaga aktualnego silnika przeglądarki. Wersja internetowa działa w Chrome 111, Edge 111, Firefox 128 i Safari 16.4 lub nowszych; przeglądarki oparte na Chromium, takie jak Brave i Opera, odpowiadają wersji Chrome, na której bazują. Aplikacja na komputer renderuje w systemowym WebView, więc jej minimum wyznacza silnik systemu operacyjnego:

| Platforma | Wymaganie |
| --------- | --------- |
| macOS | macOS 13 Ventura lub nowszy z zainstalowanymi bieżącymi aktualizacjami Safari (Safari 16.4 trafiło do systemu w macOS 13.3). |
| Windows | Windows 10 lub nowszy z środowiskiem Microsoft Edge WebView2 Evergreen, które aktualizuje się samo. |
| Linux | WebKitGTK 2.40 lub nowszy (`webkit2gtk-4.1`). |

Gdy silnik jest zbyt stary, Lawha zamiast pustego okna pokazuje, co należy zaktualizować. Jeśli widzisz to powiadomienie w systemie spełniającym wymagania, użyj odnośnika „Report a problem”, który uzupełnia dane przeglądarki i silnika.

## Instalacja w macOS przez Homebrew

```sh
brew install --cask lawha
```

Polecenie instaluje podpisaną aplikację dla komputerów Mac z Apple Silicon lub procesorem Intel z [oficjalnego katalogu Homebrew](https://formulae.brew.sh/cask/lawha). Aktualizacje są weryfikowane przez Homebrew i mogą pojawiać się później niż wydania na GitHubie. W tym czasie skorzystaj z [bezpośredniego pobierania](https://github.com/aliaaldihnayn-lab/design/releases/latest). CLI instaluje się osobno: `npm install -g @lawha/cli`.

Jeśli używałeś zarchiwizowanego własnego tapa, przeprowadź migrację:

```sh
brew uninstall lawha/tap/lawha
brew install --cask lawha
```

## Budowanie ze źródeł {#building-from-source}

### Wymagania

- [Bun](https://bun.sh/) — runtime i package manager;
- [Rust](https://rustup.rs/) — tylko do aplikacji Tauri.

### Instalacja

```sh
git clone https://github.com/aliaaldihnayn-lab/design.git
cd lawha
bun install
```

### Serwer deweloperski

```sh
bun run dev
```

Edytor będzie dostępny pod adresem `http://localhost:1420`.

### Polecenia

| Polecenie | Zastosowanie |
| ------------------------------- | ------------------------------------------------------------------- |
| `bun run dev` | Uruchamia serwer deweloperski z HMR |
| `bun run build` | Buduje wersję produkcyjną |
| `bun run check` | Uruchamia oxlint i sprawdzanie typów za pomocą TypeScript 7 |
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
