# OpenPencil

Vue 3 + CanvasKit (Skia WASM) + Yoga WASM design editor. Tauri v2 desktop, also runs in browser. Bun workspace monorepo.

This file holds the repository map and the rules that apply everywhere. Rules for one folder live in that folder's `AGENTS.md`. **Before changing files under a mapped path, read this file and that path's guide.** Paths in every guide are repository-relative. Process for humans (setup, PRs, commits) is in `CONTRIBUTING.md`; product direction and Figma gaps are in `packages/docs/development/roadmap.md`.

## Map

| Path                   | Owns                                                                                                                                                                                              | Guide                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `packages/scene-graph` | Framework-neutral graph, node types, geometry, copy/snap/undo, variables, instances, hit testing, plus the shared primitives formats need: color conversion and management, CSS value parsing, text/layout direction | `packages/scene-graph/AGENTS.md`  |
| `packages/pen`         | Pencil.dev `.pen` model, parser, SceneGraph adapter                                                                                                                                               | —                                 |
| `packages/kiwi`        | SceneGraph-independent Kiwi schema/runtime, codecs, containers, parse helpers                                                                                                                     | `packages/fig/AGENTS.md`          |
| `packages/fig`         | `.fig` archives, SceneGraph conversion, metadata policy, component/instance interpretation, Figma clipboard                                                                                       | `packages/fig/AGENTS.md`          |
| `packages/core`        | Renderer, layout, editor, Figma API, tools, clipboard, vector conversion, document I/O; depends on scene-graph and the format packages (pen, kiwi, fig, dom-css, design-jsx); no browser DOM      | `packages/core/AGENTS.md`         |
| `packages/dom-css`     | DOM/CSS/HTML/JSX/Tailwind projection and browser/headless adapters; depends only on scene-graph and emit, and takes engine services such as web-font resolution as injected options               | `packages/dom-css/AGENTS.md`      |
| `packages/emit`        | Source emission for exporters: ESTree and JSX builders, template filling, and esrap printing, with the literal rules that keep exported strings from being reinterpreted                          | —                                 |
| `packages/design-jsx`  | OpenPencil design JSX: elements, paint/effect helpers, variables, schema and authoring reference, JSX export, and a renderer that takes icons, SVG, and layout as injected services               | `packages/design-jsx/AGENTS.md`   |
| `packages/vue`         | Headless Vue 3 SDK primitives, composables, commands, i18n, menu model                                                                                                                            | `packages/vue/AGENTS.md`          |
| `packages/cli`         | Headless `.fig` inspection, export, linting, `eval`                                                                                                                                               | `packages/cli/AGENTS.md`          |
| `packages/mcp`         | stdio and Hono HTTP MCP server reusing Core tools                                                                                                                                                 | `packages/mcp/AGENTS.md`          |
| `packages/harness`     | Optional Node companion for HarnessAgent sessions                                                                                                                                                 | `packages/harness/AGENTS.md`      |
| `packages/docs`        | Published VitePress site                                                                                                                                                                          | `packages/docs/AGENTS.md`         |
| `src`                  | Tauri/Vite app: services and state in `src/app/**`, views in `src/views/**`, UI in `src/components/**`                                                                                            | `src/AGENTS.md`                   |
| `desktop`              | Tauri v2 shell, capabilities, native credentials, menus                                                                                                                                           | `desktop/AGENTS.md`               |
| `tests`                | Central app, integration, E2E, native, and Figma acceptance tests                                                                                                                                 | `tests/AGENTS.md`                 |
| `tools`, `.github`     | Private repo tooling, CI classification, releases, brand generation                                                                                                                               | `tools/AGENTS.md`                 |
| `skills/open-pencil`   | Installable agent skill                                                                                                                                                                           | `packages/core/AGENTS.md` (Tools) |
| `assets/brand`         | Canonical brand artwork                                                                                                                                                                           | `assets/brand/README.md`          |

## Commands

- `bun run dev:portless` — preferred browser server at `https://open-pencil.localhost`; worktrees get `https://<branch>.open-pencil.localhost` and a sibling `mcp.open-pencil` URL with isolated runtime discovery.
- `bun run dev` — fixed `http://localhost:1420`; use only for Playwright, Tauri, and Dev Containers.
- `bun run tauri dev` — desktop app with hot reload.
- A fresh worktree needs `bun install` and `bun run build:packages` before docs, Storybook, or any workflow that resolves workspace subpath exports; without the package builds those resolve to missing `packages/*/dist` targets.
- `bun run check` — complete build, lint, type, architecture, docs, package, dependency, security, tooling, and duplication gate.
- `bun run format` — format and sort imports.
- `bun run test:unit` / `bun run test` / `bun run test:storybook` — engine/unit, app Playwright, and Storybook Playwright suites. See `tests/AGENTS.md` for server selection and worktree ports.
- `bun open-pencil --help` — current CLI command list.

Before a PR run `bun run check`, `bun run format`, `bun run test:unit`, and `bun run test`.

## Package boundaries

- Across package/app boundaries import the owning package's public exports, never workspace internals or forwarding-only shims. `@open-pencil/scene-graph` owns graph types and primitives; `@open-pencil/kiwi` owns low-level Kiwi/FIG helpers; `@open-pencil/core` provides the compatibility barrel plus the subpaths listed in `packages/core/package.json`.
- `bun run check:arch` enforces: public workspace exports, framework-neutral Core, no app services in views or shared UI, property-panel internals scoped to that panel.
- Package aliases are `#core/*`, `#fig/*`, `#vue/*`, `#cli/*`, `#mcp/*`, `#dom-css/*`, `#design-jsx/*`, `#emit/*`; a package's own tests use `#core-tests/*` and `#fig-tests/*`; the app uses `@/`. Prefer clear relative imports nearby. Never escape an alias root with `../` (for example `#tests/../vite`); fix module ownership instead.
- Never drill with `../../`: one `../` to a sibling folder is fine, two or more means an alias. This holds in tests as much as in source — a test reaches its package's source through `#<pkg>/*` and its own helpers through `#<pkg>-tests/*`. `open-pencil/no-deep-parent-relative-imports` enforces it; a new test directory must be added to `lint:structure` so the rule reaches it.
- Reuse named types from `@open-pencil/scene-graph`; do not respell `Color`, `Vector`, `SceneNode`, `Effect`, `Fill`, or `Stroke`.

## Code conventions

- Put code and tests in the established owning domain; inspect nearby structure before adding files. Group multi-file domains in subfolders instead of repeated sibling prefixes (`selection/container.ts`, not `selection-container.ts`).
- Non-component folders and files use lowercase or kebab-case except standard entrypoints (`README.md`, `AGENTS.md`, `index.ts`). Component domains use kebab-case folders; Vue files stay PascalCase and component composables camelCase. Do not add new PascalCase app folders or root-level base controls; migrate old ones when touched.
- No `any`, non-null assertions, or `Math.random()`; use precise types, guards, and `crypto.getRandomValues()` — through `randomHex`, `randomInt`, and `randomIndex` from `@open-pencil/scene-graph/random` rather than new copies. New component property IDs come from `createComponentPropertyId()`, and graph entity IDs from the `SceneGraph`'s generator (`createNode`, `createCollection`, `createMode`).
- Valibot for first-party runtime validation. Keep Zod only where an upstream dependency requires it; never maintain parallel first-party schemas in both.
- Use existing dependencies before writing utilities: `culori` for color conversion, VueUse for browser, event, focus, clipboard, storage, and timer behavior (one-shot rAF or service-owned timers are fine when clearer), `dedent` for multiline prompt composition and embedded examples. Keep substantial prompt prose in the owning Markdown source and compose it.
- Reach for `es-toolkit` before hand-writing a collection or object helper: `uniq`/`uniqBy` over `Set` round trips, `compact` over `filter(Boolean)`, `groupBy`/`keyBy`/`partition`/`countBy` over accumulator loops, `pick`/`omit`/`mapValues`/`mapKeys` over rewriting `Object.entries`, `isEmptyObject`/`isEqual` over manual checks. Keep native code where it is a single clear call (`map`, `some`, `Object.fromEntries` of a direct mapping) or on a measured hot path such as per-frame rendering and layout. `open-pencil/prefer-es-toolkit` enforces the `uniq` and `compact` cases.
- Use `js-base64` directly for Base64: `fromUint8Array`/`toUint8Array` for bytes, `encode`/`decode` for text, and `isValid` before decoding input from outside (clipboard, imported files, tool arguments). Do not wrap it or use `atob`, `btoa`, or `Buffer` Base64 conversions; `open-pencil/no-hand-rolled-base64` enforces this.
- Parse JSON from outside the process (clipboard, files, network, storage, tool arguments) with `v.safeParse(v.pipe(v.string(), v.parseJson(), Schema), text)`, so malformed JSON and a wrong shape fail the same way. Never assert a type on a `JSON.parse` or `.json()` result other than `unknown`; `open-pencil/no-unvalidated-json-parse` enforces this in source, tests, and tooling.
- Browser-shipped code targets the supported browser baseline in `src/app/shell/support/baseline.ts`: TypeScript `lib` stays ES2023 and `compat/compat` rejects missing Web APIs; Node-only packages (`cli`, `mcp`, `harness`) are exempt. Details in `src/AGENTS.md` (Browser baseline).
- Components must not hold module-level mutable state. Name repeated or cross-feature constants; app-wide values belong in `src/constants.ts`.
- Window API augmentations belong to the owning compilation boundary: `src/global.d.ts` for the app, the package's `global.d.ts` for package DOM gaps, `tests/helpers/tauri/native-global.d.ts` for native tests. Never put `declare global` in specs or implementation modules; include canonical declarations through tsconfig. Keep app API contracts named and owned by their implementation domain; derive vendor API types from top-level type imports. Optional runtime globals stay optional and need a runtime guard.
- Use `structuredClone` or typed copy helpers for nested mutable data. Self-review for duplication, named shared types, precise unions, and files approaching ~600 lines.
- Detect desktop with `IS_TAURI`, never ad-hoc `__TAURI_INTERNALS__` checks.

### Dependency documentation

Before using an unfamiliar dependency API or writing a replacement, inspect existing project wrappers and read the official documentation. Start with these indexes, then fetch specific pages rather than entire `llms-full.txt` dumps. Match versions in the manifests and lockfile; verify signatures against installed types when versions differ. Do not guess APIs or invent primitives already supplied by dependencies. Read current Reka UI, VueUse, and Tailwind/tailwind-variants docs before inventing UI primitives or composables, and update local wrappers deliberately when upstream APIs changed.

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

VueUse serves HTML at its `llms.txt` URL; Tailwind CSS and Skia have no verified index. If an index disappears or returns HTML, fall back to official API documentation, not guessed methods or unofficial generated indexes.

## Tests

Follow `packages/docs/development/testing.md` and `tests/AGENTS.md`. Package-local tests mirror source domains; central app tests mirror `src/app/**`; central integration requires a genuinely cross-owner contract. Test contracts, not source text; never commit temporary or profile specs. Pixel-affecting renderer changes need committed canvas snapshots; simple CSS-only UI changes need visual verification, not new automated tests.

## Documentation and changelog

- `CHANGELOG.md` — curated user-facing changes by version; `Unreleased` stays first. `README.md` — concise features, setup, CLI, and overview. `AGENTS.md` files — contributor/agent rules. `packages/docs/` — public site (`packages/docs/AGENTS.md`). Keep internal plans in ignored `scratch/`.
- For user-facing work add one present-tense outcome under the single appropriate `Unreleased` category: `Breaking changes`, `Added`, `Changed`, `Fixed`, `Performance`, or `Security`. Treat it as release notes: omit tests, benchmarks, CI, internal refactors/tooling, and bugs both introduced and fixed since the last release. End sentences with periods and retain issue/PR references. Update `README.md` when appropriate and the owning `AGENTS.md` when architecture or conventions change.
- `CHANGELOG.md` merges with git's `union` driver (`.gitattributes`), so two branches adding entries combine instead of conflicting; the driver concatenates blindly, which is why the pass below is load-bearing rather than tidy-up.
- After merges, compare the whole section with changes since the latest release, preserve important outcomes, consolidate related work, and remove duplicate bullets and headings.
- Before finalizing `Unreleased`: compare released behavior at the latest tag with the final implementation, not commit subjects; verify questionable fixes existed at that tag and fold fixes to newly added features into the feature bullet; check public exports, model/config/data contracts, and peer requirements for `Breaking changes`; remove superseded intermediate behavior; state platform requirements and concrete supported behavior instead of unqualified claims; run `bun run check:changelog`. Keep historical sections unchanged.

## Commits, PRs, and issues

`CONTRIBUTING.md` is canonical for commit messages, PR titles and bodies, and attribution. Digest:

- Conventional Commits (`feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `build`, `ci`, `chore`); short imperative subjects, rationale in the body; release commits are exactly `Release vX.Y.Z`. Preserve product casing: DOM/CSS, HTML, JSX, Tailwind, Kiwi, `.fig`, MCP, CLI, AI, ACP, i18n. Validate with `bun run check:commits --last` or `--from`/`--to`.
- PR titles are Conventional Commits because GitHub uses them as merge subjects; branch-update merges get explicit subjects such as `chore: merge master into <branch>`. Do not rewrite published history solely to normalize messages.
- Disclose AI assistance in the PR's AI assistance section, never as commit authorship, `Co-authored-by` trailers, promotional signatures, or session links. Preserve human co-author credits and third-party notices.
- Stacked pull requests: `gh stack`, rebase never merge, land from the top layer via the merge queue (`CONTRIBUTING.md#stacked-pull-requests`).
- Issues, PR descriptions, and public comments use concise concrete technical prose: lead with the problem and outcome, add a short example when needed, avoid filler, promotional claims, decorative emojis, unnecessary tables, and file-by-file inventories. Link long logs or design notes.

## Code review

- Review codebase fit, not just the diff. Inspect the owning folder, nearby analogous implementations, shared helpers and types, public exports, callers, and tests. Prefer an existing abstraction when it fits; do not invent a parallel pattern or demand unrelated cleanup.
- Verify findings against the current PR head and pinned dependency APIs. Give the concrete failing scenario and consequence; distinguish demonstrated bugs from hardening and preferences. State when runtime validation or dependency source was unavailable.
- On re-review, check later commits and the discussion before repeating a finding. Green checks and resolved threads are not substitutes for reviewing the current code.
- Request evidence appropriate to the change: engine tests for state contracts, Storybook for isolated component states, browser integration tests for workflows, canvas snapshots for rendering, native tests for platform delivery. One does not prove another.
- Preserve intentional behavior unless a concrete regression is demonstrated; for example, preferences and native credentials cannot transact together, so documented partial-save outcomes and retryable drafts are not bugs.
- Keep comments concise and actionable; cite the location and the repository rule or existing analogue. Independently assess automated suggestions; never bulk-apply or bulk-resolve them to make a bot green.

## Maintaining these guides

- One rule per bullet, at most three sentences, ending with its anchor: the enforcing check, the analogous file, or the test. A rule that can become a lint, `check:arch` boundary, or type-level test should become one, and the prose is then removed.
- A rule lives in exactly one guide: here if it applies across the repository, otherwise in the nearest `AGENTS.md` of the owning folder. Explanations belong in `packages/docs/development/`, not in guides.
- Every nested `AGENTS.md` is listed in the Map above; `bun run check:docs` fails on an unlisted or missing guide. Nested guides are classified as documentation by CI.
- When a section here passes about ten lines, move it to a domain guide and leave the map row.

## Reference

[`figma-use`](https://github.com/dannote/figma-use) is a historical code reference and a live-Figma oracle (`packages/core/AGENTS.md`, Figma API); verify current paths, types, and behavior before adapting anything from it.
