# Mitwirken

## Projektstruktur

```
packages/
  core/              @open-pencil/core — Engine (keine DOM-Abhängigkeiten)
    src/             Szenengraph, Renderer, Layout, Codec, Kiwi, Typen
  cli/               @open-pencil/cli — Headless-CLI für .fig-Operationen
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — MCP-Server für KI-Werkzeuge
    src/             stdio + HTTP (Hono) Transporte, 87 Werkzeuge
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

1. Änderung implementieren
2. `bun run check` und `bun run test` ausführen
3. Pull Request einreichen

## Schlüsseldateien

Der Core-Engine-Quellcode lebt in `packages/core/src/`. App-spezifischer Editor-, Dokument-, KI-, Kollaborations-, Shell-, Demo- und Automatisierungscode liegt unter `src/app/*`; das Vue SDK verwaltet wiederverwendbaren Canvas- und Composable-Code unter `packages/vue/src/`.

| Datei | Zweck |
|-------|-------|
| `packages/core/src/scene-graph/` | Szenengraph: Knoten, Variablen, Instanzen, Hit-Testing |
| `packages/core/src/canvas/renderer.ts` | CanvasKit-Rendering-Pipeline |
| `packages/core/src/layout.ts` | Yoga-Layout-Adapter |
| `packages/core/src/scene-graph/undo.ts` | Rückgängig/Wiederherstellen-Manager |
| `packages/core/src/clipboard.ts` | Figma-kompatible Zwischenablage |
| `packages/core/src/vector/` | Vektornetzwerk-Modell |
| `packages/core/src/kiwi/binary/codec.ts` | Kiwi-Binär-Encoder/Decoder |
| `packages/core/src/kiwi/fig-import.ts` | .fig-Datei-Import-Logik |
| `packages/core/src/tools/` | Vereinheitlichte Werkzeugdefinitionen (KI, MCP, CLI) |
| `packages/core/src/figma-api/` | Figma Plugin API-Implementierung |
| `packages/mcp/src/server.ts` | MCP-Server-Factory |
| `packages/cli/src/index.ts` | CLI-Einstiegspunkt |
| `src/app/editor/session/create.ts` | Editor session assembly |
| `packages/vue/src/canvas/CanvasRoot.vue` | Canvas-Rendering-Composable |
| `src/app/shell/keyboard/use.ts` | Tastenkürzel-Behandlung |
