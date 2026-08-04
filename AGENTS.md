# OpenPencil

Vue 3 + CanvasKit (Skia WASM) + Yoga WASM design editor. Tauri v2 desktop, also runs in browser.

**Roadmap:** `packages/docs/development/roadmap.md` tracks product direction, Figma compatibility gaps, and raw metadata coverage. This file keeps project-wide agent-facing architecture, conventions, and commands; detailed public docs live under `packages/docs/**`.

Domain-specific conventions live in nested agent files next to the code they govern:

- `src/AGENTS.md` — app editor session, settings/credentials, ACP/collab, UI component and styling rules
- `desktop/AGENTS.md` — Tauri desktop shell
- `packages/core/AGENTS.md` — editor core, tools, rendering, layout, CanvasKit
- `packages/scene-graph/AGENTS.md` — scene graph, components/instances, shared primitives
- `packages/fig/AGENTS.md` and `packages/kiwi/AGENTS.md` — `.fig`/Kiwi file format
- `packages/vue/AGENTS.md` — headless Vue SDK primitives, commands, i18n
- `packages/cli/AGENTS.md` — CLI output and command conventions
- `packages/mcp/AGENTS.md` — MCP server tools and transport

## Monorepo

Bun workspace packages:

- `packages/scene-graph` — `@open-pencil/scene-graph`: SceneGraph, node types, copy/snap/undo helpers, variables, instances, hit testing. Framework-agnostic.
- `packages/pen` — `@open-pencil/pen`: Pencil.dev `.pen` document model, parser, and SceneGraph import adapter.
- `packages/kiwi` — `@open-pencil/kiwi`: pure Kiwi schema/runtime/protocol package. Owns low-level Figma Kiwi codec/container/parse helpers and stays SceneGraph-agnostic.
- `packages/fig` — `@open-pencil/fig`: `.fig` archive/parser package owning Figma-specific SceneGraph conversion, raw metadata policy, and component/instance interpretation. Core keeps format-neutral IO registration and runtime rendering/font integration.
- `packages/deck` — `@open-pencil/deck`: Figma Slides `.deck` archive parse/write and slide↔page NodeChange restructure. Core owns IO registration and SceneGraph import/export orchestration.
- `packages/core` — `@open-pencil/core`: renderer, layout, editor core, Figma API, tools, clipboard, vector conversion, and app/CLI-facing document I/O. Depends on scene-graph/pen/kiwi/fig/deck but keeps browser DOM out of core.
- `packages/dom-css` — `@open-pencil/dom-css`: DOM/CSS projection layer for HTML/CSS/JSX/Tailwind compatibility. Owns DesignDOM types and browser/headless CSS runtime adapters; keeps DOM/CSS parser dependencies out of core.
- `packages/vue` — `@open-pencil/vue`: headless Vue 3 SDK (Reka UI-style) for building custom OpenPencil-powered editor shells and embedded editing surfaces. Renderless components and composables. The app is one consumer of the SDK.
- `packages/cli` — `@open-pencil/cli`: headless CLI for .fig inspection, export, linting. Uses `citty` + `agentfmt`.
- `packages/mcp` — `@open-pencil/mcp`: MCP server for AI coding tools. Stdio + HTTP (Hono). Reuses core tools.
- `packages/docs` — `@open-pencil/docs`: published VitePress documentation site. Run with `bun run docs:dev`.

The root app (`src/`) is the Tauri/Vite desktop editor. App-specific editor, document, AI, collaboration, shell, tabs, demo, and automation code lives under `src/app/*`. The app consumes scene graph primitives from `@open-pencil/scene-graph`, editor/rendering services through targeted `@open-pencil/core` subpath exports, and `@open-pencil/vue` through the public Vue SDK entrypoint.

### Public package exports

Use public package exports across package/app boundaries. Do not import workspace package internals from app code. Do not create cross-package re-export shim files whose only purpose is forwarding another package's API. Import the owning package directly at call sites; public compatibility barrels may re-export the owner directly when preserving an established package API.

- `@open-pencil/scene-graph` — SceneGraph, node types, primitives, copy/snap/undo, instance helpers, variable helpers, vector-network types.
- `@open-pencil/core` — broad compatibility barrel for editor/rendering/tooling APIs.
- Common targeted core subpaths keep imports smaller and dependency intent clearer: `@open-pencil/core/color`, `/text`, `/vector`, `/figma-api`, `/icons`, `/canvas`, `/design-jsx`, `/editor`, `/tools`, `/kiwi`, `/clipboard`, `/rpc`, `/lint`, `/profiler`, `/io`, `/canvaskit`, `/layout`.
- Use `@open-pencil/kiwi` for low-level Kiwi/FIG schema-runtime, codec, container, GUID, and parse helpers.

## Commands

- `bun run check` — type-aware lint + typecheck via oxlint + tsgo + architecture checks (run before committing)
- `bun run check:arch` — Steiger architecture lint for project-specific import boundaries
- `bun run check:vue` — vue-tsc type-check for app and Vue SDK .vue files
- `bun run test:dupes` — jscpd copy-paste detection across product TS sources
- `bun run test:tools` — tests for private repo tooling under `tools/*`
- `bun run format` — oxfmt with import sorting
- `bun run test:unit:quick` — engine/unit tests minus heavy fixtures (the pre-PR gate)
- `bun test $(bun tools/unit-tests/src/list.ts <group>)` — one shard while iterating; groups are `app`, `dom`, `editor`, `fig`, `render`, `scene`, `vue` (see `tools/unit-tests/src/shards.ts`)
- `bun run test` — Playwright E2E and visual regression tests
- `bun run tauri dev` — desktop app with hot reload
- `bun open-pencil --help` — list CLI commands. Common commands include `info`, `tree`, `find`, `node`, `pages`, `variables`, `export`, `import`, `convert`, `lint`, `query`, `selection`, `formats`, `analyze ...`, and `eval` for Figma Plugin API scripting.

### Running unit tests

The engine suite is sharded on purpose — do not run it raw.

- Do not run `bun test tests/engine` (or `bun run test:unit`, which is the same thing). It takes ~40 minutes and pulls the heavy fixture tests in **without** their intended 180s timeout, producing failures that are artifacts of the timeout rather than real regressions.
- While iterating, run the directories you touched (`bun test tests/engine/{deck,editor,vue}`) or a single shard group. These are seconds, not minutes.
- `bun run test:unit:quick` (~10 min) is the pre-PR gate. Run it once before opening a PR, not mid-task.
- `bun run test:unit:heavy` applies the 180s timeout to the heavy fixture patterns. The nightly `heavy-tests.yml` schedule owns these; they are not a per-PR gate.
- To tell a pre-existing failure from one you introduced, re-run the single failing file across a `git stash` — never re-run the suite to diff failure lists.
- Per-PR CI shards the same groups across parallel jobs (`ci.yml`), so targeted tests plus the static gates are enough to justify a push.

## Debugging discipline

- Time-box expensive interactive and browser repro loops. After two attempts or roughly two
  minutes without materially new evidence, stop, summarize what changed, and choose a smaller
  diagnostic instead of repeating the same sweep.
- Repeated low-yield testing is being stuck even when commands and tools are still running.
  Say so plainly, report the current evidence, and reassess; never deny being stuck merely
  because work is in progress.
- Keep the user informed during long diagnostics. State what is running, why it is needed, and
  the bounded next checkpoint; do not leave them waiting silently while repeating tests.
- Prefer the smallest discriminating test: instrument one boundary, reproduce one transition,
  and inspect one result before expanding to a full deck or full quality gate.
- Browser/HMR tests must confirm that the inspected tab is the current live window before using
  its screenshot or logs as evidence. Close or release stale popups instead of comparing them.
- Run targeted checks while diagnosing. Save repository-wide gates and long stress sweeps for
  after the focused reproduction passes, unless the user explicitly asks for the full gate.
- Long test runs must stay observable. Run them in the background with full streaming output —
  never piped through `tail`, `head`, or `grep`, which buffer everything until completion and
  leave a 10-minute run with zero mid-run signal. Snapshot the task output to read progress
  (per-test lines from `bun test`, Playwright's `--reporter=list`), and state the scope
  (files, test count) and expected duration before launching, with a bounded checkpoint to
  re-estimate ETA from observed progress rather than waiting blind.

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
- `AGENTS.md` (this file) plus nested `AGENTS.md` files — contributor/agent reference: architecture, conventions, how to release. Keep domain rules in the nested file closest to the code they govern.
- `packages/docs/` — VitePress site deployed at `openpencil.dev`. User guide, SDK, automation, reference, and development docs. Do not create English placeholder copies under locale directories; until a real translation exists, localized navigation should link to the canonical English page.

When adding features, update `CHANGELOG.md` (Unreleased section) and `README.md` (if user-facing). Update `AGENTS.md` when architecture or conventions change. Do not put speculative/internal implementation plans in `packages/docs/**`; VitePress docs are published. Keep temporary plans in ignored `scratch/` or distill durable public direction into the canonical roadmap.

## Commit messages

Use Conventional Commits for regular development commits: `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`.

- Keep the first line short, imperative, and scoped when helpful
- Put rationale and implementation details in the commit body
- Keep the commit type lowercase (`fix:`, `feat:`, `docs:`), but start each body line/bullet with an uppercase word
- Preserve product/domain casing in subjects and bodies: `DOM/CSS`, `CSS`, `HTML`, `JSX`, `Tailwind`, `Kiwi`, `.fig`, `MCP`, `CLI`, `AI`, `ACP`, `i18n`. Do not flatten acronyms to lowercase prose such as `dom css documents`.
- Prefer scopes that match the project structure: `app`, `tauri`, `core`, `cli`, `dom-css`, `mcp`, `vue`, `docs`, or focused domains like `editor`, `scene-graph`, `canvas`, `tools`, `kiwi`, `io`, `text`, `vector`, `color`, `acp`, `ai`, `collab`, `automation`, `i18n`
- Use the narrowest honest scope, or omit it if the change spans multiple unrelated areas

Example:

```text
fix(editor): preserve text edit undo state

- Snapshot both text and styleRuns when editing starts
- Restore both on undo instead of comparing against the live node
```

Release commits are the exception: keep using `Release v0.x.y`.

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

### General rules

- Use package-local aliases inside workspace packages: `#vue/*` in `packages/vue`, `#cli/*` in `packages/cli`, `#dom-css/*` in `packages/dom-css`, `#mcp/*` in `packages/mcp`, and `#core/*` when core code needs an alias. Prefer relative imports within nearby core modules when that is clearer than an alias.
- No `any` — use proper types, generics, declaration merging
- No `!` non-null assertions — use guards, `?.`, `??`
- No `Math.random()` — use `crypto.getRandomValues()` everywhere
- No inline type definitions when a named type exists — use `Color` not `{ r: number; g: number; b: number; a: number }`, use `Vector` not `{ x: number; y: number }`, and import `SceneNode` / `Effect` / `Fill` / `Stroke` from `@open-pencil/scene-graph` instead of re-spelling their shapes.
- Use `culori` for color conversions — don't reimplement parseColor/colorToRgba
- No duplicated logic — if two components or modules share data (icon maps, util functions, constants), export from one place and import in both

## Code quality

Before submitting a PR, run the full quality gate and do a self-review:

```sh
bun run check          # oxlint + tsgo type-aware lint & typecheck — zero errors required
bun run format         # oxfmt with import sorting
bun run test:dupes     # jscpd — zero clones required
bun run test:tools     # private repo tooling tests
bun run test:unit:quick # bun:test, heavy fixtures excluded — see "Running unit tests"
bun run test           # Playwright E2E
```

Self-review checklist:

- Run `bun run test:dupes` — if duplication rises, extract shared helpers or use existing types
- No inline type definitions that duplicate named types (Color, Vector, SceneNode, Effect, Fill, Stroke, etc.)
- No copy-pasted logic — extract into functions. If `jscpd` flags it, fix it.
- Use precise union types — `'closed' | 'half' | 'full'` not `number | string | null`
- Files should stay under ~600 lines — split by domain when they grow (see `packages/core/src/tools/` for the pattern)
- `structuredClone` for deep copies, never shallow spread when mutating nested objects
- Don't hand-roll what a dependency already does. Check existing deps first (`package.json`, `packages/*/package.json`). If none covers it, find a quality library instead of inlining an implementation — e.g. use `diff` for unified diffs, not a custom line-by-line loop; use `culori` for color math, not manual RGB parsing.
- Before custom UI/control/composable work, read upstream docs for the relevant dependency instead of guessing from local usage. Prefer their `llms.txt` entrypoints when available:
  - Reka UI (`https://reka-ui.com/llms.txt`) before building dialogs, popovers, dropdowns, menus, selects, tooltips, toasts, trees, splitters, or other primitives.
  - VueUse (`https://vueuse.org/llms.txt`) before hand-rolling DOM events, browser APIs, refs/focus, media queries, timers, clipboard, storage, async state, or observers.
  - Tailwind / tailwind-variants docs before inventing one-off styling prop APIs or variant composition.
- If upstream docs contradict local patterns, prefer current upstream APIs and update local wrappers deliberately.

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
