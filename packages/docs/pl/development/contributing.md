# Współtworzenie

## Struktura projektu

```
packages/
  core/              @open-pencil/core — silnik (zero zależności DOM)
    src/             Graf sceny, renderer, layout, kodek, kiwi, typy
  cli/               @open-pencil/cli — headless CLI do operacji .fig
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — serwer MCP dla narzędzi AI
    src/             Transporty stdio + HTTP (Hono), 87 narzędzi
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

3. Zaimplementować zmianę
4. Uruchomić `bun run check` i `bun run test`
5. Wysłać pull request

## Kluczowe pliki

Kod źródłowy silnika core znajduje się w `packages/core/src/`. Kod aplikacyjny edytora, dokumentów, AI, współpracy, shella, demo i automatyzacji znajduje się w `src/app/*`; SDK Vue zawiera wielokrotnego użytku kod canvasu i composable w `packages/vue/src/`.

| Plik | Cel |
|------|-----|
| `packages/core/src/scene-graph/` | Graf sceny: węzły, zmienne, instancje, hit testing |
| `packages/core/src/canvas/renderer.ts` | Pipeline renderowania CanvasKit |
| `packages/core/src/layout.ts` | Adapter layoutu Yoga |
| `packages/core/src/scene-graph/undo.ts` | Menedżer cofnij/ponów |
| `packages/core/src/clipboard.ts` | Schowek kompatybilny z Figmą |
| `packages/core/src/vector/` | Model sieci wektorowej |
| `packages/core/src/io/formats/raster/render.ts` | Eksport obrazu offscreen (PNG/JPG/WEBP) |
| `packages/core/src/kiwi/binary/codec.ts` | Koder/dekoder binarny Kiwi |
| `packages/core/src/kiwi/fig-import.ts` | Logika importu plików .fig |
| `packages/cli/src/index.ts` | Punkt wejścia CLI |
| `packages/core/src/tools/` | Ujednolicone definicje narzędzi (AI, MCP, CLI) |
| `packages/core/src/figma-api/` | Implementacja Figma Plugin API |
| `packages/mcp/src/server.ts` | Fabryka serwera MCP |
| `packages/cli/src/commands/` | Polecenia CLI (info, tree, find, export, eval, analyze) |
| `src/app/editor/session/create.ts` | Editor session assembly |
| `packages/vue/src/canvas/CanvasRoot.vue` | Composable renderowania canvasu |
| `packages/vue/src/canvas/useCanvasInput.ts` | Obsługa wejścia mysz/dotyk |
| `src/app/shell/keyboard/use.ts` | Obsługa skrótów klawiszowych |
