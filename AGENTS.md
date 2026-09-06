# OpenPencil

Vue 3 + CanvasKit (Skia WASM) + Yoga WASM design editor. Tauri v2 desktop, also runs in browser.

**Roadmap:** `packages/docs/development/roadmap.md` tracks product direction, Figma compatibility gaps, and raw metadata coverage. This file keeps agent-facing architecture, conventions, and commands; detailed public docs live under `packages/docs/**`.

## Monorepo

Bun workspace packages:

- `scene-graph` — framework-neutral graph, node types, geometry, copy/snap/undo, variables, instances, and hit testing.
- `pen` — Pencil.dev `.pen` model, parser, and SceneGraph adapter.
- `kiwi` — SceneGraph-independent Kiwi schema/runtime, codecs, containers, and parse helpers.
- `fig` — `.fig` archives, SceneGraph conversion, metadata policy, and component/instance interpretation.
- `core` — renderer, layout, editor, Figma API, tools, clipboard, vector conversion, and document I/O; depends on scene-graph, pen, kiwi, and fig, and keeps browser DOM out.
- `dom-css` — DOM/CSS/HTML/JSX/Tailwind projection and browser/headless adapters.
- `vue` — headless Vue 3 SDK primitives and composables; the root app is one consumer.
- `cli` — headless `.fig` inspection, export, and linting with `citty` and `agentfmt`.
- `mcp` — stdio and Hono HTTP MCP server reusing Core tools.
- `harness` — optional Node companion for HarnessAgent sessions and its bounded JSONL host protocol; Tauri launches the separately installed command.
- `docs` — published VitePress site. Use `bun run docs:dev`, `bun run docs:build` for fast checks, and `bun run docs:build:production` for deployment output.

The root Tauri/Vite app lives in `src/`; app services and state belong under `src/app/**`, views under `src/views/**`, and app UI under `src/components/**`.

### Settings UI ownership

Settings components own layout, translated copy, confirmation visibility, and emits. Reactive settings workflows live under the owning app domain's `settings/` folder (for example `src/app/ai/models/settings/profile-editor/{use,selection,connection}.ts`), not a global composables bucket. Use `use.ts` for orchestration and focused sibling modules for substantial sub-workflows. Keep persistence and external operations in domain services, and pure option projections as ordinary functions. Return operation outcomes rather than importing dialogs, routers, or toast UI into workflow composables. Keep newly entered secrets short-lived, never expose saved secrets, and guard async results against changed targets. Small presentation-only computed bindings can remain in components.

### Public package exports

Across package/app boundaries, import the owning package's public exports—never workspace internals or forwarding-only shims. `@open-pencil/scene-graph` owns graph types and primitives; `@open-pencil/kiwi` owns low-level Kiwi/FIG helpers; `@open-pencil/core` provides the compatibility barrel plus targeted subpaths listed in `packages/core/package.json`.

CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit`. Headless raster export may dynamically load `canvaskit-wasm/full`; elsewhere prefer `import type` and pass CanvasKit in.

### Editor architecture

`packages/core/src/editor/` is the framework-agnostic editor core. `createEditor()` in `create.ts` assembles an `EditorContext` plus domain action modules for viewport, selection, pages, shapes, structure, components, clipboard, undo/history, text, variables, layout, color space, graph reads, tool registry, and related helpers. Check the folder before adding editor behavior; keep new actions in the nearest domain module/folder instead of growing unrelated files.

`Editor` type = `ReturnType<typeof createEditor>`. Core modules should share state through `EditorContext` rather than importing app code or Vue.

#### Editor event bus

The editor exposes a typed nanoevents emitter. Event names/payloads live in `EditorEvents` in `packages/core/src/editor/types.ts`; graph events are bridged from SceneGraph by `graph-events.ts`. Subscribe with `editor.onEditorEvent(event, handler)`, or in Vue use `useEditorEvent(event, handler)` from `packages/vue/src/editor/events/use.ts`.

Important invariant: all selection mutations in core go through `ctx.setSelectedIds()` and all tool changes go through `ctx.setActiveTool()` so events fire consistently. App-layer code should use editor actions such as `clearSelection()`, `select()`, or `setTool()` — never direct `state.selectedIds =` or `state.activeTool =` assignments.

The app editor session (`src/app/editor/session/create.ts`) is a Vue wrapper around core: it creates reactive state, calls `createEditor()`, and assembles app-specific document I/O, autosave, export, vector edit, pen resume, flashes, profiler, and mobile clipboard. Tabs live in `src/app/tabs/`; active editor access lives in `src/app/editor/active-store/`.

Headless SDK fields compose variable/token binding through `BindingProvider` and the `BindableValue` primitives in `packages/vue/src/controls/binding-provider/` and `packages/vue/src/primitives/BindableValue/`. Keep numeric interaction in `NumberField`; providers own binding lookup, mutation, and undo batching.

Property-panel anatomy in `packages/vue/src/primitives/PropertySection/`, `SegmentedControl/`, and `PropertyList/` is controlled and editor-agnostic. Connect PropertyList events to OpenPencil selection and undo through `useEditorPropertyList()` or an app adapter; never call `useEditor()` from these primitives.

### Settings and credentials

Credential persistence lives under `src/app/settings/credentials/`. Settings components receive `CredentialManager` and may inspect status, replace, or clear credentials; runtime adapters receive `CredentialResolver`. Components must not read saved secrets or keep them in long-lived reactive refs. Non-secret provider preferences remain in normal settings storage.

Tauri stores secrets in the native system credential store through `desktop/src/credentials.rs`; browsers default to WebCrypto-encrypted IndexedDB storage and may explicitly opt out to session-only memory. Native failures must never silently fall back to browser or plaintext storage. New integration credentials use stable `CredentialRef` values and join the unified Settings surface rather than adding feature-local key forms.

Storage-provider schemas and runtime adapters live under `src/app/integrations/storage/`; non-secret preferences and credential references stay separate, and adapters resolve secrets at operation time. Local-first document caching and outbox synchronization live under `src/app/storage/`. A remote storage binding augments document source state and must not replace local file identity.

Bitmap-to-vector conversion lives in `packages/core/src/vector/vectorize/`; app provider clients, preferences, and lazy credential resolution live under `src/app/editor/vectorize/`. Keep provider credentials in the centralized credential manager, bound request and response sizes, and validate provider-owned download URLs before importing returned SVG.

App dialogs compose the Reka-backed components under `src/components/ui/dialog/` and the typed theme in `src/theme/dialog.ts`. Do not repeat portal, overlay, content, header, or footer infrastructure in feature dialogs.

## Commands

- `bun run dev:portless` — preferred browser server at `https://open-pencil.localhost`; worktrees use `https://<branch>.open-pencil.localhost`.
- `bun run dev` — fixed `http://localhost:1420` server for Playwright, Tauri, and Dev Containers.
- `bun run check` — complete build, lint, type, architecture, docs, package, dependency, security, tooling, and duplication gate.
- `bun run format` — format and sort imports.
- `bun run test:unit` / `bun run test` — engine/unit and Playwright suites.
- `bun run tauri dev` — desktop app with hot reload.
- `bun open-pencil --help` — current CLI command list.

## Git worktrees and development servers

Prefer `dev:portless`, especially in worktrees. It assigns branch-specific app and `mcp.open-pencil` sibling URLs with isolated runtime discovery. Use fixed-port `dev` only for Playwright, Tauri, and Dev Container flows.

## Releases & CI

For releases, update versions in the root and publishable package manifests plus `desktop/tauri.conf.json` and `desktop/Cargo.toml`; move `Unreleased` into `## x.y.z — YYYY-MM-DD`; commit `Release vX.Y.Z`; then tag and push `vX.Y.Z`.

`.github/workflows/build.yml` is the source of truth: `v*` tags build signed desktop artifacts, create a draft release from the exact changelog section, upload updater files, and publish the package set defined there and in `tools/release-packages/src/publish-dirs.ts`. Publishing uses prepared, validated npm tarballs—do not publish package directories manually. Ensure Tauri and Apple signing/notarization secrets are configured. Verify the draft title/body and artifacts, then publish it; `homebrew.yml` updates the cask on publication.

App/docs production workflows run on `v*` tags or `workflow_dispatch`, not ordinary `master` pushes. `ci.yml` and `heavy-tests.yml` define validation gates.

## Documentation

- `CHANGELOG.md` — curated user-facing changes by version; `Unreleased` stays first.
- `README.md` — concise features, setup, CLI, and project overview.
- `AGENTS.md` — contributor/agent architecture and conventions.
- `packages/docs/` — public VitePress docs. Keep routes under `/getting-started`, `/overview/**`, `/user-guide/**`, `/programmable/**`, `/reference/**`, and `/development/**`; do not recreate `/guide/**`. Preserve moves in `public/_redirects`, and link untranslated locale navigation to canonical English pages rather than adding placeholders.

For user-facing work, add one present-tense outcome under the single appropriate `Unreleased` category: `Breaking changes`, `Added`, `Changed`, `Fixed`, `Performance`, or `Security`. Treat it as release notes, not a commit log: omit tests, benchmarks, CI, internal refactors/tooling, and bugs both introduced and fixed since the last release. After merges, compare the whole section with changes since the latest release, preserve important outcomes, consolidate related work, and remove duplicate bullets/headings. End sentences with periods and retain relevant issue/PR references. Update `README.md` when appropriate and this file when architecture or conventions change. Keep internal plans in ignored `scratch/`, not published docs.

## Commit messages

Use Conventional Commits (`feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`) for regular work. Keep subjects short, imperative, and narrowly scoped; explain rationale in the body. Preserve product casing such as DOM/CSS, HTML, JSX, Tailwind, Kiwi, `.fig`, MCP, CLI, AI, ACP, and i18n. Release commits use `Release vX.Y.Z`.

## CLI

- Format all output with the `agentfmt` helpers re-exported from `packages/cli/src/format.ts`; do not hand-roll terminal formatting.
- Data/inspection commands should support `--json`.

## Tools (AI / MCP / CLI)

- Core operations are `ToolDef`s under `packages/core/src/tools/**`; `schema.ts` defines their contract and registries expose them. Add work to the nearest existing domain and the appropriate registry.
- `ai-adapter.ts` converts ToolDefs for Vercel AI; `src/app/ai/tools/index.ts` binds them to the active editor's `FigmaAPI`.
- CLI commands own CLI UX independently; `eval` exposes operations through `FigmaAPI`.
- MCP-only filesystem/server tools live in `packages/mcp/src/tool/registration.ts`; listener/session lifecycle lives under `server/`, stdio under `stdio/`, and transport discovery under `transport/`. File access must resolve symlinks inside the effective MCP root; CLI defaults are cwd on macOS/Linux and home on Windows.
- Keep MCP transport tests under `tests/engine/mcp/{server,stdio,transport}` and shared fixtures under `tests/helpers/mcp`; isolate tests from user runtime discovery.
- Core codegen prompts live under `packages/core/src/tools/prompts/`; app chat/ACP prompts under `src/app/ai/**`.

## ACP and collaboration

- Harness agents live in the optional `@open-pencil/harness` Node companion. Keep it backend-neutral, persist only opaque non-secret resume state, expose the bounded JSONL protocol, and never bundle a JavaScript runtime into Tauri. Pi's in-memory `just-bash` cannot recover across process restarts.
- ACP transport lives under `src/app/ai/acp/**`; provider definitions in `packages/core/src/constants.ts`; profiles in `src/app/ai/models/**`. Keep provider connections, reusable profiles, and role assignments separate, and resolve credentials lazily.
- ACP process changes require checking `desktop/capabilities/**`.
- Collaboration lives under `src/app/collab/**` and uses Trystero, Yjs, and awareness; preserve crypto-safe room IDs and peer cleanup.

## Code conventions

- Put code and tests in the established owning domain; inspect nearby structure before adding files.
- `bun run check:arch` enforces boundaries: use public workspace exports, keep Core framework-neutral, keep app services out of views/shared UI, and keep property-panel internals scoped to that panel.
- Tests belong in `tests/e2e/**/*.spec.ts` (browser UI/visual), `tests/figma/**/*.spec.ts` (Figma automation), `tests/engine/**/*.test.ts` (engine/unit), `tests/helpers/**` (shared helpers), or an established package-local test location. Mirror source domains where practical and test behavior/contracts, not source text. Never commit temporary/profile specs.

### File and folder naming

- App services/state/integrations live in `src/app/**`, views in `src/views/**`, and UI in `src/components/**`; `src/components/ui/**` is generic design-system code and must not import app stores/services.
- Component domains use lowercase/kebab-case folders; Vue files stay PascalCase and component composables camelCase. Do not add new PascalCase app folders or root-level base controls; migrate old ones when touched.
- Non-component folders/files use lowercase or kebab-case except standard entrypoints. Group multi-file domains in subfolders instead of repeated sibling prefixes (`selection/container.ts`, not `selection-container.ts`).

### Repo tools and scripts

Private tooling belongs under `tools/<domain>/{src,tests}`, with kebab-case domains and focused tests. `scripts/` may contain only tiny compatibility entrypoints; put real workflow, release, architecture, package, or visual tooling in `tools/`.

- Use `@/` for app cross-directory imports. Package aliases are `#vue/*`, `#cli/*`, `#dom-css/*`, `#mcp/*`, and `#core/*`; prefer clear relative imports nearby.
- No `any`, non-null assertions, or `Math.random()`; use precise types, guards, and `crypto.getRandomValues()`.
- Reuse named types and primitives from `@open-pencil/scene-graph`; do not respell `Color`, `Vector`, `SceneNode`, `Effect`, `Fill`, or `Stroke` shapes.
- Window API declarations belong in `src/global.d.ts` or `packages/core/src/global.d.ts`.
- Use `culori` for color conversion and existing dependencies before custom implementations.
- Prefer VueUse for common browser, event, focus, clipboard, storage, and timer behavior, but keep one-shot rAF or explicit service-owned timers when clearer.
- Components must not hold module-level mutable state. Share repeated logic/constants rather than copying it.
- Keep Kiwi runtime changes minimal; prefer wrappers for project policy.
- Guard browser globals explicitly in Core. Name repeated/cross-feature constants; app-wide values belong in `src/constants.ts`.

## Code quality

Before submitting a PR, run the complete gate and relevant tests:

```sh
bun run check
bun run format
bun run test:unit
bun run test
```

Self-review for duplication, named shared types, precise unions, and files approaching ~600 lines. Use `structuredClone` or typed copy helpers for nested mutable data. Check existing dependencies before implementing utilities; `es-toolkit` is available for focused helpers without replacing clear native code. Read current Reka UI, VueUse, and Tailwind/tailwind-variants docs before inventing UI primitives or composables, and update local wrappers deliberately when upstream APIs changed.

### Native WebView tests

Native desktop interaction checks live under `tests/e2e/native/**` and run through WebdriverIO against an explicit test-only Tauri binary. Use `bun run test:native` to build and run them, or `bun run build:native-test` when only the binary is needed. The embedded WebDriver plugin is compiled only with the `native-test` Cargo feature and must never be enabled in normal development or production binaries.

Keep responsibilities distinct: engine tests cover state contracts, Playwright browser E2E covers application integration, and native tests answer only whether the real platform WebView and Tauri shell deliver an interaction correctly. Platform-limited checks must skip rather than claim coverage. Synthetic composition tests do not prove real IME behavior, and native clipboard behavior remains a separate acceptance gap unless the test receives trusted OS clipboard events.

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

- Nodes live in a flat `Map<string, SceneNode>`; runtime hierarchy uses `parentId` and `childIds`.
- Frames do not clip by default.
- Sort children geometrically before creating auto-layout. Dragging outside a frame reparents; groups preserve child world positions.
- Layer trees must react to reparenting rather than retaining stale child references.

## Components & instances

- Component types use `#9747ff`.
- Instance children map to component children through `componentId`; runtime overrides use structured `InstanceOverrideState` (`self` and `descendants` maps).
- Component edits must propagate through editor/component sync—never hand-copy properties in app UI. Use Scene Graph copy helpers for nested values.

## Layout

- Recompute layout after demo creation and for each materialized/imported page; scope computation to the affected page/subtree where possible.
- `@open-pencil/yoga-layout` supplies both flexbox and CSS Grid.
- The first Hug/Fill dimension mutation switches only that axis to Fixed; focus is non-destructive, and mode/value changes share one undo transaction.

## UI

### Component structure

- Generic UI is grouped by component family under `src/components/ui/{button,input,select,toggle,dialog,panel,binding,feedback,overlay,menu,paint}/`; do not create a folder named after a single component. Theme families mirror these under `src/theme/`; feature themes remain separate. Use explicit imports without old-path forwarding shims.
- Colocate `ComponentName.stories.ts` with `ComponentName.vue`. Multipart composition stories may use a descriptive family name. Preserve explicit Storybook titles and exported story names during file moves; keep default playgrounds static and give interaction flows named stories. Use deterministic fixtures and colocated Vue demos for substantial markup.
- `src/components/ui/**` is store-free app design-system code; feature controls stay in their domain.
- SDK property primitives remain controlled/editor-agnostic. Compose property rows from `PanelGrid`, `PanelFieldGroup`, `PanelItemRow`, and `PropertyItemRow`; use `BindableValue`, `FillRoot`, and `FillSwatch` rather than rebuilding binding/picker infrastructure.
- Prefer accessible role/name, label, then text in tests. Use scoped `data-slot` anatomy or semantic attributes (`data-property`, `data-command`, `data-node-id`) when needed; reserve `data-test-id` for integration boundaries and never add test-hook props.
- Use Reka UI primitives and typed Tailwind Variants themes under `src/theme/**`; merge per-instance `ui` slot overrides, expose `class` for single-root components, and do not add one-off class props. Use `UI` casing in type names.
- Bind visual state through semantic `data-*` attributes; Steiger rejects template-time `use*UI()`, visual-state utility branches, and raw SVG app icons.
- Storybook is the internal state workshop; VitePress is canonical public SDK documentation. Reuse colocated demos, derive API tables from source/JSDoc, and keep examples valid against public exports.
- Prefer models/events/props over imperative slot actions except for explicitly renderless action primitives. Use VueUse for DOM refs/focus.
- App wrappers around SDK primitives use shared UI helpers rather than scattered raw classes.
- Commands use `packages/vue/src/editor/commands/registry.ts` for shortcuts, bindings, and menu IDs. Store portable tokens (`MOD+D`) and format them at render time; labels/translations never contain shortcuts.
- i18n uses narrow product-domain catalogs under `packages/vue/src/i18n/messages/` with matching locale files. Inspect existing domains instead of adding generic UI/component namespaces; prefer narrow `use*Messages()` composables over aggregate `useI18n()`.
- `check:i18n` enforces structure, placeholder parity, and reviewed translation baselines. Remove stale baseline identities when fixing existing debt.
- Canvas menu structure lives in `packages/vue/src/editor/menu-model/canvas.ts`; `CanvasMenu.vue` renders it.
- Browser/native menus share `src/app/shell/menu/schema.ts`; handle IDs in `use.ts` or editor commands, and regenerate `desktop/generated/menu.json` with `generate:tauri-menu`.
- Use Tailwind 4 and `tw-animate-css`; no static inline styling or component `<style>` blocks. Dynamic `:style` bindings are allowed for runtime geometry/CSS variables.
- Use `Tip`, not native `title`; Lucide/Iconify components, not raw SVG/Unicode icons; and `e.code`, not `e.key`, for modified shortcuts.
- Binding-aware fields detach/mutate only on the first value change; opening/focusing is non-destructive.
- Preserve nearby interaction gotchas when refactoring: splitter handles, NumberField pointer ownership, section dragging, panel containment, and number-spinner styling.

## File format

- Kiwi schema/runtime/codec/container helpers live in `@open-pencil/kiwi`; complete archive parsing and SceneGraph conversion live in `@open-pencil/fig`; Core owns format-neutral orchestration, runtime fonts/workers, and thumbnails.
- Vector networks use the reverse-engineered `vectorNetworkBlob`; codecs live under `packages/core/src/vector/` and types in Scene Graph.
- File System Access APIs are browser APIs, not Tauri-only. Keep Safari download fallback and defer `revokeObjectURL`.
- Detect desktop with `IS_TAURI`, never ad-hoc `__TAURI_INTERNALS__` checks.
- Browser FIG export uses fflate/`@open-pencil/fig`; Tauri uses `build_fig_file`.
- Changes to `.fig` behavior require round-trip validation in Figma. Fixtures under `tests/fixtures/*.fig` use Git LFS; use normal `git push` when they change.

## Tauri

- Tauri v2 desktop app lives under `desktop/`; check `desktop/Cargo.toml`, `desktop/capabilities/**`, and `desktop/tauri.conf.json` before adding desktop capabilities.
- File system and shell permissions must be configured explicitly; vague "Internal error" save failures often mean missing permissions.
- Dev tools: add or use a menu item to toggle, don't rely on keyboard shortcuts.

## Reference

[`figma-use`](https://github.com/dannote/figma-use) is historical context only; verify current paths, types, and behavior before adapting anything.
