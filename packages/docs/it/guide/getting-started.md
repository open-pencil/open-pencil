# Per iniziare

## Prova online

OpenPencil funziona nel browser — nessuna installazione richiesta. Apri [app.openpencil.dev](https://app.openpencil.dev) per iniziare a progettare.

## Scarica l'app desktop

Binari precompilati per macOS, Windows e Linux sono disponibili nella [pagina dei rilasci](https://github.com/open-pencil/open-pencil/releases/latest).

| Piattaforma | Download |
|-------------|----------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Compilare dal sorgente

### Prerequisiti

- [Bun](https://bun.sh/) (gestore pacchetti e runtime)
- [Rust](https://rustup.rs/) (solo per l'app desktop)

## Installazione

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

## Server di sviluppo

```sh
bun run dev
```

Apre l'editor su `http://localhost:1420`.

## Comandi disponibili

| Comando | Descrizione |
|---------|-------------|
| `bun run dev` | Server di sviluppo con HMR |
| `bun run build` | Build di produzione |
| `bun run check` | Lint (oxlint) + controllo tipi (tsgo) |
| `bun run test` | E2E regressione visuale (Playwright) |
| `bun run test:unit` | Test unitari (bun:test) |
| `bun run docs:dev` | Server documentazione |
| `bun run docs:build` | Build sito documentazione |

## App desktop (Tauri)

L'app desktop richiede Rust e prerequisiti specifici per la piattaforma. Consultare la [versione inglese](/guide/getting-started) per le istruzioni dettagliate per macOS, Windows e Linux.

```sh
bun run tauri dev
```
