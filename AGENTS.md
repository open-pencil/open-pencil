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

Compose Settings sections with `SettingsSection` and its `title`, `description`, `actions`, and default content slots. It owns heading association and internal spacing; `SettingsGroup` owns bordered row grouping. Do not repeat section/header/spacing markup in each feature.

Settings components own layout, translated copy, confirmation visibility, and emits. Reactive settings workflows live under the owning app domain's `settings/` folder (for example `src/app/ai/models/settings/profile-editor/{use,selection,connection}.ts`), not a global composables bucket. Use `use.ts` for orchestration and focused sibling modules for substantial sub-workflows. Keep persistence and external operations in domain services, and pure option projections as ordinary functions. Return operation outcomes rather than importing dialogs, routers, or toast UI into workflow composables. Keep newly entered secrets short-lived, never expose saved secrets, and guard async results against changed targets. Small presentation-only computed bindings can remain in components. New explicit settings forms use headless VeeValidate v5 with native Valibot schemas and existing controlled UI components; keep form state in the owning settings domain. Saved secrets and replacement-secret drafts stay outside form snapshots and devtools, and persistence/concurrency remain in domain workflows rather than form callbacks.

### Public package exports

Across package/app boundaries, import the owning package's public exports—never workspace internals or forwarding-only shims. `@open-pencil/scene-graph` owns graph types and primitives; `@open-pencil/kiwi` owns low-level Kiwi/FIG helpers; `@open-pencil/core` provides the compatibility barrel plus targeted subpaths listed in `packages/core/package.json`.

CanvasKit runtime loading is centralized in `@open-pencil/core/canvaskit`. Headless raster export may dynamically load `canvaskit-wasm/full`; elsewhere prefer `import type` and pass CanvasKit in.

### Editor architecture

`packages/core/src/editor/` is the framework-agnostic editor core. `createEditor()` in `create.ts` assembles an `EditorContext` plus domain action modules for viewport, selection, pages, shapes, structure, components, clipboard, undo/history, text, variables, layout, color space, graph reads, tool registry, and related helpers. Check the folder before adding editor behavior; keep new actions in the nearest domain module/folder instead of growing unrelated files.

`Editor` type = `ReturnType<typeof createEditor>`. Core modules should share state through `EditorContext` rather than importing app code or Vue.

#### Retained property panels

`DesignPanel` retains at most one selection-property subtree through `RetainedPanel`. The app installs `createRetainedScopePlugin()` from the Vue SDK; opted-in descendants receive `provideRetainedActivity()`. Vue component scopes are detached, so pausing only a parent or using bare `KeepAlive` does not suspend descendant work. Cancel drafts synchronously before DOM detachment can fire blur, close transient state and gate portals with `useRetainedPopup()`, and invalidate pending async results on deactivation/disposal. The plugin lets cleanup flush before pausing each component scope and resumes it on activation; it requires Vue's Options API. Unmounting the owning editor releases the retained subtree.

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
- `bun run test:unit` / `bun run test` — engine/unit and app Playwright suites.
- `bun run test:storybook` — the Storybook Playwright project in `playwright.config.ts`. Test scripts select their server; direct Playwright commands start both servers unless `OPENPENCIL_TEST_SERVER=app|storybook|all` is set.
- `bun run tauri dev` — desktop app with hot reload.
- `bun open-pencil --help` — current CLI command list.

## Git worktrees and development servers

Prefer `dev:portless`, especially in worktrees. It assigns branch-specific app and `mcp.open-pencil` sibling URLs with isolated runtime discovery. Use fixed-port `dev` only for Playwright, Tauri, and Dev Container flows.

A fresh worktree needs `bun install` and `bun run build:packages` before docs, Storybook, or any workflow that resolves workspace subpath exports; without the package builds those resolve to missing `packages/*/dist` targets.

Browser tests use the canonical `playwright.config.ts`; do not create task-specific config copies or server runners. Managed runs must start the intended checkout, with server reuse explicitly opted into only for local development, never baseline comparisons or CI. Isolate the app URL and MCP endpoint, CORS origin, socket, and discovery path together. Playwright owns Vite; the existing Vite automation plugin owns MCP startup and cleanup; browser fixtures own interactions, not server processes. See `packages/docs/development/testing.md` for configuration and commands.

## Releases & CI

For releases, update versions in the root and publishable package manifests plus `desktop/tauri.conf.json` and `desktop/Cargo.toml`; move `Unreleased` into `## x.y.z — YYYY-MM-DD`; commit `Release vX.Y.Z`; then tag and push `vX.Y.Z`.

`.github/workflows/build.yml` is the source of truth: `v*` tags (or dispatches for an immutable stable tag) build shared frontend/package outputs once, build signed desktop artifacts in parallel, verify and attest one complete same-run artifact set, publish npm packages, and replace the draft release assets using the exact changelog section. Native release policy and recovery rules live in `tools/release-packages/README.md`; workflow and application source commits are recorded separately. Public workspace packages are discovered by the package-artifacts catalog. Bun source exports require the complete `src` directory in package contents; Node exports continue to use `dist`. Release preparation must preserve resolution maps. Publishing uses prepared npm tarballs verified through the shared Node/Bun consumer checks—do not publish package directories manually. Ensure Tauri and Apple signing/notarization secrets are configured. Verify the draft title/body and artifacts, then publish it. Release titles are exactly the tag (`vX.Y.Z`), without a product-name prefix. Homebrew's official `openpencil` cask is managed upstream: BrewTestBot proposes version updates, then Homebrew reviews and merges them. Check the upstream cask/PR after publication; do not push to the archived custom tap or create duplicate bump automation. Install the desktop app with `brew install --cask openpencil`; install the CLI separately through npm or Bun.

App/docs production workflows run on `v*` tags or `workflow_dispatch`, not ordinary `master` pushes. `ci.yml` and `heavy-tests.yml` define validation gates.

PR CI always classifies changed paths through `tools/ci/`. Docs-only changes run documentation integrity/reference checks and the docs build, not engine, browser, Storybook, or native suites. Runtime prompt Markdown, executable examples, configuration, and unknown paths require code validation. The aggregate `CI result` gate requires successful classification and every applicable job; failures, cancellations, and unexpected skips cannot pass. Do not restore workflow-level path filtering on required CI.

## Documentation

- `CHANGELOG.md` — curated user-facing changes by version; `Unreleased` stays first.
- `README.md` — concise features, setup, CLI, and project overview.
- `AGENTS.md` — contributor/agent architecture and conventions.
- `packages/docs/` — public VitePress docs. Keep routes under `/getting-started`, `/overview/**`, `/user-guide/**`, `/programmable/**`, `/reference/**`, and `/development/**`; do not recreate `/guide/**`. Preserve moves in `public/_redirects`, and link untranslated locale navigation to canonical English pages rather than adding placeholders.

For user-facing work, add one present-tense outcome under the single appropriate `Unreleased` category: `Breaking changes`, `Added`, `Changed`, `Fixed`, `Performance`, or `Security`. Treat it as release notes, not a commit log: omit tests, benchmarks, CI, internal refactors/tooling, and bugs both introduced and fixed since the last release. After merges, compare the whole section with changes since the latest release, preserve important outcomes, consolidate related work, and remove duplicate bullets/headings. End sentences with periods and retain relevant issue/PR references. Update `README.md` when appropriate and this file when architecture or conventions change. Keep internal plans in ignored `scratch/`, not published docs.

Before finalizing `Unreleased`:

- Compare released behavior at the latest published tag with the final implementation, not just commit subjects. Verify questionable fixes existed at that tag; fold fixes to newly added features into their final feature description.
- Check public exports, model/config/data contracts, and peer requirements for removals, renames, and upgrade instructions under `Breaking changes`.
- Remove superseded intermediate behavior and duplicate outcomes across categories. State platform requirements and concrete supported behavior instead of unqualified compatibility or performance claims.
- Run `bun run check:changelog`. Keep historical sections unchanged during routine cleanup; release publication uses the matching tagged section, not regenerated prose.

## Commit messages

`commitlint.config.ts` enforces message structure through the **Commit messages** CI job on all PRs, including docs-only changes. Run `bun run check:commits --last` or pass `--from`/`--to` for a branch range. Preserve the release exception and product casing when changing rules; CI gate policy lives in `tools/ci/src/policy.ts`.

Use Conventional Commits (`feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`) for regular work. Keep subjects short, imperative, and narrowly scoped; explain rationale in the body. Preserve product casing such as DOM/CSS, HTML, JSX, Tailwind, Kiwi, `.fig`, MCP, CLI, AI, ACP, and i18n. Release commits use `Release vX.Y.Z`.

Keep AI assistance in the PR's AI assistance section, not commit authorship or `Co-authored-by` trailers. Do not append tool-generated promotional signatures or session links. Preserve human co-author credits and required third-party notices. Follow the vendor-neutral attribution policy in `CONTRIBUTING.md`; the existing commitlint gate checks known AI co-author identities without rewriting base history.

PR titles use Conventional Commits because GitHub uses them as merge subjects. The separate **PR title** workflow validates titles, including title edits, without rerunning the full CI suite. Preserve the conventional subject when merging via CLI/API; if setting it explicitly with `gh pr merge --subject`, use the validated PR title. Give branch-update merges explicit subjects such as `chore: merge master into <branch>`. Commitlint's default merge exceptions are not a naming convention. Do not rewrite published history solely to normalize messages.

## CLI

- Format all output with the `agentfmt` helpers re-exported from `packages/cli/src/format.ts`; do not hand-roll terminal formatting.
- Data/inspection commands should support `--json`.

## Tools (AI / MCP / CLI)

- Core operations are `ToolDef`s under `packages/core/src/tools/**`; `schema.ts` defines their contract and registries expose them. Each definition owns its native Valibot `input`, execution/mutation metadata, and optional per-interface exposure exclusions (`mcp`, `ai`, `webmcp`). Exposure defaults to inclusion; adapters use `isToolExposed()`, then apply execution support and user permissions independently. Infer arguments from the schema; derive effects and default capabilities from execution metadata instead of maintaining parameter DSLs or tool-name lists. Add work to the nearest existing domain and the appropriate registry.
- `ai-adapter.ts` converts ToolDefs for Vercel AI; `src/app/ai/tools/index.ts` binds them to the active editor's `FigmaAPI`.
- CLI commands own CLI UX independently; `eval` exposes operations through `FigmaAPI`.
- MCP-only filesystem/server tools live in `packages/mcp/src/tool/registration.ts`; listener/session lifecycle lives under `server/`, stdio under `stdio/`, and transport discovery under `transport/`. File access must resolve symlinks inside the effective MCP root; CLI defaults are cwd on macOS/Linux and home on Windows.
- Browser-native WebMCP registration lives under `src/app/automation/webmcp/`, consumes per-tool exposure metadata, and is feature-detected through `document.modelContext`. Core owns synchronous property/variable transactions in `editor/history/atomic-tool.ts`; Scene Graph owns checkpoint recovery, including hierarchy and indexes. AI, MCP, and WebMCP share this execution path; async and structural tools cannot declare atomic property execution. App completion under `src/app/automation/execution/` loads fonts after commit. Keep browser lifecycle out of Core and the MCP server package.
- Keep MCP transport tests under `tests/engine/mcp/{server,stdio,transport}` and shared fixtures under `tests/helpers/mcp`; isolate tests from user runtime discovery.
- Shared scene-authoring guidance and tested examples live under `packages/core/src/design-jsx/reference/`; `reference.ts` combines them with renderer metadata. Core codegen prompts under `packages/core/src/tools/prompts/` and the app chat/ACP prompt compose that public reference rather than copying it. Run `bun run generate:authoring-reference` after changes; committed skill/docs copies are checked by `check:authoring-reference` (also part of `check:docs`). Do not edit generated reference files directly.
- The installable agent skill is maintained in `skills/open-pencil/`. Changes to agent-facing APIs, CLI/MCP behavior, or design authoring must update affected skill examples, prompts, and public documentation in the same change. Keep examples valid in their actual execution environment; do not advertise library exports as scripting globals unless exposed there. Prefer runtime discovery and canonical references over duplicated API/tool inventories.

## ACP and collaboration

- Harness agents live in the optional `@open-pencil/harness` Node companion. Keep it backend-neutral, persist only opaque non-secret resume state, expose the bounded JSONL protocol, and never bundle a JavaScript runtime into Tauri. Pi's in-memory `just-bash` cannot recover across process restarts.
- ACP transport lives under `src/app/ai/acp/**`; provider definitions in `packages/core/src/constants.ts`; profiles in `src/app/ai/models/**`. Keep provider connections, reusable profiles, and role assignments separate, and resolve credentials lazily.
- ACP process changes require checking `desktop/capabilities/**`.
- Collaboration lives under `src/app/collab/**` and uses Trystero, Yjs, and awareness; preserve crypto-safe room IDs and peer cleanup.

## Code conventions

- Use Valibot for first-party runtime validation. MCP v2 registration uses Standard Schema with Valibot JSON Schema conversion; AI and WebMCP adapters share the Core tool input contract. Keep Zod only where upstream dependencies require it; do not maintain parallel first-party schemas in both libraries.

- Put code and tests in the established owning domain; inspect nearby structure before adding files.
- `bun run check:arch` enforces boundaries: use public workspace exports, keep Core framework-neutral, keep app services out of views/shared UI, and keep property-panel internals scoped to that panel.
- Follow the canonical [testing architecture](packages/docs/development/testing.md): package-local tests mirror source domains; central app tests mirror `src/app/**`; central integration requires a genuinely cross-owner contract. E2E follows user workflows; native and Figma acceptance remain explicit exceptions. Existing `tests/engine/**` domains migrate together with runner discovery—`tools/unit-tests/src/shards.ts` lists each owner's canonical home and its current `tests/engine` directories, so a move is a `git mv` plus imports; do not create competing homes or undiscovered suites. Owner-local helpers/fixtures stay local; only genuinely shared support is central. Specs use domain drivers/probes, not scattered Window/store traversal or unrestricted evaluator wrappers. Test contracts, not source text; never commit temporary/profile specs.

### File and folder naming

- App services/state/integrations live in `src/app/**`, views in `src/views/**`, and UI in `src/components/**`; `src/components/ui/**` is generic design-system code and must not import app stores/services.
- Component domains use lowercase/kebab-case folders; Vue files stay PascalCase and component composables camelCase. Do not add new PascalCase app folders or root-level base controls; migrate old ones when touched.
- Non-component folders/files use lowercase or kebab-case except standard entrypoints. Group multi-file domains in subfolders instead of repeated sibling prefixes (`selection/container.ts`, not `selection-container.ts`).

### Brand assets

Canonical brand artwork lives in `assets/brand/`: the main mark and an optical micro master. `tools/brand/` derives web/docs/native icons locally with RealFaviconGenerator and Tauri; generated assets are ignored, not committed. Vite/VitePress configs prepare their own targets, and Tauri dev/build hooks prepare native icons. Direct Cargo checks must run `bun run generate:icons --target desktop` first. Keep the app manifest in `vite/pwa.ts`, use `BrandMark` for in-app branding, and never symlink web assets to desktop icons. See `assets/brand/README.md` for commands and output ownership.

### Repo tools and scripts

Private tooling belongs under `tools/<domain>/{src,tests}`, with kebab-case domains and focused tests. `scripts/` may contain only tiny compatibility entrypoints; put real workflow, release, architecture, package, or visual tooling in `tools/`.

- Use `@/` for app cross-directory imports. Never escape an alias root with `../` (for example `#tests/../vite`); fix module ownership instead. Package aliases are `#vue/*`, `#cli/*`, `#dom-css/*`, `#mcp/*`, and `#core/*`; prefer clear relative imports nearby.
- No `any`, non-null assertions, or `Math.random()`; use precise types, guards, and `crypto.getRandomValues()`.
- Use the existing `dedent` package for multiline prompt composition and embedded examples instead of escaped newline strings. Keep substantial prompt prose in the owning Markdown source; compose it rather than duplicating it. Apply this convention across app, packages, and tools.
- Tooling must resolve the workspace with `resolveWorkspaceRoot` from `@open-pencil/package-artifacts`, not parent-directory traversal. Use domain aliases for cross-directory tooling imports, including tests; keep nearby sibling imports relative.
- Reuse named types and primitives from `@open-pencil/scene-graph`; do not respell `Color`, `Vector`, `SceneNode`, `Effect`, `Fill`, or `Stroke` shapes.
- Window API augmentations belong in the owning compilation boundary: app declarations in `src/global.d.ts`, package DOM gaps in the owning package's `global.d.ts`, and native-test declarations in `tests/helpers/tauri/native-global.d.ts`. Never put `declare global` in specs or implementation modules. Include canonical declarations through tsconfig instead of duplicating them.
- Keep app API contracts named and owned by their implementation domain; declaration files import those types. Derive vendor API types from top-level type imports rather than hand-copying signatures. Optional runtime globals remain optional and require a runtime guard.
- Native tests centralize invocation in a guarded test helper using vendor-derived types; do not import packages inside serialized WebView callbacks or repeat direct Tauri-global access in specs. Never expand production Window declarations just to accommodate test fixtures.
- Prefer test-runner-owned fixtures and request/route counters over browser globals. For in-page performance instrumentation, return a scoped `JSHandle` from `evaluateHandle()`; restore patched methods/listeners and dispose the handle in `finally`. Handles do not survive navigation. Assert transient DOM state with locators before the interaction ends when possible. Do not create a catch-all test Window interface or add ad-hoc counter properties to window.
- In Bun tests, prefer injected dependencies or scoped spies with explicit cleanup. `mock.restore()` restores spies but does not undo `mock.module()` overrides; do not assume module mocks are isolated by cleanup hooks. Read the installed runner's current lifecycle/mocking docs before introducing global or module-level instrumentation.
- Use `culori` for color conversion and existing dependencies before custom implementations.
- Prefer VueUse for common browser, event, focus, clipboard, storage, and timer behavior, but keep one-shot rAF or explicit service-owned timers when clearer.
- Components must not hold module-level mutable state. Share repeated logic/constants rather than copying it.
- Keep Kiwi runtime changes minimal; prefer wrappers for project policy.
- Guard browser globals explicitly in Core. Name repeated/cross-feature constants; app-wide values belong in `src/constants.ts`.
- The supported browser baseline lives in `src/app/shell/support/baseline.ts` and feeds the Vite `build.target`, the startup gate, and the documented system requirements; change all three together, including `desktop/tauri.conf.json` `minimumSystemVersion`. Vite lowers syntax but never polyfills APIs, so two data-driven checks enforce the baseline: the app and browser-shipped packages pin TypeScript `lib` to ES2023 (the last edition those engines implement fully), so newer built-ins fail type-checking, and `compat/compat` (`eslint-plugin-compat` under oxlint, fed the same browsers from `settings.browsers`) rejects Web APIs they lack. Do not raise the lib to `ESNext` in those tsconfigs; use `createDeferred()` from `src/app/runtime/deferred.ts` instead of `Promise.withResolvers()`. Node-only packages (`cli`, `mcp`, `harness`) are exempt from both. `tests/app/shell/support/baseline.test.ts` keeps the tsconfigs and oxlint browsers in step with the baseline. `src/main.ts` must stay a tiny gate that only dynamically imports `src/boot.ts`, so an unsupported engine can still render `src/app/shell/support/` guidance.

## Issue and PR writing

Use concise, concrete technical prose for issues, PR descriptions, and public comments. Lead with the problem and outcome; add a short example when needed to make the behavior clear. Avoid filler, promotional claims, decorative emojis, unnecessary tables, and file-by-file change inventories. Preserve the PR template's headings: Summary explains why and the outcome; What changed adds one to three non-repeated details; Validation reports actual commands/results and relevant omissions; AI assistance discloses known model names. Link lengthy logs or design notes rather than expanding the description into a work diary. Follow `CONTRIBUTING.md`; brevity must not omit reproduction steps, material risks, or validation limitations.

## Code review

- Review codebase fit, not just the diff. Before judging or implementing a change, inspect the owning folder, nearby analogous implementations, shared helpers/types, public exports, callers, and tests. Check new files against the established file tree, package boundaries, naming, and local conventions. Prefer an existing abstraction when it fits; do not invent a parallel pattern or demand unrelated cleanup.
- Verify findings against the current PR head and pinned dependency APIs. Give the concrete failing scenario and consequence; distinguish demonstrated bugs from defensive hardening and preferences. If runtime validation or dependency source is unavailable, state that limitation rather than treating an assumption as a fact.
- On re-review, check later commits and the discussion before repeating a finding. Mark addressed, obsolete, or intentionally declined suggestions accurately. Green checks and resolved threads are not substitutes for reviewing the current code.
- Request evidence appropriate to the change: engine tests for state contracts, Storybook for isolated component states, browser integration tests for workflows, canvas snapshots for rendering, and native tests for platform delivery. Do not claim one proves another.
- Preserve intentional behavior unless a concrete regression is demonstrated. For example, preferences and native credentials cannot transact together; documented partial-save outcomes and retryable drafts are not inherently bugs.
- Keep review comments concise and actionable. Cite the relevant location and repository rule or existing analogue for codebase-fit findings. Independently assess automated suggestions; do not bulk-apply or bulk-resolve them merely to make a bot green.

## Code quality

Before submitting a PR, run the complete gate and relevant tests:

```sh
bun run check
bun run format
bun run test:unit
bun run test
```

Self-review for duplication, named shared types, precise unions, and files approaching ~600 lines. Use `structuredClone` or typed copy helpers for nested mutable data. Check existing dependencies before implementing utilities; `es-toolkit` is available for focused helpers without replacing clear native code. Read current Reka UI, VueUse, and Tailwind/tailwind-variants docs before inventing UI primitives or composables, and update local wrappers deliberately when upstream APIs changed.

### Dependency documentation

Before using an unfamiliar dependency API or writing a replacement utility, inspect existing project wrappers and read the relevant official documentation. Start with the indexes below, then fetch specific pages rather than entire `llms-full.txt` dumps. Match documentation to versions in the package manifests and lockfiles; verify signatures against installed types/source when versions differ. Do not guess APIs or invent primitives already supplied by dependencies.

| Dependency                   | Official documentation entrypoint                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Vue                          | https://vuejs.org/llms.txt                                                                     |
| VueUse                       | https://vueuse.org/guide/ — follow individual composable documentation.                        |
| Reka UI                      | https://reka-ui.com/llms.txt                                                                   |
| Tauri v2                     | https://v2.tauri.app/llms.txt                                                                  |
| Tailwind CSS                 | https://tailwindcss.com/docs                                                                   |
| Tailwind Variants            | https://www.tailwind-variants.org/llms.txt                                                     |
| Motion (use the Vue section) | https://motion.dev/llms.txt                                                                    |
| Valibot                      | https://valibot.dev/llms.txt                                                                   |
| es-toolkit                   | https://es-toolkit.dev/llms.txt                                                                |
| CanvasKit                    | https://skia.org/docs/user/modules/canvaskit/ and installed `canvaskit-wasm/types/index.d.ts`. |

VueUse currently serves HTML homepage content at its `llms.txt` URL; Tailwind CSS and Skia have no verified index there. Use their official documentation above instead. If an index disappears or returns HTML, fall back to official API documentation, not guessed methods or unofficial generated indexes.

### Native WebView tests

Native desktop interaction checks live under `tests/e2e/native/**` and run through WebdriverIO against an explicit test-only Tauri binary. Use `bun run test:native` to build and run them, or `bun run build:native-test` when only the binary is needed. The embedded WebDriver plugin is compiled only with the `native-test` Cargo feature and must never be enabled in normal development or production binaries.

Native-test builds use a separate application identifier, an ephemeral WebView data store, and process-memory credentials. Never run UI smoke tests against production Keychain entries or clear user recovery data to unblock tests. Tests requiring persistence across application restarts need a dedicated test-owned persistent profile rather than the default ephemeral profile.

Keep responsibilities distinct: engine tests cover state contracts, Playwright browser E2E covers application integration, and native tests answer only whether the real platform WebView and Tauri shell deliver an interaction correctly. Platform-limited checks must skip rather than claim coverage. Synthetic composition tests do not prove real IME behavior, and native clipboard behavior remains a separate acceptance gap unless the test receives trusted OS clipboard events.

## Rendering

- Canvas is CanvasKit (Skia WASM) on a WebGL surface, not DOM
- Bounded rendering caches share `packages/core/src/cache/resource.ts` for recency, count/weight accounting, and removal disposal. Domain adapters own keys, font/page/dependency invalidation, and sizing units; use non-touching `peek()` for FIFO/planning reads. Rejected insertions leave ownership with the caller. Keep weak memos, async request registries, pools, and dependency-owned picture/path maps on their distinct lifetime policies.
- `renderVersion` vs `sceneVersion`: `renderVersion` = canvas repaint (pan/zoom/hover); `sceneVersion` = scene graph mutations. UI that only cares about graph data should avoid watching repaint-only state; use editor events for incremental surfaces such as the layer tree.
- Live property controls use selected-node projections from `editor/selection-state/nodes.ts`: shallow reactive copies receive `node:previewUpdated` patches at property granularity. Never add preview invalidation to all `useSceneComputed` consumers; catalogs and unrelated controls must not refresh for geometry previews. Projection subscriptions belong to the consuming scope/session and must be disposed.
- Numeric geometry edits own a `beginNodePreview()` handle with `update`, `commit`, and `cancel`. It captures all affected fields/layout children, publishes the complete delta once, and restores exact originals on cancellation. Selection/page/graph changes and disposal cancel the old edit; trailing input must not target the new selection. Controls must close previews even when a gesture returns to its starting value.
- Renderer interaction policy uses explicit `beginInteractiveEdit()` leases and `isInteractiveEditing()`, not undo batching. Release leases on every terminal path. Keep live queries callable across app facades that spread editor actions.
- Drawing and input share preview-aware geometry through `@open-pencil/core/geometry`, built on Scene Graph matrices. Use it for world/screen transforms, inverses, bounds, and handle placement instead of independently interpreting ancestor rotations or reflections. LINE pivots remain at the origin; other nodes rotate around their centers.
- Label drawing and hit testing share `canvas/labels/{layout,transform,style}.ts`, including paragraph measurements and unreflected label axes. Rotation previews change through `setRotationPreview()` and `rotation:preview-changed`; cancellation must close the owning gesture without deselecting or committing it.
- Paragraph construction is typed against `canvas/text/paragraph-inputs.ts`; the same inputs drive preparation-cache invalidation. Add a mutation case when extending that contract. Drawing borrows native paragraphs; the renderer owns their bounded cache and destruction.
- `requestRender()` bumps `renderVersion` and `sceneVersion`; `requestRepaint()` bumps only `renderVersion`
- `renderNow()` is only for surface recreation and font loading (need immediate draw)
- Resize observer uses rAF throttle, not debounce — debounce causes canvas skew
- Overscan images accelerate navigation; settled scenes rasterize existing retained pictures at the live viewport size/origin. Pixel-grid alignment alone does not guarantee Skia AA parity. Keep settlement pending until the viewport pass completes; do not add a second viewport image cache.
- Viewport culling skips off-screen nodes; unclipped parents are NOT culled (children may extend beyond bounds)
- Selection border width must be constant regardless of zoom — divide by scale
- Section/frame title text never scales — render at fixed font size, ellipsize to fit
- Rulers are rendered on the canvas (not DOM), with selection range badges that don't overlap tick numbers
- Remote cursors: Figma-style colored arrows with white border + name pill, rendered in screen space
- Pixel-affecting renderer features need committed visual coverage, not just mock/geometry assertions. Add or update a Playwright canvas snapshot for changes to fills, gradients, images, blend modes, masks, boolean geometry, corners, strokes, shadows, blur, text rendering, or demo showcase scenes. Use targeted snapshot updates such as `bun run test tests/e2e/canvas/fill-modes-visual.spec.ts --update-snapshots` and then rerun the same test without `--update-snapshots`.

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
- Colocate `ComponentName.stories.ts` with `ComponentName.vue`. Multipart composition stories may use a descriptive family name. Preserve explicit Storybook titles and exported story names during file moves; keep default playgrounds static and give interaction flows named stories. Prefer inline story fixtures for small app-local states. Use colocated `examples/<Variant>.vue` SFCs for substantial templates or fixtures that need SFC template/slot typing, including app-only fixtures; shared SDK examples use the same convention (see below). Story templates compile at runtime, so they must be plain JavaScript — no type assertions or other TypeScript syntax — and `icon-lucide-*` tags do not resolve there; import icons from `~icons/...` and register them.
- `src/components/ui/**` is store-free app design-system code; feature controls stay in their domain.
- SDK property primitives remain controlled/editor-agnostic. Compose property rows from `PanelGrid`, `PanelFieldGroup`, `PanelItemRow`, and `PropertyItemRow`; use `BindableValue`, `FillRoot`, and `FillSwatch` rather than rebuilding binding/picker infrastructure.
- Do not add automated tests or snapshot baselines for simple CSS-only UI changes, including spacing, sizing, colors, and responsive breakpoints. Verify these visually instead. Keep automated coverage focused on behavior and contracts; the separate canvas-renderer visual coverage requirement still applies.
- Prefer accessible role/name, label, then text in tests. Use scoped `data-slot` anatomy or semantic attributes (`data-property`, `data-command`, `data-node-id`) when needed; reserve `data-test-id` for integration boundaries and never add test-hook props.
- Use Reka UI primitives and typed Tailwind Variants themes under `src/theme/**`; merge per-instance `ui` slot overrides, expose `class` for single-root components, and do not add one-off class props. Use `UI` casing in type names.
- Bind visual state through semantic `data-*` attributes; Steiger rejects template-time `use*UI()`, visual-state utility branches, and raw SVG app icons.
- Storybook is the internal state workshop; VitePress is canonical public SDK documentation. Derive API tables from source/JSDoc and keep examples valid against public exports. An example shared by Storybook and a docs page lives in `packages/vue/src/primitives/<Primitive>/examples/<Variant>.vue` (PascalCase variant name, e.g. `States.vue`); the story renders it and the docs page imports it with `#vue/primitives/...`. Do not render Storybook stories inside VitePress pages: `@storybook/vue3` assigns `window.STORYBOOK_ENV` on import so it cannot be server-rendered, the docs bundle ships runtime-only Vue so runtime templates silently fail, and a client-only embed drops examples from the prerendered HTML while adding the Storybook preview runtime and `storybook/test` to the published docs.
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

### Feedback and form submission

- Use `AppAlert` (`src/components/ui/feedback/AppAlert.vue`) for persistent contextual errors, warnings, recovery guidance, and informative results. Its typed theme lives in `src/theme/feedback/alert.ts`; use translated `heading`/`description` and the `actions` slot for recovery controls. Do not hand-roll feature-level alert markup or colored error paragraphs.
- Use the existing toast service for transient confirmations such as copying or completing an action after its view closes. Do not show both a toast and an alert for the same event. Partial saves and actionable failures must not disappear in a toast.
- Field validation stays inline in the shared field component, with `aria-invalid`, associated error text before hints, and first-invalid-field focus. VeeValidate owns validation and form submission state; domain workflows retain their own pending/lifecycle guards for external operations. A credential-store failure does not make the entered key invalid.
- Settings save feedback uses `SettingsSaveFeedback`, which maps domain outcomes to `AppAlert`. Keep persistence outcomes (`saved`, `failed`, `partial`) in the domain: a form library cannot make preferences and a native credential store transactional. Preserve retryable drafts, reuse already-persisted identities on retries, and show the partial-save warning. Never render raw credential backend errors or secrets.
- Use `SettingsLink` for external Settings links, including provider key pages and setup guides. It owns link styling, the external-link icon, and native opening behavior. Keep arrow glyphs out of translated labels.
- Ordinary labels such as Running/Stopped remain status text or badges, not alerts. Destructive confirmation belongs in the shared confirmation dialog. Alerts announce changes without taking keyboard focus.
- Isolated feedback-component visual states belong in colocated Storybook stories, not Playwright application screenshots. Settings E2E tests cover integration behavior: when feedback appears, validation/focus, retained drafts, and successful retries.

### Animations

Motion policy lives in `src/app/shell/motion/`: resolve persisted System/Off preference and OS reduction once. The root `data-motion` attribute and the app's Tailwind `motion-safe`/`motion-reduce` variants represent this effective policy, including portalled content. Store-free presets/treatments live in `src/theme/motion/`; compose them into owning themes. Use the policy-aware Motion adapters for shared or feature-specific transitions rather than repeating preference conditionals in components. Keep what moves, geometry, and genuinely feature-specific spring values local.

- Use Tailwind transitions and `tw-animate-css` for simple visual state changes and enter/exit animations. Use the existing `motion-v` dependency for gesture-driven motion, coordinated layout changes, and springs; do not add another animation library.
- Use Reka state attributes and measured CSS variables for collapsibles. The utilities are `animate-collapsible-down` and `animate-collapsible-up`; keep padding and borders inside the animated height wrapper so they do not snap during collapse.
- Respect `prefers-reduced-motion` in both CSS and Motion. Disable or simplify nonessential motion while preserving state changes and interaction feedback.
- Keep reusable animation styling in the owning theme and share repeated duration/easing values rather than scattering timing constants across components.
- Verify opening and closing, interrupted transitions, reduced motion, and scroll behavior. Expanding historical chat content must not force the transcript to the bottom.

## File format

- Figma clipboard envelope encoding, decoding, bounds, and SceneGraph import conversion belong to `@open-pencil/fig/clipboard`. Core prepares runtime fonts/text and owns editor placement/history; browser/Tauri adapters own system clipboard I/O. Do not add platform clipboard APIs to Fig.
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
