# Testing

## Ownership and location

Place a test with the source that owns its contract. Choose the runtime separately: using a browser does not automatically make a test application E2E, and importing several packages does not automatically make it cross-package integration.

| Contract                                | Canonical location                                             |
| --------------------------------------- | -------------------------------------------------------------- |
| Package unit and in-process integration | `packages/<owner>/tests/<source-relative-domain>/**/*.test.ts` |
| App services and state                  | `tests/app/<path-relative-to-src/app>/**/*.test.ts`            |
| Cross-package/system integration        | `tests/integration/<contract>/`                                |
| Application workflows and visuals       | `tests/e2e/<workflow>/**/*.spec.ts`                            |
| Native WebView and shell delivery       | `tests/e2e/native/**/*.spec.ts`                                |
| Figma compatibility acceptance          | `tests/figma/**/*.spec.ts`                                     |
| Private tool contracts                  | `tools/<owner>/tests/`                                         |

For example, `packages/core/src/canvas/text/prepared.ts` maps to `packages/core/tests/canvas/text/prepared.test.ts`; `src/app/demo/viewport.ts` maps to `tests/app/demo/viewport.test.ts`. A substantial module may have a matching test directory rather than one large test file. Application E2E, external-system acceptance and large contract suites are intentional exceptions to file-for-file mirroring.

Core tests using SceneGraph still belong to Core. Central integration is for contracts without a single owning implementation, such as interoperability between published packages. Name that contract explicitly; do not use integration as a miscellaneous bucket.

**Migration status:** much existing coverage remains under `tests/engine/**`, alongside package-local suites. The table is the agreed destination, not a claim that migration is complete. Until a domain migrates, extend its existing suite rather than create a second home. The repository-wide migration is separate from feature work.

Discovery already covers the destinations: `tools/unit-tests/src/shards.ts` groups tests by owner and lists each owner's canonical home (`packages/<owner>/tests`, `tests/app`, `tests/integration`) together with the `tests/engine` directories it still owns, so `bun run test:unit` and the CI shards run a file from either place. Moving a domain is therefore a `git mv` plus import fixes; only a new owner or a new top-level home needs a shard entry. Do not move files into a directory the shard map does not list.

`test:unit:quick` runs files in Bun worker processes (`--parallel`), which is the fastest local loop. CI shards still run each group in one process; `test:unit:isolated` (`--isolate`, also run nightly) gives every file a fresh global object and is the check to run when a suite passes alone but fails in a shard. Shards share one Bun process, so module-level state (a `fake-indexeddb/auto` import, an IndexedDB connection left open by `createEditorStore()`, a patched global) leaks into later files in the same shard. A package-local run (`bun test tests` inside the package) is a fresh process and will not reproduce that leak. Close what a test opens and restore what it patches.

Run `bun --filter @open-pencil/core build` before unit tests. Files under `tests/` resolve `@open-pencil/core` and its subpaths to `packages/core/src` through the root tsconfig, but package sources (`packages/dom-css/src`, `packages/mcp/src`, …) use their own tsconfig, where `@open-pencil/core/<subpath>` falls back to the package `exports` and therefore to `dist`. One process can hold both copies; only `packages/vue` maps Core to `src`. Aligning the other package tsconfigs is a packaging change (it affects `tsdown` declaration output), not a test change.

## Test purpose

- Unit tests cover isolated rules and state transitions.
- Package integration tests exercise real collaborators owned by that package.
- Browser integration tests cover browser CSS, WebGL, fonts and DOM behavior where that runtime matters. They need not launch the whole app if the contract can be exercised independently.
- E2E tests exercise application workflows, accessibility and representative visual integration.
- Native tests answer whether the real WebView or shell delivers an interaction. A CPU CanvasKit test is not native desktop acceptance; synthetic composition is not real IME acceptance.
- Benchmarks belong to performance tooling and opt-in runs, not ordinary correctness E2E. Bounded assertions about redundant work may accompany a real interaction, but exhaustive cache policy belongs with the owning implementation.

Test observable behavior and contracts, not source text. A test claiming a UI update must observe the UI, not merely read a Set after calling an editor action.

## Fixtures, builders, drivers and probes

These responsibilities are distinct:

| Kind           | Responsibility                                                               |
| -------------- | ---------------------------------------------------------------------------- |
| Runner fixture | Acquire a context/editor/resource and guarantee teardown.                    |
| Data builder   | Construct deterministic plain inputs; no browser, assertions or hidden I/O.  |
| UI driver      | Perform named user interactions through roles, labels and semantic controls. |
| Probe          | Read a bounded typed observation, or install scoped instrumentation.         |
| Asset fixture  | Immutable document, font, image or reference data.                           |
| Snapshot       | Expected visual output colocated with its spec.                              |

Owner-specific builders and support belong under that owner's `tests/helpers/<domain>/`; owner-specific assets belong under `tests/fixtures/` within the owning package. Central `tests/helpers/<domain>/` and `tests/fixtures/<format-or-domain>/` are reserved for genuine shared consumers, runner adapters and large shared corpora. Keep existing LFS assets in place until all consumers are mapped; binary moves are not a prerequisite for clarity. Record font licenses and fixture provenance beside the assets.

Do not import another package's test internals or import test support from production. Share production contracts through public exports. Promote test support only when multiple owners actually need it. Avoid catch-all `utils`, `store` and `test-utils` collections with mixed runtime dependencies. Keep temporary diagnostics and profiling specs in ignored scratch space; extract a small durable regression when an investigation finds a bug.

Prefer test-runner-owned fixtures, such as Playwright `test.extend`, over implicit shared pages. Serial mode is for an intentionally dependent scenario, not a side effect of importing a helper. A failed screenshot must not silently prevent unrelated contracts from executing. A fixture's housekeeping should not be counted as separate native acceptance.

## Browser and native boundaries

Specs should read as fixture setup, user action, observation and assertion. Do not scatter `window.openPencil`, store/renderer traversal, internal module URLs or resource-timing module discovery through specs.

Keep unavoidable transport access in a small guarded adapter with named domain operations. Separate:

1. Explicit fixture setup mutations.
2. User interactions through the UI.
3. Read-only serializable observations.
4. Scoped instrumentation with restoration and disposal in `finally`.

Do not replace global digging with a generic `evaluateEditor(callback)` escape hatch or a giant driver exposing the mutable store. Use public named types and precise result projections; do not maintain inconsistent handcrafted copies of node shapes. A UI test must not call the editor action instead of performing the interaction it claims to test. A renderer test may deliberately use a bounded renderer probe because rendering is its subject.

Existing global-based helpers are migration debt, not the preferred API. Migrate a complete domain slice rather than adding forwarding-only wrappers. Test-only browser entrypoints must stay out of production artifacts. Do not enlarge production Window declarations for fixtures or counters. Native adapters retain guarded vendor-typed invocation and the test-only Cargo feature; browser and native drivers need not share an implementation or pretend they support the same capabilities.

## Execution and iteration

Current commands:

| Suite                          | Command                      |
| ------------------------------ | ---------------------------- |
| Engine/unit                    | `bun run test:unit`          |
| Quick unit, parallel           | `bun run test:unit:quick`    |
| Quick unit, per-file isolation | `bun run test:unit:isolated` |
| App browser E2E                | `bun run test`               |
| Storybook browser              | `bun run test:storybook`     |
| Figma acceptance               | `bun run test:figma`         |
| Native WebView                 | `bun run test:native`        |

During implementation, run the affected unit files or one representative browser scenario. Inspect discovery changes without executing the whole suite when reorganizing files. Use the final CI gate after integration; do not rerun full suites for each edit. Report commands actually run, and distinguish focused coverage from full acceptance.

Visual changes require inspection and committed coverage. Update only a justified affected snapshot, then rerun that test without update mode. Never relax tolerances or regenerate unrelated baselines to turn a failed run green. Browser GPU parity and real glyph coverage complement CPU rendering tests; they are not redundant merely because both compare pixels.

## Server ownership and worktrees

The canonical `playwright.config.ts` owns app, Figma and Storybook projects. The `test`, `test:update`, `test:real-llm` and `test:figma` scripts select only the app server; `test:storybook` selects Storybook on port `6017`. Direct Playwright commands start both servers by default. Set `OPENPENCIL_TEST_SERVER=app`, `storybook` or `all`; `--project` selects tests, not servers.

App tests start Vite from the current checkout and wait for its HTTP URL. Vite owns its MCP companion. Reuse is off by default and always off in CI. Default ports are app `1420` and MCP `7600`; concurrent worktrees need distinct free pairs:

```sh
OPENPENCIL_TEST_SERVER=app OPENPENCIL_TEST_PORT=1482 OPENPENCIL_TEST_MCP_PORT=7682 \
  bunx playwright test tests/e2e/properties/effect-panel.spec.ts --project=openpencil
```

Use the configured base URL and same-origin paths, never hard-coded ports in specs or adapters. For intentional debugging against a verified matching server, set `OPENPENCIL_TEST_REUSE_SERVER=1`. HTTP readiness alone does not prove checkout identity, so do not reuse servers for baseline comparisons. Portless remains the preferred interactive preview workflow, separate from managed fixed-port tests.

## External-system acceptance

Storybook uses its own viewport, device scale and reduced-motion context. Its specs are excluded from app projects. Figma acceptance requires the desktop app's configured CDP connection.

Native tests use an explicit test-only binary, separate application identity and test-owned credentials/profile. Never run acceptance against production secrets or clear user recovery data. Skip unsupported platforms rather than claim coverage. Ordinary WebDriver text input, trusted clipboard events, real IME and persistence across restarts are separate contracts.
