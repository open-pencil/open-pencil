# Primi passi

## Versione web

OpenPencil funziona direttamente nel browser e non richiede installazione. Apri [app.openpencil.dev](https://app.openpencil.dev) per iniziare a progettare.

Se vuoi creare un prodotto basato su OpenPencil invece di utilizzare soltanto l'applicazione predefinita, consulta la sezione [Automazione](/programmable/) e la documentazione del [Vue SDK](/programmable/sdk/).

## Applicazione desktop

Le versioni pronte per macOS, Windows e Linux sono disponibili nella [pagina delle versioni](https://github.com/open-pencil/open-pencil/releases/latest).

| Piattaforma | File |
|-------------|------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Installazione in macOS con Homebrew

```sh
brew install open-pencil/tap/open-pencil
```

Il comando installa l'ultima versione firmata per i Mac con Apple Silicon o processore Intel. Il tap Homebrew viene aggiornato a ogni versione.

## Compilazione dal codice sorgente

### Requisiti

- [Bun](https://bun.sh/) come runtime e package manager;
- [Rust](https://rustup.rs/) soltanto per l'applicazione Tauri.

### Installazione

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

### Server di sviluppo

```sh
bun run dev
```

L'editor sarà disponibile all'indirizzo `http://localhost:1420`.

### Comandi

| Comando | Funzione |
|---------|----------|
| `bun run dev` | Avvia il server di sviluppo con HMR |
| `bun run build` | Genera la versione di produzione |
| `bun run check` | Esegue oxlint e controlla i tipi con tsgo |
| `bun run test` | Esegue i test E2E e di regressione visiva con Playwright |
| `bun run test:update` | Aggiorna gli screenshot di riferimento |
| `bun run test:unit` | Esegue gli unit test con bun:test |
| `bun run docs:dev` | Avvia il server di sviluppo della documentazione |
| `bun run docs:build` | Genera rapidamente la documentazione per la verifica locale |
| `bun run docs:build:production` | Genera la documentazione completa per la pubblicazione, inclusi i file per gli LLM |

## Applicazione Tauri

Per compilare l'applicazione Tauri sono necessari Rust e i componenti di sistema specifici della piattaforma.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Installa [Rust](https://rustup.rs/) con il toolchain `stable-msvc`:
   ```sh
   rustup default stable-msvc
   ```
2. Installa [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) e seleziona il workload **Desktop development with C++**.
3. WebView2 è già incluso in Windows 10 dalla versione 1803 e in Windows 11.
4. Esegui:
   ```sh
   bun run tauri dev
   ```

### Linux

In Debian o Ubuntu, installa le dipendenze di sistema:

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Quindi esegui:

```sh
bun run tauri dev
```

### Generare un pacchetto di installazione

```sh
bun run tauri build                                    # Piattaforma corrente
bun run tauri build --target universal-apple-darwin    # Universal Binary per macOS
```
