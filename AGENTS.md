# OpenPencil

Vue 3 + CanvasKit (Skia WASM) + Yoga WASM design editor. Tauri v2 desktop, also runs in browser.

**Roadmap:** `packages/docs/development/roadmap.md` tracks product direction, Figma compatibility gaps, and raw metadata coverage. This file keeps agent-facing architecture, conventions, and commands; detailed public docs live under `packages/docs/**`.

## Monorepo

Bun workspace packages:

- `packages/scene-graph` — `@open-pencil/scene-graph`: SceneGraph, node types, copy/snap/undo helpers, variables, instances, hit testing. Framework-agnostic.
- `packages/pen` — `@open-pencil/pen`: Pen/vector editing helpers shared by core/editor surfaces.
- `packages/kiwi` — `@open-pencil/kiwi`: pure Kiwi schema/runtime/protocol package. Owns low-level Figma Kiwi codec/container/parse helpers and stays SceneGraph-agnostic.
- `packages/fig` — `@open-pencil/fig`: publishable `.fig` package shell and low-level smoke/test boundary. Production SceneGraph `.fig` policy still lives mostly in core while this package grows.
- `packages/core` — `@open-pencil/core`: renderer, layout, editor core, Figma API, tools, clipboard, vector conversion, and app/CLI-facing document I/O. Depends on scene-graph/pen/kiwi but keeps browser DOM out of core.
- `packages/dom-css` — `@open-pencil/dom-css`: DOM/CSS projection layer for HTML/CSS/JSX/Tailwind compatibility. Owns DesignDOM types and browser/headless CSS runtime adapters; keeps DOM/CSS parser dependencies out of core.
- `packages/vue` — `@open-pencil/vue`: headless Vue 3 SDK (Reka UI-style) for building custom OpenPencil-powered editor shells and embedded editing surfaces. Renderless components and composables. The app is one consumer of the SDK.
- `packages/cli` — `@open-pencil/cli`: headless CLI for .fig inspection, export, linting. Uses `citty` + `agentfmt`.
- `packages/mcp` — `@open-pencil/mcp`: MCP server for AI coding tools. Stdio + HTTP (Hono). Reuses core tools.
- `packages/docs` — `@open-pencil/docs`: published VitePress documentation site. Run with `bun run docs:dev`.

The root app (`src/`) is the Tauri/Vite desktop editor. App-specific editor, document, AI, collaboration, shell, tabs, demo, and automation code lives under `src/app/*`. The app consumes scene graph primitives from `@open-pencil/scene-graph`, editor/rendering services through targeted `@open-pencil/core` subpath exports, and `@open-pencil/vue` through the public Vue SDK entrypoint.

### Public package exports

Use public package exports across package/app boundaries. Do not import workspace package internals from app code.

- `@open-pencil/scene-graph` — SceneGraph, node types, primitives, copy/snap/undo, instance helpers, variable helpers, vector-network types.
- `@open-pencil/core` — broad compatibility barrel for editor/rendering/tooling APIs.
- Common targeted core subpaths keep imports smaller and dependency intent clearer: `@open-pencil/core/color`, `/text`, `/vector`, `/figma-api`, `/icons`, `/canvas`, `/design-jsx`, `/editor`, `/tools`, `/kiwi`, `/clipboard`, `/rpc`, `/lint`, `/profiler`, `/io`, `/canvaskit`, `/layout`.
- Use `@open-pencil/kiwi` for low-level Kiwi/FIG schema-runtime, codec, container, GUID, and parse helpers.

CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit` for app/browser use. Headless raster export may dynamically load `canvaskit-wasm/full`; elsewhere prefer `import type` and pass the CanvasKit instance in.

### Editor architecture

`packages/core/src/editor/` is the framework-agnostic editor core. `createEditor()` in `create.ts` assembles an `EditorContext` plus domain action modules for viewport, selection, pages, shapes, structure, components, clipboard, undo/history, text, variables, layout, color space, graph reads, tool registry, and related helpers. Check the folder before adding editor behavior; keep new actions in the nearest domain module/folder instead of growing unrelated files.

`Editor` type = `ReturnType<typeof createEditor>`. Core modules should share state through `EditorContext` rather than importing app code or Vue.

#### Editor event bus

The editor exposes a typed nanoevents emitter. Event names/payloads live in `EditorEvents` in `packages/core/src/editor/types.ts`; graph events are bridged from SceneGraph by `graph-events.ts`. Subscribe with `editor.onEditorEvent(event, handler)`, or in Vue use `useEditorEvent(event, handler)` from `packages/vue/src/editor/events/use.ts`.

Important invariant: all selection mutations in core go through `ctx.setSelectedIds()` and all tool changes go through `ctx.setActiveTool()` so events fire consistently. App-layer code should use editor actions such as `clearSelection()`, `select()`, or `setTool()` — never direct `state.selectedIds =` or `state.activeTool =` assignments.

The app editor session (`src/app/editor/session/create.ts`) is a Vue wrapper around core: it creates reactive state, calls `createEditor()`, and assembles app-specific document I/O, autosave, export, vector edit, pen resume, flashes, profiler, and mobile clipboard. Tabs live in `src/app/tabs/`; active editor access lives in `src/app/editor/active-store/`.

## Commands

- `bun run check` — type-aware lint + typecheck via oxlint + tsgo + architecture checks (run before committing)
- `bun run check:arch` — Steiger architecture lint for project-specific import boundaries
- `bun run check:vue` — vue-tsc type-check for app and Vue SDK .vue files
- `bun run test:dupes` — jscpd copy-paste detection across product TS sources
- `bun run test:tools` — tests for private repo tooling under `tools/*`
- `bun run format` — oxfmt with import sorting
- `bun run test:unit` — engine/unit tests
- `bun run test` — Playwright E2E and visual regression tests
- `bun run tauri dev` — desktop app with hot reload
- `bun open-pencil --help` — list CLI commands. Common commands include `info`, `tree`, `find`, `node`, `pages`, `variables`, `export`, `convert`, `lint`, `query`, `selection`, `formats`, `analyze ...`, and `eval` for Figma Plugin API scripting.

## Releases & CI

### How to release

1. Update version in the root `package.json`, publishable `packages/*/package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`
2. Update `CHANGELOG.md` — move "Unreleased" items under new version heading with date
3. Commit: `Release v0.x.y`
4. Tag: `git tag v0.x.y && git push --tags`
5. Ensure GitHub release secrets include `TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the updater key is password-protected); the public updater key is configured in `desktop/tauri.conf.json`.
6. The `build.yml` workflow triggers on `v*` tags and:
   - Builds Tauri binaries for macOS (arm64 + x64), Windows (x64 + arm64), Linux (x64)
   - Creates a draft GitHub Release with all platform binaries
   - Publishes public workspace packages to npm with provenance. Keep the exact package list in sync with `.github/workflows/build.yml`.
7. The production web app/docs deploy workflows (`app.yml`, `docs.yml`) also trigger on `v*` tags. They do **not** deploy on ordinary `master` pushes.
8. Go to GitHub Releases → edit the draft → paste changelog section → publish

### CI workflows

Key workflows live in `.github/workflows/`. Use `build.yml` as the source of truth for release packaging and npm publishing, `ci.yml` / `heavy-tests.yml` for validation gates, and `app.yml` / `docs.yml` for Cloudflare Pages deploys.

Production Cloudflare Pages deploys are intentionally release/manual only: `app.yml` and `docs.yml` run on `v*` tags and `workflow_dispatch`, not on `master` pushes. To deploy manually, run the relevant workflow from GitHub Actions (`Deploy app` or `Deploy docs`) on the desired ref; the workflow deploys to the configured production branch (`master`).

## Documentation

- `CHANGELOG.md` — all user-facing changes, grouped by version. "Unreleased" section at top for in-progress work.
- `README.md` — user-facing: features, getting started, CLI, project structure. No implementation details.
- `AGENTS.md` (this file) — contributor/agent reference: architecture, conventions, how to release.
- `packages/docs/` — VitePress site deployed at `openpencil.dev`. User guide, SDK, automation, reference, and development docs.

When adding features, update `CHANGELOG.md` (Unreleased section) and `README.md` (if user-facing). Update `AGENTS.md` when architecture or conventions change. Do not put speculative/internal implementation plans in `packages/docs/**`; VitePress docs are published. Keep temporary plans in ignored `scratch/` or distill durable public direction into the canonical roadmap.

## Commit messages

Use Conventional Commits for regular development commits: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`.

- Keep the first line short, imperative, and scoped when helpful
- Put rationale and implementation details in the commit body
- Keep the commit type lowercase (`fix:`, `feat:`, `docs:`), but start each body line/bullet with an uppercase word
- Preserve product/domain casing in subjects and bodies: `DOM/CSS`, `CSS`, `HTML`, `JSX`, `Tailwind`, `Kiwi`, `.fig`, `MCP`, `CLI`, `AI`, `ACP`, `i18n`. Do not flatten acronyms to lowercase prose such as `dom css documents`.
- Prefer scopes that match the project structure: `app`, `tauri`, `core`, `cli`, `dom-css`, `mcp`, `vue`, `docs`, or focused domains like `editor`, `scene-graph`, `canvas`, `tools`, `kiwi`, `io`, `text`, `vector`, `color`, `acp`, `ai`, `collab`, `automation`, `i18n`
- Use the narrowest honest scope, or omit it if the change spans multiple unrelated areas
- Do not add coding-harness attribution, vendor branding, or product-placement text to commits, PR bodies, comments, or generated files; this includes `Co-authored-by: Claude`, `Made with Cursor`, `Generated with Claude Code`, and similar trailers from any AI coding tool
- If AI-generated code is substantial and the context is useful for review, mention only the model identifier, for example `Model: claude-sonnet-4.5`; do not credit or advertise the coding harness/agent

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
- CLI data/inspection commands should support `--json` for machine-readable output

## Tools (AI / MCP / CLI)

- Framework-agnostic tool operations live under `packages/core/src/tools/**` as `ToolDef` objects. Domains include read, create, modify, structure, variables, vector, analyze, describe, codegen, stock-photo, and helpers. Check the existing domain folder before adding a new file.
- `schema.ts` defines `ToolDef`, `defineTool()`, and shared result helpers. Each tool has a name, description, typed params, and an `execute(figma: FigmaAPI, args)` function.
- Registries (`registry*.ts`) assemble tool sets. Add new tools to the appropriate registry so AI chat, MCP, and CLI eval paths can see them.
- AI adapter (`packages/core/src/tools/ai-adapter.ts`) converts ToolDefs to Vercel AI tools with valibot schemas. `src/app/ai/tools/index.ts` is a thin app wire that creates `FigmaAPI` from the active editor.
- CLI commands in `packages/cli/src/commands/**` are not generated from ToolDefs; they own CLI UX, pagination, and agentfmt formatting. The `eval` command exposes ToolDef operations through `FigmaAPI`.
- MCP server code lives in `packages/mcp/src/server.ts`. MCP-only tools such as `open_file`, `new_document`, `save_file`, and `get_codegen_prompt` are registered there because they need server filesystem access or are not scene-graph tools.
- `open_file` and `new_document` are only registered when `OPENPENCIL_MCP_ROOT` is set. Export tools can write files under that root when given a `path`.
- Core codegen prompts live as markdown under `packages/core/src/tools/prompts/`; app chat/ACP prompts live under `src/app/ai/**` markdown files.
- `FigmaAPI` (`packages/core/src/figma-api/`) is the execution target for tools and CLI eval. It is Figma Plugin API compatible and uses Symbols for hidden internals.

## ACP and collaboration

Keep this section light; implementation details move often.

- ACP UI/transport lives under `src/app/ai/acp/**`; provider definitions live in `packages/core/src/constants.ts`; app prompts live under `src/app/ai/**`. Public docs: `packages/docs/programmable/ai-chat.md` and `packages/docs/programmable/mcp-server.md`.
- ACP transport uses Tauri shell permissions, so check `desktop/capabilities/**` when changing agent launch behavior.
- Collaboration lives under `src/app/collab/**` and is documented in `packages/docs/programmable/collaboration.md`. It uses Trystero + Yjs + awareness; preserve crypto-safe room IDs and peer cleanup semantics when changing it.

## Code conventions

- Do not place code or tests ad hoc. Before adding or moving files, inspect the existing folder structure and nearby patterns, then put changes in the established domain-specific location. If no proper location exists, create one deliberately and update docs/conventions as needed.
- Architecture boundaries are enforced by `bun run check:arch` and related lint rules; keep app/package boundaries clean instead of relying on review to catch private imports. In practice: use public workspace exports across boundaries, keep core framework-agnostic, keep app services separate from component/view layers, keep shared UI free of app stores/services, and keep property-panel internals inside the property panel.
- Test placement is strict: app E2E in `tests/e2e/**/*.spec.ts`, Figma automation in `tests/figma/**/*.spec.ts`, engine/unit tests in `tests/engine/**/*.test.ts`, shared test utilities in `tests/helpers/**`, and standalone package tests in their package `tests/**` when established. UI-visible behavior belongs in E2E; graph/internal-state assertions belong in engine/unit tests. Do not commit temporary/profile specs.

### File and folder naming

OpenPencil uses domain namespaces rather than full Feature-Sliced Design ceremony:

- App services/state/integration live under `src/app/**`; route/layout views live under `src/views/**`; app UI lives under `src/components/**`.
- `src/components/ui/**` is the shared app design-system layer. `packages/vue/src/primitives/**` is the headless SDK primitive layer. App wrappers around SDK primitives should stay in app component domains and only move to `ui/**` when genuinely generic.
- Root-level `src/components/*.vue` is reserved for broad editor panels/surfaces assembled by views or shell layout. Do not add new root-level base controls; create a domain namespace or use `src/components/ui/**` for reusable primitives.
- App component domain folders should be lowercase or kebab-case (`chat/`, `properties/`, `fill-picker/`, `color-picker-panel/`, `canvas/`, `inputs/`). Avoid adding new `PascalCase/Component.vue` app folders; migrate existing ones gradually when touched.
- Vue component files stay PascalCase: `ColorPickerRoot.vue`, `ToolbarItem.vue`. Component-scoped composables use camelCase: `useToolbarState.ts`, `usePageList.ts`.
- Non-component domain folders use lowercase or kebab-case: `scene-graph/`, `figma-api/`, `node-edit/`. Non-component TypeScript files use lowercase or kebab-case unless they are conventional entrypoints such as `index.ts`, `types.ts`, `context.ts`, or `use.ts`.
- Multi-file root components live inside their component namespace folder, not beside it. When a reusable picker/input/control grows beyond one file, create a namespace instead of leaving related files at `src/components/` root.
- Use subfolders for multi-file domains instead of sibling files with repeated prefixes. Prefer `selection/container.ts`, `selection/hit-test.ts` over `selection-container.ts`, `selection-hit-test.ts`. When adding a second file for a domain (e.g. `eval-wrap.ts` next to `eval.ts`), create the folder immediately (`eval/index.ts` + `eval/wrap.ts`) instead of prefixing. Oxlint catches sibling prefix files when a sibling folder exists; Steiger catches 3+ sibling files with the same prefix. The convention applies even before either rule triggers.

### Repo tools and scripts

Private repository tooling lives under `tools/<domain>/`, not as ad-hoc root scripts. Use kebab-case domain folders and split by capability inside `src/`:

```text
tools/<domain>/
  package.json
  src/index.ts
  src/<capability>.ts
  tests/<capability>.test.ts
```

Use `scripts/` only for tiny compatibility entrypoint shims that import `../tools/<domain>/src/...`; do not put implementation logic there. Workflow helpers, release packaging helpers, architecture rules, package checks, visual-oracle utilities, and other maintainable programs belong in `tools/` with focused tests when they contain logic. Steiger enforces tool layout and script shims. `bun run check` includes `bun run test:tools`, and lint/format cover `tools/`.

- `@/` import alias for app cross-directory imports; app feature code lives under `src/app/*`
- Use package-local aliases inside workspace packages: `#vue/*` in `packages/vue`, `#cli/*` in `packages/cli`, `#dom-css/*` in `packages/dom-css`, `#mcp/*` in `packages/mcp`, and `#core/*` when core code needs an alias. Prefer relative imports within nearby core modules when that is clearer than an alias.
- No `any` — use proper types, generics, declaration merging
- No `!` non-null assertions — use guards, `?.`, `??`
- No `Math.random()` — use `crypto.getRandomValues()` everywhere
- No inline type definitions when a named type exists — use `Color` not `{ r: number; g: number; b: number; a: number }`, use `Vector` not `{ x: number; y: number }`, and import `SceneNode` / `Effect` / `Fill` / `Stroke` from `@open-pencil/scene-graph` instead of re-spelling their shapes.
- Shared geometry/color primitives live in `packages/scene-graph/src/primitives.ts`; scene/node domain types live in `packages/scene-graph/src/types.ts` and are exported from `@open-pencil/scene-graph`.
- Window API extensions (showOpenFilePicker, queryLocalFonts) live in `src/global.d.ts` and `packages/core/src/global.d.ts`
- Use `culori` for color conversions — don't reimplement parseColor/colorToRgba
- Use `@vueuse/core` hooks — prefer higher-level composables (`useBreakpoints`, `useEventListener`, `onClickOutside`, etc.) over raw APIs (`useMediaQuery`, manual `addEventListener`)
- Prefer VueUse utilities for simple browser/timer state: `refAutoReset` for temporary copied/saved flags, `promiseTimeout` for async sleeps/retry backoff, `useClipboard`/`useFileDialog`/`useLocalStorage` where they fit the local state model. Don't force VueUse when direct APIs are clearer: one-shot `requestAnimationFrame` focus/defer calls, explicit service-owned reconnect/permission timers, or nanostores-backed state can stay hand-rolled.
- No module-level mutable state in components — use the editor store
- Prefer `tw-animate-css` for animations — don't hand-write `<style>` transition keyframes
- No duplicated component logic — if two components share data (icon maps, util functions, constants), export from one place and import in both
- `packages/kiwi/src/schema-runtime/` contains the Kiwi codec runtime; keep runtime changes minimal and prefer wrappers/helpers for project-specific validation
- Core code must guard browser APIs with explicit runtime checks such as `typeof window !== 'undefined'` / `typeof document !== 'undefined'` before using them.
- Name repeated or cross-feature constants; use `src/constants.ts` for app-wide constants rather than feature-local values.

## Code quality

Before submitting a PR, run the full quality gate and do a self-review:

```sh
bun run check          # oxlint + tsgo type-aware lint & typecheck — zero errors required
bun run format         # oxfmt with import sorting
bun run test:dupes     # jscpd — zero clones required
bun run test:tools     # private repo tooling tests
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
- Don't hand-roll what a dependency already does. Check existing deps first (`package.json`, `packages/*/package.json`). If none covers it, find a quality library instead of inlining an implementation — e.g. use `diff` for unified diffs, not a custom line-by-line loop; use `culori` for color math, not manual RGB parsing.
- Before custom UI/control/composable work, read upstream docs for the relevant dependency instead of guessing from local usage. Prefer their `llms.txt` entrypoints when available:
  - Reka UI (`https://reka-ui.com/llms.txt`) before building dialogs, popovers, dropdowns, menus, selects, tooltips, toasts, trees, splitters, or other primitives.
  - VueUse (`https://vueuse.org/llms.txt`) before hand-rolling DOM events, browser APIs, refs/focus, media queries, timers, clipboard, storage, async state, or observers.
  - Tailwind / tailwind-variants docs before inventing one-off styling prop APIs or variant composition.
- If upstream docs contradict local patterns, prefer current upstream APIs and update local wrappers deliberately.
- `es-toolkit` is available in core for small, focused utility helpers when it clearly improves readability. Prefer subpath imports such as `es-toolkit/object`, `es-toolkit/array`, and `es-toolkit/predicate`; good fits include `omit` / `pick` for object key selection, `uniq` for dedupe, and `isNotNil` for typed nullish filtering. Do not replace clear native JavaScript just for consistency, and avoid `es-toolkit/compat` unless deliberately migrating lodash-compatible behavior.

## Rendering

- Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM
- `renderVersion` vs `sceneVersion`: `renderVersion` = canvas repaint (pan/zoom/hover); `sceneVersion` = scene graph mutations. UI that only cares about graph data should avoid watching repaint-only state; use editor events for incremental surfaces such as the layer tree.
- `requestRender()` bumps both counters; `requestRepaint()` bumps only `renderVersion`
- `renderNow()` is only for surface recreation and font loading (need immediate draw)
- Resize observer uses rAF throttle, not debounce — debounce causes canvas skew
- Viewport culling skips off-screen nodes; unclipped parents are NOT culled (children may extend beyond bounds)
- Selection border width must be constant regardless of zoom — divide by scale
- Section/frame title text never scales — render at fixed font size, ellipsize to fit
- Rulers are rendered on the canvas (not DOM), with selection range badges that don't overlap tick numbers
- Remote cursors: Figma-style colored arrows with white border + name pill, rendered in screen space
- Pixel-affecting renderer features need committed visual coverage, not just mock/geometry assertions. Add or update a Playwright canvas snapshot for changes to fills, gradients, images, blend modes, masks, boolean geometry, corners, strokes, shadows, blur, text rendering, or demo showcase scenes. Use targeted snapshot updates such as `bunx playwright test tests/e2e/canvas/renderer-visuals.spec.ts --project=openpencil --update-snapshots` and then rerun the same test without `--update-snapshots`.

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
- Editing a component must propagate to instances through the editor/component sync path; do not hand-copy instance fields in app UI code.
- Instance property copying lives in `@open-pencil/scene-graph` helpers and uses structured copies for nested values.

## Layout

- `computeAllLayouts()` must be called after demo creation and after opening .fig files
- Yoga WASM handles flexbox; CSS Grid blocked on upstream (facebook/yoga#1893)
- Auto-layout creation (Shift+A) must recompute layout immediately to update selection bounds

## UI

### Component structure

- `src/components/ui/**` is the app design-system layer: reusable visual primitives, wrappers around Reka UI primitives, low-level styled controls, and UI class helpers. These files must not import app services/stores or feature panels.
- `src/components/Shell/**` is for app shell chrome and global app services rendered as components (menu bar, toast viewport, update/status chrome). Shell components may use app shell/editor stores.
- `src/components/properties/**`, `src/components/chat/**`, `src/components/LayerTree/**`, `src/components/Toolbar/**`, and similar folders are feature/domain component namespaces. Keep feature-specific controls there unless they are genuinely reusable UI primitives.
- Treat existing root-level picker/input/control components as migration candidates when touched; do not expand that pattern.
- Test hooks should be `data-test-id` attributes owned by the rendered markup or generated internally from semantic component state. Do not add `testId`, `visibilityTestId`, `triggerTestId`, or other test-id props to component APIs.

- Use reka-ui for UI components (Splitter, ContextMenu, DropdownMenu, etc.)
- Vue UI styling APIs must follow the existing `:ui` / `tailwind-variants` slot pattern. Do not add one-off `fooClass`, `barClass`, `emptyActionClass`, etc. props to components; define a typed `Ui` object with named slots and merge through the local `use*UI()` helper or a `ui` prop.
- Do not pass imperative setters/actions through slots as `:set-*`, `:update-*`, `:request-*`, `:toggle-*`, etc. unless the component is explicitly a renderless primitive whose whole contract is slot actions. Prefer `v-model`, emitted events, normal component props, or owned default UI. For DOM refs/focus, use VueUse (`templateRef`, `unrefElement`, `useFocus`, etc.) instead of ref callback plumbing through slots.
- App wrappers around SDK primitives should compose a single `ui` object from shared UI helpers (`useSelectUI`, `usePopoverUI`, etc.) rather than bypassing the design system with raw Tailwind strings spread across multiple props.
- Editor commands share `packages/vue/src/editor/commands/registry.ts` as the canonical source for shortcut display tokens, keyboard bindings, and context-menu test IDs. Store portable shortcuts such as `MOD+D`, `MOD+SHIFT+H`, and `MOD+ALT+K`; format them with `formatShortcut()` at render time so macOS shows `⌘`/`⌥` and Windows/Linux show `Ctrl`/`Alt`.
- Labels and translations must not contain shortcut text. Keep labels semantic (`Add auto layout`, `Show/Hide`) and render shortcuts from command metadata. Steiger enforces this for `packages/vue/src/i18n/messages.ts` and locale JSON files.
- Canvas context-menu structure lives in `packages/vue/src/editor/menu-model/canvas.ts`. Do not hand-build command grouping in `src/components/canvas/CanvasMenu.vue`; the component should render menu entries and provide app-specific actions only when unavoidable.
- Browser and Tauri menus share `src/app/shell/menu/schema.ts` as the canonical menu model. Do not add menu items directly in `src/components/Shell/AppMenu.vue` or `desktop/src/menu.rs`.
- Regenerate the native menu with `bun run generate:tauri-menu` after editing the shared menu schema; `desktop/generated/menu.json` is consumed by the Tauri menu builder. Tauri also runs this generator from `desktop/tauri.conf.json` via `beforeDevCommand` and `beforeBuildCommand`.
- Every shared menu item with an `id` must be handled by `src/app/shell/menu/use.ts`, an editor command, or explicitly marked browser/native-only in the schema.
- Tailwind 4 for styling — no inline CSS, no component-level `<style>` blocks
- Use `Tip` / tooltip components for hover help; do not add native `title` attributes in Vue UI.
- Mac keyboards: use `e.code` not `e.key` for shortcuts with modifiers (Option transforms characters)
- Icons: use unplugin-icons with Iconify/Lucide (`<icon-lucide-*>`) — don't use raw SVG or Unicode symbols
- App menu (`src/components/Shell/AppMenu.vue`) — browser-only menu bar using reka-ui Menubar components; Tauri uses native menus, so menu is hidden when `IS_TAURI` is true
- Preserve established UI gotchas in nearby components before refactoring: splitter handle sizing, ScrubInput pointer ownership, section drag targets, side-panel containment, and global number-spinner styling.

## File format

- `.fig` files use Figma's Kiwi schema and `NodeChange[]` records. Low-level schema/runtime/codec/container/parse helpers live in `packages/kiwi/src/fig/**` and `packages/kiwi/src/schema-runtime/**`.
- Core still owns SceneGraph `.fig` policy: import/export orchestration in `packages/core/src/io/formats/fig/**`, SceneGraph ⇄ NodeChange conversion in `packages/core/src/kiwi/fig/node-change/**`, and component/instance override interpretation in `packages/core/src/kiwi/fig/instance-overrides/**`.
- `packages/fig` is the publishable boundary for future `.fig` policy extraction; do not move behavior there without package-local tests and dist smoke.
- Vector data uses reverse-engineered `vectorNetworkBlob` binary format — encoder/decoder in `packages/core/src/vector/` and scene-graph vector-network types in `@open-pencil/scene-graph`.
- `showOpenFilePicker` / `showSaveFilePicker` are File System Access API (Chrome/Edge), not Tauri-only; code must keep browser fallbacks.
- Safari save: no File System Access API → use an `<a>` download fallback with deferred `revokeObjectURL`. SafariBanner warns users about limitations.
- Tauri detection: use `IS_TAURI` from `@open-pencil/core/constants` / `src/constants.ts`; don't inline `__TAURI_INTERNALS__` checks.
- `.fig` export compression uses fflate in browser paths and Tauri Rust commands where available.
- Test `.fig` round-trip by exporting and reimporting in Figma when changing file-format behavior.
- Test fixtures (`tests/fixtures/*.fig`) are Git LFS. If no `.fig` fixtures changed, `git push --no-verify` can skip the slow LFS pre-push hook; use regular `git push` when fixtures changed.

## Tauri

- Tauri v2 desktop app lives under `desktop/`; check `desktop/Cargo.toml`, `desktop/capabilities/**`, and `desktop/tauri.conf.json` before adding desktop capabilities.
- File system and shell permissions must be configured explicitly; vague "Internal error" save failures often mean missing permissions.
- Dev tools: add or use a menu item to toggle, don't rely on keyboard shortcuts.

## Publishing

- `bun publish` from package dirs — resolves `workspace:*` → actual versions
- Public packages publish built `dist/` output, not runtime TypeScript entrypoints
- Public workspace packages build before publishing; most use tsdown, and split packages may also run `tsc --emitDeclarationOnly` plus dist smoke checks. Keep release tooling package lists in sync with `.github/workflows/build.yml`.
- CLI publishes a Node-compatible `bin/openpencil.js` wrapper; do not point package `bin` entries at TypeScript source

## Reference

[figma-use](https://github.com/dannote/figma-use) — historical Figma toolkit reference. Verify current paths/types in that repo before copying assumptions. Useful areas:

- Kiwi binary format, schema, encode/decode (`packages/shared/src/kiwi/`)
- Figma WebSocket multiplayer protocol (`packages/plugin/src/ws/`)
- Vector network blob format (`packages/shared/src/vector/`)
- Node types, paints, effects, layout fields (`packages/shared/src/types/`)
- MCP tools / design operations (`packages/mcp/`)
- JSX-to-design renderer (`packages/render/`)
- Design linter rules (`packages/linter/`)
