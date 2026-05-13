# OpenPencil

Vue 3 + CanvasKit (Skia WASM) + Yoga WASM design editor. Tauri v2 desktop, also runs in browser.

**Roadmap:** `packages/docs/development/variables-ui-roadmap.md` tracks remaining variable-system UI work. Current architecture and commands live in this file.

## Monorepo

Bun workspace with three packages:

- `packages/core` — `@open-pencil/core`: scene graph, renderer, layout, codec, kiwi, clipboard, vector, snap, undo. Zero DOM deps, runs headless in Bun.
- `packages/cli` — `@open-pencil/cli`: headless CLI for .fig inspection, export, linting. Uses `citty` + `agentfmt`.
- `packages/docs` — `@open-pencil/docs`: VitePress documentation site. Run with `cd packages/docs && bun run dev`.
- `packages/mcp` — `@open-pencil/mcp`: MCP server for AI coding tools. Stdio + HTTP (Hono). Reuses `createServer()` factory with all core tools.

- `packages/vue` — `@open-pencil/vue`: headless Vue 3 SDK (Reka UI-style) for building custom OpenPencil-powered editor shells and embedded editing surfaces. Renderless components and composables. The app is one consumer of the SDK.

The root app (`src/`) is the Tauri/Vite desktop editor. App-specific editor, document, AI, collaboration, shell, tabs, demo, and automation code lives under `src/app/*`. The app consumes `@open-pencil/core` through targeted core subpath exports and `@open-pencil/vue` through the public Vue SDK entrypoint.

### Core subpath exports

`@open-pencil/core` exposes domain-specific subpath exports for targeted imports. The main `"."` entry re-exports everything for backward compatibility.

| Subpath | What | Heavy dep isolated |
|---|---|---|
| `@open-pencil/core` | everything (barrel) | all |
| `@open-pencil/core/scene-graph` | SceneGraph, node types, hit-test, copy, snap, undo | — |
| `@open-pencil/core/color` | parseColor, colorToHex, color management, OkHCL | culori |
| `@open-pencil/core/text` | fonts, text editor, style runs, direction | — |
| `@open-pencil/core/vector` | vector network encode/decode, bezier math | — |
| `@open-pencil/core/figma-api` | FigmaAPI, FigmaNodeProxy | — |
| `@open-pencil/core/icons` | Iconify API client, icon rendering | @iconify/utils |
| `@open-pencil/core/canvas` | SkiaRenderer (Skia/CanvasKit painting engine) | — |
| `@open-pencil/core/design-jsx` | JSX-to-design renderer | sucrase |
| `@open-pencil/core/editor` | createEditor, Editor, EditorState | — |
| `@open-pencil/core/tools` | ToolDef, ALL_TOOLS, AI adapter | diff |
| `@open-pencil/core/kiwi` | .fig parse/serialize, codec, protocol | fflate, fzstd |
| `@open-pencil/core/rpc` | RPC commands for CLI | — |
| `@open-pencil/core/lint` | design linter rules and presets | — |
| `@open-pencil/core/profiler` | render profiling | — |
| `@open-pencil/core/canvaskit` | getCanvasKit loader | canvaskit-wasm |
| `@open-pencil/core/layout` | computeLayout | yoga-layout |

Runtime `canvaskit-wasm` import exists only in `canvaskit.ts` — all other files use `import type`. CanvasKit instance is passed as a parameter everywhere.

### Editor architecture

`packages/core/src/editor/` is the framework-agnostic editor core — 13 modules sharing an `EditorContext` interface:

| Module | What |
|---|---|
| `types.ts` | EditorState, EditorOptions, EditorEvents, Tool, EditorToolDef, EditorContext |
| `create.ts` | `createEditor()` assembler — wires context, event bus + all modules |
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

#### Editor event bus

The editor exposes a typed nanoevents emitter for lifecycle events. Defined in `EditorEvents` (`types.ts`), emitted via `emitEditorEvent()` on the context, subscribed via `editor.onEditorEvent(event, handler)` which returns an unbind function.

| Event | Payload | Emitted by |
|---|---|---|
| `render:requested` | `{ renderVersion, sceneVersion }` | `requestRender()` |
| `repaint:requested` | `{ renderVersion, sceneVersion }` | `requestRepaint()` |
| `graph:replaced` | `SceneGraph` | `replaceGraph()` |
| `node:created` | `SceneNode` | SceneGraph emitter → `graph-events.ts` |
| `node:updated` | `id, changes` | SceneGraph emitter → `graph-events.ts` |
| `node:deleted` | `id` | SceneGraph emitter → `graph-events.ts` |
| `node:reparented` | `nodeId, oldParentId, newParentId` | SceneGraph emitter → `graph-events.ts` |
| `node:reordered` | `nodeId, parentId, index` | SceneGraph emitter → `graph-events.ts` |
| `selection:changed` | `selectedIds[], previousIds[]` | `setSelectedIds()` |
| `tool:changed` | `tool, previousTool` | `setActiveTool()` |
| `page:changed` | `pageId, previousPageId` | `switchPage()`, `replaceGraph()` |
| `viewport:changed` | `{ panX, panY, zoom }, previous` | viewport actions |

All selection mutations in core use `ctx.setSelectedIds()` and all tool changes use `ctx.setActiveTool()` so the event bus fires consistently. App-layer code uses `editor.clearSelection()`, `editor.select()`, or `editor.setTool()` — never direct `state.selectedIds =` or `state.activeTool =` assignments.

Vue SDK provides `useEditorEvent(event, handler)` composable (`packages/vue/src/editor/events/use.ts`) that auto-disposes on scope cleanup.

The app editor session (`src/app/editor/session/create.ts`) is a thin Vue wrapper: creates `shallowReactive` state, calls `createEditor()`, and assembles app-specific modules for document I/O, autosave, export, vector edit, pen resume, flashes, profiler, and mobile clipboard. Tabs live in `src/app/tabs/`; active editor access lives in `src/app/editor/active-store/`.

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

1. Update version in `package.json`, `packages/core/package.json`, `packages/cli/package.json`, `packages/mcp/package.json`, `packages/vue/package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`
2. Update `CHANGELOG.md` — move "Unreleased" items under new version heading with date
3. Commit: `Release v0.x.y`
4. Tag: `git tag v0.x.y && git push --tags`
5. Ensure GitHub release secrets include `TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the updater key is password-protected); the public updater key is configured in `desktop/tauri.conf.json`.
6. The `build.yml` workflow triggers on `v*` tags and:
   - Builds Tauri binaries for macOS (arm64 + x64), Windows (x64 + arm64), Linux (x64)
   - Creates a draft GitHub Release with all platform binaries
   - Publishes `@open-pencil/core`, `@open-pencil/cli`, `@open-pencil/mcp`, and `@open-pencil/vue` to npm with provenance
7. Go to GitHub Releases → edit the draft → paste changelog section → publish

### CI workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `build.yml` | `v*` tag push or manual | Build Tauri desktop apps (5 targets), create GitHub Release, publish `@open-pencil/core`, `@open-pencil/cli`, `@open-pencil/mcp`, and `@open-pencil/vue` |
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
- `packages/docs/` — VitePress site deployed at `openpencil.dev`. User guide, SDK, automation, reference, and development docs.

When adding features, update `CHANGELOG.md` (Unreleased section) and `README.md` (if user-facing). Update `AGENTS.md` when architecture or conventions change.

## Commit messages

Use Conventional Commits for regular development commits: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`.

- Keep the first line short, imperative, and scoped when helpful
- Put rationale and implementation details in the commit body
- Keep the commit type lowercase (`fix:`, `feat:`, `docs:`), but start each body line/bullet with an uppercase word
- Prefer scopes that match the project structure: `app`, `tauri`, `core`, `cli`, `mcp`, `vue`, `docs`, or focused domains like `editor`, `scene-graph`, `canvas`, `tools`, `kiwi`, `io`, `text`, `vector`, `color`, `acp`, `ai`, `collab`, `automation`, `i18n`
- Use the narrowest honest scope, or omit it if the change spans multiple unrelated areas

Example:

```text
fix(editor): preserve text edit undo state

- Snapshot both text and styleRuns when editing starts
- Restore both on undo instead of comparing against the live node
```

Release commits are the exception: keep using `Release v0.x.y`.

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
- `src/app/ai/tools/index.ts` is just a thin wire: creates FigmaAPI from editor store, calls `toolsToAI()`
- CLI commands (`packages/cli/src/commands/`) are **not** generated from ToolDefs — they have custom agentfmt formatting, tree walking, pagination. The `eval` command is the CLI's access to all ToolDef operations via FigmaAPI.
- MCP adapter (`packages/mcp/src/server.ts`): `startServer()` creates unified HTTP + WebSocket server. Registers all ToolDefs as MCP tools (zod schemas). Single entry point: `index.ts` (Hono + Streamable HTTP with sessions). Browser connects via WebSocket, tool calls proxied through.
- MCP-only tools (`open_file`, `new_document`, `save_file`, `get_codegen_prompt`) are registered directly in `server.ts`, not as ToolDefs — they need Node.js fs access or don't operate on the scene graph
- `open_file` and `new_document` are only registered when `OPENPENCIL_MCP_ROOT` is set (path scoping for security)
- Export tools (`export_image`, `export_svg`, `get_jsx`) accept an optional `path` param — when provided and `OPENPENCIL_MCP_ROOT` is set, the MCP server writes output to disk and returns `{ written, byteLength }` instead of the raw data
- Core prompts (`CODEGEN_PROMPT`, `JSX_REFERENCE`) live as markdown files in `packages/core/src/tools/prompts/`, loaded via raw-md bundler plugin; app chat/ACP prompts live under `src/app/ai/**` markdown files.
- To add a new tool: add a `defineTool()` in the appropriate domain file, add to `ALL_TOOLS` in `registry.ts` — it's instantly available in AI chat, MCP, and via `eval` in CLI
- `FigmaAPI` (`packages/core/src/figma-api/`) is the execution target for all tools — Figma Plugin API compatible, uses Symbols for hidden internals

## ACP (Agent Client Protocol)

- ACP transport (`src/app/ai/acp/transport.ts`) spawns agents via dynamic import of `@tauri-apps/plugin-shell`
- Pure mapping logic in `src/app/ai/acp/map-update.ts` — converts `SessionUpdate` → `UIMessageChunk`
- ACP design context prompt (`ACP_DESIGN_CONTEXT`) is authored in `src/app/ai/acp/design-context.md` and re-exported from `src/constants.ts`
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
- `src/app/collab/use.ts` — composable: connect/disconnect, cursor/selection broadcasting, follow mode, Yjs ↔ SceneGraph sync
- Provided via `COLLAB_KEY` injection — `useCollabInjected()` in child components
- ICE servers: Google STUN + Cloudflare STUN + Open Relay TURN (TCP + UDP)
- Room IDs use `crypto.getRandomValues()` — no `Math.random()` anywhere in codebase
- Stale cursors cleaned on peer disconnect via `removeAwarenessStates()`

## Code conventions

- Do not place code or tests ad hoc. Before adding or moving files, inspect the existing folder structure and nearby patterns, then put changes in the established domain-specific location. If no proper location exists, create one deliberately and update docs/conventions as needed.

### File and folder naming

OpenPencil follows a Reka UI-inspired component namespace structure:

- Vue component namespace folders use PascalCase: `ColorPicker/`, `Toolbar/`, `ProviderSettings/`.
- Vue component files use PascalCase: `ColorPickerRoot.vue`, `ToolbarItem.vue`.
- Component-scoped composables use camelCase: `useToolbarState.ts`, `usePageList.ts`.
- Non-component domain folders use lowercase or kebab-case: `scene-graph/`, `figma-api/`, `node-edit/`.
- Non-component TypeScript files use lowercase or kebab-case unless they are conventional entrypoints such as `index.ts`, `types.ts`, `context.ts`, or `use.ts`.
- Multi-file root components live inside their component namespace folder, not beside it.
- Use subfolders for multi-file domains instead of sibling files with repeated prefixes. Prefer `selection/container.ts`, `selection/hit-test.ts` over `selection-container.ts`, `selection-hit-test.ts`. When adding a second file for a domain (e.g. `eval-wrap.ts` next to `eval.ts`), create the folder immediately (`eval/index.ts` + `eval/wrap.ts`) instead of prefixing. The lint rule `no-sibling-domain-prefixed-files` catches this when a sibling folder exists, but the convention applies even before the folder is created.

- `@/` import alias for app cross-directory imports; app feature code lives under `src/app/*`
- Use package-local aliases inside workspace packages: `#vue/*` in `packages/vue`, `#cli/*` in `packages/cli`, `#mcp/*` in `packages/mcp`, and `#core/*` when core code needs an alias. Prefer relative imports within nearby core modules when that is clearer than an alias.
- No `any` — use proper types, generics, declaration merging
- No `!` non-null assertions — use guards, `?.`, `??`
- No `Math.random()` — use `crypto.getRandomValues()` everywhere
- No inline type definitions when a named type exists — use `Color` not `{ r: number; g: number; b: number; a: number }`, use `Vector` not `{ x: number; y: number }`, use `SceneNode` / `Effect` / `Fill` / `Stroke` from `@open-pencil/core/scene-graph` instead of re-spelling their shapes inline
- Shared types (GUID, Color, Vector, Matrix, Rect) live in `packages/core/src/types.ts`
- Domain types (SceneNode, Fill, Stroke, Effect, BlendMode, etc.) live in `packages/core/src/scene-graph/` and are exported from `@open-pencil/core/scene-graph`
- Window API extensions (showOpenFilePicker, queryLocalFonts) live in `src/global.d.ts` and `packages/core/src/global.d.ts`
- Use `culori` for color conversions — don't reimplement parseColor/colorToRgba
- Use `@vueuse/core` hooks — prefer higher-level composables (`useBreakpoints`, `useEventListener`, `onClickOutside`, etc.) over raw APIs (`useMediaQuery`, manual `addEventListener`)
- Prefer VueUse utilities for simple browser/timer state: `refAutoReset` for temporary copied/saved flags, `promiseTimeout` for async sleeps/retry backoff, `useClipboard`/`useFileDialog`/`useLocalStorage` where they fit the local state model. Don't force VueUse when direct APIs are clearer: one-shot `requestAnimationFrame` focus/defer calls, explicit service-owned reconnect/permission timers, or nanostores-backed state can stay hand-rolled.
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
- Vue UI styling APIs must follow the existing `:ui` / `tailwind-variants` slot pattern. Do not add one-off `fooClass`, `barClass`, `emptyActionClass`, etc. props to components; define a typed `Ui` object with named slots and merge through the local `use*UI()` helper or a `ui` prop.
- Do not pass imperative setters/actions through slots as `:set-*`, `:update-*`, `:request-*`, `:toggle-*`, etc. unless the component is explicitly a renderless primitive whose whole contract is slot actions. Prefer `v-model`, emitted events, normal component props, or owned default UI. For DOM refs/focus, use VueUse (`templateRef`, `unrefElement`, `useFocus`, etc.) instead of ref callback plumbing through slots.
- App wrappers around SDK primitives should compose a single `ui` object from shared UI helpers (`useSelectUI`, `usePopoverUI`, etc.) rather than bypassing the design system with raw Tailwind strings spread across multiple props.
- Browser and Tauri menus share `src/app/shell/menu/schema.ts` as the canonical menu model. Do not add menu items directly in `src/components/AppMenu.vue` or `desktop/src/menu.rs`.
- Regenerate the native menu with `bun run generate:tauri-menu` after editing the shared menu schema; `desktop/generated/menu.json` is consumed by the Tauri menu builder. Tauri also runs this generator from `desktop/tauri.conf.json` via `beforeDevCommand` and `beforeBuildCommand`.
- Every shared menu item with an `id` must be handled by `src/app/shell/menu/use.ts`, an editor command, or explicitly marked browser/native-only in the schema.
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

- .fig files use Kiwi binary codec — schema in `packages/core/src/kiwi/binary/codec.ts`
- `NodeChange` is the central type for Kiwi encode/decode
- Vector data uses reverse-engineered `vectorNetworkBlob` binary format — encoder/decoder in `packages/core/src/vector/`
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
