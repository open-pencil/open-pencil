# `@open-pencil/fig` package plan

`@open-pencil/fig` is the next package-split stage after `@open-pencil/kiwi`. It should own `.fig` document policy while `@open-pencil/kiwi` remains a pure low-level Kiwi/schema/container package and `@open-pencil/core` remains the editable SceneGraph/editor package.

## Package boundary

| Package | Owns | Must not own |
|---|---|---|
| `@open-pencil/kiwi` | Kiwi schema runtime, Figma Kiwi protocol/schema data, low-level codec, FIG Kiwi containers, GUID helpers, raw parse helpers | SceneGraph conversion, Figma compatibility policy, raw metadata invalidation |
| `@open-pencil/fig` | `.fig` read/write orchestration, raw metadata preservation/invalidation policy, SceneGraph ⇄ NodeChange conversion, component/instance interpretation, fixture/oracle helpers | Editor actions, Vue/app UI, CLI formatting, MCP transport |
| `@open-pencil/core` | SceneGraph data model, renderer, layout, editor actions, tools | Low-level Kiwi codec internals once `@open-pencil/fig` owns `.fig` policy |

## Initial public API sketch

```ts
import { readFig, writeFig } from '@open-pencil/fig'

const document = await readFig(bytes, { preserveRawMetadata: true })
const nextBytes = await writeFig(document.graph, { source: document.source })
```

Potential subpaths:

- `@open-pencil/fig` — high-level `.fig` read/write API
- `@open-pencil/fig/node-change` — SceneGraph ⇄ NodeChange conversion helpers
- `@open-pencil/fig/metadata` — raw metadata protection/invalidation helpers
- `@open-pencil/fig/instances` — component/instance interpretation helpers
- `@open-pencil/fig/oracles` — test-only oracle fixture helpers if they prove reusable outside core tests

Do not expose low-level Kiwi codec names from `@open-pencil/fig`; consumers that need raw codec access should use `@open-pencil/kiwi/fig/*` directly.

## Migration inventory

Candidate code currently in `@open-pencil/core`:

- `packages/core/src/io/formats/fig/**`
- `packages/core/src/kiwi/fig/import.ts`
- `packages/core/src/kiwi/fig/lazy-import.ts`
- `packages/core/src/kiwi/fig/node-change/**`
- `packages/core/src/kiwi/fig/instance-overrides/**`
- `packages/core/src/kiwi/fig/parse/worker.ts`
- `packages/core/src/kiwi/fig/parse/transfer.ts`

Keep these in core until the new package has package-local tests and published-style smoke coverage. Do not move editor-specific operations, renderer code, or app document stores.

## Milestones

### 1. Define package shell

- Add `packages/fig/package.json`, `tsconfig.json`, `tsdown.config.ts`, package-local tests, and `README.md`.
- Depend on `@open-pencil/core` for SceneGraph types and `@open-pencil/kiwi` for low-level FIG/Kiwi helpers.
- Add package metadata checks and tarball smoke imports before moving behavior.

### 2. Move pure `.fig` orchestration helpers

- Move read/write orchestration wrappers that do not depend on app/editor state.
- Preserve current core public exports with thin compatibility barrels only where public API stability requires them.
- Avoid deep compatibility shims for private paths.

### 3. Move NodeChange conversion policy

- Move SceneGraph ⇄ NodeChange conversion modules with tests covering:
  - text styles and glyph metadata
  - boolean operation `EXCLUDE` ⇄ Kiwi `XOR`
  - fills/strokes/effects raw field preservation
  - masks and component metadata
  - variable bindings and style refs

### 4. Move raw metadata invalidation/protection

- Centralize source metadata invalidation rules in `@open-pencil/fig`.
- Keep tests that mutate SceneGraph fields and verify stale raw fields are invalidated.
- Preserve real Figma/oracle evidence in fixtures rather than guessing schema fields.

### 5. Move instance/component interpretation

- Move component props, derived symbol data, instance override resolution, and sync helpers once NodeChange conversion is stable.
- Keep package-local fixtures for component sets, variants, nested instances, and override propagation.

### 6. Rewire core consumers

- Make core import `.fig` policy through public `@open-pencil/fig` exports.
- Keep app, CLI, and MCP consuming core-level document APIs unless a direct `@open-pencil/fig` import is clearly better.
- Run architecture checks to ensure package boundaries stay acyclic.

## Tests and smoke coverage

Each milestone should keep these passing:

```sh
bun run check
bun scripts/smoke-packages.ts
bun test packages/fig/tests
bun test tests/engine/io/fig
bun test tests/engine/kiwi
```

The smoke script should eventually cover:

- `await import('@open-pencil/fig')`
- `await import('@open-pencil/fig/node-change')`
- a minimal `.fig` read/write round trip through packed packages

## Non-goals

- Do not move browser/app file picker logic into `@open-pencil/fig`.
- Do not move renderer behavior or visual comparison scripts into `@open-pencil/fig` unless they become package-local test utilities.
- Do not guess unsupported Figma schema fields. Use Figma/oracle payloads first.
- Do not merge `@open-pencil/fig` and `@open-pencil/kiwi`; the low-level codec package must remain SceneGraph-agnostic.
