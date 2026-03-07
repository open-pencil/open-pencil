# Contributing

## Project Structure

```
packages/
  core/              @open-pencil/core — engine (zero DOM deps)
    src/             Scene graph, renderer, layout, codec, kiwi, types
  cli/               @open-pencil/cli — headless CLI for .fig operations
    src/commands/    info, tree, find, export, eval, analyze
  mcp/               @open-pencil/mcp — MCP server for AI tools
    src/             stdio + HTTP (Hono) transports, 75 tools
src/
  components/        Vue SFCs (canvas, panels, toolbar, color picker)
    properties/      Property panel sections (Appearance, Fill, Stroke, etc.)
  composables/       Canvas input, keyboard shortcuts, rendering hooks
  stores/            Editor state (Vue reactivity)
  engine/            Re-export shims from @open-pencil/core
  kiwi/              Re-export shims from @open-pencil/core
  types.ts           Shared types (re-exported from core)
  constants.ts       UI colors, defaults, thresholds
desktop/             Tauri v2 (Rust + config)
tests/
  e2e/               Playwright visual regression
  engine/            Unit tests (bun:test)
docs/                VitePress documentation site
openspec/
  specs/             Capability specifications (source of truth)
  changes/           Active and archived changes
```

## Development Setup

```sh
bun install
bun run dev          # Editor at localhost:1420
bun run docs:dev     # Docs at localhost:5173
```

## Code Style

### Tooling

| Tool | Command | Purpose |
|------|---------|---------|
| oxlint | `bun run lint` | Linting (Rust-based, fast) |
| oxfmt | `bun run format` | Code formatting |
| tsgo | `bun run typecheck` | Type checking (Go-based TypeScript checker) |

Run all checks:

```sh
bun run check
```

### Conventions

- **File names** — kebab-case (`scene-graph.ts`, `use-canvas-input.ts`)
- **Components** — PascalCase Vue SFCs (`EditorCanvas.vue`, `ScrubInput.vue`)
- **Constants** — SCREAMING_SNAKE_CASE
- **Functions/variables** — camelCase
- **Types/interfaces** — PascalCase

### AI Agent Conventions

Developers and AI agents working on the codebase should read `AGENTS.md` in the repo root ([view on GitHub](https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md)). Covers rendering, scene graph, components & instances, layout, UI, file format, Tauri conventions, and known issues.

## Making Changes

1. Check existing [openspec specs](/development/openspec) for the capability you're modifying
2. Create an openspec change if adding new behavior: `openspec new change "my-change"`
3. Implement the change
4. Run `bun run check` and `bun run test`
5. Submit a pull request

## Key Files

Engine source lives in `packages/core/src/`. The app's `src/engine/` and `src/kiwi/` are re-export shims — edit the core package, not the shims.

| File | Purpose |
|------|---------|
| `packages/core/src/scene-graph.ts` | Scene graph: nodes, variables, instances, hit testing |
| `packages/core/src/renderer.ts` | CanvasKit rendering pipeline |
| `packages/core/src/layout.ts` | Yoga layout adapter |
| `packages/core/src/undo.ts` | Undo/redo manager |
| `packages/core/src/clipboard.ts` | Figma-compatible clipboard |
| `packages/core/src/vector.ts` | Vector network model |
| `packages/core/src/render-image.ts` | Offscreen image export (PNG/JPG/WEBP) |
| `packages/core/src/kiwi/codec.ts` | Kiwi binary encoder/decoder |
| `packages/core/src/kiwi/fig-import.ts` | .fig file import logic |
| `packages/cli/src/index.ts` | CLI entry point |
| `packages/core/src/tools/schema.ts` | Unified tool definitions (AI, MCP, CLI) |
| `packages/core/src/figma-api.ts` | Figma Plugin API implementation |
| `packages/mcp/src/server.ts` | MCP server factory |
| `packages/cli/src/commands/` | CLI commands (info, tree, find, export, eval, analyze) |
| `src/stores/editor.ts` | Global editor state |
| `src/composables/use-canvas.ts` | Canvas rendering composable |
| `src/composables/use-canvas-input.ts` | Mouse/touch input handling |
| `src/composables/use-keyboard.ts` | Keyboard shortcut handling |
