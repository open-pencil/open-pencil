# Contribuire

## Struttura del progetto

```
packages/
  core/              @open-pencil/core — motore (zero dipendenze DOM)
    src/             Grafo scena, renderer, layout, codec, kiwi, tipi
  cli/               @open-pencil/cli — CLI headless per operazioni .fig
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — server MCP per strumenti IA
    src/             Trasporti stdio + HTTP (Hono), 75 strumenti
src/
  components/        Vue SFCs (canvas, pannelli, barra strumenti, selettore colore)
    properties/      Sezioni pannello proprietà (Aspetto, Riempimento, Contorno, ecc.)
  composables/       Input canvas, scorciatoie tastiera, hook di rendering
  stores/            Stato editor (reattività Vue)
  engine/            Shim di ri-esportazione da @open-pencil/core
  kiwi/              Shim di ri-esportazione da @open-pencil/core
  types.ts           Tipi condivisi (ri-esportati da core)
  constants.ts       Colori UI, default, soglie
desktop/             Tauri v2 (Rust + config)
tests/
  e2e/               Regressione visiva Playwright
  engine/            Test unitari (bun:test)
docs/                Sito documentazione VitePress
openspec/
  specs/             Specifiche di capacità (fonte di verità)
  changes/           Cambiamenti attivi e archiviati
```

## Configurazione sviluppo

```sh
bun install
bun run dev          # Editor su localhost:1420
bun run docs:dev     # Docs su localhost:5173
```

## Stile di codice

### Strumenti

| Strumento | Comando | Scopo |
|-----------|---------|-------|
| oxlint | `bun run lint` | Linting (basato su Rust, veloce) |
| oxfmt | `bun run format` | Formattazione codice |
| tsgo | `bun run typecheck` | Verifica tipi (checker TypeScript basato su Go) |

Eseguire tutte le verifiche:

```sh
bun run check
```

### Convenzioni

- **Nomi file** — kebab-case (`scene-graph.ts`, `use-canvas-input.ts`)
- **Componenti** — PascalCase Vue SFCs (`EditorCanvas.vue`, `ScrubInput.vue`)
- **Costanti** — SCREAMING_SNAKE_CASE
- **Funzioni/variabili** — camelCase
- **Tipi/interfacce** — PascalCase

### Convenzioni per agenti IA

Sviluppatori e agenti IA dovrebbero leggere `AGENTS.md` nella root del repo ([vedi su GitHub](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)). Copre rendering, grafo scena, componenti e istanze, layout, UI, formato file, convenzioni Tauri e problemi noti.

## Apportare modifiche

1. Consultare le [spec openspec](/development/openspec) esistenti
2. Creare un cambiamento openspec se si aggiunge un nuovo comportamento: `openspec new change "mio-cambiamento"`
3. Implementare il cambiamento
4. Eseguire `bun run check` e `bun run test`
5. Inviare una pull request

## File chiave

Il codice sorgente del motore si trova in `packages/core/src/`. I directory `src/engine/` e `src/kiwi/` dell'app sono shim di ri-esportazione — modificare il pacchetto core, non gli shim.

| File | Scopo |
|------|-------|
| `packages/core/src/scene-graph.ts` | Grafo scena: nodi, variabili, istanze, hit testing |
| `packages/core/src/renderer.ts` | Pipeline di rendering CanvasKit |
| `packages/core/src/layout.ts` | Adattatore layout Yoga |
| `packages/core/src/undo.ts` | Gestore annulla/ripristina |
| `packages/core/src/clipboard.ts` | Appunti compatibili con Figma |
| `packages/core/src/vector.ts` | Modello rete vettoriale |
| `packages/core/src/render-image.ts` | Export immagine offscreen (PNG/JPG/WEBP) |
| `packages/core/src/kiwi/codec.ts` | Encoder/decoder binario Kiwi |
| `packages/core/src/kiwi/fig-import.ts` | Logica import file .fig |
| `packages/cli/src/index.ts` | Punto di ingresso CLI |
| `packages/core/src/tools/schema.ts` | Definizioni strumenti unificate (IA, MCP, CLI) |
| `packages/core/src/figma-api.ts` | Implementazione Figma Plugin API |
| `packages/mcp/src/server.ts` | Factory del server MCP |
| `packages/cli/src/commands/` | Comandi CLI (info, tree, find, export, eval, analyze) |
| `src/stores/editor.ts` | Stato globale dell'editor |
| `src/composables/use-canvas.ts` | Composable rendering canvas |
| `src/composables/use-canvas-input.ts` | Gestione input mouse/touch |
| `src/composables/use-keyboard.ts` | Gestione scorciatoie tastiera |
