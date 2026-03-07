# Mitwirken

## Projektstruktur

```
packages/
  core/              @open-pencil/core — Engine (keine DOM-Abhängigkeiten)
    src/             Szenengraph, Renderer, Layout, Codec, Kiwi, Typen
  cli/               @open-pencil/cli — Headless-CLI für .fig-Operationen
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — MCP-Server für KI-Werkzeuge
    src/             stdio + HTTP (Hono) Transporte, 75 Werkzeuge
src/
  components/        Vue SFCs (Canvas, Panels, Werkzeugleiste, Farbauswahl)
    properties/      Eigenschaftspanel-Abschnitte
  composables/       Canvas-Input, Tastenkürzel, Rendering-Hooks
  stores/            Editor-Zustand (Vue-Reaktivität)
  engine/            Re-Export-Shims von @open-pencil/core
desktop/             Tauri v2 (Rust + Konfiguration)
tests/
  e2e/               Playwright visuelle Regression
  engine/            Unit-Tests (bun:test)
packages/docs/       VitePress-Dokumentationsseite
openspec/
  specs/             Fähigkeitsspezifikationen (Wahrheitsquelle)
  changes/           Aktive und archivierte Änderungen
```

## Entwicklungsumgebung

```sh
bun install
bun run dev          # Editor auf localhost:1420
bun run docs:dev     # Dokumentation auf localhost:5173
```

## Code-Stil

### Werkzeuge

| Werkzeug | Befehl | Zweck |
|----------|--------|-------|
| oxlint | `bun run lint` | Linting (Rust-basiert, schnell) |
| oxfmt | `bun run format` | Code-Formatierung |
| tsgo | `bun run typecheck` | Typprüfung (Go-basierter TypeScript-Prüfer) |

Alle Prüfungen ausführen:

```sh
bun run check
```

### Konventionen

- **Dateinamen** — kebab-case (`scene-graph.ts`, `use-canvas-input.ts`)
- **Komponenten** — PascalCase Vue SFCs (`EditorCanvas.vue`, `ScrubInput.vue`)
- **Konstanten** — SCREAMING_SNAKE_CASE
- **Funktionen/Variablen** — camelCase
- **Typen/Interfaces** — PascalCase

### KI-Agent-Konventionen

Entwickler und KI-Agenten sollten `AGENTS.md` im Repo-Root lesen ([auf GitHub ansehen](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)). Behandelt Rendering, Szenengraph, Komponenten & Instanzen, Layout, UI, Dateiformat, Tauri-Konventionen und bekannte Probleme.

## Änderungen vornehmen

1. Vorhandene [OpenSpec-Spezifikationen](/de/development/openspec) für die zu ändernde Fähigkeit prüfen
2. Bei neuem Verhalten eine OpenSpec-Änderung erstellen: `openspec new change "meine-aenderung"`
3. Änderung implementieren
4. `bun run check` und `bun run test` ausführen
5. Pull Request einreichen

## Schlüsseldateien

Engine-Quellcode lebt in `packages/core/src/`. Die `src/engine/`- und `src/kiwi/`-Dateien der App sind Re-Export-Shims — bearbeiten Sie das Core-Paket, nicht die Shims.

| Datei | Zweck |
|-------|-------|
| `packages/core/src/scene-graph.ts` | Szenengraph: Knoten, Variablen, Instanzen, Hit-Testing |
| `packages/core/src/renderer.ts` | CanvasKit-Rendering-Pipeline |
| `packages/core/src/layout.ts` | Yoga-Layout-Adapter |
| `packages/core/src/undo.ts` | Rückgängig/Wiederherstellen-Manager |
| `packages/core/src/clipboard.ts` | Figma-kompatible Zwischenablage |
| `packages/core/src/vector.ts` | Vektornetzwerk-Modell |
| `packages/core/src/kiwi/codec.ts` | Kiwi-Binär-Encoder/Decoder |
| `packages/core/src/kiwi/fig-import.ts` | .fig-Datei-Import-Logik |
| `packages/core/src/tools/schema.ts` | Vereinheitlichte Werkzeugdefinitionen (KI, MCP, CLI) |
| `packages/core/src/figma-api.ts` | Figma Plugin API-Implementierung |
| `packages/mcp/src/server.ts` | MCP-Server-Factory |
| `packages/cli/src/index.ts` | CLI-Einstiegspunkt |
| `src/stores/editor.ts` | Globaler Editor-Zustand |
| `src/composables/use-canvas.ts` | Canvas-Rendering-Composable |
| `src/composables/use-keyboard.ts` | Tastenkürzel-Behandlung |
