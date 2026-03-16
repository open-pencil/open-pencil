# OpenPencil

Vue 3 + CanvasKit (Skia WASM) + Yoga WASM design editor. Tauri v2 desktop, also runs in browser.

**Roadmap:** `plan.md` — phases, tech stack, CLI architecture, test strategy, keyboard shortcuts.

## Monorepo

Bun workspace with three packages:

- `packages/core` — `@open-pencil/core`: scene graph, renderer, layout, codec, kiwi, clipboard, vector, snap, undo. Zero DOM deps, runs headless in Bun.
- `packages/cli` — `@open-pencil/cli`: headless CLI for .fig inspection, export, linting. Uses `citty` + `agentfmt`.
- `packages/docs` — `@open-pencil/docs`: VitePress documentation site. Run with `cd packages/docs && bun run dev`.
- `packages/mcp` — `@open-pencil/mcp`: MCP server for AI coding tools. Stdio + HTTP (Hono). Reuses `createServer()` factory with all core tools.

- `packages/vue` — `@open-pencil/vue`: headless Vue 3 SDK (Reka UI-style). Renderless components, composables. The app is a consumer.

The root app (`src/`) is the Tauri/Vite desktop editor. Its `src/engine/` files are thin re-export shims from `@open-pencil/core`. `src/composables/use-canvas.ts` re-exports from `@open-pencil/vue`.

### Core subpath exports

`@open-pencil/core` exposes domain-specific subpath exports for targeted imports. The main `"."` entry re-exports everything for backward compatibility.

| Subpath | What | Heavy dep isolated |
|---|---|---|
| `@open-pencil/core` | everything (barrel) | all |
| `@open-pencil/core/scene-graph` | SceneGraph, node types, events | — |
| `@open-pencil/core/kiwi` | .fig parse/serialize, codec, protocol | fflate, fzstd |
| `@open-pencil/core/tools` | ToolDef, ALL_TOOLS, AI adapter | diff |
| `@open-pencil/core/renderer` | SkiaRenderer | — |
| `@open-pencil/core/render` | JSX-to-design renderer | sucrase |
| `@open-pencil/core/rpc` | RPC commands for CLI | — |
| `@open-pencil/core/figma-api` | FigmaAPI, FigmaNodeProxy | — |
| `@open-pencil/core/canvaskit` | getCanvasKit loader | canvaskit-wasm |
| `@open-pencil/core/layout` | computeLayout | yoga-layout |
| `@open-pencil/core/color` | parseColor, colorToHex, etc. | — |
| `@open-pencil/core/render-image` | renderNodesToImage | — |
| `@open-pencil/core/profiler` | render profiling | — |
| `@open-pencil/core/editor` | createEditor, Editor, EditorState | — |

Runtime `canvaskit-wasm` import exists only in `canvaskit.ts` — all other files use `import type`. CanvasKit instance is passed as a parameter everywhere.

### Editor architecture

`packages/core/src/editor/` is the framework-agnostic editor core — 13 modules sharing an `EditorContext` interface:

| Module | What |
|---|---|
| `types.ts` | EditorState, EditorOptions, Tool, EditorToolDef, EditorContext |
| `create.ts` | `createEditor()` assembler — wires context + all modules |
| `viewport.ts` | screenToCanvas, applyZoom, pan, zoomToFit/100/Selection |
| `selection.ts` | select, clearSelection, marquee, snap, hover, entered container |
| `pages.ts` | switchPage, addPage, deletePage, renamePage |
| `shapes.ts` | createShape, pen tool, adoptNodesIntoSection |
| `structure.ts` | group, ungroup, wrapInAutoLayout, reorder, reparent, z-order |
| `components.ts` | component/instance/detach/componentSet |
| `clipboard.ts` | duplicate, copy, paste, delete, storeImage |
| `undo.ts` | commitMove/Resize/Rotation, snapshot/restore |
| `text.ts` | startTextEditing, commitTextEdit |
| `nodes.ts` | updateNode, updateNodeWithUndo, setLayoutMode |

Each module exports a factory: `createXxxActions(ctx: EditorContext) => { ... }`.
`create.ts` assembles context + all modules, spreads into a flat return object.
`Editor` type = `ReturnType<typeof createEditor>`.

The app store (`src/stores/editor.ts`) is a thin Vue wrapper: creates `shallowReactive` state, calls `createEditor()`, adds Vue-specific concerns (computed refs, file I/O, autosave, export, image placement, mobile clipboard).

## Commands

- `bun run check` — type-aware lint + typecheck via oxlint + tsgo (run before committing)
- `bun run check:vue` — vue-tsc type-check for .vue files (has pre-existing errors, fix progressively)
- `bun run test:dupes` — jscpd copy-paste detection across all TS sources
- `bun run format` — oxfmt with import sorting
- `bun test ./tests/engine` — unit tests
- `bun run test` — Playwright visual regression
- `bun run tauri dev` — desktop app with hot reload
- `bun open-pencil info <file>` — document stats
- `bun open-pencil tree <file>` — node tree
- `bun open-pencil find <file>` — search nodes
- `bun open-pencil node <file> --id <id>` — detailed node properties
- `bun open-pencil pages <file>` — list pages
- `bun open-pencil variables <file>` — list design variables
- `bun open-pencil export <file>` — headless render to PNG/JPG/WEBP
- `bun open-pencil analyze colors <file>` — color palette usage
- `bun open-pencil analyze typography <file>` — font/size/weight stats
- `bun open-pencil analyze spacing <file>` — gap/padding values
- `bun open-pencil analyze clusters <file>` — repeated patterns
- `bun open-pencil eval <file> --code '<js>'` — execute JS with Figma Plugin API

## Releases & CI

### How to release

1. Update version in `package.json`, `packages/core/package.json`, `packages/cli/package.json`, `desktop/tauri.conf.json`
2. Update `CHANGELOG.md` — move "Unreleased" items under new version heading with date
3. Commit: `Release v0.x.y`
4. Tag: `git tag v0.x.y && git push --tags`
5. The `build.yml` workflow triggers on `v*` tags and:
   - Builds Tauri binaries for macOS (arm64 + x64), Windows (x64 + arm64), Linux (x64)
   - Creates a draft GitHub Release with all platform binaries
   - Publishes `@open-pencil/core` and `@open-pencil/cli` to npm with provenance
6. Go to GitHub Releases → edit the draft → paste changelog section → publish

### CI workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `build.yml` | `v*` tag push or manual | Build Tauri desktop apps (5 targets), create GitHub Release, publish npm |
| `homebrew.yml` | Release published | Update `open-pencil/homebrew-tap` cask with new version + SHA256 hashes |
| `app.yml` | Push to `master` (non-docs) | Build web app, deploy to Cloudflare Pages (`app.openpencil.dev`) |
| `docs.yml` | Push to `master` (`packages/docs/**`) | Build VitePress docs, deploy to Cloudflare Pages (`openpencil.dev`) |

### Before committing

Run all quality gates (see [Code quality](#code-quality) for the self-review checklist):

```sh
bun run check          # oxlint + tsgo type-aware lint & typecheck
bun run format         # oxfmt
bun run test:dupes     # jscpd < 3%
bun run test:unit      # bun:test
bun run test           # Playwright E2E
```

## Documentation

- `CHANGELOG.md` — all user-facing changes, grouped by version. "Unreleased" section at top for in-progress work.
- `README.md` — user-facing: features, getting started, CLI, project structure. No implementation details.
- `AGENTS.md` (this file) — contributor/agent reference: architecture, conventions, how to release.
- `packages/docs/` — VitePress site deployed at `openpencil.dev`. User guide, reference, development docs.

When adding features, update `CHANGELOG.md` (Unreleased section) and `README.md` (if user-facing). Update `AGENTS.md` when architecture or conventions change.

## CLI

- All CLI output must use `agentfmt` formatters — `fmtList`, `fmtHistogram`, `fmtSummary`, `fmtNode`, `fmtTree`, `kv`, `entity`, `bold`, `dim`, etc.
- Don't hand-roll `console.log` formatting — use the helpers from `packages/cli/src/format.ts` which re-exports agentfmt with project-specific adapters (`nodeToData`, `nodeDetails`, `nodeToTreeNode`, `nodeToListItem`)
- Every command supports `--json` for machine-readable output

## Tools (AI / MCP / CLI)

- Tool operations live in `packages/core/src/tools/` as framework-agnostic `ToolDef` objects, split by domain:
  - `schema.ts` — `ToolDef` type, `defineTool()`, shared helpers (`nodeSummary`, `nodeToResult`)
  - `read.ts` — query tools: selection, find, pages, fonts, components
  - `create.ts` — shape/component/page creation, JSX render
  - `modify.ts` — property setters: fills, strokes, effects, text, layout
  - `structure.ts` — tree ops: delete, clone, reparent, group, arrange
  - `variables.ts` — variable/collection CRUD and binding
  - `vector.ts` — boolean ops, paths, viewport, SVG/image export
  - `analyze.ts` — analyze (colors, typography, spacing, clusters), diff, eval
  - `registry.ts` — assembles all tools into the `ALL_TOOLS` array
- Each tool has: name, description, typed params, and an `execute(figma: FigmaAPI, args)` function
- `defineTool()` gives type-safe params in the execute body; the array `ALL_TOOLS` erases the generics for adapters
- AI adapter (`packages/core/src/tools/ai-adapter.ts`): `toolsToAI()` converts ToolDefs → valibot schemas + Vercel AI `tool()` wrappers
- `src/ai/tools.ts` is just a thin wire: creates FigmaAPI from editor store, calls `toolsToAI()`
- CLI commands (`packages/cli/src/commands/`) are **not** generated from ToolDefs — they have custom agentfmt formatting, tree walking, pagination. The `eval` command is the CLI's access to all ToolDef operations via FigmaAPI.
- MCP adapter (`packages/mcp/src/server.ts`): `startServer()` creates unified HTTP + WebSocket server. Registers all ToolDefs as MCP tools (zod schemas). Single entry point: `index.ts` (Hono + Streamable HTTP with sessions). Browser connects via WebSocket, tool calls proxied through.
- To add a new tool: add a `defineTool()` in the appropriate domain file, add to `ALL_TOOLS` in `registry.ts` — it's instantly available in AI chat, MCP, and via `eval` in CLI
- `FigmaAPI` (`packages/core/src/figma-api.ts`) is the execution target for all tools — Figma Plugin API compatible, uses Symbols for hidden internals

## ACP (Agent Client Protocol)

- ACP transport (`src/ai/acp-transport.ts`) spawns agents via dynamic import of `@tauri-apps/plugin-shell`
- Pure mapping logic in `src/ai/acp-map-update.ts` — converts `SessionUpdate` → `UIMessageChunk`
- System prompt (`ACP_DESIGN_CONTEXT`) in `src/constants.ts`
- Agent definitions (`ACP_AGENTS`) in `packages/core/src/constants.ts`
- MCP server: Vite plugin in dev, `openpencil-mcp` via shell plugin in production Tauri (requires `npm i -g @open-pencil/mcp`; follow-up: bundle as Tauri sidecar)
- Architecture: browser ↔ WebSocket :7601 ↔ MCP server :7600 ↔ HTTP ↔ agent subprocess
- Shell permissions scoped per-command in `desktop/capabilities/default.json` (`args: true` — agents need dynamic SDK flags)
- ACP providers visible only in Tauri desktop when MCP server is reachable
- Permission requests shown in AlertDialog — user must approve/reject each request (60s auto-reject timeout)

## Collaboration

- P2P via Trystero (WebRTC) — no server relay. Signaling over MQTT public brokers.
- Yjs CRDT for document state sync. Awareness protocol for cursors/selections/presence.
- y-indexeddb for local persistence — room survives page refresh.
- Constants in `src/constants.ts`: `TRYSTERO_APP_ID`, `PEER_COLORS`, `ROOM_ID_LENGTH`, `ROOM_ID_CHARS`, `YJS_JSON_FIELDS`
- `src/composables/use-collab.ts` — composable: connect/disconnect, cursor/selection broadcasting, follow mode, Yjs ↔ SceneGraph sync
- Provided via `COLLAB_KEY` injection — `useCollabInjected()` in child components
- ICE servers: Google STUN + Cloudflare STUN + Open Relay TURN (TCP + UDP)
- Room IDs use `crypto.getRandomValues()` — no `Math.random()` anywhere in codebase
- Stale cursors cleaned on peer disconnect via `removeAwarenessStates()`

## Code conventions

- `@/` import alias for app cross-directory imports, relative imports within core
- No `any` — use proper types, generics, declaration merging
- No `!` non-null assertions — use guards, `?.`, `??`
- No `Math.random()` — use `crypto.getRandomValues()` everywhere
- No inline type definitions when a named type exists — use `Color` not `{ r: number; g: number; b: number; a: number }`, use `Vector` not `{ x: number; y: number }`, use `SceneNode` / `Effect` / `Fill` / `Stroke` from `scene-graph.ts` instead of re-spelling their shapes inline
- Shared types (GUID, Color, Vector, Matrix, Rect) live in `packages/core/src/types.ts`
- Domain types (SceneNode, Fill, Stroke, Effect, BlendMode, etc.) live in `packages/core/src/scene-graph.ts`
- Window API extensions (showOpenFilePicker, queryLocalFonts) live in `src/global.d.ts` and `packages/core/src/global.d.ts`
- Use `culori` for color conversions — don't reimplement parseColor/colorToRgba
- Use `@vueuse/core` hooks — prefer higher-level composables (`useBreakpoints`, `useEventListener`, `onClickOutside`, etc.) over raw APIs (`useMediaQuery`, manual `addEventListener`)
- No module-level mutable state in components — use the editor store
- Prefer `tw-animate-css` for animations — don't hand-write `<style>` transition keyframes
- No duplicated component logic — if two components share data (icon maps, util functions, constants), export from one place and import in both
- `packages/core/src/kiwi/kiwi-schema/` is vendored — don't modify
- Core code must guard browser APIs: `typeof window !== 'undefined'`, `typeof document === 'undefined'`
- Constants in `src/constants.ts` — no magic numbers in components or composables

## Code quality

Before submitting a PR, run the full quality gate and do a self-review:

```sh
bun run check          # oxlint + tsgo type-aware lint & typecheck — zero errors required
bun run format         # oxfmt with import sorting
bun run test:dupes     # jscpd — must stay under 3% duplication
bun run test:unit      # bun:test
bun run test           # Playwright E2E
```

Self-review checklist:
- Run `bun run test:dupes` — if duplication rises, extract shared helpers or use existing types
- No inline type definitions that duplicate named types (Color, Vector, SceneNode, Effect, Fill, Stroke, etc.)
- No copy-pasted logic — extract into functions. If two components share a util, icon map, or data structure, export from one place. If `jscpd` flags it, fix it.
- Use precise union types — `'closed' | 'half' | 'full'` not `number | string | null`
- Files should stay under ~600 lines — split by domain when they grow (see `packages/core/src/tools/` for the pattern)
- `structuredClone` for deep copies, never shallow spread when mutating nested objects
- Don't hand-roll what a dependency already does. Check existing deps first (`package.json`, `packages/*/package.json`). If none covers it, find a quality library instead of inlining an implementation — e.g. use `diff` for unified diffs, not a custom line-by-line loop; use `culori` for color math, not manual RGB parsing
- Check Reka UI for existing components (Dialog, Popover, DropdownMenu, Select, Tooltip, Toast, etc.) before building custom ones — especially dropdowns, popovers, and modals


## Rendering

- Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM
- `renderVersion` vs `sceneVersion`: `renderVersion` = canvas repaint (pan/zoom/hover); `sceneVersion` = scene graph mutations. UI panels watch `sceneVersion` only.
- `requestRender()` bumps both counters; `requestRepaint()` bumps only `renderVersion`
- `renderNow()` is only for surface recreation and font loading (need immediate draw)
- Resize observer uses rAF throttle, not debounce — debounce causes canvas skew
- Viewport culling skips off-screen nodes; unclipped parents are NOT culled (children may extend beyond bounds)
- Selection border width must be constant regardless of zoom — divide by scale
- Section/frame title text never scales — render at fixed font size, ellipsize to fit
- Rulers are rendered on the canvas (not DOM), with selection range badges that don't overlap tick numbers
- Remote cursors: Figma-style colored arrows with white border + name pill, rendered in screen space

## Scene graph

- Nodes live in flat `Map<string, SceneNode>`, tree via `parentIndex` references
- Frames clip content by default is OFF (unlike what you'd assume)
- When creating auto-layout, sort children by geometric position first
- Dragging a child outside a frame should reparent it, not clip it
- Layer panel tree must react to reparenting — watch for stale children refs
- Groups: creating a group must preserve children's visual positions

## Components & instances

- Purple (#9747ff) for COMPONENT, COMPONENT_SET, INSTANCE — matches Figma
- Instance children map to component children via `componentId` for 1:1 sync
- Override key format: `"childId:propName"` in instance's `overrides` record
- Editing a component must call `syncIfInsideComponent()` to propagate to instances
- `SceneGraph.copyProp<K>()` typed helper — uses `structuredClone` for arrays

## Layout

- `computeAllLayouts()` must be called after demo creation and after opening .fig files
- Yoga WASM handles flexbox; CSS Grid blocked on upstream (facebook/yoga#1893)
- Auto-layout creation (Shift+A) must recompute layout immediately to update selection bounds

## UI

- Use reka-ui for UI components (Splitter, ContextMenu, DropdownMenu, etc.)
- Tailwind 4 for styling — no inline CSS, no component-level `<style>` blocks
- Mac keyboards: use `e.code` not `e.key` for shortcuts with modifiers (Option transforms characters)
- Splitter resize handles need inner div with `pointer-events-none` for sizing (zero-width handle collapses without it)
- Number input spinner hiding is global CSS in `app.css`, not per-component
- ScrubInput (drag-to-change number) — cursor and pointerdown on outer container, not inner spans
- Icons: use unplugin-icons with Iconify/Lucide (`<icon-lucide-*>`) — don't use raw SVG or Unicode symbols
- App menu (`src/components/AppMenu.vue`) — browser-only menu bar using reka-ui Menubar components; Tauri uses native menus, so menu is hidden when `IS_TAURI` is true
- Sections are draggable by title pill, not by the area to the right of the title
- CSS `contain: paint layout style` on side panels to isolate repaints from WebGL canvas

## File format

- .fig files use Kiwi binary codec — schema in `packages/core/src/kiwi/codec.ts`
- `NodeChange` is the central type for Kiwi encode/decode
- Vector data uses reverse-engineered `vectorNetworkBlob` binary format — encoder/decoder in `packages/core/src/vector.ts`
- showOpenFilePicker/showSaveFilePicker are File System Access API (Chrome/Edge), not Tauri-only — code has fallbacks
- Safari save: no File System Access API → uses `<a>` download link with deferred `revokeObjectURL`. SafariBanner warns users about limitations.
- Tauri detection: `IS_TAURI` constant from `packages/core/src/constants.ts` — don't use `'__TAURI_INTERNALS__' in window` inline
- .fig export: compression with fflate (browser) or Tauri Rust commands
- Test .fig round-trip by exporting and reimporting in Figma
- Test fixtures (`tests/fixtures/*.fig`) are Git LFS — use `git push --no-verify` to skip the slow LFS pre-push hook. Use regular `git push` only when `.fig` fixtures changed.

## Tauri

- Tauri v2 with plugin-dialog, plugin-fs, plugin-opener
- File system permissions must be configured in `desktop/tauri.conf.json` — "Internal error" on save means missing permissions
- Dev tools: add a menu item to toggle, don't rely on keyboard shortcut

## Publishing

- `bun publish` from package dirs — resolves `workspace:*` → actual versions
- Core: `prepublishOnly` runs `tsc` to build `dist/` for Node.js consumers
- CLI requires Bun runtime (`#!/usr/bin/env bun`)

## Reference

[figma-use](https://github.com/dannote/figma-use) — our Figma toolkit. Use as reference for:
- Kiwi binary format, schema, encode/decode (`packages/shared/src/kiwi/`)
- Figma WebSocket multiplayer protocol (`packages/plugin/src/ws/`)
- Vector network blob format (`packages/shared/src/vector/`)
- Node types, paints, effects, layout fields (`packages/shared/src/types/`)
- MCP tools / design operations (`packages/mcp/`)
- JSX-to-design renderer (`packages/render/`)
- Design linter rules (`packages/linter/`)

## Known issues

- Safari ew-resize/col-resize/ns-resize cursor bug (WebKit #303845) — fixed in Safari 26.3 Beta
