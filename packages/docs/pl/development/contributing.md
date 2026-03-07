# Współtworzenie

## Struktura projektu

```
packages/
  core/              @open-pencil/core — silnik (zero zależności DOM)
    src/             Graf sceny, renderer, layout, kodek, kiwi, typy
  cli/               @open-pencil/cli — headless CLI do operacji .fig
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — serwer MCP dla narzędzi AI
    src/             Transporty stdio + HTTP (Hono), 75 narzędzi
src/
  components/        Vue SFCs (canvas, panele, pasek narzędzi, wybieracz kolorów)
    properties/      Sekcje panelu właściwości (Wygląd, Wypełnienie, Obrys, itp.)
  composables/       Wejście canvasu, skróty klawiszowe, hooki renderowania
  stores/            Stan edytora (reaktywność Vue)
  engine/            Shimy re-eksportu z @open-pencil/core
  kiwi/              Shimy re-eksportu z @open-pencil/core
  types.ts           Współdzielone typy (re-eksportowane z core)
  constants.ts       Kolory UI, wartości domyślne, progi
desktop/             Tauri v2 (Rust + config)
tests/
  e2e/               Regresja wizualna Playwright
  engine/            Testy jednostkowe (bun:test)
docs/                Strona dokumentacji VitePress
openspec/
  specs/             Specyfikacje możliwości (źródło prawdy)
  changes/           Aktywne i zarchiwizowane zmiany
```

## Konfiguracja deweloperska

```sh
bun install
bun run dev          # Edytor na localhost:1420
bun run docs:dev     # Dokumentacja na localhost:5173
```

## Styl kodu

### Narzędzia

| Narzędzie | Polecenie | Cel |
|-----------|-----------|-----|
| oxlint | `bun run lint` | Linting (oparty na Rust, szybki) |
| oxfmt | `bun run format` | Formatowanie kodu |
| tsgo | `bun run typecheck` | Sprawdzanie typów (checker TypeScript oparty na Go) |

Uruchom wszystkie sprawdzenia:

```sh
bun run check
```

### Konwencje

- **Nazwy plików** — kebab-case (`scene-graph.ts`, `use-canvas-input.ts`)
- **Komponenty** — PascalCase Vue SFCs (`EditorCanvas.vue`, `ScrubInput.vue`)
- **Stałe** — SCREAMING_SNAKE_CASE
- **Funkcje/zmienne** — camelCase
- **Typy/interfejsy** — PascalCase

### Konwencje dla agentów AI

Deweloperzy i agenci AI powinni przeczytać `AGENTS.md` w katalogu głównym repo ([zobacz na GitHub](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)). Obejmuje renderowanie, graf sceny, komponenty i instancje, layout, UI, format pliku, konwencje Tauri i znane problemy.

## Wprowadzanie zmian

1. Sprawdzić istniejące [specyfikacje openspec](/development/openspec)
2. Utworzyć zmianę openspec jeśli dodajesz nowe zachowanie: `openspec new change "moja-zmiana"`
3. Zaimplementować zmianę
4. Uruchomić `bun run check` i `bun run test`
5. Wysłać pull request

## Kluczowe pliki

Kod źródłowy silnika znajduje się w `packages/core/src/`. Katalogi `src/engine/` i `src/kiwi/` aplikacji to shimy re-eksportu — edytuj pakiet core, nie shimy.

| Plik | Cel |
|------|-----|
| `packages/core/src/scene-graph.ts` | Graf sceny: węzły, zmienne, instancje, hit testing |
| `packages/core/src/renderer.ts` | Pipeline renderowania CanvasKit |
| `packages/core/src/layout.ts` | Adapter layoutu Yoga |
| `packages/core/src/undo.ts` | Menedżer cofnij/ponów |
| `packages/core/src/clipboard.ts` | Schowek kompatybilny z Figmą |
| `packages/core/src/vector.ts` | Model sieci wektorowej |
| `packages/core/src/render-image.ts` | Eksport obrazu offscreen (PNG/JPG/WEBP) |
| `packages/core/src/kiwi/codec.ts` | Koder/dekoder binarny Kiwi |
| `packages/core/src/kiwi/fig-import.ts` | Logika importu plików .fig |
| `packages/cli/src/index.ts` | Punkt wejścia CLI |
| `packages/core/src/tools/schema.ts` | Ujednolicone definicje narzędzi (AI, MCP, CLI) |
| `packages/core/src/figma-api.ts` | Implementacja Figma Plugin API |
| `packages/mcp/src/server.ts` | Fabryka serwera MCP |
| `packages/cli/src/commands/` | Polecenia CLI (info, tree, find, export, eval, analyze) |
| `src/stores/editor.ts` | Globalny stan edytora |
| `src/composables/use-canvas.ts` | Composable renderowania canvasu |
| `src/composables/use-canvas-input.ts` | Obsługa wejścia mysz/dotyk |
| `src/composables/use-keyboard.ts` | Obsługa skrótów klawiszowych |
