# Rozpoczęcie pracy

## Wypróbuj online

OpenPencil działa w przeglądarce — bez instalacji. Otwórz [app.openpencil.dev](https://app.openpencil.dev).

## Pobierz aplikację desktopową

Binaria dla macOS, Windows i Linux na [stronie wydań](https://github.com/open-pencil/open-pencil/releases/latest).

| Platforma | Pobieranie |
|-----------|-----------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Kompilacja ze źródeł

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
bun run dev
```

Otwiera edytor na `http://localhost:1420`.

## Dostępne polecenia

| Polecenie | Opis |
|-----------|------|
| `bun run dev` | Serwer deweloperski z HMR |
| `bun run build` | Build produkcyjny |
| `bun run check` | Lint + sprawdzanie typów |
| `bun run test` | Testy E2E (Playwright) |
| `bun run docs:dev` | Serwer dokumentacji |

## Aplikacja desktopowa (Tauri)

Szczegółowe instrukcje dla każdej platformy w [wersji angielskiej](/guide/getting-started).
