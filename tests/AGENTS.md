# Tests

`packages/docs/development/testing.md` is the canonical testing architecture: ownership table, fixture/driver/probe roles, browser and native boundaries, execution commands, server ownership, and worktree ports. This file holds the rules that bite during implementation.

## Placement

- Package-local tests mirror source domains under `packages/<owner>/tests/`; central app tests mirror `src/app/**` under `tests/app/`; `tests/integration/` requires a genuinely cross-owner contract; E2E under `tests/e2e/` follows user workflows; native and Figma acceptance are explicit exceptions.
- Existing `tests/engine/**` domains migrate together with runner discovery: `tools/dev/unit-tests/src/shards.ts` lists each owner's canonical home and its current `tests/engine` directories, so a move is a `git mv` plus imports. `bun run check:test-homes` rejects any test added under `tests/engine` and any stale entry in `tools/checks/test-homes/engine-baseline.txt`; new tests go to the canonical home, and a moved file is removed from the baseline (`--write` regenerates it). Scene Graph has migrated to `packages/scene-graph/tests` and the editor domain to `packages/core/tests/editor`; put new Core tests there, mirroring `packages/core/src`.
- Address a package's source by `#<pkg>/*` and its own helpers by `#<pkg>-tests/*` (`#core-tests/*`, `#fig-tests/*`); never drill with `../../`. Registering a new alias means `imports` in the package manifest and `PACKAGE_ALIASES`/`PACKAGE_ALIAS_OWNERS` in `tools/checks/architecture/src/steiger-rules/support.ts`.
- Reach repository files, such as `tests/fixtures`, through `repoPath`/`testPath` in `tests/helpers/paths.ts`, or a package helper's `workspaceRoot()`, which finds the root by its lockfile; never climb from `import.meta` (`open-pencil/no-deep-parent-relative-paths`).
- Owner-local helpers and fixtures stay local; only genuinely shared support goes under central `tests/helpers/<domain>/` and `tests/fixtures/`. MCP transport tests: `tests/engine/mcp/{server,stdio,transport}` with `tests/helpers/mcp`.
- Never commit temporary, diagnostic, or profile specs; keep them in ignored `scratch/`.

## Writing specs

- Test contracts and observable behavior, not source text. Specs use domain drivers and probes, not scattered Window/store traversal or unrestricted evaluator wrappers.
- Assert state and outcomes, never copy, prompts, or constants: a test must not fail on rewording, a catalog update, or a list it restates. Name controls by role to reach them, assert what they do, and never recompute an expected value with the rule under test (`tests/app/ai/models/settings/onboarding/plan.test.ts`).
- Locate behavior by accessible role and name, then label, then visible text. Scope repeated controls to a named region. Use scoped `data-slot` anatomy or semantic attributes (`data-property`, `data-command`, `data-node-id`) when needed; reserve `data-test-id` for integration boundaries and never add test-hook props or compound IDs.
- Prefer test-runner-owned fixtures and request/route counters over browser globals. For in-page performance instrumentation, return a scoped `JSHandle` from `evaluateHandle()`, restore patched methods and listeners, and dispose the handle in `finally`; handles do not survive navigation. Assert transient DOM state with locators before the interaction ends.
- Do not create a catch-all test Window interface or ad-hoc counter properties on `window`. Native-test declarations live in `tests/helpers/tauri/native-global.d.ts`; never expand production Window declarations for fixtures.
- Tests are typechecked: `bun run check:test-types` covers `tests/**` and `packages/*/tests/**` through `tsconfig.tests.json`, and reports test files only because sources are judged by `bun run typecheck` against the globals they ship with.
- Build a fixture with the owning factory (`createDefaultNode`, `colorToFill`) rather than a partial literal asserted to the type; a partial that drops a required field is exactly what the typecheck exists to catch.
- A stand-in for an interface a test cannot build (CanvasKit, `EditorStore`) goes through `asDouble` from `#tests/helpers/doubles`, which is the one sanctioned widening; `open-pencil/no-broad-double-cast` rejects the `as unknown as` spelling.
- In Bun tests prefer injected dependencies or scoped spies with explicit cleanup. `mock.restore()` restores spies but does not undo `mock.module()` overrides; do not assume module mocks are isolated by cleanup hooks. Read the installed runner's lifecycle and mocking docs before adding global or module-level instrumentation.
- Make flaky tests deterministic; raising a timeout is never the fix. Keep package-manager invocations out of `bun test` suites; their cold start is not bounded.

## Browser runs

- Use the canonical `playwright.config.ts`; do not create task-specific config copies or server runners. Playwright owns Vite; the Vite automation plugin owns MCP startup and cleanup; browser fixtures own interactions, not server processes.
- Test scripts select their server; direct Playwright commands start both servers unless `OPENPENCIL_TEST_SERVER=app|storybook|all` is set. Managed runs start the intended checkout; server reuse is opt-in for local development only, never for baseline comparisons or CI. Isolate the app URL, MCP endpoint, CORS origin, socket, and discovery path together.
- App projects start with the first-run AI setup offer already dismissed through the shared `storageState` in `playwright.config.ts`. A spec that overrides `storageState` and loads without `?test` must keep that preference unless it tests the offer (`tests/e2e/settings/ai-setup-first-run.spec.ts`).
- Pixel-affecting renderer changes need committed canvas snapshots (`packages/core/AGENTS.md`, Renderer). Update only the justified affected snapshot and rerun without update mode.

## Native WebView

- Native checks live under `tests/e2e/native/**` and run through WebdriverIO against an explicit test-only Tauri binary: `bun run test:native` builds and runs, `bun run build:native-test` only builds. The binary uses a separate application identifier, an ephemeral WebView data store, and process-memory credentials.
- Never run UI smoke tests against production Keychain entries or clear user recovery data to unblock tests. Persistence across restarts needs a dedicated test-owned persistent profile.
- Native tests answer only whether the real WebView and Tauri shell deliver an interaction; engine tests cover state contracts and Playwright covers app integration. Platform-limited checks skip rather than claim coverage. Synthetic composition does not prove IME behavior; native clipboard remains a separate acceptance gap without trusted OS clipboard events.
- Centralize native invocation in a guarded helper using vendor-derived types; do not import packages inside serialized WebView callbacks or repeat direct Tauri-global access in specs.
